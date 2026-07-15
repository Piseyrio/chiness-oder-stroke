import { getScalingTransform } from './strokeData.js';

const COLS = 10;
const ROWS = 14;
const SVG_NS = 'http://www.w3.org/2000/svg';
/** ViewBox size for character SVG inside each cell (arbitrary; scaled by CSS). */
const CHAR_BOX = 100;

/**
 * Expand sheet items into abstract grid rows.
 * Blank items (`strokes` empty + `blank: true`) become one empty practice bar.
 * @param {Array<{ char?: string, strokes: string[], blank?: boolean, sourceIndex?: number }>} loaded
 * @param {{ guideStyle?: 'stroke' | 'font' }} [opts]
 * @returns {Array<Array<{ type: 'empty' | 'master' | 'guide', strokes: string[], char?: string, sourceIndex?: number }>>}
 */
export function buildContentRows(loaded, opts = {}) {
  const guideStyle = opts.guideStyle === 'font' ? 'font' : 'stroke';
  /** @type {Array<Array<{ type: 'empty' | 'master' | 'guide', strokes: string[], char?: string, sourceIndex?: number }>>} */
  const rows = [];

  for (const item of loaded) {
    const sourceIndex = Number.isFinite(item.sourceIndex) ? item.sourceIndex : undefined;

    if (item.blank || !item.strokes?.length) {
      rows.push(
        Array.from({ length: COLS }, () => ({
          type: 'empty',
          strokes: [],
          char: '',
          sourceIndex,
        })),
      );
      continue;
    }

    const { strokes, char = '' } = item;

    // Match Chinese font (描红): one model + soft full glyphs — same face as Settings font.
    if (guideStyle === 'font') {
      const row = [{ type: 'master', strokes: [...strokes], char, sourceIndex }];
      for (let col = 1; col < COLS; col++) {
        row.push({ type: 'guide', strokes: [...strokes], char, sourceIndex });
      }
      rows.push(row);
      continue;
    }

    const total = strokes.length;
    let strokeIndex = 0;
    let firstRow = true;

    while (firstRow || strokeIndex < total) {
      /** @type {Array<{ type: 'empty' | 'master' | 'guide', strokes: string[], char?: string, sourceIndex?: number }>} */
      const row = [];

      if (firstRow) {
        row.push({ type: 'master', strokes: [...strokes], char, sourceIndex });
        for (let col = 1; col < COLS; col++) {
          if (strokeIndex < total) {
            strokeIndex += 1;
            row.push({
              type: 'guide',
              strokes: strokes.slice(0, strokeIndex),
              char,
              sourceIndex,
            });
          } else {
            row.push({ type: 'guide', strokes: [...strokes], char, sourceIndex });
          }
        }
        firstRow = false;
      } else {
        // Overflow row: finish remaining stroke steps, then soft full glyphs to practice.
        for (let col = 0; col < COLS; col++) {
          if (strokeIndex < total) {
            strokeIndex += 1;
            row.push({
              type: 'guide',
              strokes: strokes.slice(0, strokeIndex),
              char,
              sourceIndex,
            });
          } else {
            row.push({ type: 'guide', strokes: [...strokes], char, sourceIndex });
          }
        }
      }

      rows.push(row);

      if (strokeIndex >= total) {
        break;
      }
    }
  }

  return rows;
}

/**
 * Pad/split content rows into A4 pages of 14 rows × 10 cols.
 * @param {ReturnType<typeof buildContentRows>} contentRows
 */
export function paginateRows(contentRows) {
  const pages = [];
  for (let i = 0; i < contentRows.length; i += ROWS) {
    const slice = contentRows.slice(i, i + ROWS);
    while (slice.length < ROWS) {
      slice.push(Array.from({ length: COLS }, () => ({ type: 'empty', strokes: [], char: '' })));
    }
    pages.push(slice);
  }
  if (pages.length === 0) {
    pages.push(
      Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => ({ type: 'empty', strokes: [], char: '' })),
      ),
    );
  }
  return pages;
}

function createGuidesSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'cell__guides');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');

  const h = document.createElementNS(SVG_NS, 'line');
  h.setAttribute('x1', '0');
  h.setAttribute('y1', '50');
  h.setAttribute('x2', '100');
  h.setAttribute('y2', '50');

  const v = document.createElementNS(SVG_NS, 'line');
  v.setAttribute('x1', '50');
  v.setAttribute('y1', '0');
  v.setAttribute('x2', '50');
  v.setAttribute('y2', '100');

  svg.append(h, v);
  return svg;
}

/**
 * @param {string[]} strokePaths
 */
function createCharSvg(strokePaths) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'cell__char cell__char--stroke');
  svg.setAttribute('viewBox', `0 0 ${CHAR_BOX} ${CHAR_BOX}`);

  const group = document.createElementNS(SVG_NS, 'g');
  const { transform } = getScalingTransform(CHAR_BOX, 2);
  group.setAttribute('transform', transform);

  for (const d of strokePaths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    group.appendChild(path);
  }

  svg.appendChild(group);
  return svg;
}

/**
 * Full character via selected Chinese font (--font-cjk).
 * @param {string} char
 */
function createCharFont(char) {
  const el = document.createElement('div');
  el.className = 'cell__char cell__char--font';
  el.textContent = char;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

/**
 * @param {{ type: string, strokes: string[], char?: string, sourceIndex?: number }} cellData
 * @param {{ selectedIndex?: number | null, onSelect?: (index: number) => void, guideStyle?: 'stroke' | 'font' }} [interact]
 */
function createCell(cellData, interact = {}) {
  const guideStyle = interact.guideStyle === 'font' ? 'font' : 'stroke';
  const cell = document.createElement('div');
  cell.className = `cell cell--${cellData.type}`;
  cell.appendChild(createGuidesSvg());

  const hasSource = Number.isFinite(cellData.sourceIndex);
  if (hasSource) {
    cell.dataset.sourceIndex = String(cellData.sourceIndex);
    cell.classList.add('cell--editable');
    if (interact.selectedIndex === cellData.sourceIndex) {
      cell.classList.add('is-selected');
    }
    cell.title =
      cellData.type === 'empty'
        ? 'Empty grid row — click to select, then Delete selected'
        : `Click to select “${cellData.char || 'row'}”`;
    cell.addEventListener('click', () => {
      interact.onSelect?.(/** @type {number} */ (cellData.sourceIndex));
    });
  }

  if (cellData.type === 'empty') return cell;

  if (cellData.type === 'master' && cellData.char) {
    cell.appendChild(createCharFont(cellData.char));
    return cell;
  }

  // Soft practice glyphs can follow the selected Chinese font (描红).
  if (guideStyle === 'font' && cellData.char) {
    cell.appendChild(createCharFont(cellData.char));
    return cell;
  }

  if (cellData.strokes.length > 0) {
    cell.appendChild(createCharSvg(cellData.strokes));
  }
  return cell;
}

/**
 * Render all sheet pages into a container.
 * @param {HTMLElement} container
 * @param {ReturnType<typeof buildContentRows>} contentRows
 * @param {number} opacity 0–1
 * @param {{ selectedIndex?: number | null, onSelect?: (index: number) => void, activeSheet?: number, guideStyle?: 'stroke' | 'font' }} [opts]
 */
export function renderSheets(container, contentRows, opacity, opts = {}) {
  container.replaceChildren();
  document.documentElement.style.setProperty('--soft-opacity', String(opacity));
  const guideStyle = opts.guideStyle === 'font' ? 'font' : 'stroke';

  const pages = paginateRows(contentRows);
  const activeSheet = Math.min(pages.length, Math.max(1, opts.activeSheet || 1));

  pages.forEach((pageRows, index) => {
    const page = document.createElement('section');
    page.className = 'sheet-page';
    page.dataset.page = String(index + 1);
    page.setAttribute('aria-label', `Sheet ${index + 1} of ${pages.length}`);
    if (index + 1 === activeSheet) page.classList.add('is-active-page');

    const grid = document.createElement('div');
    grid.className = 'sheet-grid';
    for (const row of pageRows) {
      for (const cell of row) {
        grid.appendChild(
          createCell(cell, {
            selectedIndex: opts.selectedIndex,
            onSelect: opts.onSelect,
            guideStyle,
          }),
        );
      }
    }
    page.appendChild(grid);

    const footer = document.createElement('div');
    footer.className = 'sheet-page__footer';
    footer.innerHTML = `<span>${index + 1}</span><span class="sheet-page__footer-sep">/</span><span>${pages.length}</span>`;
    page.appendChild(footer);

    container.appendChild(page);
  });

  return pages.length;
}

export { COLS, ROWS };
