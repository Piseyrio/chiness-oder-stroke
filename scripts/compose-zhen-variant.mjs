/**
 * Compose traditional variant 鉁 (U+9241) from 金 + 㐱 for Hanzi Writer.
 * Layout: left radical 金 (~45%) + right 㐱 (~52%).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = dirname(require.resolve("hanzi-writer-data/package.json"));

function load(ch) {
  return JSON.parse(readFileSync(join(dataDir, `${ch}.json`), "utf8"));
}

function pathBounds(path) {
  const nums = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function charBounds(charData) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of charData.strokes) {
    const b = pathBounds(s);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY };
}

function transformPath(path, sx, sy, dx, dy) {
  let i = 0;
  return path.replace(/-?\d+(?:\.\d+)?/g, (n) => {
    const v = Number(n);
    const even = i % 2 === 0;
    i += 1;
    return String(Math.round((even ? v * sx + dx : v * sy + dy) * 10) / 10);
  });
}

function transformMedian(median, sx, sy, dx, dy) {
  return median.map(([x, y]) => [
    Math.round((x * sx + dx) * 10) / 10,
    Math.round((y * sy + dy) * 10) / 10,
  ]);
}

function fitPart(part, target) {
  const b = charBounds(part);
  const bw = Math.max(1, b.maxX - b.minX);
  const bh = Math.max(1, b.maxY - b.minY);
  const tw = target.maxX - target.minX;
  const th = target.maxY - target.minY;
  const s = Math.min(tw / bw, th / bh) * 0.92;
  const dx = target.minX + (tw - bw * s) / 2 - b.minX * s;
  const dy = target.minY + (th - bh * s) / 2 - b.minY * s;
  return {
    strokes: part.strokes.map((p) => transformPath(p, s, s, dx, dy)),
    medians: part.medians.map((m) => transformMedian(m, s, s, dx, dy)),
  };
}

const jin = load("金");
const zhen = load("㐱");

const left = fitPart(jin, { minX: 28, minY: 95, maxX: 455, maxY: 905 });
const right = fitPart(zhen, { minX: 470, minY: 70, maxX: 970, maxY: 930 });

const out = {
  strokes: [...left.strokes, ...right.strokes],
  medians: [...left.medians, ...right.medians],
};

const outDir = join(root, "public", "custom-hanzi-data");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "鉁.json");
writeFileSync(outPath, `${JSON.stringify(out)}\n`, "utf8");

const customChars = readdirSync(outDir)
  .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
  .map((name) => name.slice(0, -".json".length));
writeFileSync(
  join(outDir, "_index.json"),
  `${JSON.stringify({ characters: customChars })}\n`,
  "utf8",
);

const b = charBounds(out);
console.log("Wrote", outPath);
console.log("strokes:", out.strokes.length, "medians:", out.medians.length);
console.log("bounds:", b);
console.log("custom index:", customChars.join(" "));
console.log("median0 sample:", out.medians[0].slice(0, 3));
console.log("stroke0 head:", out.strokes[0].slice(0, 60));
