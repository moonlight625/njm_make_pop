// UI配線: 入力 → 状態 → プレビュー描画 → 印刷
import * as Fonts from './fonts.js';
import * as Layouts from './layouts.js';
import * as BG from './backgrounds.js';
import { loadState, saveState } from './state.js';
import { expandItems, buildSheets, fitText, MM } from './render.js';

const { FIELD_KEYS, FIELD_LABELS, GUIDE_COLORS } = Layouts;
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const emptyItem = () => ({ name: '', model: '', price: '', comment: '', copies: 1 });

let state;
let currentLayout;
let sheetSize = [210, 297];
let renderTimer = null;
let renderSeq = 0;

// ---------- 起動 ----------
async function init() {
  const errors = [];
  await Promise.all([
    Fonts.loadManifest().catch((e) => errors.push(`フォント一覧を読めませんでした（${e.message}）`)),
    Layouts.loadLayouts().catch((e) => errors.push(`レイアウト一覧を読めませんでした（${e.message}）`)),
  ]);
  await Fonts.loadLocalFonts();
  if (errors.length) showError(errors.join(' / ') + '。ファイルサーバー経由（http://）で開いているか確認してください。');

  state = loadState();
  if (!Fonts.fonts.some((f) => f.id === state.fontId) && Fonts.fonts[0]) state.fontId = Fonts.fonts[0].id;
  currentLayout = Layouts.getLayout(state.layoutId);
  if (currentLayout) state.layoutId = currentLayout.id;

  buildFontSelect();
  buildLayoutSelect();
  buildFieldEditor();
  renderItemsTable();
  syncSettingsUI();
  fillLayoutEditor();
  wireEvents();
  await render();
  handleShareHash();

  window.addEventListener('resize', scalePreview);
  document.fonts.addEventListener('loadingdone', () => scheduleRender());
}

function showError(msg) {
  const box = $('#error-box');
  box.textContent = msg;
  box.hidden = false;
}

// ---------- 描画 ----------
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 80);
}

async function render() {
  if (!currentLayout) return;
  const seq = ++renderSeq;
  const settings = {
    fontFamily: Fonts.familyOf(state.fontId),
    guide: state.guide,
    lightness: state.lightness,
    strokeWidth: state.strokeWidth,
    priceStyle: state.priceStyle,
    taxRate: state.taxRate,
  };
  const entries = expandItems(state.items);
  const { frag, pages, per, W, H } = await buildSheets(entries, currentLayout, settings);
  if (seq !== renderSeq) return; // 古い描画結果は捨てる
  sheetSize = [W, H];
  $('#preview').replaceChildren(frag);
  $('#page-style').textContent = `@page{size:${W}mm ${H}mm;margin:0}`;
  $('#page-info').textContent = `${entries.length}件 → ${pages}枚（1枚に${per}件 / ${W}×${H}mm）`;
  updateEditingMode();
  scalePreview();
  fitText($('#preview'));
  saveState(state);
}

function scalePreview() {
  const [W, H] = sheetSize;
  const avail = $('#preview').clientWidth - 8;
  const scale = Math.min(1, avail / (W * MM));
  for (const wrap of $$('.sheet-wrap')) {
    wrap.style.width = `${W * MM * scale}px`;
    wrap.style.height = `${H * MM * scale}px`;
    wrap.firstElementChild.style.transform = `scale(${scale})`;
  }
}

// ---------- 商品リスト ----------
function renderItemsTable() {
  const list = $('#items-list');
  list.replaceChildren();
  state.items.forEach((it, idx) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <label class="in-name"><span>カテゴリ</span><input type="text" data-k="name" placeholder="カテゴリ（例: ノートPC）" autocomplete="off"></label>
      <label class="in-model"><span>型番</span><input type="text" data-k="model" placeholder="型番" autocomplete="off"></label>
      <label class="in-price"><span>税別価格</span><input type="text" data-k="price" placeholder="税別" inputmode="numeric" autocomplete="off"></label>
      <label class="in-copies"><span>枚数</span><input type="number" data-k="copies" min="1" max="99" title="枚数"></label>
      <div class="ops">
        <button class="btn btn-sm btn-icon" data-op="add" title="この下に行を追加">＋</button>
        <button class="btn btn-sm btn-icon btn-ghost" data-op="up" title="上へ">↑</button>
        <button class="btn btn-sm btn-icon btn-ghost" data-op="down" title="下へ">↓</button>
        <button class="btn btn-sm btn-icon btn-ghost btn-danger" data-op="del" title="削除">×</button>
      </div>
      <label class="in-comment"><span>コメント</span><input type="text" data-k="comment" placeholder="コメント（さらにお値引!! など）" autocomplete="off"></label>`;
    div.dataset.idx = String(idx);
    for (const inp of div.querySelectorAll('input')) inp.value = it[inp.dataset.k] ?? '';
    list.appendChild(div);
  });
}

function onItemsInput(e) {
  const inp = e.target.closest('input');
  if (!inp) return;
  const idx = Number(inp.closest('.item').dataset.idx);
  const k = inp.dataset.k;
  state.items[idx][k] = k === 'copies' ? Math.max(1, Math.min(99, parseInt(inp.value, 10) || 1)) : inp.value;
  scheduleRender();
}

function onItemsClick(e) {
  const btn = e.target.closest('button[data-op]');
  if (!btn) return;
  const idx = Number(btn.closest('.item').dataset.idx);
  const op = btn.dataset.op;
  if (op === 'add') {
    state.items.splice(idx + 1, 0, emptyItem());
    renderItemsTable();
    render();
    $(`#items-list .item[data-idx="${idx + 1}"] input`)?.focus();
    return;
  }
  if (op === 'del') {
    state.items.splice(idx, 1);
    if (state.items.length === 0) state.items.push(emptyItem());
  } else if (op === 'up' && idx > 0) {
    [state.items[idx - 1], state.items[idx]] = [state.items[idx], state.items[idx - 1]];
  } else if (op === 'down' && idx < state.items.length - 1) {
    [state.items[idx + 1], state.items[idx]] = [state.items[idx], state.items[idx + 1]];
  }
  renderItemsTable();
  render();
}

function addRow(focus = true) {
  state.items.push(emptyItem());
  renderItemsTable();
  render();
  if (focus) $('#items-list .item:last-child input')?.focus();
}

// スプレッドシート貼り付け: タブ区切り(商品名/型番/税別価格/コメント/枚数)
function parsePasted(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = line.includes('\t') ? line.split('\t') : line.split(/[,，]/);
    const [name = '', model = '', price = '', comment = '', copies = '1'] = cols.map((c) => c.trim());
    if (/^(カテゴリ|商品名|商品|品名)/.test(name) && /^(型番|品番)/.test(model)) continue; // 見出し行
    rows.push({ name, model, price, comment, copies: Math.max(1, Math.min(99, parseInt(copies, 10) || 1)) });
  }
  return rows;
}

// ---------- フォント ----------
const SAMPLE = '¥12,800 ABC-123 とってもお買い得！';

function buildFontSelect() {
  const sel = $('#font-select');
  sel.replaceChildren();
  for (const f of Fonts.fonts) {
    const o = document.createElement('option');
    o.value = f.id;
    o.textContent = f.name;
    sel.appendChild(o);
  }
  sel.value = state.fontId;
  updateFontSample();
}

function updateFontSample() {
  const s = $('#font-sample');
  s.style.setProperty('--pop-font', Fonts.familyOf(state.fontId));
  s.textContent = SAMPLE;
  const f = Fonts.fonts.find((x) => x.id === state.fontId);
  $('#font-remove-btn').hidden = !(f && f.local);
}

function openCompare() {
  const list = $('#font-list');
  list.replaceChildren();
  for (const f of Fonts.fonts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = f.id === state.fontId ? 'selected' : '';
    b.innerHTML = `<div class="fname"></div><div class="fsample"></div>`;
    b.querySelector('.fname').textContent = f.name;
    const sm = b.querySelector('.fsample');
    sm.textContent = SAMPLE;
    sm.style.fontFamily = Fonts.familyOf(f.id);
    b.addEventListener('click', () => {
      state.fontId = f.id;
      $('#font-select').value = f.id;
      updateFontSample();
      render();
      $('#compare-dialog').close();
    });
    list.appendChild(b);
  }
  $('#compare-dialog').showModal();
}

// ---------- レイアウト ----------
function buildLayoutSelect() {
  const sel = $('#layout-select');
  sel.replaceChildren();
  const groups = { builtin: document.createElement('optgroup'), custom: document.createElement('optgroup') };
  groups.builtin.label = '組込み';
  groups.custom.label = '自作（この端末に保存）';
  for (const l of Layouts.allLayouts()) {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = l.name;
    (l.builtin ? groups.builtin : groups.custom).appendChild(o);
  }
  sel.appendChild(groups.builtin);
  if (groups.custom.children.length) sel.appendChild(groups.custom);
  sel.value = currentLayout?.id ?? '';
}

function selectLayout(id) {
  currentLayout = Layouts.getLayout(id);
  state.layoutId = currentLayout.id;
  $('#layout-select').value = currentLayout.id;
  fillLayoutEditor();
  render();
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const setPath = (obj, path, v) => {
  const ks = path.split('.');
  const last = ks.pop();
  ks.reduce((o, k) => o[k], obj)[last] = v;
};

// 項目ごとの位置・見た目の編集行を生成する
function buildFieldEditor() {
  const box = $('#field-editor');
  box.replaceChildren();
  for (const k of FIELD_KEYS) {
    const p = `fields.${k}`;
    const row = document.createElement('div');
    row.className = 'field-editor-row';
    row.innerHTML = `
      <label class="fe-on"><input type="checkbox" data-path="${p}.enabled"> <strong>${FIELD_LABELS[k]}</strong></label>
      <label class="fe-num"><span>左 %</span><input type="number" data-path="${p}.x" min="-200" max="200" step="0.5"></label>
      <label class="fe-num"><span>上 %</span><input type="number" data-path="${p}.y" min="-200" max="200" step="0.5"></label>
      <label class="fe-num"><span>幅 %</span><input type="number" data-path="${p}.w" min="1" max="300" step="0.5"></label>
      <label class="fe-num"><span>高さ %</span><input type="number" data-path="${p}.h" min="1" max="300" step="0.5"></label>
      <label class="fe-num"><span>文字×</span><input type="number" data-path="${p}.sizeScale" min="0.2" max="3" step="0.1"></label>
      <label class="fe-sel"><span>寄せ</span><select data-path="${p}.align"><option value="left">左</option><option value="center">中央</option><option value="right">右</option></select></label>
      <label class="fe-sel"><span>ガイド色</span><select data-path="${p}.color">${Object.entries(GUIDE_COLORS).map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>`;
    box.appendChild(row);
  }
}

function fillLayoutEditor() {
  const l = currentLayout;
  if (!l) return;
  for (const el of $$('#layout-editor [data-path]')) {
    const v = getPath(l, el.dataset.path);
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
  }
  const locked = !!l.builtin;
  $('#editor-form').classList.toggle('editor-disabled', locked);
  $('#editor-locked-note').hidden = !locked;
  $('#layout-delete').disabled = locked;
  $('#custom-size').hidden = l.paper !== 'custom';
  const hasBg = !!(l.background?.id || l.background?.url);
  $('#bg-name').textContent = l.background?.id ? (l.background.name || '登録済み')
    : l.background?.url ? `組込み台紙（${l.background.url.split('/').pop()}）` : '未登録';
  $('#bg-remove').hidden = !hasBg;
  $('#bg-fit-row').hidden = !hasBg;
  updateEditingMode();
}

function isEditing() {
  return !!currentLayout && !currentLayout.builtin && $('#layout-editor').open;
}

function updateEditingMode() {
  $('#preview').classList.toggle('editing', isEditing());
  $('#editing-hint').hidden = !isEditing();
}

function commitLayout({ rebuildSelect = false } = {}) {
  Object.assign(currentLayout, Layouts.normalize(currentLayout));
  currentLayout.builtin = false;
  Layouts.saveCustom(currentLayout);
  if (rebuildSelect) buildLayoutSelect();
}

function onEditorInput(e) {
  const el = e.target.closest('[data-path]');
  if (!el || currentLayout.builtin) return;
  let v;
  if (el.type === 'checkbox') v = el.checked;
  else if (el.type === 'number') v = el.value === '' ? NaN : Number(el.value);
  else v = el.value;
  setPath(currentLayout, el.dataset.path, v);
  commitLayout({ rebuildSelect: el.dataset.path === 'name' });
  $('#custom-size').hidden = currentLayout.paper !== 'custom';
  scheduleRender();
}

// ---------- プレビュー上でのドラッグ(移動・リサイズ) ----------
let drag = null;
const HANDLE_PX = 18;

function onPreviewPointerDown(e) {
  if (!isEditing() || e.button !== 0) return;
  const f = e.target.closest('.pop .f');
  if (!f) return;
  const cellRect = f.parentElement.getBoundingClientRect(); // 画面上(縮小後)の px
  const fRect = f.getBoundingClientRect();
  const key = f.dataset.field;
  const mode = fRect.right - e.clientX <= HANDLE_PX && fRect.bottom - e.clientY <= HANDLE_PX ? 'resize' : 'move';
  drag = { key, mode, startX: e.clientX, startY: e.clientY, orig: { ...currentLayout.fields[key] }, cellW: cellRect.width, cellH: cellRect.height };
  f.setPointerCapture(e.pointerId);
  e.preventDefault();
}

function onPreviewPointerMove(e) {
  if (!drag) return;
  const fd = currentLayout.fields[drag.key];
  const dx = ((e.clientX - drag.startX) / drag.cellW) * 100;
  const dy = ((e.clientY - drag.startY) / drag.cellH) * 100;
  const r1 = (n) => Math.round(n * 2) / 2; // 0.5% 刻み
  // 用紙の端で止めない(パワポと同じく外に出せる。印刷時は用紙外が切れる)
  if (drag.mode === 'move') {
    fd.x = r1(drag.orig.x + dx);
    fd.y = r1(drag.orig.y + dy);
  } else {
    fd.w = r1(Math.max(2, drag.orig.w + dx));
    fd.h = r1(Math.max(2, drag.orig.h + dy));
  }
  for (const el of $$(`.pop .f[data-field="${drag.key}"]`)) {
    el.style.left = `${fd.x}%`;
    el.style.top = `${fd.y}%`;
    el.style.width = `${fd.w}%`;
    el.style.height = `${fd.h}%`;
  }
}

function onPreviewPointerUp() {
  if (!drag) return;
  drag = null;
  commitLayout();
  fillLayoutEditor();
  render();
}

// ---------- 背景(台紙) ----------
async function setBackground(file) {
  if (currentLayout.builtin) return;
  try {
    const oldId = currentLayout.background.id;
    const id = await BG.addBackground(file);
    currentLayout.background.id = id;
    currentLayout.background.url = null;
    currentLayout.background.name = file.name;
    commitLayout();
    if (oldId && !Layouts.allLayouts().some((l) => l.background?.id === oldId)) await BG.removeBackground(oldId);
    fillLayoutEditor();
    render();
  } catch (err) {
    alert(err.message);
  }
}

async function removeBackground() {
  const id = currentLayout.background?.id;
  const msg = id ? '台紙画像を外しますか？（この端末から画像も削除します）' : '組込みの台紙を外しますか？';
  if (!(id || currentLayout.background?.url) || !confirm(msg)) return;
  currentLayout.background.id = null;
  currentLayout.background.url = null;
  currentLayout.background.name = '';
  commitLayout();
  if (id && !Layouts.allLayouts().some((l) => l.background?.id === id)) await BG.removeBackground(id);
  fillLayoutEditor();
  render();
}

// ---------- 共有 / パック ----------
function openShare() {
  const url = Layouts.shareUrl(currentLayout);
  $('#share-url').value = url;
  $('#share-json').textContent = Layouts.exportJson(currentLayout);
  $('#share-bg-note').hidden = !currentLayout.background?.id;
  const box = $('#qr-box');
  box.replaceChildren();
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch {
    box.textContent = 'QRコードを作れませんでした（URLが長すぎる可能性）';
  }
  $('#share-dialog').showModal();
}

async function downloadPack() {
  const text = await Layouts.exportPack(currentLayout);
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${currentLayout.name.replace(/[\\/:*?"<>|]/g, '_')}.pop-layout.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importPackFile(file) {
  try {
    const saved = await Layouts.importPack(await file.text());
    buildLayoutSelect();
    selectLayout(saved.id);
  } catch (err) {
    alert(err.message);
  }
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = 'コピーしました';
    setTimeout(() => (btn.textContent = orig), 1500);
  } catch {
    window.prompt('コピーできませんでした。手動でコピーしてください', text);
  }
}

function handleShareHash() {
  const layout = Layouts.parseShareHash();
  if (!layout) return;
  $('#import-name').textContent = layout.name;
  const dlg = $('#import-dialog');
  $('#import-ok').onclick = () => {
    const saved = Layouts.importLayout(layout);
    buildLayoutSelect();
    selectLayout(saved.id);
    dlg.close();
  };
  dlg.addEventListener('close', () => history.replaceState(null, '', location.pathname + location.search), { once: true });
  dlg.showModal();
}

// ---------- 設定UI ----------
function syncSettingsUI() {
  $(`input[name="guide"][value="${state.guide}"]`).checked = true;
  $(`input[name="priceStyle"][value="${state.priceStyle}"]`).checked = true;
  $('#lightness').value = state.lightness;
  $('#stroke').value = state.strokeWidth;
  $('#tax-rate').value = state.taxRate;
  $('#stroke-row').hidden = state.guide !== 'outline';
}

// ---------- イベント ----------
function wireEvents() {
  $('#items-list').addEventListener('input', onItemsInput);
  $('#items-list').addEventListener('click', onItemsClick);
  $('#items-list').addEventListener('focusout', (e) => {
    // 金額欄: 数字だけならカンマを付けて見やすく
    const inp = e.target;
    if (inp.dataset?.k === 'price' && /^\d+$/.test(inp.value.trim())) {
      inp.value = Number(inp.value.trim()).toLocaleString('ja-JP');
      state.items[Number(inp.closest('.item').dataset.idx)].price = inp.value;
      scheduleRender();
    }
  });
  $('#add-row').addEventListener('click', () => addRow());
  $('#adjust-layout-btn').addEventListener('click', () => {
    if (currentLayout.builtin) {
      if (!confirm(`「${currentLayout.name}」は組込みなので直接は変えられません。\n複製して自分用のレイアウトを作りますか？`)) return;
      const copy = Layouts.duplicate(currentLayout, `${currentLayout.name}（調整版）`);
      buildLayoutSelect();
      selectLayout(copy.id);
    }
    // 編集モードに入るだけ(スクロールはしない。みんなプレビュー上のドラッグで合わせる想定。数値入力は編集欄に残す)
    $('#layout-editor').open = true;
    updateEditingMode();
  });
  $('#clear-rows').addEventListener('click', () => {
    if (!confirm('商品リストを全部消しますか？')) return;
    state.items = [emptyItem()];
    renderItemsTable();
    render();
  });
  $('#paste-btn').addEventListener('click', () => {
    $('#paste-text').value = '';
    $('#paste-dialog').showModal();
  });
  $('#paste-ok').addEventListener('click', () => {
    const rows = parsePasted($('#paste-text').value);
    if (rows.length) {
      state.items = state.items.filter((it) => it.name || it.model || it.price || it.comment);
      state.items.push(...rows);
      renderItemsTable();
      render();
    }
    $('#paste-dialog').close();
  });

  $('#font-select').addEventListener('change', (e) => {
    state.fontId = e.target.value;
    updateFontSample();
    render();
  });
  $('#font-compare-btn').addEventListener('click', openCompare);
  $('#font-add-btn').addEventListener('click', () => $('#font-file').click());
  $('#font-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const id = await Fonts.addLocalFont(file);
      state.fontId = id;
      buildFontSelect();
      render();
    } catch (err) {
      alert('フォントを読み込めませんでした: ' + err.message);
    }
  });
  $('#font-remove-btn').addEventListener('click', async () => {
    const f = Fonts.fonts.find((x) => x.id === state.fontId);
    if (!f?.local || !confirm(`「${f.name}」をこの端末から削除しますか？`)) return;
    await Fonts.removeLocalFont(f.id);
    state.fontId = Fonts.fonts[0]?.id ?? '';
    buildFontSelect();
    render();
  });

  for (const r of $$('input[name="guide"]')) {
    r.addEventListener('change', () => {
      state.guide = r.value;
      $('#stroke-row').hidden = state.guide !== 'outline';
      render();
    });
  }
  for (const r of $$('input[name="priceStyle"]')) {
    r.addEventListener('change', () => { state.priceStyle = r.value; render(); });
  }
  $('#lightness').addEventListener('input', (e) => { state.lightness = Number(e.target.value); scheduleRender(); });
  $('#stroke').addEventListener('input', (e) => { state.strokeWidth = Number(e.target.value); scheduleRender(); });
  $('#tax-rate').addEventListener('input', (e) => {
    state.taxRate = Math.max(0, Math.min(100, Number(e.target.value) || 0));
    scheduleRender();
  });

  $('#layout-select').addEventListener('change', (e) => selectLayout(e.target.value));
  $('#layout-dup').addEventListener('click', () => {
    const name = prompt('新しいレイアウトの名前', `${currentLayout.name} のコピー`);
    if (name === null) return;
    const copy = Layouts.duplicate(currentLayout, name.trim() || undefined);
    buildLayoutSelect();
    selectLayout(copy.id);
    $('#layout-editor').open = true;
    updateEditingMode();
  });
  $('#layout-delete').addEventListener('click', async () => {
    if (currentLayout.builtin || !confirm(`「${currentLayout.name}」を削除しますか？`)) return;
    await Layouts.deleteCustom(currentLayout.id);
    buildLayoutSelect();
    selectLayout(Layouts.allLayouts()[0].id);
  });
  $('#layout-share').addEventListener('click', openShare);
  $('#share-copy-url').addEventListener('click', (e) => copyText($('#share-url').value, e.target));
  $('#share-copy-json').addEventListener('click', (e) => copyText($('#share-json').textContent, e.target));
  $('#pack-export').addEventListener('click', downloadPack);
  $('#pack-import').addEventListener('click', () => $('#pack-file').click());
  $('#pack-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) await importPackFile(file);
  });
  $('#layout-editor').addEventListener('input', onEditorInput);
  $('#layout-editor').addEventListener('change', onEditorInput);
  $('#layout-editor').addEventListener('toggle', updateEditingMode);

  $('#bg-set').addEventListener('click', () => $('#bg-file').click());
  $('#bg-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) await setBackground(file);
  });
  $('#bg-remove').addEventListener('click', removeBackground);

  const pv = $('#preview');
  pv.addEventListener('pointerdown', onPreviewPointerDown);
  pv.addEventListener('pointermove', onPreviewPointerMove);
  pv.addEventListener('pointerup', onPreviewPointerUp);
  pv.addEventListener('pointercancel', onPreviewPointerUp);

  $('#print-btn').addEventListener('click', async () => {
    await document.fonts.ready;
    $('#preview').classList.remove('editing');
    fitText($('#preview'));
    window.print();
    updateEditingMode();
  });
  $('#help-btn').addEventListener('click', () => $('#help-dialog').showModal());
  for (const b of $$('[data-close]')) b.addEventListener('click', () => b.closest('dialog').close());
}

init().catch((e) => {
  console.error(e);
  showError('起動に失敗しました: ' + e.message);
});
