// Formato de las copias de seguridad (JSON con suma de comprobación SHA-256).
import { calcular } from '../motor/calculo';
import { fechaDe, horaDe } from '../motor/tiempo';
import type { Datos } from '../motor/tipos';
import { migrar, VERSION_DATOS } from './migraciones';

export const FORMATO = 'control-horario-copia';

export interface ResumenCopia {
  /** Instante con el que se calculó el resumen. */
  calculadoEn: number;
  desde: string | null;
  hasta: string | null;
  movimientos: number;
  diasMarcados: number;
  festivos: number;
  ADIC: number;
  DEF: number;
  saldo: number;
}

export interface Copia {
  formato: typeof FORMATO;
  version: number;
  fecha: number;
  datos: Datos;
  resumen: ResumenCopia;
  suma: string;
}

/** Datos en orden estable, para que la suma no dependa del orden de lectura. */
export function normalizar(d: Datos): Datos {
  return {
    movimientos: [...d.movimientos].sort((a, b) => a.t - b.t || a.seq - b.seq),
    dias: [...d.dias].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    festivos: [...d.festivos].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    config: d.config,
  };
}

export function resumir(d: Datos, ahora: number): ResumenCopia {
  const r = calcular(d, ahora);
  const fechas = d.movimientos.map((m) => fechaDe(m.t)).sort();
  return {
    calculadoEn: ahora,
    desde: fechas[0] ?? null,
    hasta: fechas[fechas.length - 1] ?? null,
    movimientos: d.movimientos.length,
    diasMarcados: d.dias.length,
    festivos: d.festivos.length,
    ADIC: r.totales.ADIC,
    DEF: r.totales.DEF,
    saldo: r.totales.saldo,
  };
}

async function sha256(txt: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const contenido = (c: Omit<Copia, 'suma'>) =>
  JSON.stringify({ formato: c.formato, version: c.version, fecha: c.fecha, datos: c.datos, resumen: c.resumen });

export async function crearCopia(d: Datos, ahora: number): Promise<Copia> {
  const datos = normalizar(d);
  const base = { formato: FORMATO, version: VERSION_DATOS, fecha: ahora, datos, resumen: resumir(datos, ahora) } as const;
  return { ...base, suma: await sha256(contenido(base)) };
}

export function nombreArchivoCopia(fecha: number): string {
  return `control-horario_copia_${fechaDe(fecha)}_${horaDe(fecha).replace(':', '')}.json`;
}

/** Valida formato y suma, aplica migraciones y comprueba el resumen. */
export async function leerCopia(texto: string): Promise<{ copia: Copia; datos: Datos }> {
  let c: any;
  try {
    c = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es una copia válida (no se puede leer).');
  }
  if (!c || c.formato !== FORMATO) throw new Error('El archivo no es una copia de Control Horario.');
  if (typeof c.version !== 'number' || !c.datos || !c.resumen || typeof c.suma !== 'string')
    throw new Error('A la copia le faltan partes.');
  if ((await sha256(contenido(c))) !== c.suma)
    throw new Error('La suma de comprobación no coincide: la copia está dañada o se ha modificado.');
  const datos = normalizar(migrar(c.datos, c.version));
  const { movimientos, dias, festivos, config } = datos;
  if (!Array.isArray(movimientos) || !Array.isArray(dias) || !Array.isArray(festivos) || !config?.fechaInicio)
    throw new Error('A la copia le faltan datos.');
  return { copia: c as Copia, datos };
}

/** Diferencias entre el resumen guardado y el recalculado (vacía si coinciden). */
export function compararResumen(a: ResumenCopia, b: ResumenCopia): string[] {
  const dif: string[] = [];
  for (const k of ['movimientos', 'diasMarcados', 'festivos', 'ADIC', 'DEF', 'saldo', 'desde', 'hasta'] as const)
    if (a[k] !== b[k]) dif.push(`${k}: copia ${a[k]} · restaurado ${b[k]}`);
  return dif;
}
