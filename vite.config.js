import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'node_modules', 'hanzi-writer-data');

/** @type {string[] | null} */
let cachedIndex = null;

function getCharIndex() {
  if (cachedIndex) return cachedIndex;
  cachedIndex = fs
    .readdirSync(dataDir)
    .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
    .map((name) => name.slice(0, -'.json'.length))
    .filter((char) => char.length > 0);
  return cachedIndex;
}

function hanziDataMiddleware(req, res, next) {
  try {
    const rawPath = (req.url || '/').split('?')[0];
    const name = decodeURIComponent(rawPath.slice(1).replace(/\.json$/, ''));

    if (name === '_index') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ characters: getCharIndex() }));
      return;
    }

    if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
      res.statusCode = 400;
      res.end('Bad request');
      return;
    }
    const filePath = path.join(dataDir, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    fs.createReadStream(filePath).pipe(res);
  } catch {
    next();
  }
}

function serveHanziData() {
  return {
    name: 'serve-hanzi-data',
    configureServer(server) {
      server.middlewares.use('/hanzi-data', hanziDataMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/hanzi-data', hanziDataMiddleware);
    },
  };
}

export default defineConfig({
  plugins: [serveHanziData()],
});
