import { base44 } from '@/api/base44Client';
import { fetchAllPages } from '@/lib/fetchAll';

/**
 * Catálogo del TPV en caché local (auditoría B-48). Antes cada entrada en /venta o
 * /tpv descargaba los 9.100 artículos (2,8–3,8 s). Ahora se guardan en IndexedDB
 * y al volver solo se piden los artículos cambiados desde la última vez
 * (updated_date). Cada 12 h, o si algo falla, se descarga todo de nuevo.
 * Sin IndexedDB (modo privado) funciona como antes.
 */
const DB = 'tpv-cache';
const STORE = 'catalog';
const FULL_EVERY_MS = 12 * 60 * 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('sin IndexedDB')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(out?.result);
    tx.onerror = () => reject(tx.error);
  });
}

const read = () => idb('readonly', (store) => store.get('products')).catch(() => null);
const write = (value) => idb('readwrite', (store) => store.put(value, 'products')).catch(() => null);

export async function loadCatalog(fields) {
  const withDate = [...new Set([...fields, 'updated_date'])];
  const cached = await read();
  const now = Date.now();
  const sameShape = cached && JSON.stringify(cached.fields) === JSON.stringify(withDate);
  if (sameShape && now - cached.full_at < FULL_EVERY_MS && Array.isArray(cached.items)) {
    try {
      const changed = await fetchAllPages(base44.entities.Product, { updated_date: { $gt: cached.synced_at } }, { fields: withDate });
      const byId = new Map(cached.items.map((item) => [item.id, item]));
      for (const item of changed) byId.set(item.id, item);
      const items = [...byId.values()];
      const latest = changed.reduce((max, item) => (item.updated_date > max ? item.updated_date : max), cached.synced_at);
      write({ ...cached, items, synced_at: latest });
      return items;
    } catch {
      // Delta failed: fall through to a full download.
    }
  }
  const items = await fetchAllPages(base44.entities.Product, {}, { fields: withDate });
  const latest = items.reduce((max, item) => (item.updated_date > max ? item.updated_date : max), '');
  write({ fields: withDate, items, synced_at: latest || new Date(0).toISOString(), full_at: now });
  return items;
}
