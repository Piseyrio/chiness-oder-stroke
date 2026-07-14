/**
 * Extract unique Han characters from text, in order of first appearance.
 * @param {string} text
 * @returns {string[]}
 */
export function uniqueCharsFromText(text) {
  const seen = new Set();
  const out = [];
  for (const ch of text) {
    if (!/\p{Script=Han}/u.test(ch)) continue;
    if (seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
  }
  return out;
}
