// Operaciones sobre los datos guardados. Cada operación valida antes de escribir
// y solo se resuelve cuando la transacción de IndexedDB ha terminado.
import { estadoJornada, motivoInactivo, ordenar, permitido, sesionAbierta, validarConjunto, analizar } from '../motor/secuencia';
import { alMinuto, fechaDe, horaDe, instanteMadrid, leerHora, sumarDias, type Fecha } from '../motor/tiempo';
import type { Config, Datos, Dia, Festivo, Marca, Movimiento, TipoMov } from '../motor/tipos';
import { esLaborableBase } from '../motor/calculo';
import { pedir, todos, transaccion } from './db';
import { compararResumen, crearCopia, leerCopia, resumir, type Copia } from './formatoCopia';
import { CONFIG_INICIAL, FESTIVOS_INICIALES } from './inicial';
import { migrar, VERSION_DATOS } from './migraciones';

export interface Meta {
  clave: 'meta';
  version: number;
  asistenteHecho: boolean;
  ultimaCopiaAuto?: number;
  ultimaCopiaFuera?: number;
  /** Copia semanal creada y aún no guardada fuera ni pospuesta. */
  avisoCopia?: boolean;
  /** Nombre de la copia interna pendiente de guardar fuera. */
  copiaPendienteId?: string;
}

export interface CopiaInterna {
  id: string;
  fecha: number;
  tipo: 'auto' | 'manual' | 'antes-restaurar' | 'antes-migrar';
  tamano: number;
  json: string;
}

export interface Estado {
  datos: Datos;
  meta: Meta;
}

export class ErrorUsuario extends Error {}

const nuevoId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

async function leer(tx: IDBTransaction): Promise<Estado> {
  const [movimientos, dias, festivos] = await Promise.all([
    todos<Movimiento>(tx, 'movimientos'),
    todos<Dia>(tx, 'dias'),
    todos<Festivo>(tx, 'festivos'),
  ]);
  const ajustes = tx.objectStore('ajustes');
  const cfg = await pedir<any>(ajustes.get('config'));
  const meta = await pedir<any>(ajustes.get('meta'));
  return {
    datos: { movimientos: ordenar(movimientos), dias, festivos, config: cfg?.valor },
    meta,
  };
}

/** Escribe en la transacción el conjunto completo de datos (reemplazo total). */
async function escribirTodo(tx: IDBTransaction, d: Datos) {
  for (const a of ['movimientos', 'dias', 'festivos'] as const) await pedir(tx.objectStore(a).clear());
  for (const m of d.movimientos) tx.objectStore('movimientos').put(m);
  for (const x of d.dias) tx.objectStore('dias').put(x);
  for (const f of d.festivos) tx.objectStore('festivos').put(f);
  await pedir(tx.objectStore('ajustes').put({ clave: 'config', valor: d.config }));
}

/**
 * Abre los datos. Si la base está vacía, carga la configuración y los festivos
 * iniciales. Si los datos son de una versión anterior, hace copia y migra.
 */
export async function cargar(
  ahora: number,
  migracion: { version: number; tabla?: Record<number, (d: any) => any> } = { version: VERSION_DATOS },
): Promise<Estado> {
  // Lectura previa (crearCopia es asíncrona y no puede ir dentro de la transacción).
  const previo = await transaccion(['movimientos', 'dias', 'festivos', 'ajustes'], 'readonly', leer);
  if (!previo.meta) {
    await transaccion(['ajustes', 'festivos'], 'readwrite', async (tx) => {
      const meta: Meta = { clave: 'meta', version: migracion.version, asistenteHecho: false };
      tx.objectStore('ajustes').put({ clave: 'config', valor: structuredClone(CONFIG_INICIAL) });
      for (const f of FESTIVOS_INICIALES) tx.objectStore('festivos').put(f);
      await pedir(tx.objectStore('ajustes').put(meta));
    });
  } else if (previo.meta.version > migracion.version) {
    throw new Error('Los datos son de una versión más nueva de la app. Recarga la página para actualizarla.');
  } else if (previo.meta.version < migracion.version) {
    const copia = await crearCopia(previo.datos, ahora);
    const migrados = migrar(previo.datos, previo.meta.version, migracion.version, migracion.tabla);
    await transaccion(['movimientos', 'dias', 'festivos', 'ajustes', 'copias'], 'readwrite', async (tx) => {
      const json = JSON.stringify(copia);
      tx.objectStore('copias').put({ id: `${ahora}-antes-migrar-${previo.meta.version}`, fecha: ahora, tipo: 'antes-migrar', tamano: json.length, json });
      await escribirTodo(tx, migrados);
      await pedir(tx.objectStore('ajustes').put({ ...previo.meta, version: migracion.version }));
    });
  }
  return transaccion(['movimientos', 'dias', 'festivos', 'ajustes'], 'readonly', leer);
}

async function guardarMeta(cambios: Partial<Meta>) {
  await transaccion(['ajustes'], 'readwrite', async (tx) => {
    const st = tx.objectStore('ajustes');
    const meta = await pedir<Meta>(st.get('meta'));
    await pedir(st.put({ ...meta, ...cambios, clave: 'meta' }));
  });
}

/** Sesión abierta de un día anterior a la que el usuario aún no ha respondido. */
export function olvidoSinResponder(movs: Movimiento[], ahora: number): Movimiento | null {
  const s = sesionAbierta(movs);
  if (!s || s.entrada.pendiente) return null;
  const hoy = fechaDe(ahora);
  return fechaDe(s.entrada.t) < hoy && s.entrada.sigoFecha !== hoy ? s.entrada : null;
}

// ---------- Fichajes ----------

/** Registra un fichaje desde un botón. Valida con la máquina de estados. */
export async function fichar(tipo: TipoMov, ahora: number): Promise<Movimiento> {
  const t = alMinuto(ahora);
  return transaccion(['movimientos'], 'readwrite', async (tx) => {
    const st = tx.objectStore('movimientos');
    const movs = ordenar(await pedir<Movimiento[]>(st.getAll() as IDBRequest<Movimiento[]>));
    if (olvidoSinResponder(movs, ahora)) throw new ErrorUsuario('Primero responde al aviso de la jornada abierta.');
    const estado = estadoJornada(movs);
    if (!permitido(estado, tipo)) throw new ErrorUsuario(motivoInactivo(estado, tipo));
    const ultimo = movs[movs.length - 1];
    if (ultimo && t < ultimo.t)
      throw new ErrorUsuario('La hora del teléfono es anterior al último fichaje. Revisa la fecha y hora del teléfono.');
    const seq = movs.reduce((s, m) => Math.max(s, m.seq), 0) + 1;
    const nuevo: Movimiento = { id: nuevoId(), t, tipo, seq, origen: 'boton' };
    const errores = validarConjunto([...movs, nuevo], ahora);
    if (errores.length) throw new ErrorUsuario(errores[0]);
    await pedir(st.add(nuevo));
    return nuevo;
  });
}

export type RespuestaOlvido =
  | { opcion: 'sigo' }
  | { opcion: 'pendiente' }
  | { opcion: 'hora'; fecha: Fecha; hora: string };

export async function responderOlvido(r: RespuestaOlvido, ahora: number): Promise<void> {
  await transaccion(['movimientos'], 'readwrite', async (tx) => {
    const st = tx.objectStore('movimientos');
    const movs = ordenar(await pedir<Movimiento[]>(st.getAll() as IDBRequest<Movimiento[]>));
    const s = sesionAbierta(movs);
    if (!s) throw new ErrorUsuario('No hay ninguna jornada abierta.');
    const e = { ...s.entrada };
    if (r.opcion === 'sigo') {
      e.sigoFecha = fechaDe(ahora);
      delete e.pendiente;
      await pedir(st.put(e));
    } else if (r.opcion === 'pendiente') {
      e.pendiente = true;
      await pedir(st.put(e));
    } else {
      const hm = leerHora(r.hora);
      if (!hm) throw new ErrorUsuario('Escribe la hora con el formato HH:MM, por ejemplo 17:00.');
      const t = instanteMadrid(r.fecha, hm[0], hm[1]);
      if (t === null) throw new ErrorUsuario('Esa hora no existe ese día (cambio de hora).');
      const seq = movs.reduce((x, m) => Math.max(x, m.seq), 0) + 1;
      const salida: Movimiento = { id: nuevoId(), t, tipo: 'S', seq, origen: 'manual', original: null, modificado: alMinuto(ahora) };
      delete e.pendiente;
      const nuevos = movs.map((m) => (m.id === e.id ? e : m)).concat(salida);
      const ultimo = s.movs[s.movs.length - 1];
      if (t < ultimo.t) throw new ErrorUsuario(`La salida debe ser posterior a ${horaDe(ultimo.t)} del ${fechaDe(ultimo.t).split('-').reverse().join('/')}.`);
      const errores = validarConjunto(nuevos, ahora);
      if (errores.length) throw new ErrorUsuario(errores[0]);
      st.put(e);
      await pedir(st.add(salida));
    }
  });
}

// ---------- Edición por día ----------

export interface FilaEdicion {
  /** id del movimiento existente; vacío si es nuevo. */
  id?: string;
  tipo: TipoMov;
  hora: string; // 'HH:MM'
}

/**
 * Sustituye los movimientos de un día por los de la edición. Valida el
 * conjunto completo y solo guarda si es correcto.
 */
export async function guardarDia(fecha: Fecha, filas: FilaEdicion[], ahora: number): Promise<void> {
  const errores: string[] = [];
  const instantes: number[] = filas.map((f, i) => {
    const hm = leerHora(f.hora);
    if (!hm) { errores.push(`Fila ${i + 1}: escribe la hora con el formato HH:MM.`); return NaN; }
    const t = instanteMadrid(fecha, hm[0], hm[1]);
    if (t === null) { errores.push(`Fila ${i + 1}: la hora ${f.hora} no existe ese día (cambio de hora).`); return NaN; }
    return t;
  });
  for (let i = 1; i < instantes.length; i++)
    if (instantes[i] < instantes[i - 1]) errores.push(`Las horas deben ir en orden: la fila ${i + 1} (${filas[i].hora}) es anterior a la ${i} (${filas[i - 1].hora}).`);
  if (errores.length) throw new ErrorUsuario(errores.join('\n'));

  await transaccion(['movimientos'], 'readwrite', async (tx) => {
    const st = tx.objectStore('movimientos');
    const movs = await pedir<Movimiento[]>(st.getAll() as IDBRequest<Movimiento[]>);
    const delDia = movs.filter((m) => fechaDe(m.t) === fecha);
    const otros = movs.filter((m) => fechaDe(m.t) !== fecha);
    const porId = new Map(delDia.map((m) => [m.id, m]));
    let seq = movs.reduce((s, m) => Math.max(s, m.seq), 0);
    const mod = alMinuto(ahora);
    const nuevos: Movimiento[] = filas.map((f, i) => {
      const t = instantes[i];
      const prev = f.id ? porId.get(f.id) : undefined;
      if (!prev) return { id: nuevoId(), t, tipo: f.tipo, seq: 0, origen: 'manual', original: null, modificado: mod };
      if (prev.t === t && prev.tipo === f.tipo) return { ...prev };
      return {
        ...prev, t, tipo: f.tipo, modificado: mod,
        original: prev.original !== undefined ? prev.original : { t: prev.t, tipo: prev.tipo },
      };
    });
    // A igualdad de minuto manda el orden de la edición.
    for (const n of nuevos) n.seq = ++seq;

    let todos = [...otros, ...nuevos];
    // Una sesión que queda completa deja de estar pendiente.
    const { sesiones } = analizar(todos);
    const limpiar = new Set(sesiones.filter((s) => s.salida && (s.entrada.pendiente || s.entrada.sigoFecha)).map((s) => s.entrada.id));
    todos = todos.map((m) => {
      if (!limpiar.has(m.id)) return m;
      const c = { ...m }; delete c.pendiente; delete c.sigoFecha; return c;
    });
    const errs = validarConjunto(todos, ahora);
    if (errs.length) throw new ErrorUsuario(errs.join('\n'));
    for (const m of delDia) if (!todos.some((x) => x.id === m.id)) st.delete(m.id);
    for (const m of todos) {
      const antes = movs.find((x) => x.id === m.id);
      if (!antes || JSON.stringify(antes) !== JSON.stringify(m)) st.put(m);
    }
    await pedir(st.count());
  });
}

/** Borra los movimientos anteriores a la fecha de inicio (de prueba). */
export async function borrarPrueba(): Promise<number> {
  return transaccion(['movimientos', 'ajustes'], 'readwrite', async (tx) => {
    const cfg = (await pedir<any>(tx.objectStore('ajustes').get('config'))).valor as Config;
    const st = tx.objectStore('movimientos');
    const movs = await pedir<Movimiento[]>(st.getAll() as IDBRequest<Movimiento[]>);
    const borrar = movs.filter((m) => fechaDe(m.t) < cfg.fechaInicio);
    const quedan = movs.filter((m) => fechaDe(m.t) >= cfg.fechaInicio);
    // Una sesión de prueba que siga en un día computable no se puede partir.
    if (analizar(quedan).errores.length)
      throw new ErrorUsuario('Hay una jornada que empieza antes de la fecha de inicio y termina después. Corrígela primero en el histórico.');
    for (const m of borrar) st.delete(m.id);
    await pedir(st.count());
    return borrar.length;
  });
}

// ---------- Días marcados y observaciones ----------

export async function marcarDia(fecha: Fecha, marca: Marca | undefined): Promise<void> {
  await transaccion(['dias', 'festivos', 'ajustes'], 'readwrite', async (tx) => {
    const cfg = (await pedir<any>(tx.objectStore('ajustes').get('config'))).valor as Config;
    const fest = await todos<Festivo>(tx, 'festivos');
    if (marca && fecha < cfg.fechaInicio) throw new ErrorUsuario('Ese día es anterior a la fecha de inicio.');
    if (marca && !esLaborableBase(fecha, cfg.horarios, new Set(fest.map((f) => f.fecha))))
      throw new ErrorUsuario('Solo se pueden marcar días laborables (no sábados, domingos ni festivos).');
    const st = tx.objectStore('dias');
    const d = (await pedir<Dia | undefined>(st.get(fecha))) ?? { fecha };
    const n: Dia = { ...d };
    if (marca) n.marca = marca; else delete n.marca;
    if (!n.marca && !n.obs) await pedir(st.delete(fecha));
    else await pedir(st.put(n));
  });
}

/** Marca un rango: solo días laborables y sin otra marca. */
export async function marcarRango(desde: Fecha, hasta: Fecha, marca: Marca): Promise<{ marcados: Fecha[]; conOtraMarca: Fecha[] }> {
  if (hasta < desde) throw new ErrorUsuario('La fecha final es anterior a la inicial.');
  return transaccion(['dias', 'festivos', 'ajustes'], 'readwrite', async (tx) => {
    const cfg = (await pedir<any>(tx.objectStore('ajustes').get('config'))).valor as Config;
    const fest = new Set((await todos<Festivo>(tx, 'festivos')).map((f) => f.fecha));
    const st = tx.objectStore('dias');
    const existentes = new Map((await todos<Dia>(tx, 'dias')).map((d) => [d.fecha, d]));
    const marcados: Fecha[] = [], conOtraMarca: Fecha[] = [];
    for (let f = desde < cfg.fechaInicio ? cfg.fechaInicio : desde; f <= hasta; f = sumarDias(f, 1)) {
      if (!esLaborableBase(f, cfg.horarios, fest)) continue;
      const d = existentes.get(f);
      if (d?.marca && d.marca !== marca) { conOtraMarca.push(f); continue; }
      st.put({ ...(d ?? { fecha: f }), marca });
      marcados.push(f);
    }
    await pedir(st.count());
    return { marcados, conOtraMarca };
  });
}

export async function guardarObservacion(fecha: Fecha, obs: string): Promise<void> {
  await transaccion(['dias'], 'readwrite', async (tx) => {
    const st = tx.objectStore('dias');
    const d = (await pedir<Dia | undefined>(st.get(fecha))) ?? { fecha };
    const n: Dia = { ...d, obs: obs.trim() || undefined };
    if (!n.obs) delete n.obs;
    if (!n.marca && !n.obs) await pedir(st.delete(fecha));
    else await pedir(st.put(n));
  });
}

// ---------- Festivos y configuración ----------

export async function guardarFestivo(f: Festivo, fechaAnterior?: Fecha): Promise<void> {
  await transaccion(['festivos'], 'readwrite', async (tx) => {
    const st = tx.objectStore('festivos');
    if (fechaAnterior && fechaAnterior !== f.fecha) st.delete(fechaAnterior);
    const limpio: Festivo = { fecha: f.fecha, nombre: f.nombre.trim() || 'Festivo' };
    if (f.sinConfirmar) limpio.sinConfirmar = true;
    await pedir(st.put(limpio));
  });
}

export async function borrarFestivo(fecha: Fecha): Promise<void> {
  await transaccion(['festivos'], 'readwrite', async (tx) => { await pedir(tx.objectStore('festivos').delete(fecha)); });
}

export async function guardarConfig(c: Config): Promise<void> {
  if (!c.horarios.length) throw new ErrorUsuario('Debe haber al menos un horario.');
  await transaccion(['ajustes'], 'readwrite', async (tx) => {
    await pedir(tx.objectStore('ajustes').put({ clave: 'config', valor: c }));
  });
}

export async function terminarAsistente(): Promise<void> {
  await guardarMeta({ asistenteHecho: true });
}

// ---------- Copias de seguridad ----------

export async function leerDatos(): Promise<Estado> {
  return transaccion(['movimientos', 'dias', 'festivos', 'ajustes'], 'readonly', leer);
}

export async function crearCopiaAhora(ahora: number, tipo: CopiaInterna['tipo'] = 'manual'): Promise<CopiaInterna> {
  const { datos } = await leerDatos();
  const copia = await crearCopia(datos, ahora);
  const json = JSON.stringify(copia);
  const ci: CopiaInterna = { id: `${ahora}-${tipo}-${nuevoId().slice(0, 8)}`, fecha: ahora, tipo, tamano: json.length, json };
  await transaccion(['copias', 'ajustes'], 'readwrite', async (tx) => {
    tx.objectStore('copias').put(ci);
    if (tipo === 'auto') {
      const st = tx.objectStore('ajustes');
      const meta = await pedir<Meta>(st.get('meta'));
      await pedir(st.put({ ...meta, ultimaCopiaAuto: ahora, avisoCopia: true, copiaPendienteId: ci.id }));
    }
  });
  return ci;
}

/** Crea la copia semanal si han pasado 7 días o más desde la última. */
export async function copiaSemanalSiToca(ahora: number): Promise<CopiaInterna | null> {
  const { meta } = await leerDatos();
  const ultima = meta?.ultimaCopiaAuto;
  if (ultima !== undefined && ahora - ultima < 7 * 86_400_000) return null;
  return crearCopiaAhora(ahora, 'auto');
}

export async function listarCopias(): Promise<CopiaInterna[]> {
  const r = await transaccion(['copias'], 'readonly', (tx) => todos<CopiaInterna>(tx, 'copias'));
  return r.sort((a, b) => b.fecha - a.fecha);
}

export async function leerCopiaInterna(id: string): Promise<CopiaInterna | undefined> {
  return transaccion(['copias'], 'readonly', (tx) => pedir<CopiaInterna | undefined>(tx.objectStore('copias').get(id)));
}

export async function borrarCopia(id: string): Promise<void> {
  await transaccion(['copias'], 'readwrite', async (tx) => { await pedir(tx.objectStore('copias').delete(id)); });
}

export async function marcarCopiaGuardadaFuera(ahora: number): Promise<void> {
  await guardarMeta({ ultimaCopiaFuera: ahora, avisoCopia: false });
}

export async function posponerAvisoCopia(): Promise<void> {
  await guardarMeta({ avisoCopia: false });
}

export interface PreviaRestauracion {
  copia: Copia;
  datos: Datos;
}

export async function prepararRestauracion(texto: string): Promise<PreviaRestauracion> {
  try {
    return await leerCopia(texto);
  } catch (e) {
    throw new ErrorUsuario((e as Error).message);
  }
}

/**
 * Restaura una copia ya validada: guarda antes una copia del estado actual,
 * sustituye los datos y comprueba el resumen recalculado.
 */
export async function restaurar(p: PreviaRestauracion, ahora: number): Promise<{ diferencias: string[] }> {
  const errores = validarConjunto(p.datos.movimientos, Math.max(ahora, p.copia.fecha));
  if (errores.length) throw new ErrorUsuario('La copia tiene fichajes incoherentes: ' + errores[0]);
  const actual = await leerDatos();
  const copiaActual = await crearCopia(actual.datos, ahora);
  await transaccion(['movimientos', 'dias', 'festivos', 'ajustes', 'copias'], 'readwrite', async (tx) => {
    const json = JSON.stringify(copiaActual);
    tx.objectStore('copias').put({ id: `${ahora}-antes-restaurar-${nuevoId().slice(0, 8)}`, fecha: ahora, tipo: 'antes-restaurar', tamano: json.length, json });
    await escribirTodo(tx, p.datos);
  });
  const restaurado = await leerDatos();
  return { diferencias: compararResumen(p.copia.resumen, resumir(restaurado.datos, p.copia.resumen.calculadoEn)) };
}
