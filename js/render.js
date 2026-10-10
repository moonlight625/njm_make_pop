// 商品行 × レイアウト → 用紙DOM を作る
import { sizeMm, FIELD_KEYS } from './layouts.js';
import * as BG from './backgrounds.js';

export const MM = 96 / 25.4; // 1mm あたりの CSS px

// 「枠の高さに対する文字サイズ」の基準比。コメントは2行入るよう小さめ
const FONT_RATIO = { name: 0.55, model: 0.55, price: 0.62, priceTax: 0.55, comment: 0.42 };

export function formatPrice(raw, style) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const digits = s.replace(/[,，\s]/g, '');
  if (!/^\d+$/.test(digits)) return s; // 数字以外が混ざっていればそのまま
  return decorate(Number(digits), style);
}

function decorate(n, style) {
  const f = n.toLocaleString('ja-JP');
  if (style === 'yen') return `¥${f}`;
  if (style === 'en') return `${f}円`;
  return f;
}

// 税込(切り捨て)。税別が数字でなければ空
export function taxIncluded(raw, ratePct, style) {
  const digits = String(raw ?? '').replace(/[,，\s]/g, '');
  if (!/^\d+$/.test(digits)) return '';
  return decorate(Math.floor(Number(digits) * (1 + ratePct / 100)), style);
}

// 枚数(copies)ぶん展開し、空行は捨てる
export function expandItems(items) {
  const out = [];
  for (const it of items) {
    if (!FIELD_KEYS.some((k) => k !== 'priceTax' && it[k]?.trim())) continue;
    const c = Math.max(1, Math.min(99, parseInt(it.copies, 10) || 1));
    for (let i = 0; i < c; i++) out.push(it);
  }
  return out;
}

function guideColor(color, lightness) {
  if (color === 'red') return `hsl(0 85% ${lightness}%)`;
  if (color === 'blue') return `hsl(220 85% ${lightness}%)`;
  return `hsl(0 0% ${lightness}%)`;
}

export function fieldTexts(entry, settings) {
  return {
    name: entry.name || '',
    model: entry.model || '',
    price: formatPrice(entry.price, settings.priceStyle),
    priceTax: taxIncluded(entry.price, settings.taxRate, settings.priceStyle),
    comment: entry.comment || '',
  };
}

export async function buildSheets(entries, layout, settings) {
  const [W, H] = sizeMm(layout);
  const per = layout.cols * layout.rows;
  const pages = Math.max(1, Math.ceil(entries.length / per));
  const cellW = (W - 2 * layout.marginMm - (layout.cols - 1) * layout.gapMm) / layout.cols;
  const cellH = (H - 2 * layout.marginMm - (layout.rows - 1) * layout.gapMm) / layout.rows;
  const bgUrl = layout.background?.url || (await BG.urlFor(layout.background?.id));
  const frag = document.createDocumentFragment();

  for (let p = 0; p < pages; p++) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    const sheet = document.createElement('div');
    sheet.className = `sheet guide-${settings.guide}`;
    sheet.style.width = `${W}mm`;
    sheet.style.height = `${H}mm`;
    sheet.style.padding = `${layout.marginMm}mm`;
    sheet.style.gap = `${layout.gapMm}mm`;
    sheet.style.gridTemplateColumns = `repeat(${layout.cols}, minmax(0, 1fr))`;
    sheet.style.gridTemplateRows = `repeat(${layout.rows}, minmax(0, 1fr))`;
    sheet.style.setProperty('--pop-font', settings.fontFamily);
    sheet.style.setProperty('--stroke-w', `${settings.strokeWidth * MM}px`);
    sheet.dataset.cellW = String(cellW);
    sheet.dataset.cellH = String(cellH);

    for (let i = 0; i < per; i++) {
      const entry = entries[p * per + i];
      const cell = document.createElement('div');
      cell.className = 'pop' + (layout.cutLines ? ' cut' : '');
      if (bgUrl) {
        const img = document.createElement('img');
        img.className = 'bg';
        img.src = bgUrl;
        img.alt = '';
        img.style.objectFit = layout.background.fit === 'fill' ? 'fill' : 'contain';
        cell.appendChild(img);
      }
      // 空セルでも、編集中に枠の位置が見えるよう項目枠は出す(文字は空)
      const texts = entry ? fieldTexts(entry, settings) : null;
      for (const k of FIELD_KEYS) {
        const fdef = layout.fields[k];
        if (!fdef.enabled) continue;
        const boxH = (cellH * fdef.h) / 100; // mm
        const fontPx = boxH * FONT_RATIO[k] * fdef.sizeScale * MM;
        const f = document.createElement('div');
        f.className = `f f-${k} al-${fdef.align}`;
        f.dataset.field = k;
        f.style.left = `${fdef.x}%`;
        f.style.top = `${fdef.y}%`;
        f.style.width = `${fdef.w}%`;
        f.style.height = `${fdef.h}%`;
        f.style.fontSize = `${fontPx}px`;
        f.style.setProperty('--guide-color', guideColor(fdef.color, settings.lightness));
        f.dataset.basePx = String(fontPx);
        const span = document.createElement('span');
        span.textContent = texts ? texts[k] : '';
        f.appendChild(span);
        cell.appendChild(f);
      }
      sheet.appendChild(cell);
    }
    wrap.appendChild(sheet);
    frag.appendChild(wrap);
  }
  return { frag, pages, per, W, H };
}

// 枠に収まらない文字を縮める(コメントは高さ、それ以外は幅で判定)
export function fitText(root) {
  const fields = root.querySelectorAll('.pop .f');
  for (const f of fields) {
    const span = f.firstElementChild;
    if (!span || !span.textContent) continue;
    let size = parseFloat(f.dataset.basePx);
    f.style.fontSize = `${size}px`;
    const min = Math.max(6, size * 0.3);
    const overflows = () =>
      f.classList.contains('f-comment')
        ? span.scrollHeight > f.clientHeight + 0.5
        : span.scrollWidth > f.clientWidth + 0.5;
    let guard = 40;
    while (overflows() && size > min && guard-- > 0) {
      size *= 0.92;
      f.style.fontSize = `${size}px`;
    }
  }
}
