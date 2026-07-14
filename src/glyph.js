import { getScalingTransform } from './strokeData.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CHAR_BOX = 100;

/**
 * Create an SVG showing the stroke-library glyph (same paths as the sheet).
 * @param {string[]} strokePaths
 * @param {{ className?: string, fill?: string }} [opts]
 */
export function createGlyphSvg(strokePaths, opts = {}) {
  const { className = 'glyph-svg', fill = 'currentColor' } = opts;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', `0 0 ${CHAR_BOX} ${CHAR_BOX}`);
  svg.setAttribute('aria-hidden', 'true');

  const group = document.createElementNS(SVG_NS, 'g');
  const { transform } = getScalingTransform(CHAR_BOX, 2);
  group.setAttribute('transform', transform);

  for (const d of strokePaths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.style.fill = fill;
    group.appendChild(path);
  }

  svg.appendChild(group);
  return svg;
}
