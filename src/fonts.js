/** @typedef {{ id: string, label: string, family: string, sample?: string, google?: string }} CjkFont */

/** Google Fonts query fragment, or null for system fonts. */
/** @type {CjkFont[]} */
export const CJK_FONTS = [
  // System — instant, no download
  { id: 'yahei', label: '微软雅黑 Microsoft YaHei', family: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { id: 'simsun', label: '宋体 SimSun', family: 'SimSun, "Songti SC", serif' },
  { id: 'simhei', label: '黑体 SimHei', family: 'SimHei, "Heiti SC", sans-serif' },
  { id: 'kaiti', label: '楷体 KaiTi', family: 'KaiTi, STKaiti, "Kaiti SC", serif' },
  { id: 'fangsong', label: '仿宋 FangSong', family: 'FangSong, STFangsong, serif' },
  { id: 'dengxian', label: '等线 DengXian', family: 'DengXian, "Microsoft YaHei", sans-serif' },
  { id: 'pingfang', label: '苹方 PingFang SC', family: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { id: 'songti', label: '宋体-简 Songti SC', family: '"Songti SC", SimSun, serif' },
  { id: 'heiti', label: '黑体-简 Heiti SC', family: '"Heiti SC", SimHei, sans-serif' },
  { id: 'stxingkai', label: '华文行楷 STXingkai', family: 'STXingkai, "Kaiti SC", cursive' },
  { id: 'sthupo', label: '华文琥珀 STHupo', family: 'STHupo, "Microsoft YaHei", sans-serif' },
  { id: 'stliti', label: '华文隶书 STLiti', family: 'STLiti, KaiTi, serif' },
  { id: 'stxingkai-sys', label: '华文楷体 STKaiti', family: 'STKaiti, KaiTi, serif' },

  // Google Fonts — loaded on demand
  {
    id: 'noto-sans',
    label: 'Noto Sans SC',
    family: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
    google: 'Noto+Sans+SC:wght@400;500;600;700',
  },
  {
    id: 'noto-serif',
    label: 'Noto Serif SC',
    family: '"Noto Serif SC", SimSun, serif',
    google: 'Noto+Serif+SC:wght@400;600;700',
  },
  {
    id: 'xiaowei',
    label: '站酷小薇 ZCOOL XiaoWei',
    family: '"ZCOOL XiaoWei", "Microsoft YaHei", sans-serif',
    google: 'ZCOOL+XiaoWei',
  },
  {
    id: 'kuaile',
    label: '站酷快乐 ZCOOL KuaiLe',
    family: '"ZCOOL KuaiLe", "Microsoft YaHei", sans-serif',
    google: 'ZCOOL+KuaiLe',
  },
  {
    id: 'qingke',
    label: '站酷庆科黄油体',
    family: '"ZCOOL QingKe HuangYou", "Microsoft YaHei", sans-serif',
    google: 'ZCOOL+QingKe+HuangYou',
  },
  {
    id: 'mashan',
    label: '马善政楷书 Ma Shan Zheng',
    family: '"Ma Shan Zheng", KaiTi, cursive',
    google: 'Ma+Shan+Zheng',
  },
  {
    id: 'longcang',
    label: '龙藏体 Long Cang',
    family: '"Long Cang", KaiTi, cursive',
    google: 'Long+Cang',
  },
  {
    id: 'zhimang',
    label: '芝麻行 Zhi Mang Xing',
    family: '"Zhi Mang Xing", STXingkai, cursive',
    google: 'Zhi+Mang+Xing',
  },
  {
    id: 'liujian',
    label: '刘建毛草 Liu Jian Mao Cao',
    family: '"Liu Jian Mao Cao", STXingkai, cursive',
    google: 'Liu+Jian+Mao+Cao',
  },
];

const byId = new Map(CJK_FONTS.map((f) => [f.id, f]));
/** @type {Set<string>} */
const loadedGoogle = new Set();

/**
 * @param {string} id
 */
export function getFont(id) {
  return byId.get(id) || byId.get('noto-sans');
}

/**
 * @param {string} id
 * @returns {Promise<CjkFont>}
 */
export async function ensureFontLoaded(id) {
  const font = getFont(id);
  if (!font) return getFont('noto-sans');

  if (font.google && !loadedGoogle.has(font.id)) {
    const href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    if (!document.querySelector(`link[data-cjk-font="${font.id}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.cjkFont = font.id;
      document.head.appendChild(link);
    }
    loadedGoogle.add(font.id);
    try {
      const familyName = font.family.split(',')[0].replace(/"/g, '').trim();
      await document.fonts.load(`28px "${familyName}"`);
      await document.fonts.ready;
    } catch {
      // continue with fallback stack
    }
  }

  return font;
}

/**
 * Apply CSS variable for the selected CJK stack.
 * @param {string} id
 */
export function applyFontVar(id) {
  const font = getFont(id);
  document.documentElement.dataset.cjkFont = font.id;
  document.documentElement.style.setProperty('--font-cjk', font.family);
}
