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
const outPath = path.join(root, 'public', 'char-relations.json');

hanzi.start();

const available = new Set(
  fs
    .readdirSync(dataDir)
    .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
    .map((name) => name.slice(0, -'.json'.length))
    .filter(Boolean),
);

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
fs.writeFileSync(outPath, JSON.stringify(relations));
console.log(
  `Wrote ${outPath} (${Object.keys(relations).length} entries with variants/related)`,
);
