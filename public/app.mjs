import { extractCitations, MAX_TEXT_LENGTH, MAX_SELECTION, ROLES, SAMPLE_TEXT } from './citations.mjs';

// Dependency injection keeps interface tests fully offline; production uses the same code.
export function createApp(doc = document, fetchImpl = (...args) => fetch(...args), waitMs = 28000) {
  const byId = id => doc.getElementById(id);
  const ui = Object.fromEntries(['opinion', 'extract', 'sample', 'clear', 'analyze', 'characters',
    'sample-notice', 'summary', 'status', 'error', 'results'].map(id => [id, byId(id)]));
  let citations = [];
  let extractedText = '';
  let busy = false;
  const selected = new Set();
  const analyses = new Map();
  const checkboxes = new Map();
  const views = new Map();

  function say(text) { ui.status.textContent = text; }
  function fail(text) { ui.error.textContent = text; ui.error.hidden = false; }
  function clearError() { ui.error.textContent = ''; ui.error.hidden = true; }
  function syncControls() {
    for (const name of ['extract', 'sample', 'clear', 'opinion']) ui[name].disabled = busy;
    ui.analyze.disabled = busy || !selected.size || extractedText !== ui.opinion.value;
    ui.analyze.textContent = busy ? 'Analyzing…' : 'Analyze citations';
    ui.results.setAttribute('aria-busy', String(busy));
    for (const [citation, checkbox] of checkboxes) {
      checkbox.disabled = busy || (!selected.has(citation) && selected.size >= MAX_SELECTION);
    }
    ui.summary.textContent = citations.length
      ? `${citations.length} unique citation${citations.length === 1 ? '' : 's'} found · ${selected.size} selected`
      : 'Extract citations to see their surrounding passages.';
  }
  function node(tag, className, text) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function renderCards() {
    ui.results.replaceChildren(); checkboxes.clear(); views.clear();
    citations.forEach((item, index) => {
      const card = node('article', 'citation-card');
      const header = node('div', 'card-header');
      const label = node('label', 'citation-choice');
      const checkbox = node('input');
      checkbox.type = 'checkbox'; checkbox.checked = selected.has(item.citation);
      checkbox.id = `citation-${index}`;
      label.htmlFor = checkbox.id;
      label.append(checkbox, node('span', 'citation-name', item.citation));
      checkbox.addEventListener('change', () => {
        if (busy) return;
        if (checkbox.checked && selected.size < MAX_SELECTION) selected.add(item.citation);
        else { selected.delete(item.citation); checkbox.checked = false; }
        syncControls();
      });
      checkboxes.set(item.citation, checkbox);
      const role = node('span', 'badge', 'Awaiting analysis');
      header.append(label, role);
      const columns = node('div', 'columns');
      const source = node('div'); source.append(node('h3', '', 'Source passage'));
      for (const passage of item.passages) {
        source.append(node('blockquote', 'source-passage',
          (passage.start ? '…' : '') + passage.text + (passage.end < extractedText.length ? '…' : '')));
      }
      source.append(node('p', 'occurrences', `${item.occurrences} reference${item.occurrences === 1 ? '' : 's'} in text · up to three surrounding excerpts shown`));
      const interpretation = node('div'); interpretation.append(node('h3', '', 'AI explanation · tentative'));
      const explanation = node('p', 'explanation', 'Select this citation and click Analyze citations.');
      interpretation.append(explanation);
      columns.append(source, interpretation); card.append(header, columns); ui.results.append(card);
      views.set(item.citation, {role, explanation});
    });
    updateAnalyses(); syncControls();
  }
  function updateAnalyses() {
    for (const [citation, result] of analyses) {
      const view = views.get(citation);
      if (view) { view.role.textContent = `Tentative role: ${result.role}`; view.explanation.textContent = result.explanation; }
    }
  }
  function reset() {
    citations = []; extractedText = ''; selected.clear(); analyses.clear(); checkboxes.clear(); views.clear();
    ui.results.replaceChildren(); clearError();
    ui.characters.textContent = `${ui.opinion.value.length.toLocaleString()} / 60,000`;
    syncControls();
  }
  ui.opinion.addEventListener('input', () => {
    if (busy) return;
    reset(); ui['sample-notice'].hidden = true;
    say('Text changed. Extract citations to update the passages.');
  });
  ui.extract.addEventListener('click', () => {
    if (busy) return;
    reset();
    if (!ui.opinion.value.trim()) { say('Paste some text or load the sample passage first.'); return; }
    if (ui.opinion.value.length > MAX_TEXT_LENGTH) { fail('Please shorten the text to 60,000 characters.'); return; }
    extractedText = ui.opinion.value; citations = extractCitations(extractedText);
    citations.slice(0, MAX_SELECTION).forEach(item => selected.add(item.citation));
    renderCards();
    say(citations.length ? 'Passages extracted locally. Select up to five citations for AI analysis.' : 'No common reporter citations found. Unusual formats may be missed.');
  });
  ui.sample.addEventListener('click', () => {
    if (busy) return;
    ui.opinion.value = SAMPLE_TEXT; reset(); ui['sample-notice'].hidden = false;
    say('Sample passage loaded. Click Extract citations.'); ui.opinion.focus();
  });
  ui.clear.addEventListener('click', () => {
    if (busy) return;
    ui.opinion.value = ''; reset(); ui['sample-notice'].hidden = true;
    say('Cleared. Ready for your text.'); ui.opinion.focus();
  });

  async function analyze() {
    if (busy || !selected.size || extractedText !== ui.opinion.value) return;
    busy = true; clearError(); syncControls();
    const requested = [...selected];
    say(`Analyzing ${requested.length} citation${requested.length === 1 ? '' : 's'} in one AI request…`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), waitMs);
    const progress = setTimeout(() => say('Still waiting for the free model. Your request is in progress…'), 9000);
    try {
      const response = await fetchImpl('/.netlify/functions/analyze', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, signal: controller.signal,
        body: JSON.stringify({text: extractedText, citations: requested})
      });
      if (!response.ok) {
        // Error pages and upstream strings are never rendered. Map only known status codes.
        const messages = {400: 'The request was not valid. Extract the citations again.',
          413: 'The passage is too large. Please shorten it.', 415: 'The server needs a JSON request.',
          429: 'The request limit was reached. Wait a minute and try again.',
          503: 'AI analysis is unavailable. The site owner may need to configure the server key, or the free service may be unavailable.',
          504: 'The free model took too long. Please try again later.'};
        throw new Error(messages[response.status] || 'AI analysis failed. Please try again later.');
      }
      const data = await response.json();
      if (!Array.isArray(data.results) || data.results.length !== requested.length) throw new Error('The server returned an incomplete analysis. Please try again.');
      const received = new Set();
      for (const row of data.results) {
        if (!row || !requested.includes(row.citation) || received.has(row.citation) || !ROLES.includes(row.role) ||
            typeof row.explanation !== 'string' || !row.explanation.trim() || row.explanation.length > 700) {
          throw new Error('The server returned an invalid analysis. Please try again.');
        }
        received.add(row.citation);
      }
      for (const row of data.results) analyses.set(row.citation, row);
      updateAnalyses();
      say(`Analysis complete for ${requested.length} citation${requested.length === 1 ? '' : 's'}. Review the tentative interpretation beside the source.`);
    } catch (error) {
      // Never expose raw network exceptions, response bodies, or document text in error messages.
      const safe = new Set(['The request was not valid. Extract the citations again.', 'The passage is too large. Please shorten it.',
        'The server needs a JSON request.', 'The request limit was reached. Wait a minute and try again.',
        'AI analysis is unavailable. The site owner may need to configure the server key, or the free service may be unavailable.',
        'The free model took too long. Please try again later.', 'AI analysis failed. Please try again later.',
        'The server returned an incomplete analysis. Please try again.', 'The server returned an invalid analysis. Please try again.']);
      fail(controller.signal.aborted ? 'The request timed out. Please try again later.' :
        safe.has(error.message) ? error.message : 'Could not reach the analysis service. Use the deployed Netlify site or a local preview server.');
      say('Analysis did not finish. Existing results have been kept.');
    } finally {
      clearTimeout(timeout); clearTimeout(progress); busy = false; syncControls();
    }
  }
  ui.analyze.addEventListener('click', analyze);
  reset();
  return {analyze};
}

if (typeof document !== 'undefined') createApp();
