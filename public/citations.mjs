// Shared by the browser and server: ordinary reporter matching, not authority verification.
export const MAX_TEXT_LENGTH = 60000;
export const MAX_SELECTION = 5;
export const MAX_PASSAGES = 3;
export const ROLES = ["supporting authority", "distinguishing", "criticism", "background", "unclear"];
export const SAMPLE_TEXT = `SAMPLE PASSAGE — written for this app; not an actual court opinion.

This essay invokes Brown v. Board of Education, 347 U.S. 483 (1954), as supporting authority for the proposition that racial segregation in public schools violates equal protection. Its discussion uses Brown to support that proposition; it does not examine the full opinion.

The essay also discusses Miranda v. Arizona, 384 U.S. 436 (1966), as background to the development of safeguards during custodial interrogation. It summarizes the historical setting without deciding whether Miranda controls a particular dispute.

Returning to Brown, 347 U.S. 483, 495 (1954), the author again relies on its school-segregation holding to support the essay's equal-protection argument.`;

const REPORTERS = [
  ["U.S.", "U\\.?\\s*S\\.?"],
  ["S. Ct.", "S\\.?\\s*Ct\\.?"],
  ["L. Ed. 2d", "L\\.?\\s*Ed\\.?\\s*2d"],
  ["L. Ed.", "L\\.?\\s*Ed\\.?"],
  ["F. Supp. 3d", "F\\.?\\s*Supp\\.?\\s*3d"],
  ["F. Supp. 2d", "F\\.?\\s*Supp\\.?\\s*2d"],
  ["F. Supp.", "F\\.?\\s*Supp\\.?"],
  ["F.4th", "F\\.?\\s*4th"],
  ["F.3d", "F\\.?\\s*3d"],
  ["F.2d", "F\\.?\\s*2d"],
  ["F.", "F\\."],
  ["A.3d", "A\\.?\\s*3d"], ["A.2d", "A\\.?\\s*2d"], ["A.", "A\\."],
  ["P.3d", "P\\.?\\s*3d"], ["P.2d", "P\\.?\\s*2d"], ["P.", "P\\."],
  ["N.E.3d", "N\\.?\\s*E\\.?\\s*3d"], ["N.E.2d", "N\\.?\\s*E\\.?\\s*2d"], ["N.E.", "N\\.?\\s*E\\.?"],
  ["N.W.2d", "N\\.?\\s*W\\.?\\s*2d"], ["N.W.", "N\\.?\\s*W\\.?"],
  ["S.E.2d", "S\\.?\\s*E\\.?\\s*2d"], ["S.E.", "S\\.?\\s*E\\.?"],
  ["S.W.3d", "S\\.?\\s*W\\.?\\s*3d"], ["S.W.2d", "S\\.?\\s*W\\.?\\s*2d"], ["S.W.", "S\\.?\\s*W\\.?"],
  ["So. 3d", "So\\.?\\s*3d"], ["So. 2d", "So\\.?\\s*2d"], ["So.", "So\\.?"],
  ["N.Y.3d", "N\\.?\\s*Y\\.?\\s*3d"], ["N.Y.2d", "N\\.?\\s*Y\\.?\\s*2d"], ["N.Y.", "N\\.?\\s*Y\\.?"],
  ["Cal. App. 5th", "Cal\\.?\\s*App\\.?\\s*5th"], ["Cal. App. 4th", "Cal\\.?\\s*App\\.?\\s*4th"],
  ["Cal. 5th", "Cal\\.?\\s*5th"], ["Cal. 4th", "Cal\\.?\\s*4th"],
  ["Cal. 3d", "Cal\\.?\\s*3d"], ["Cal. 2d", "Cal\\.?\\s*2d"], ["Cal.", "Cal\\.?"]
];
const CITATION_PATTERN = new RegExp(
  "\\b(\\d{1,4})\\s+(" + REPORTERS.map(([, pattern]) => pattern).join("|") + ")\\s+(\\d{1,6})\\b", "gi"
);
const reporterMatchers = REPORTERS.map(([name, pattern]) => [name, new RegExp("^(?:" + pattern + ")$", "i")]);


export function extractCitations(text) {
  const found = new Map();
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const reporter = reporterMatchers.find(([, pattern]) => pattern.test(match[2]))[0];
    const citation = `${match[1]} ${reporter} ${match[3]}`;
    if (!found.has(citation)) found.set(citation, {citation, occurrences: 0, passages: []});
    const item = found.get(citation);
    item.occurrences++;
    // Keep separate, verbatim windows for at most three non-overlapping occurrences.
    const start = Math.max(0, match.index - 280);
    const end = Math.min(text.length, match.index + match[0].length + 280);
    const previous = item.passages.at(-1);
    if (previous && start <= previous.end) {
      // Do not grow a window indefinitely for dense citation lists.
      if (end - previous.start <= 760) {
        previous.end = end;
        previous.text = text.slice(previous.start, end);
      } else if (match.index < previous.end) {
        continue;
      } else if (item.passages.length < MAX_PASSAGES) {
        item.passages.push({start, end, text: text.slice(start, end)});
      }
    } else if (item.passages.length < MAX_PASSAGES) {
      item.passages.push({start, end, text: text.slice(start, end)});
    }
  }
  return [...found.values()];
}
