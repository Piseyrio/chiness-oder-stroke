/**
 * Rare / variant forms → extra search suggestions (related practice glyphs).
 * Characters listed in public/custom-hanzi-data have real stroke data and
 * appear as exact matches; aliases here only surface related forms.
 */
export const PRACTICE_ALIASES = {
  // Custom traditional 鉁 still suggests modern 珍 for related practice
  鉁: ['珍'],
  𨱅: ['珍', '鉁'],
};

/**
 * @param {string} char
 * @returns {string[]}
 */
export function practiceSuggestionsFor(char) {
  return PRACTICE_ALIASES[char] || [];
}
