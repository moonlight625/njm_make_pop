// 台紙(背景画像)の保存: 会社ロゴ入りのため公開リポジトリには置かず、端末の IndexedDB にだけ保存する
const DB_NAME = 'pop-backgrounds';
const STORE = 'images';
const urlCache = new Map(); // id -> object URL

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

const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];

// { id, name, type, blob } を保存して id を返す
export async function addBackground(file, id) {
  if (!ACCEPT.includes(file.type)) throw new Error('PNG / JPEG / WebP / SVG の画像ファイルを選んでください');
  const rec = {
    id: id || 'bg-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name: file.name || 'background',
    type: file.type,
    blob: file instanceof Blob ? file : new Blob([file], { type: file.type }),
  };
  await withStore('readwrite', (s) => s.put(rec));
  return rec.id;
}

export async function getBackground(id) {
  if (!id) return null;
  try {
    return (await withStore('readonly', (s) => s.get(id))) || null;
  } catch {
    return null;
  }
}

export async function removeBackground(id) {
  if (!id) return;
  await withStore('readwrite', (s) => s.delete(id));
  const u = urlCache.get(id);
  if (u) { URL.revokeObjectURL(u); urlCache.delete(id); }
}

// 描画用の object URL(無ければ null)。一度作ったら使い回す
export async function urlFor(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await getBackground(id);
  if (!rec) return null;
  const u = URL.createObjectURL(rec.blob);
  urlCache.set(id, u);
  return u;
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
}
