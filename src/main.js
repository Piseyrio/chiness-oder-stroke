import { loadCharacterData } from './strokeData.js';
import { buildContentRows, renderSheets } from './sheet.js';
import { uniqueCharsFromText } from './chars.js';
import { practiceSuggestionsFor } from './practiceAliases.js';
import { searchLibrary } from './librarySearch.js';
import { CJK_FONTS, applyFontVar, ensureFontLoaded } from './fonts.js';
import {
  createPage,
  createStudent,
  getActivePage,
  getActivePageNumber,
  getActiveStudent,
  loadStore,
  saveStore,
} from './students.js';

/** Empty practice bar (blank grid row). */
const EMPTY_ROW = '';

const DEFAULT_CHARS = uniqueCharsFromText('翁才安谢慧雅黄金丰张荣城');

const charInput = document.getElementById('char-input');
const btnAdd = document.getElementById('btn-add');
const btnEmpty = document.getElementById('btn-empty');
const btnClear = document.getElementById('btn-clear');
const btnDeleteSelected = document.getElementById('btn-delete-selected');
const btnAddPage = document.getElementById('btn-add-page');
const btnPrint = document.getElementById('btn-print');
const charListEl = document.getElementById('char-list');
const errorsEl = document.getElementById('errors');
const selectionHint = document.getElementById('selection-hint');
const sheetsEl = document.getElementById('sheets');
const opacityInput = document.getElementById('opacity-input');
const opacityValue = document.getElementById('opacity-value');
const fontSelect = document.getElementById('font-select');
const guideStyleSelect = document.getElementById('guide-style');
const searchGridEl = document.getElementById('search-grid');
const searchCountEl = document.getElementById('search-count');
const searchHintEl = document.getElementById('search-hint');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');
const zoomValueEl = document.getElementById('zoom-value');
const studentSelect = document.getElementById('student-select');
const studentMeta = document.getElementById('student-meta');
const btnStudentAdd = document.getElementById('btn-student-add');
const btnStudentRename = document.getElementById('btn-student-rename');
const btnStudentDelete = document.getElementById('btn-student-delete');
const btnPagePrev = document.getElementById('btn-page-prev');
const btnPageNext = document.getElementById('btn-page-next');
const pageLabel = document.getElementById('page-label');
const pageStrip = document.getElementById('page-strip');
const previewCanvas = document.querySelector('.preview__canvas');

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 1;
const ZOOM_STORAGE_KEY = 'stroke-order-preview-zoom';
const FONT_STORAGE_KEY = 'stroke-order-cjk-font';
const GUIDE_STYLE_KEY = 'stroke-order-guide-style';
const FONT_IDS = new Set(CJK_FONTS.map((f) => f.id));

let store = loadStore();
seedDefaultIfEmpty();

/** @type {string[]} */
let characters = [...getActivePage(getActiveStudent(store)).characters];
let opacity = (Number(getActiveStudent(store).opacity) || 20) / 100;
let previewZoom = loadZoom();
/** @type {'stroke' | 'font'} */
let guideStyle = loadGuideStyle();
let renderToken = 0;
/** @type {number | null} */
let selectedIndex = null;
let sheetCount = 1;
/** @type {Set<string>} */
let availableChars = new Set();
/** @type {Record<string, { variants?: string[], related?: string[] }>} */
let charRelations = {};
/** @type {Map<string, string[]>} */
const strokeCache = new Map();

opacityInput.value = String(Math.round(opacity * 100));
opacityValue.textContent = `${Math.round(opacity * 100)}%`;
if (guideStyleSelect) guideStyleSelect.value = guideStyle;

function seedDefaultIfEmpty() {
  const active = getActiveStudent(store);
  const page = getActivePage(active);
  if (store.students.length === 1 && active.pages.length === 1 && page.characters.length === 0) {
    page.characters = [...DEFAULT_CHARS];
    active.updatedAt = Date.now();
    saveStore(store);
  }
}

function isEmptyRow(char) {
  return char === EMPTY_ROW;
}

function loadZoom() {
  const raw = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
  if (!Number.isFinite(raw)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(raw * 10) / 10));
}

function applyZoom() {
  sheetsEl.style.setProperty('--preview-zoom', String(previewZoom));
  zoomValueEl.textContent = `${Math.round(previewZoom * 100)}%`;
  btnZoomOut.disabled = previewZoom <= ZOOM_MIN;
  btnZoomIn.disabled = previewZoom >= ZOOM_MAX;
  localStorage.setItem(ZOOM_STORAGE_KEY, String(previewZoom));
}

function setZoom(next) {
  previewZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 10) / 10));
  applyZoom();
}

function persistActiveStudent() {
  const active = getActiveStudent(store);
  const page = getActivePage(active);
  page.characters = [...characters];
  active.opacity = Math.round(opacity * 100);
  active.updatedAt = Date.now();
  saveStore(store);
  renderStudentMeta();
  updatePageNav();
}

function saveCharacters() {
  persistActiveStudent();
}

function formatUpdated(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function renderStudentMeta() {
  const active = getActiveStudent(store);
  const pageNum = getActivePageNumber(active);
  const total = active.pages.length;
  studentMeta.textContent = `Saved · viewing page ${pageNum}/${total} · ${characters.length} grids · edited ${formatUpdated(active.updatedAt)}`;
}

function updateSelectionHint() {
  if (!selectionHint) return;
  if (selectedIndex == null) {
    selectionHint.textContent =
      'Click a grid on the A4 to select it. Add Glyphs / Blank Row go to the end (or after the selection).';
    return;
  }
  const char = characters[selectedIndex];
  const label = isEmptyRow(char) ? 'empty grid row' : `“${char}”`;
  selectionHint.textContent = `Selected #${selectedIndex + 1} (${label}). Add Glyphs / Blank Row insert after this. Edit the character in the list, or Delete selected.`;
}

function renderStudentSelect() {
  studentSelect.replaceChildren();
  for (const student of store.students) {
    const opt = document.createElement('option');
    opt.value = student.id;
    opt.textContent = student.name;
    studentSelect.appendChild(opt);
  }
  studentSelect.value = store.activeStudentId;
  btnStudentDelete.disabled = store.students.length <= 1;
  renderStudentMeta();
  updatePageNav();
}

function loadStudentIntoEditor(student) {
  characters = [...getActivePage(student).characters];
  opacity = (Number(student.opacity) || 20) / 100;
  opacityInput.value = String(Math.round(opacity * 100));
  opacityValue.textContent = `${Math.round(opacity * 100)}%`;
  document.documentElement.style.setProperty('--soft-opacity', String(opacity));
  selectedIndex = null;
}

function switchStudent(id) {
  persistActiveStudent();
  if (!store.students.some((s) => s.id === id)) return;
  store.activeStudentId = id;
  saveStore(store);
  loadStudentIntoEditor(getActiveStudent(store));
  renderStudentSelect();
  renderCharList();
  renderSearchResults();
  scheduleRender();
}

function addStudent() {
  const name = window.prompt('Student name', `Student ${store.students.length + 1}`);
  if (name == null) return;
  persistActiveStudent();
  const student = createStudent({ name: name.trim() || `Student ${store.students.length + 1}` });
  store.students.push(student);
  store.activeStudentId = student.id;
  saveStore(store);
  loadStudentIntoEditor(student);
  renderStudentSelect();
  renderCharList();
  renderSearchResults();
  scheduleRender();
}

function renameStudent() {
  const active = getActiveStudent(store);
  const name = window.prompt('Rename student', active.name);
  if (name == null) return;
  const next = name.trim();
  if (!next) return;
  active.name = next;
  active.updatedAt = Date.now();
  saveStore(store);
  renderStudentSelect();
}

function deleteStudent() {
  if (store.students.length <= 1) return;
  const active = getActiveStudent(store);
  const ok = window.confirm(`Delete “${active.name}” and all saved pages? This cannot be undone.`);
  if (!ok) return;
  store.students = store.students.filter((s) => s.id !== active.id);
  store.activeStudentId = store.students[0].id;
  saveStore(store);
  loadStudentIntoEditor(getActiveStudent(store));
  renderStudentSelect();
  renderCharList();
  renderSearchResults();
  scheduleRender();
}

function updatePageNav() {
  const active = getActiveStudent(store);
  const total = active.pages.length;
  const num = getActivePageNumber(active);
  const overflow =
    sheetCount > 1 ? ` · ${sheetCount} A4 sheets` : '';
  pageLabel.textContent = `Page ${num} of ${total}${overflow}`;
  btnPagePrev.disabled = num <= 1;
  btnPageNext.disabled = num >= total;
  renderPageStrip();
  renderStudentMeta();
  updateSelectionHint();
}

function renderPageStrip() {
  if (!pageStrip) return;
  const active = getActiveStudent(store);
  pageStrip.replaceChildren();

  active.pages.forEach((page, index) => {
    const n = index + 1;
    const isActive = page.id === active.activePageId;
    const count = page.characters.length;

    const tab = document.createElement('div');
    tab.className = `page-tab${isActive ? ' is-active' : ''}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.title = `Page ${n} · ${count} grid${count === 1 ? '' : 's'}`;

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'page-tab__open';
    openBtn.textContent = String(n);
    openBtn.addEventListener('click', () => {
      if (!isActive) goToPage(n);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'page-tab__delete';
    delBtn.title =
      active.pages.length <= 1
        ? 'Cannot delete the only page — use Clear page'
        : `Delete page ${n}`;
    delBtn.setAttribute('aria-label', `Delete page ${n}`);
    delBtn.disabled = active.pages.length <= 1;
    delBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePageAt(index);
    });

    tab.append(openBtn, delBtn);
    pageStrip.appendChild(tab);
  });
}

function goToPage(pageNum) {
  persistActiveStudent();
  const active = getActiveStudent(store);
  const idx = Math.min(active.pages.length, Math.max(1, pageNum)) - 1;
  active.activePageId = active.pages[idx].id;
  saveStore(store);
  characters = [...getActivePage(active).characters];
  selectedIndex = null;
  renderCharList();
  renderSearchResults();
  scheduleRender();
  updatePageNav();
}

function addBlankPage() {
  persistActiveStudent();
  const active = getActiveStudent(store);
  const page = createPage([]);
  const currentIdx = active.pages.findIndex((p) => p.id === active.activePageId);
  const insertAt = currentIdx >= 0 ? currentIdx + 1 : active.pages.length;
  active.pages.splice(insertAt, 0, page);
  active.activePageId = page.id;
  active.updatedAt = Date.now();
  saveStore(store);
  characters = [];
  selectedIndex = null;
  renderCharList();
  renderSearchResults();
  scheduleRender();
  updatePageNav();
}

/**
 * Delete a specific page by 0-based index.
 * @param {number} index
 */
function deletePageAt(index) {
  const active = getActiveStudent(store);
  if (active.pages.length <= 1) {
    showErrors(['You need at least one page. Use “Clear page” to empty it instead.']);
    return;
  }
  if (index < 0 || index >= active.pages.length) return;

  const page = active.pages[index];
  const label = `page ${index + 1}`;
  const gridCount = page.characters.length;
  const ok = window.confirm(
    `Delete ${label}?${
      gridCount ? ` It has ${gridCount} grid row${gridCount === 1 ? '' : 's'}.` : ''
    }\n\nOther pages stay saved.`,
  );
  if (!ok) return;

  // Save current editor into its page first (unless we're deleting the page being edited).
  const deletingActive = page.id === active.activePageId;
  if (!deletingActive) {
    persistActiveStudent();
  }

  active.pages.splice(index, 1);
  const nextIdx = Math.min(index, active.pages.length - 1);
  active.activePageId = active.pages[nextIdx].id;
  active.updatedAt = Date.now();
  saveStore(store);

  characters = [...getActivePage(active).characters];
  selectedIndex = null;
  showErrors([]);
  renderCharList();
  renderSearchResults();
  scheduleRender();
  updatePageNav();
}

function selectGrid(index) {
  selectedIndex = index;
  renderCharList();
  updateSelectionHint();
  scheduleRender();
}

function deleteSelected() {
  if (selectedIndex == null || selectedIndex < 0 || selectedIndex >= characters.length) {
    showErrors(['Select a grid on the A4 sheet (or in the list) first.']);
    return;
  }
  characters.splice(selectedIndex, 1);
  selectedIndex = null;
  saveCharacters();
  renderCharList();
  renderSearchResults();
  scheduleRender();
  showErrors([]);
}

function extractHanzi(text) {
  return uniqueCharsFromText(text);
}

async function ensureStrokes(char) {
  if (strokeCache.has(char)) return strokeCache.get(char);
  const data = await loadCharacterData(char);
  if (!data?.strokes?.length) throw new Error('No strokes');
  strokeCache.set(char, data.strokes);
  return data.strokes;
}

async function fillGlyph(container, char) {
  container.replaceChildren();
  // Workspace preview follows the selected Chinese font.
  const span = document.createElement('span');
  span.className = 'char-item__glyph-font';
  span.textContent = char;
  container.appendChild(span);
}

function initTheme() {
  const toggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const stored = localStorage.getItem('stroke-order-theme');
  const dark = stored ? stored === 'dark' : true;

  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);

  toggle?.addEventListener('click', () => {
    const nextDark = !root.classList.contains('dark');
    root.classList.toggle('dark', nextDark);
    root.classList.toggle('light', !nextDark);
    localStorage.setItem('stroke-order-theme', nextDark ? 'dark' : 'light');
  });
}

function loadFontChoice() {
  const raw = localStorage.getItem(FONT_STORAGE_KEY);
  return FONT_IDS.has(raw) ? raw : 'yahei';
}

/** @returns {'stroke' | 'font'} */
function loadGuideStyle() {
  const raw = localStorage.getItem(GUIDE_STYLE_KEY);
  return raw === 'font' ? 'font' : 'stroke';
}

/**
 * @param {'stroke' | 'font'} style
 */
function applyGuideStyle(style) {
  guideStyle = style === 'font' ? 'font' : 'stroke';
  localStorage.setItem(GUIDE_STYLE_KEY, guideStyle);
  if (guideStyleSelect) guideStyleSelect.value = guideStyle;
  scheduleRender();
}

/**
 * @param {string} fontId
 */
async function applyFont(fontId) {
  const id = FONT_IDS.has(fontId) ? fontId : 'yahei';
  fontSelect.value = id;
  localStorage.setItem(FONT_STORAGE_KEY, id);
  await ensureFontLoaded(id);
  applyFontVar(id);
  renderCharList();
  scheduleRender();
}

function initFontPicker() {
  const system = document.createElement('optgroup');
  system.label = 'System fonts';
  const web = document.createElement('optgroup');
  web.label = 'Google fonts (download on select)';

  for (const font of CJK_FONTS) {
    const opt = document.createElement('option');
    opt.value = font.id;
    opt.textContent = `${font.label} — 黄`;
    opt.style.fontFamily = font.family;
    (font.google ? web : system).appendChild(opt);
  }

  fontSelect.append(system, web);

  applyFont(loadFontChoice()).catch(() => {
    applyFontVar('yahei');
  });

  fontSelect.addEventListener('change', () => {
    applyFont(fontSelect.value);
  });

  if (guideStyleSelect) {
    guideStyleSelect.addEventListener('change', () => {
      applyGuideStyle(/** @type {'stroke' | 'font'} */ (guideStyleSelect.value));
    });
  }
}

function renderEmptyPreview() {
  sheetsEl.replaceChildren();
  const empty = document.createElement('div');
  empty.className = 'sheet-empty';
  empty.innerHTML = `
    <div>
      <span class="material-symbols-outlined" aria-hidden="true">grid_view</span>
      <p>This page is empty — add characters or an empty grid row.</p>
    </div>
  `;
  sheetsEl.appendChild(empty);
  sheetCount = 1;
  updatePageNav();
}

function renderCharList() {
  charListEl.replaceChildren();

  characters.forEach((char, index) => {
    const li = document.createElement('li');
    li.className = `char-item${isEmptyRow(char) ? ' char-item--empty' : ''}${
      selectedIndex === index ? ' is-selected' : ''
    }`;
    li.dataset.index = String(index);
    li.addEventListener('click', (e) => {
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return;
      selectGrid(index);
    });

    const glyph = document.createElement('span');
    glyph.className = 'char-item__glyph';

    const input = document.createElement('input');
    input.type = 'text';

    if (isEmptyRow(char)) {
      glyph.textContent = '▢';
      glyph.title = 'Empty practice bar — type a character to fill';
      input.value = '';
      input.placeholder = 'Type a character…';
      input.maxLength = 4;
      input.setAttribute('aria-label', `Empty row ${index + 1}`);
    } else {
      fillGlyph(glyph, char);
      input.value = char;
      input.maxLength = 4;
      input.setAttribute('aria-label', `Character ${index + 1}`);
    }

    input.addEventListener('change', () => {
      const next = extractHanzi(input.value)[0];
      if (!next) {
        if (input.value.trim() === '') {
          characters[index] = EMPTY_ROW;
          selectedIndex = index;
          saveCharacters();
          renderCharList();
          scheduleRender();
          return;
        }
        input.value = isEmptyRow(characters[index]) ? '' : characters[index];
        return;
      }
      if (availableChars.size && !availableChars.has(next)) {
        showErrors([`“${next}” is not in the stroke data. Search and pick a tile below.`]);
        input.value = isEmptyRow(characters[index]) ? '' : characters[index];
        return;
      }
      characters[index] = next;
      selectedIndex = index;
      saveCharacters();
      renderCharList();
      renderSearchResults();
      scheduleRender();
    });

    const btnUp = document.createElement('button');
    btnUp.type = 'button';
    btnUp.title = 'Move up';
    btnUp.textContent = '↑';
    btnUp.disabled = index === 0;
    btnUp.addEventListener('click', () => moveChar(index, -1));

    const btnDown = document.createElement('button');
    btnDown.type = 'button';
    btnDown.title = 'Move down';
    btnDown.textContent = '↓';
    btnDown.disabled = index === characters.length - 1;
    btnDown.addEventListener('click', () => moveChar(index, 1));

    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.title = 'Remove this grid';
    btnRemove.textContent = '×';
    btnRemove.addEventListener('click', () => {
      characters.splice(index, 1);
      if (selectedIndex === index) selectedIndex = null;
      else if (selectedIndex != null && selectedIndex > index) selectedIndex -= 1;
      saveCharacters();
      renderCharList();
      renderSearchResults();
      scheduleRender();
    });

    li.append(glyph, input, btnUp, btnDown, btnRemove);
    charListEl.appendChild(li);
  });

  updateSelectionHint();
}

function moveChar(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= characters.length) return;
  const tmp = characters[index];
  characters[index] = characters[next];
  characters[next] = tmp;
  if (selectedIndex === index) selectedIndex = next;
  else if (selectedIndex === next) selectedIndex = index;
  saveCharacters();
  renderCharList();
  scheduleRender();
}

function insertAfterSelection() {
  if (selectedIndex != null && selectedIndex >= 0 && selectedIndex < characters.length) {
    return selectedIndex + 1;
  }
  return characters.length;
}

function addEmptyRow() {
  const insertAt = insertAfterSelection();
  characters.splice(insertAt, 0, EMPTY_ROW);
  selectedIndex = insertAt;
  saveCharacters();
  renderCharList();
  scheduleRender();
  showErrors([]);
}

function addCharacters(chars, { clearErrors = true, clearInput = false } = {}) {
  const toAdd = [];
  const missing = [];
  for (const ch of chars) {
    if (availableChars.size && !availableChars.has(ch)) {
      missing.push(ch);
      continue;
    }
    toAdd.push(ch);
  }
  if (toAdd.length) {
    const insertAt = insertAfterSelection();
    characters.splice(insertAt, 0, ...toAdd);
    selectedIndex = insertAt + toAdd.length - 1;
    saveCharacters();
    renderCharList();
    if (clearInput) {
      charInput.value = '';
    }
    renderSearchResults();
    scheduleRender();
  }
  if (missing.length) {
    const tips = missing.map((ch) => {
      const alts = practiceSuggestionsFor(ch).filter((a) => !availableChars.size || availableChars.has(a));
      return alts.length
        ? `“${ch}” has no stroke data — try ${alts.join(' / ')}`
        : `“${ch}” has no stroke data`;
    });
    showErrors([
      `${tips.join('. ')}. Pick a matching glyph from search results.`,
    ]);
  } else if (clearErrors) {
    showErrors([]);
  }
}

function addFromInput() {
  const added = extractHanzi(charInput.value);
  if (added.length === 0) return;
  addCharacters(added, { clearInput: true });
}

function showErrors(messages) {
  if (!messages.length) {
    errorsEl.hidden = true;
    errorsEl.textContent = '';
    return;
  }
  errorsEl.hidden = false;
  errorsEl.textContent = messages.join(' ');
}

function updateSearchCount(counts, queryChars, unsupported = []) {
  const q = queryChars.join('');
  if (!counts.total) {
    const tip = unsupported.length
      ? ` No stroke-order data for <strong>${unsupported.join(' ')}</strong> (rare/old form). Try a common form.`
      : '';
    searchCountEl.innerHTML = `No stroke matches for <strong>${q}</strong>.${tip}`;
    return;
  }
  const parts = [];
  if (counts.exact) parts.push(`${counts.exact} exact`);
  if (counts.variant) parts.push(`${counts.variant} variant`);
  if (counts.related) parts.push(`${counts.related} same-type`);
  let html = `Found <strong>${counts.total}</strong> for <strong>${q}</strong> (${parts.join(', ')}) — click to add`;
  if (unsupported.length) {
    html += `<br/><span class="library-count__warn">“${unsupported.join(
      ' ',
    )}” has no stroke-order data — use a suggested glyph below.</span>`;
  }
  searchCountEl.innerHTML = html;
}

function renderSearchResults() {
  const trimmed = charInput.value.trim();
  const queryChars = extractHanzi(trimmed);

  if (!queryChars.length) {
    searchGridEl.hidden = true;
    searchGridEl.replaceChildren();
    searchCountEl.textContent = '';
    searchHintEl.hidden = false;
    return;
  }

  searchHintEl.hidden = true;

  if (!availableChars.size) {
    searchGridEl.hidden = true;
    searchGridEl.replaceChildren();
    searchCountEl.innerHTML = 'Loading stroke library…';
    return;
  }

  const { hits, counts, unsupported } = searchLibrary(trimmed, {
    available: availableChars,
    relations: charRelations,
    extractHanzi,
  });

  updateSearchCount(counts, queryChars, unsupported);

  searchGridEl.hidden = hits.length === 0;
  searchGridEl.replaceChildren();

  for (const { char, kind } of hits) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = [
      'library-tile',
      characters.includes(char) ? 'is-selected' : '',
      `library-tile--${kind}`,
    ]
      .filter(Boolean)
      .join(' ');

    const kindLabel =
      kind === 'exact' ? 'exact' : kind === 'variant' ? 'variant' : 'type';
    btn.title = `${char} (${kindLabel}) — click to add`;
    btn.disabled = false;

    const badge = document.createElement('span');
    badge.className = 'library-tile__badge';
    badge.textContent = kindLabel;
    btn.appendChild(badge);

    const holder = document.createElement('span');
    holder.className = 'char-item__glyph';
    btn.appendChild(holder);

    fillGlyph(holder, char);
    btn.addEventListener('click', () => {
      addCharacters([char]);
    });

    searchGridEl.appendChild(btn);
  }
}

async function loadStrokeIndex() {
  try {
    const [indexRes, customRes, relRes] = await Promise.all([
      fetch('/hanzi-data/_index.json'),
      fetch('/custom-hanzi-data/_index.json'),
      fetch('/char-relations.json'),
    ]);
    const chars = [];
    if (indexRes.ok) {
      const data = await indexRes.json();
      chars.push(...(data.characters || []));
    }
    if (customRes.ok) {
      const data = await customRes.json();
      chars.push(...(data.characters || []));
    }
    availableChars = new Set(chars);
    if (relRes.ok) {
      charRelations = await relRes.json();
    }
  } catch {
    availableChars = new Set();
  }
  renderSearchResults();
}

async function renderSheet() {
  const token = ++renderToken;

  if (!characters.length) {
    showErrors([]);
    renderEmptyPreview();
    return;
  }

  const uniqueChars = [...new Set(characters.filter((c) => !isEmptyRow(c)))];
  /** @type {Map<string, { char: string, strokes: string[] }>} */
  const byChar = new Map();
  const errors = [];

  await Promise.all(
    uniqueChars.map(async (char) => {
      try {
        const strokes = await ensureStrokes(char);
        byChar.set(char, { char, strokes });
      } catch {
        errors.push(`“${char}” has no stroke data. Search and pick another glyph.`);
      }
    }),
  );

  if (token !== renderToken) return;

  const ordered = characters
    .map((char, index) => {
      if (isEmptyRow(char)) return { blank: true, char: '', strokes: [], sourceIndex: index };
      const found = byChar.get(char);
      if (!found) return null;
      return { ...found, sourceIndex: index };
    })
    .filter(Boolean);

  showErrors(errors);
  const rows = buildContentRows(ordered, { guideStyle });
  sheetCount =
    renderSheets(sheetsEl, rows, opacity, {
      selectedIndex,
      onSelect: selectGrid,
      guideStyle,
    }) || 1;

  // Show every A4 sheet belonging to this page (overflow stacks).
  sheetsEl.querySelectorAll('.sheet-page').forEach((el) => {
    el.classList.add('is-active-page');
  });

  updatePageNav();
}

function scheduleRender() {
  renderSheet().catch((err) => {
    console.error(err);
    showErrors(['Failed to render sheet. Check the console for details.']);
  });
}

btnAdd.addEventListener('click', addFromInput);
btnEmpty.addEventListener('click', addEmptyRow);
btnAddPage.addEventListener('click', addBlankPage);
btnDeleteSelected.addEventListener('click', deleteSelected);
charInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addFromInput();
  }
});
charInput.addEventListener('input', () => {
  renderSearchResults();
});

btnClear.addEventListener('click', () => {
  const ok = window.confirm('Clear all grids on this page only?');
  if (!ok) return;
  characters = [];
  selectedIndex = null;
  saveCharacters();
  renderCharList();
  renderSearchResults();
  scheduleRender();
});

btnPrint.addEventListener('click', async () => {
  persistActiveStudent();
  const active = getActiveStudent(store);
  const restoreChars = [...characters];
  const restorePageId = active.activePageId;
  const restoreZoom = previewZoom;
  characters = active.pages.flatMap((p) => p.characters);
  selectedIndex = null;
  try {
    // Print must use real A4 size (not the preview zoom width).
    setZoom(1);
    await renderSheet();
    sheetsEl.querySelectorAll('.sheet-page').forEach((el) => {
      el.classList.add('is-active-page');
    });
    document.documentElement.classList.add('is-printing');
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    // Let the browser finish layout at print size before opening the dialog.
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    window.print();
  } finally {
    document.documentElement.classList.remove('is-printing');
    active.activePageId = restorePageId;
    characters = restoreChars;
    setZoom(restoreZoom);
    scheduleRender();
  }
});

opacityInput.addEventListener('input', () => {
  const pct = Number(opacityInput.value);
  opacity = pct / 100;
  opacityValue.textContent = `${pct}%`;
  document.documentElement.style.setProperty('--soft-opacity', String(opacity));
  persistActiveStudent();
});

studentSelect.addEventListener('change', () => {
  switchStudent(studentSelect.value);
});
btnStudentAdd.addEventListener('click', addStudent);
btnStudentRename.addEventListener('click', renameStudent);
btnStudentDelete.addEventListener('click', deleteStudent);

btnPagePrev.addEventListener('click', () => {
  goToPage(getActivePageNumber(getActiveStudent(store)) - 1);
});
btnPageNext.addEventListener('click', () => {
  goToPage(getActivePageNumber(getActiveStudent(store)) + 1);
});

window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(/** @type {HTMLElement} */ (e.target).tagName)) {
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedIndex != null) {
      e.preventDefault();
      deleteSelected();
    }
    return;
  }
  if (e.key === 'PageDown' || e.key === 'ArrowRight') {
    e.preventDefault();
    goToPage(getActivePageNumber(getActiveStudent(store)) + 1);
  } else if (e.key === 'PageUp' || e.key === 'ArrowLeft') {
    e.preventDefault();
    goToPage(getActivePageNumber(getActiveStudent(store)) - 1);
  }
});

btnZoomIn.addEventListener('click', () => setZoom(previewZoom + ZOOM_STEP));
btnZoomOut.addEventListener('click', () => setZoom(previewZoom - ZOOM_STEP));
btnZoomReset.addEventListener('click', () => setZoom(ZOOM_DEFAULT));

previewCanvas?.addEventListener(
  'wheel',
  (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(previewZoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  },
  { passive: false },
);

initTheme();
initFontPicker();
applyZoom();
renderStudentSelect();
renderCharList();
scheduleRender();
loadStrokeIndex();
