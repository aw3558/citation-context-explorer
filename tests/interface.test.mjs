import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../public/app.mjs';
import { SAMPLE_TEXT } from '../public/citations.mjs';

// Small DOM double for deterministic handler tests. Browser QA is reported separately.
class Element {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.events = {}; this.attrs = {}; this.value = ''; this.hidden = false; this.disabled = false; this.checked = false; this._text = ''; }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw new Error('Unsafe HTML rendering used'); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  addEventListener(name, fn) { this.events[name] = fn; }
  setAttribute(name, value) { this.attrs[name] = value; }
  focus() { this.focused = true; }
  emit(name = 'click') { return this.events[name]?.(); }
}
function setup(fetchImpl, waitMs) {
  const ids = ['opinion', 'extract', 'sample', 'clear', 'analyze', 'characters', 'sample-notice', 'summary', 'status', 'error', 'results'];
  const ui = Object.fromEntries(ids.map(id => [id, new Element()]));
  const doc = {getElementById: id => ui[id], createElement: tag => new Element(tag)};
  const app = createApp(doc, fetchImpl || (() => { throw new Error('Unexpected request'); }), waitMs);
  return {ui, app};
}
function descendants(element) { return element.children.flatMap(child => [child, ...descendants(child)]); }
function sample(ui) { ui.sample.emit(); ui.extract.emit(); }
const responseFor = citations => new Response(JSON.stringify({results: citations.map(citation => ({citation, role: 'background', explanation: 'Mock explanation.'}))}));

test('sample, extraction, deduplication, source passages, and Clear work without AI', () => {
  const {ui} = setup(); sample(ui);
  assert.equal(ui.opinion.value, SAMPLE_TEXT); assert.equal(ui['sample-notice'].hidden, false);
  assert.equal(ui.results.children.length, 2); assert.match(ui.summary.textContent, /2 unique citations found · 2 selected/);
  assert.match(ui.results.textContent, /347 U.S. 483/); assert.match(ui.results.textContent, /equal-protection/);
  assert.equal(ui.analyze.disabled, false);
  ui.clear.emit(); assert.equal(ui.opinion.value, ''); assert.equal(ui.results.children.length, 0);
  assert.equal(ui.analyze.disabled, true); assert.equal(ui.opinion.focused, true);
});
test('blank and no-match inputs show clear feedback', () => {
  const {ui} = setup(); ui.extract.emit(); assert.match(ui.status.textContent, /Paste some text/);
  ui.opinion.value = 'No case references here.'; ui.extract.emit();
  assert.match(ui.status.textContent, /No common reporter citations/); assert.equal(ui.analyze.disabled, true);
});
test('editing input invalidates stale citations and analyses', () => {
  const {ui} = setup(); sample(ui); ui.opinion.value = 'new text'; ui.opinion.emit('input');
  assert.equal(ui.results.children.length, 0); assert.equal(ui.analyze.disabled, true);
});
test('first five citations selected; a sixth can be selected after one is deselected', () => {
  const {ui} = setup(); ui.opinion.value = Array.from({length: 6}, (_, i) => `${i + 1} U.S. ${i + 1}`).join('; '); ui.extract.emit();
  const boxes = descendants(ui.results).filter(x => x.tagName === 'input');
  assert.equal(boxes.length, 6); assert.equal(boxes.filter(x => x.checked).length, 5); assert.equal(boxes[5].disabled, true);
  boxes[0].checked = false; boxes[0].emit('change'); assert.equal(boxes[5].disabled, false);
  boxes[5].checked = true; boxes[5].emit('change'); assert.match(ui.summary.textContent, /5 selected/);
});
test('busy state prevents duplicate submissions and disables editing until the request finishes', async () => {
  let finish; let calls = 0;
  const {ui, app} = setup(async (url, options) => {
    calls++; assert.equal(url, '/.netlify/functions/analyze');
    assert.deepEqual(Object.keys(JSON.parse(options.body)), ['text', 'citations']);
    return new Promise(resolve => { finish = () => resolve(responseFor(JSON.parse(options.body).citations)); });
  });
  sample(ui); const pending = app.analyze(); await app.analyze();
  assert.equal(calls, 1); assert.equal(ui.analyze.disabled, true); assert.equal(ui.opinion.disabled, true);
  assert.equal(ui.clear.disabled, true); assert.equal(ui.results.attrs['aria-busy'], 'true');
  finish(); await pending;
  assert.match(ui.status.textContent, /Analysis complete/); assert.match(ui.results.textContent, /Tentative role: background/);
  assert.equal(ui.opinion.disabled, false); assert.equal(ui.results.attrs['aria-busy'], 'false');
});
test('pasted markup and model explanations are rendered only as text', async () => {
  const unsafe = '<img src=x onerror=alert(1)>';
  const {ui, app} = setup(async () => new Response(JSON.stringify({results: [{citation: '347 U.S. 483', role: 'unclear', explanation: unsafe}]})));
  ui.opinion.value = `347 U.S. 483 ${unsafe}`; ui.extract.emit(); await app.analyze();
  assert.match(ui.results.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.ok(!descendants(ui.results).some(x => x.tagName === 'img'));
});
test('rate limit, missing key, provider errors, and HTML error pages produce clear messages', async () => {
  for (const [status, expected] of [[429, /limit/], [503, /unavailable/], [502, /failed/], [504, /too long/]]) {
    const {ui, app} = setup(async () => new Response('<html>raw upstream error</html>', {status}));
    sample(ui); await app.analyze(); assert.equal(ui.error.hidden, false); assert.match(ui.error.textContent, expected);
    assert.ok(!ui.error.textContent.includes('raw upstream')); assert.equal(ui.analyze.disabled, false);
  }
});
test('malformed or incomplete success responses are rejected without partial rendering', async () => {
  for (const body of ['not JSON', JSON.stringify({results: []}), JSON.stringify({results: [
    {citation: '347 U.S. 483', role: 'paid-model', explanation: 'Invalid.'},
    {citation: '384 U.S. 436', role: 'background', explanation: 'Valid.'}]})]) {
    const {ui, app} = setup(async () => new Response(body)); sample(ui); await app.analyze();
    assert.equal(ui.error.hidden, false); assert.ok(!ui.results.textContent.includes('Tentative role:'));
  }
});
test('client timeout restores controls', async () => {
  const {ui, app} = setup((_, {signal}) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), {once: true})), 5);
  sample(ui); await app.analyze(); assert.match(ui.error.textContent, /timed out/); assert.equal(ui.opinion.disabled, false);
});
test('network failures are sanitized and controls recover', async () => {
  const {ui, app} = setup(async () => { throw new Error('private diagnostic'); }); sample(ui); await app.analyze();
  assert.match(ui.error.textContent, /Could not reach/); assert.ok(!ui.error.textContent.includes('private diagnostic'));
  assert.equal(ui.analyze.disabled, false);
});
