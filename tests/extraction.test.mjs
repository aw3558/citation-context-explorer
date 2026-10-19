import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCitations, SAMPLE_TEXT } from '../public/citations.mjs';

test('sample has two unique citations and deduplicates repeated Brown', () => {
  const found = extractCitations(SAMPLE_TEXT);
  assert.deepEqual(found.map(x => x.citation), ['347 U.S. 483', '384 U.S. 436']);
  assert.equal(found[0].occurrences, 2);
});
test('normalizes spaces, newlines, case, and reporter punctuation', () => {
  assert.deepEqual(extractCitations('347 U. S. 483; 347 US\n483; 347 u.s. 483').map(x => x.citation), ['347 U.S. 483']);
});
test('matches federal, regional, and state reporter examples', () => {
  const text = '12 F.4th 20; 99 F. Supp. 3d 120; 10 N.E.2d 40; 7 Cal. App. 5th 80; 5 N.Y.3d 20';
  assert.deepEqual(extractCitations(text).map(x => x.citation), text.split('; '));
});
test('source windows remain verbatim, bounded, and capped at three', () => {
  const text = Array.from({length: 6}, (_, i) => `${i}: 347 U.S. 483 ${'x'.repeat(1000)} `).join('');
  const [item] = extractCitations(text);
  assert.equal(item.occurrences, 6); assert.equal(item.passages.length, 3);
  for (const p of item.passages) { assert.equal(p.text, text.slice(p.start, p.end)); assert.ok(p.text.length <= 760); }
});
test('empty or non-citation text returns no matches; repeated calls remain stable', () => {
  assert.deepEqual(extractCitations(''), []); assert.deepEqual(extractCitations('No citations.'), []);
  assert.deepEqual(extractCitations(SAMPLE_TEXT), extractCitations(SAMPLE_TEXT));
});
