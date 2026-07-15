/**
 * Builds public/char-relations.json: for each stroke-library character,
 * its variant forms and characters that share it as a component.
 * Run via: node scripts/generate-search-index.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const hanzi = require('hanzi');
const Yitizi = require('yitizi');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'node_modules', 'hanzi-writer-data');
const customDataDir = path.join(root, 'public', 'custom-hanzi-data');
const outPath = path.join(root, 'public', 'char-relations.json');

hanzi.start();

function listChars(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
    .map((name) => name.slice(0, -'.json'.length))
    .filter(Boolean);
}

const available = new Set([...listChars(dataDir), ...listChars(customDataDir)]);


/** @type {Record<string, { variants: string[], related: string[] }>} */
const relations = {};

for (const char of available) {
  const variants = [...new Set(Yitizi.get(char) || [])].filter(
    (c) => c !== char && available.has(c),
  );

  let related = [];
  try {
    related = [...new Set(hanzi.getCharactersWithComponent(char) || [])].filter(
      (c) => c !== char && available.has(c),
    );
  } catch {
    related = [];
  }

  if (variants.length || related.length) {
    relations[char] = { variants, related };
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });

// Manual links for custom / rare glyphs composed outside Make Me A Hanzi
if (available.has('鉁') && available.has('珍')) {
  const entry = relations['鉁'] || { variants: [], related: [] };
  entry.variants = [...new Set([...(entry.variants || []), '珍'])];
  relations['鉁'] = entry;

  const zhen = relations['珍'] || { variants: [], related: [] };
  zhen.variants = [...new Set([...(zhen.variants || []), '鉁'])];
  relations['珍'] = zhen;
}

fs.writeFileSync(outPath, JSON.stringify(relations));
console.log(
  `Wrote ${outPath} (${Object.keys(relations).length} entries with variants/related)`,
);
