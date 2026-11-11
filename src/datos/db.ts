// Acceso mínimo a IndexedDB. Base de datos propia: «control-horario».

export const NOMBRE_DB = 'control-horario';
const VERSION_IDB = 1;

export const ALMACENES = ['movimientos', 'dias', 'festivos', 'ajustes', 'copias'] as const;
export type Almacen = (typeof ALMACENES)[number];

let abierta: Promise<IDBDatabase> | null = null;

export function abrir(): Promise<IDBDatabase> {
  if (abierta) return abierta;
  abierta = new Promise((ok, mal) => {
    const req = indexedDB.open(NOMBRE_DB, VERSION_IDB);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Solo se crean almacenes que falten: una actualización nunca borra datos.
      if (!db.objectStoreNames.contains('movimientos')) db.createObjectStore('movimientos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('dias')) db.createObjectStore('dias', { keyPath: 'fecha' });
      if (!db.objectStoreNames.contains('festivos')) db.createObjectStore('festivos', { keyPath: 'fecha' });
      if (!db.objectStoreNames.contains('ajustes')) db.createObjectStore('ajustes', { keyPath: 'clave' });
      if (!db.objectStoreNames.contains('copias')) db.createObjectStore('copias', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); abierta = null; };
      ok(db);
    };
    req.onerror = () => { abierta = null; mal(req.error); };
    req.onblocked = () => mal(new Error('La base de datos está bloqueada por otra pestaña.'));
  });
  return abierta;
}

/** Cierra la conexión (para pruebas). */
export async function cerrar() {
  if (abierta) (await abierta).close();
  abierta = null;
}

export function pedir<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((ok, mal) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
}

/**
 * Ejecuta `fn` dentro de una transacción y resuelve solo cuando la
 * transacción se ha completado (los datos ya están escritos).
 */
export async function transaccion<T>(
  almacenes: Almacen[],
  modo: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await abrir();
  const tx = db.transaction(almacenes, modo, { durability: 'strict' } as IDBTransactionOptions);
  const fin = new Promise<void>((ok, mal) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error ?? new Error('Transacción cancelada'));
  });
  let resultado: T;
  try {
    resultado = await fn(tx);
  } catch (e) {
    try { tx.abort(); } catch { /* ya terminada */ }
    await fin.catch(() => undefined);
    throw e;
  }
  await fin;
  return resultado;
}

export const todos = <T>(tx: IDBTransaction, a: Almacen) => pedir<T[]>(tx.objectStore(a).getAll() as IDBRequest<T[]>);
