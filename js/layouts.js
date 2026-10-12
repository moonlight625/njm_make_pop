// レイアウト(用紙・配置)の管理: data/layouts.json(組込み) + localStorage(自作) + 共有URL / パック
import * as BG from './backgrounds.js';

export const PAPERS = {
  A4: [210, 297], A5: [148, 210], A3: [297, 420],
  B5: [182, 257], B4: [257, 364],
  hagaki: [100, 148],
  tanzakuS: [130, 385], tanzakuM: [190, 530],
  custom: null,
};
export const PAPER_NAMES = {
  A4: 'A4', A5: 'A5', A3: 'A3', B5: 'B5', B4: 'B4', hagaki: 'ハガキ',
  tanzakuS: 'エアコン短冊小', tanzakuM: 'エアコン短冊中', custom: 'カスタム寸法',
};

// なぞり項目。順番は編集UIの並び順
export const FIELD_KEYS = ['name', 'model', 'price', 'priceTax', 'comment'];
export const FIELD_LABELS = {
  name: 'カテゴリ', model: '型番', price: '税別価格', priceTax: '税込価格', comment: 'コメント',
};
export const GUIDE_COLORS = { gray: 'グレー', red: '赤（赤ペン用）', blue: '青（青ペン用）' };

// 項目の既定配置(セルに対する %)。台紙なしの汎用レイアウト用
const DEFAULT_FIELDS = {
  name:     { enabled: true,  x: 2,  y: 2,  w: 46, h: 12, align: 'left',   sizeScale: 1, color: 'gray' },
  model:    { enabled: true,  x: 50, y: 2,  w: 48, h: 12, align: 'left',   sizeScale: 1, color: 'gray' },
  comment:  { enabled: true,  x: 2,  y: 16, w: 96, h: 12, align: 'left',   sizeScale: 1, color: 'gray' },
  price:    { enabled: true,  x: 2,  y: 30, w: 96, h: 40, align: 'center', sizeScale: 1, color: 'red' },
  priceTax: { enabled: false, x: 2,  y: 74, w: 96, h: 12, align: 'center', sizeScale: 1, color: 'gray' },
};

const KEY = 'pop.layouts';
let builtin = [];
let custom = [];

// 読み込み元はここだけ。将来サーバーAPIにするときはこの関数を差し替える
async function fetchBuiltin() {
  const res = await fetch('data/layouts.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`layouts.json ${res.status}`);
  return res.json();
}

export async function loadLayouts() {
  builtin = (await fetchBuiltin()).map((l) => ({ ...normalize(l), builtin: true }));
  try {
    custom = JSON.parse(localStorage.getItem(KEY) || '[]').map((l) => ({ ...normalize(l), builtin: false }));
    persist(); // 旧形式からの変換結果を書き戻す
  } catch {
    custom = [];
  }
}

export function allLayouts() {
  return [...builtin, ...custom];
}

export function getLayout(id) {
  return allLayouts().find((l) => l.id === id) || builtin[0];
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(custom));
}

export function saveCustom(layout) {
  layout.builtin = false;
  const i = custom.findIndex((l) => l.id === layout.id);
  if (i >= 0) custom[i] = layout; else custom.push(layout);
  persist();
}

export async function deleteCustom(id) {
  const target = custom.find((l) => l.id === id);
  custom = custom.filter((l) => l.id !== id);
  persist();
  // 他のレイアウトが使っていない背景画像は一緒に消す
  const bg = target?.background?.id;
  if (bg && !allLayouts().some((l) => l.background?.id === bg)) await BG.removeBackground(bg);
}

function newId() {
  return 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function duplicate(layout, name) {
  const copy = structuredClone(layout);
  copy.id = newId();
  copy.name = name || `${layout.name} のコピー`;
  copy.builtin = false;
  saveCustom(copy);
  return copy;
}

// 共有URL / パックから取り込む: id は必ず振り直す(組込みと衝突させない)
export function importLayout(layout) {
  const l = normalize(layout);
  l.id = newId();
  l.builtin = false;
  saveCustom(l);
  return l;
}

export function sizeMm(layout) {
  let [w, h] = layout.paper === 'custom'
    ? [layout.widthMm, layout.heightMm]
    : (PAPERS[layout.paper] || PAPERS.A4);
  if (layout.orientation === 'landscape') [w, h] = [h, w];
  return [w, h];
}

const clamp = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const round1 = (n) => Math.round(n * 10) / 10;

// 旧形式(v1: 縦積み heightPct)の fields を v2(x/y/w/h %)に変換
function migrateV1Fields(f) {
  const out = structuredClone(DEFAULT_FIELDS);
  const order = ['model', 'price', 'comment'];
  let y = 0;
  for (const k of order) {
    const pct = clamp(f[k]?.heightPct, 1, 100, 33);
    out[k] = { ...out[k], x: 1, y: round1(y), w: 98, h: round1(pct), align: f[k]?.align || out[k].align, sizeScale: clamp(f[k]?.sizeScale, 0.2, 3, 1) };
    y += pct;
  }
  out.name.enabled = false;
  out.priceTax.enabled = false;
  out.price.color = 'gray';
  return out;
}

// 欠けた項目を既定値で埋め、範囲外を丸める(共有URL・古い保存データ対策)
export function normalize(l) {
  const src = l && typeof l === 'object' ? l : {};
  let f = src.fields || {};
  if (f.model && 'heightPct' in f.model && !('x' in f.model)) f = migrateV1Fields(f);
  const field = (k) => {
    const d = DEFAULT_FIELDS[k];
    const s = f[k] || {};
    // 枠は用紙の外にはみ出してもよい(パワポと同じ。印刷時は用紙外が切れるだけ)
    const w = clamp(s.w, 1, 300, d.w);
    const h = clamp(s.h, 1, 300, d.h);
    return {
      enabled: 'enabled' in s ? !!s.enabled : d.enabled,
      x: round1(clamp(s.x, -200, 200, d.x)),
      y: round1(clamp(s.y, -200, 200, d.y)),
      w: round1(w),
      h: round1(h),
      align: ['left', 'center', 'right'].includes(s.align) ? s.align : d.align,
      sizeScale: clamp(s.sizeScale, 0.2, 3, 1),
      color: s.color in GUIDE_COLORS ? s.color : d.color,
    };
  };
  const bg = src.background && typeof src.background === 'object' ? src.background : {};
  return {
    id: typeof src.id === 'string' ? src.id : newId(),
    name: typeof src.name === 'string' && src.name.trim() ? src.name.trim().slice(0, 40) : '名称未設定',
    paper: src.paper in PAPERS ? src.paper : 'A4',
    orientation: src.orientation === 'landscape' ? 'landscape' : 'portrait',
    widthMm: clamp(src.widthMm, 30, 1000, 210),
    heightMm: clamp(src.heightMm, 30, 1000, 297),
    cols: clamp(src.cols, 1, 10, 1) | 0,
    rows: clamp(src.rows, 1, 10, 1) | 0,
    marginMm: clamp(src.marginMm, 0, 100, 10),
    gapMm: clamp(src.gapMm, 0, 100, 5),
    cutLines: !!src.cutLines,
    background: {
      id: typeof bg.id === 'string' ? bg.id : null,                 // 端末保存(IndexedDB)の画像
      url: /^(?!.*\.\.)[\w\-./]+\.(png|jpe?g|webp|svg)$/i.test(bg.url || '') ? bg.url : null, // リポジトリ内の画像
      name: typeof bg.name === 'string' ? bg.name : '',
      fit: bg.fit === 'fill' ? 'fill' : 'contain',
    },
    fields: Object.fromEntries(FIELD_KEYS.map((k) => [k, field(k)])),
  };
}

// ---- 共有URL(#layout=base64url(JSON)) ----
function b64url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function stripForExport(layout) {
  const { builtin: _b, ...l } = structuredClone(layout);
  // 端末保存の背景 id は端末固有なので外に出さない(パックは別途画像ごと運ぶ)。url(リポジトリ内)はそのまま
  l.background = { id: null, url: l.background?.url || null, name: l.background?.url ? l.background.name : '', fit: l.background?.fit || 'contain' };
  return l;
}

export function exportJson(layout) {
  return JSON.stringify(stripForExport(layout), null, 2);
}

export function shareUrl(layout) {
  return `${location.origin}${location.pathname}#layout=${b64url(JSON.stringify(stripForExport(layout)))}`;
}

export function parseShareHash() {
  const m = location.hash.match(/^#layout=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    return normalize(JSON.parse(unb64url(m[1])));
  } catch {
    return null;
  }
}

// ---- パック(レイアウト + 背景画像を1ファイルに) ----
export async function exportPack(layout) {
  const pack = { format: 'pop-layout-pack', version: 2, layout: stripForExport(layout), background: null };
  const rec = await BG.getBackground(layout.background?.id);
  if (rec) {
    pack.layout.background.name = rec.name;
    pack.background = { name: rec.name, type: rec.type, data: await BG.blobToBase64(rec.blob) };
  }
  return JSON.stringify(pack);
}

export async function importPack(text) {
  let pack;
  try { pack = JSON.parse(text); } catch { throw new Error('パックファイルを読めませんでした'); }
  if (pack?.format !== 'pop-layout-pack' || !pack.layout) throw new Error('パックファイルの形式が違います');
  const layout = normalize(pack.layout);
  if (pack.background?.data && pack.background?.type) {
    const blob = BG.base64ToBlob(pack.background.data, pack.background.type);
    blob.name = pack.background.name || 'background';
    const file = new File([blob], pack.background.name || 'background', { type: pack.background.type });
    layout.background.id = await BG.addBackground(file);
    layout.background.url = null;
    layout.background.name = file.name;
  } else {
    layout.background.id = null;
  }
  return importLayout(layout);
}
