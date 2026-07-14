/**
 * Library search: exact match + variant forms + same-component relatives.
 */

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
 * @returns {{ hits: SearchHit[], counts: { total: number, exact: number, variant: number, related: number }, queryChars: string[] }}
 */
export function searchLibrary(query, { available, relations, extractHanzi }) {
  const queryChars = extractHanzi(query);
  if (!queryChars.length) {
    return {
      hits: [],
      counts: { total: 0, exact: 0, variant: 0, related: 0 },
      queryChars: [],
    };
  }

  /** @type {Map<string, SearchHit>} */
  const byChar = new Map();

  const add = (char, kind) => {
    if (!available.has(char)) return;
    const prev = byChar.get(char);
    // Prefer exact > variant > related
    const rank = { exact: 0, variant: 1, related: 2 };
    if (!prev || rank[kind] < rank[prev.kind]) {
      byChar.set(char, { char, kind });
    }
  };

  for (const q of queryChars) {
    add(q, 'exact');
    const rel = relations[q] || {};
    for (const v of rel.variants || []) add(v, 'variant');
    for (const r of rel.related || []) add(r, 'related');

    // Also include relatives/variants of the traditional form, etc.
    for (const v of rel.variants || []) {
      const vRel = relations[v] || {};
      add(v, 'variant');
      for (const r of vRel.related || []) add(r, 'related');
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

  return { hits, counts, queryChars };
}
