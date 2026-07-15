/**
 * Library search: exact match + variant forms + same-component relatives + practice aliases.
 */

import { practiceSuggestionsFor } from './practiceAliases.js';

/**
 * @typedef {{ variants?: string[], related?: string[] }} Relation
 * @typedef {{ char: string, kind: 'exact' | 'variant' | 'related' }} SearchHit
 */

/**
 * @param {string} query
 * @param {{
 *   available: Set<string>,
 *   relations: Record<string, Relation>,
 *   extractHanzi: (text: string) => string[],
 * }} ctx
 * @returns {{
 *   hits: SearchHit[],
 *   counts: { total: number, exact: number, variant: number, related: number },
 *   queryChars: string[],
 *   unsupported: string[],
 * }}
 */
export function searchLibrary(query, { available, relations, extractHanzi }) {
  const queryChars = extractHanzi(query);
  if (!queryChars.length) {
    return {
      hits: [],
      counts: { total: 0, exact: 0, variant: 0, related: 0 },
      queryChars: [],
      unsupported: [],
    };
  }

  /** @type {Map<string, SearchHit>} */
  const byChar = new Map();

  const add = (char, kind) => {
    if (!available.has(char)) return;
    const prev = byChar.get(char);
    const rank = { exact: 0, variant: 1, related: 2 };
    if (!prev || rank[kind] < rank[prev.kind]) {
      byChar.set(char, { char, kind });
    }
  };

  /** @type {string[]} */
  const unsupported = [];

  for (const q of queryChars) {
    if (available.has(q)) {
      add(q, 'exact');
    } else {
      unsupported.push(q);
    }

    // Known rare → common practice forms
    for (const alt of practiceSuggestionsFor(q)) add(alt, 'variant');

    const rel = relations[q] || {};
    for (const v of rel.variants || []) add(v, 'variant');
    for (const r of rel.related || []) add(r, 'related');

    for (const v of rel.variants || []) {
      const vRel = relations[v] || {};
      add(v, 'variant');
      for (const r of vRel.related || []) add(r, 'related');
    }

    // Also surface variants of suggested practice forms
    for (const alt of practiceSuggestionsFor(q)) {
      const altRel = relations[alt] || {};
      for (const v of altRel.variants || []) add(v, 'variant');
      for (const r of altRel.related || []) add(r, 'related');
    }
  }

  const hits = [...byChar.values()].sort((a, b) => {
    const rank = { exact: 0, variant: 1, related: 2 };
    if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind];
    return a.char.localeCompare(b.char, 'zh');
  });

  const counts = {
    total: hits.length,
    exact: hits.filter((h) => h.kind === 'exact').length,
    variant: hits.filter((h) => h.kind === 'variant').length,
    related: hits.filter((h) => h.kind === 'related').length,
  };

  return { hits, counts, queryChars, unsupported };
}
