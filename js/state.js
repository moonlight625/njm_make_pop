// 画面の状態(商品行・選択中の設定)を localStorage に保存/復元する
const KEY = 'pop.state';

export const DEFAULT_STATE = {
  items: [{ name: '', model: '', price: '', comment: '', copies: 1 }],
  layoutId: 'a4p-1',
  fontId: 'yomogi',
  guide: 'fill',        // fill | outline
  lightness: 80,        // 0-100 (大きいほど薄い)
  strokeWidth: 0.4,     // mm (輪郭モードの線の太さ)
  priceStyle: 'yen',    // yen(¥1,000) | en(1,000円) | none
  taxRate: 10,          // 税込の自動計算に使う %
};

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    const s = { ...DEFAULT_STATE, ...saved };
    if (!Array.isArray(s.items) || s.items.length === 0) s.items = structuredClone(DEFAULT_STATE.items);
    return s;
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* プライベートモード等で保存できなくても動作は続ける */
  }
}
