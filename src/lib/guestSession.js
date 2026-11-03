// Guest session persistence.
//
// A guest's token is written to three places on purpose:
//   localStorage    — survives tab close, the normal case.
//   sessionStorage  — instant, survives client-side navigation even if
//                     localStorage is disabled.
//   IndexedDB       — read first on boot, and the only copy left when a
//                     browser clears "site data" but keeps a PWA install.
//
// The last event slug is stored alongside it so an installed app can reopen the
// right wedding even when the token itself has expired.

const SESSION_KEY = 'oge_session';
const EVENT_KEY = 'oge_last_event';
const DB_NAME = 'our-guests-eyes';
const DB_VERSION = 1;
const STORE = 'session';

let dbPromise = null;

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      let request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch {
        resolve(null);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }
  return dbPromise;
}

async function idbGet(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(key) {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function parse(raw) {
  try {
    const value = JSON.parse(raw || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function isSession(value) {
  return Boolean(value && typeof value === 'object' && value.token && value.slug);
}

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    /* private mode / quota — other stores still hold it */
  }
}

function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

/** Synchronous read for code that cannot await (feeds, guestsbook writes). */
export function readStoredSessionSync() {
  if (typeof window === 'undefined') return null;
  const fromSession = parse(safeGet(window.sessionStorage, SESSION_KEY));
  if (isSession(fromSession)) return fromSession;
  const fromLocal = parse(safeGet(window.localStorage, SESSION_KEY));
  return isSession(fromLocal) ? fromLocal : null;
}

/** Boot read: IndexedDB first, then the web storages. */
export async function readStoredSession() {
  if (typeof window === 'undefined') return null;
  const cached = await idbGet(SESSION_KEY);
  if (isSession(cached)) return cached;
  const sync = readStoredSessionSync();
  if (sync) {
    void idbSet(SESSION_KEY, sync);
    return sync;
  }
  return null;
}

export async function writeStoredSession(data) {
  if (typeof window === 'undefined' || !isSession(data)) return;
  const json = JSON.stringify(data);
  safeSet(window.sessionStorage, SESSION_KEY, json);
  safeSet(window.localStorage, SESSION_KEY, json);
  await Promise.all([idbSet(SESSION_KEY, data), idbSet(EVENT_KEY, data.slug)]);
}

export async function clearStoredSession() {
  if (typeof window === 'undefined') return;
  safeRemove(window.sessionStorage, SESSION_KEY);
  safeRemove(window.localStorage, SESSION_KEY);
  await idbDelete(SESSION_KEY);
}

export function readLastEventSync() {
  if (typeof window === 'undefined') return null;
  return safeGet(window.localStorage, EVENT_KEY) || null;
}

/** The wedding this device last stepped into — kept even after sign-out. */
export async function readLastEvent() {
  if (typeof window === 'undefined') return null;
  const fromDb = await idbGet(EVENT_KEY);
  if (typeof fromDb === 'string' && fromDb) return fromDb;
  return readLastEventSync();
}

export async function rememberEvent(slug) {
  if (typeof window === 'undefined' || !slug) return;
  safeSet(window.localStorage, EVENT_KEY, slug);
  await idbSet(EVENT_KEY, slug);
}

export { SESSION_KEY, EVENT_KEY };
