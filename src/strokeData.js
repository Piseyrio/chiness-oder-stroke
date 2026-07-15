import HanziWriter from 'hanzi-writer';

const cache = new Map();

/**
 * Load stroke path data for a character.
 * Order: custom overrides → local /hanzi-data → HanziWriter CDN.
 * @param {string} char
 * @returns {Promise<{ strokes: string[], medians: number[][][] }>}
 */
export async function loadCharacterData(char) {
  if (cache.has(char)) {
    return cache.get(char);
  }

  const promise = (async () => {
    const urls = [
      `/custom-hanzi-data/${encodeURIComponent(char)}.json`,
      `/hanzi-data/${encodeURIComponent(char)}.json`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          return await res.json();
        }
      } catch {
        // try next source
      }
    }

    try {
      return await HanziWriter.loadCharacterData(char);
    } catch {
      throw new Error(`No stroke data for “${char}”`);
    }
  })();

  cache.set(char, promise);
  try {
    return await promise;
  } catch (err) {
    cache.delete(char);
    throw err;
  }
}

/**
 * SVG transform string to fit Make-Me-A-Hanzi paths into a square.
 * @param {number} size
 * @param {number} [padding]
 */
export function getScalingTransform(size, padding = 0) {
  return HanziWriter.getScalingTransform(size, size, padding);
}
