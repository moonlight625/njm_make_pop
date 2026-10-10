// フォント管理: vendor/fonts/fonts.json(配布フォント) + IndexedDB(この端末だけのフォント)
export const fonts = []; // { id, name, file?, local }

export function familyOf(id) {
  return `"pop-${id}"`;
}

// 配布フォントの一覧を読み、@font-face を登録する(実際のダウンロードは使われた時だけ起きる)
export async function loadManifest() {
  const res = await fetch('vendor/fonts/fonts.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`fonts.json ${res.status}`);
  const list = await res.json();
  const style = document.createElement('style');
  style.id = 'pop-font-faces';
  style.textContent = list
    .map((f) => `@font-face{font-family:"pop-${f.id}";src:url("vendor/fonts/${f.file}");font-display:swap;}`)
    .join('\n');
  document.head.appendChild(style);
  for (const f of list) fonts.push({ id: f.id, name: f.name, file: f.file, local: false });
}

// ---- この端末だけのフォント(IndexedDB) ----
const DB_NAME = 'pop-fonts';
const STORE = 'fonts';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      })
  );
}

async function registerLocal(rec) {
  const face = new FontFace(`pop-${rec.id}`, rec.data);
  await face.load();
  document.fonts.add(face);
  fonts.push({ id: rec.id, name: rec.name, local: true });
}

export async function loadLocalFonts() {
  if (!('indexedDB' in window)) return;
  try {
    const all = (await withStore('readonly', (s) => s.getAll())) || [];
    for (const rec of all) {
      try { await registerLocal(rec); } catch (e) { console.warn('local font load failed', rec.id, e); }
    }
  } catch (e) {
    console.warn('IndexedDB unavailable', e);
  }
}

export async function addLocalFont(file) {
  const id = 'local-' + Date.now().toString(36);
  const data = await file.arrayBuffer();
  const name = file.name.replace(/\.[^.]+$/, '') + '（この端末のみ）';
  const rec = { id, name, data };
  await registerLocal(rec); // 先に読めるか確認(壊れたファイルなら例外)
  await withStore('readwrite', (s) => s.put(rec));
  return id;
}

export async function removeLocalFont(id) {
  await withStore('readwrite', (s) => s.delete(id));
  const i = fonts.findIndex((f) => f.id === id);
  if (i >= 0) fonts.splice(i, 1);
  for (const face of document.fonts) {
    if (face.family === `pop-${id}` || face.family === `"pop-${id}"`) document.fonts.delete(face);
  }
}
