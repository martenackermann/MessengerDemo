// src/services/keystore.ts
// Persists CryptoKey objects across page reloads using IndexedDB.
// localStorage cannot store CryptoKey — IndexedDB can via the structured clone algorithm.

const DB_NAME = "e2ee-chat";
const DB_VERSION = 1;
const STORE_KEYS = "keys";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_KEYS);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    console.log(req)
  });
}

export async function keystoreSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KEYS, "readwrite");
    tx.objectStore(STORE_KEYS).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function keystoreGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KEYS, "readonly");
    const req = tx.objectStore(STORE_KEYS).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function keystoreDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KEYS, "readwrite");
    tx.objectStore(STORE_KEYS).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Specific helpers for our key types ----

export async function saveKeyPair(userId: string, keyPair: CryptoKeyPair): Promise<void> {
  await keystoreSet(`keypair:${userId}`, keyPair);
}

export async function loadKeyPair(userId: string): Promise<CryptoKeyPair | null> {
  return keystoreGet<CryptoKeyPair>(`keypair:${userId}`);
}

export async function deleteKeyPair(userId: string): Promise<void> {
  await keystoreDelete(`keypair:${userId}`);
}

export async function saveRoomKey(roomId: string, key: CryptoKey): Promise<void> {

  await keystoreSet(`roomkey:${roomId}`, key);

}

export async function loadRoomKey(roomId: string): Promise<CryptoKey | null> {

  return keystoreGet<CryptoKey>(`roomkey:${roomId}`);

}

export async function deleteRoomKey(roomId: string): Promise<void> {

  await keystoreDelete(`roomkey:${roomId}`);

}
