/** @typedef {{ id: string, characters: string[] }} SheetPage */
/** @typedef {{ id: string, name: string, pages: SheetPage[], activePageId: string, opacity: number, updatedAt: number }} Student */

const STORE_KEY = 'stroke-order-students-v1';
const LEGACY_CHARS_KEY = 'stroke-order-chars-v1';
const LEGACY_OPACITY_KEY = 'stroke-order-opacity';

/**
 * @returns {string}
 */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {string[]} [characters]
 * @returns {SheetPage}
 */
export function createPage(characters = []) {
  return {
    id: uid('p'),
    characters: Array.isArray(characters) ? characters.filter((c) => typeof c === 'string') : [],
  };
}

/**
 * @param {Partial<Student>} [partial]
 * @returns {Student}
 */
export function createStudent(partial = {}) {
  const now = Date.now();
  /** @type {SheetPage[]} */
  let pages = [];

  if (Array.isArray(partial.pages) && partial.pages.length) {
    pages = partial.pages.map((p) => createPage(p.characters)).map((p, i) => ({
      ...p,
      id: partial.pages[i]?.id || p.id,
    }));
  } else if (Array.isArray(partial.characters)) {
    pages = [createPage(partial.characters)];
  } else {
    pages = [createPage([])];
  }

  const activePageId =
    pages.find((p) => p.id === partial.activePageId)?.id || pages[0].id;

  return {
    id: partial.id || uid('s'),
    name: (partial.name || 'Student').trim() || 'Student',
    pages,
    activePageId,
    opacity: Number.isFinite(partial.opacity) ? Number(partial.opacity) : 20,
    updatedAt: partial.updatedAt || now,
  };
}

/**
 * @param {Student} student
 * @returns {SheetPage}
 */
export function getActivePage(student) {
  return student.pages.find((p) => p.id === student.activePageId) || student.pages[0];
}

/**
 * @param {Student} student
 * @returns {number} 1-based
 */
export function getActivePageNumber(student) {
  const idx = student.pages.findIndex((p) => p.id === student.activePageId);
  return idx >= 0 ? idx + 1 : 1;
}

/**
 * @returns {{ students: Student[], activeStudentId: string }}
 */
export function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.students) && parsed.students.length) {
        const students = parsed.students.map((s) => createStudent(s));
        let activeStudentId = parsed.activeStudentId;
        if (!students.some((s) => s.id === activeStudentId)) {
          activeStudentId = students[0].id;
        }
        return { students, activeStudentId };
      }
    }
  } catch {
    // migrate below
  }

  let characters = [];
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CHARS_KEY) || 'null');
    if (Array.isArray(legacy) && legacy.every((c) => typeof c === 'string')) {
      characters = legacy;
    }
  } catch {
    // ignore
  }

  const opacity = Number(localStorage.getItem(LEGACY_OPACITY_KEY) || '20') || 20;
  const first = createStudent({
    name: 'Student 1',
    characters,
    opacity,
  });
  const store = { students: [first], activeStudentId: first.id };
  saveStore(store);
  return store;
}

/**
 * @param {{ students: Student[], activeStudentId: string }} store
 */
export function saveStore(store) {
  localStorage.setItem(
    STORE_KEY,
    JSON.stringify({
      version: 2,
      activeStudentId: store.activeStudentId,
      students: store.students,
    }),
  );
}

/**
 * @param {{ students: Student[], activeStudentId: string }} store
 * @returns {Student}
 */
export function getActiveStudent(store) {
  return store.students.find((s) => s.id === store.activeStudentId) || store.students[0];
}
