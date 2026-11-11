// Conversión de instantes (UTC, ms) a fecha/hora de Madrid y viceversa.
// Zona fija Europe/Madrid, nunca la del dispositivo.

export const ZONA = 'Europe/Madrid';
export const MIN = 60_000;

/** Fecha local de Madrid en formato 'AAAA-MM-DD'. */
export type Fecha = string;

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface Partes {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
}

export function partes(ms: number): Partes {
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Redondea un instante hacia abajo al minuto. */
export const alMinuto = (ms: number) => Math.floor(ms / MIN) * MIN;

export function fechaDe(ms: number): Fecha {
  const p = partes(ms);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function horaDe(ms: number): string {
  const p = partes(ms);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

export function descomponer(f: Fecha): [number, number, number] {
  const [y, m, d] = f.split('-').map(Number);
  return [y, m, d];
}

function desfase(ms: number): number {
  const p = partes(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - alMinuto(ms);
}

/**
 * Instante UTC de una hora local de Madrid. Devuelve null si esa hora no
 * existe (salto de marzo). Si es ambigua (octubre) devuelve la primera.
 */
export function instanteMadrid(f: Fecha, hh: number, mm: number): number | null {
  const [y, m, d] = descomponer(f);
  const pared = Date.UTC(y, m - 1, d, hh, mm);
  const candidatos = new Set<number>();
  for (const delta of [-6, 6]) candidatos.add(pared - desfase(pared + delta * 3600_000));
  const validos = [...candidatos]
    .filter((t) => {
      const p = partes(t);
      return p.y === y && p.m === m && p.d === d && p.h === hh && p.mi === mm;
    })
    .sort((a, b) => a - b);
  return validos.length ? validos[0] : null;
}

/** Instante de las 00:00 de Madrid del día dado (siempre existe). */
export function inicioDia(f: Fecha): number {
  return instanteMadrid(f, 0, 0)!;
}

export function sumarDias(f: Fecha, n: number): Fecha {
  const [y, m, d] = descomponer(f);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Días naturales entre dos fechas (b - a). */
export function diferenciaDias(a: Fecha, b: Fecha): number {
  const [y1, m1, d1] = descomponer(a);
  const [y2, m2, d2] = descomponer(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** 1 = lunes … 7 = domingo. */
export function diaSemana(f: Fecha): number {
  const [y, m, d] = descomponer(f);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

export const NOMBRES_DIA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const NOMBRES_MES = [
  '', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function diasDelAnio(y: number): number {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' */
export function fechaES(f: Fecha): string {
  const [y, m, d] = descomponer(f);
  return `${pad(d)}/${pad(m)}/${y}`;
}

/** 'DD/MM/AAAA' o 'AAAA-MM-DD' → Fecha, o null si no es válida. */
export function leerFecha(txt: string): Fecha | null {
  const s = txt.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (r) [d, m, y] = [+r[1], +r[2], +r[3]];
  else if ((r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) [y, m, d] = [+r[1], +r[2], +r[3]];
  else return null;
  const f = `${y}-${pad(m)}-${pad(d)}`;
  return sumarDias(f, 0) === f ? f : null;
}

/** 'HH:MM' → [h, m] o null. */
export function leerHora(txt: string): [number, number] | null {
  const r = /^(\d{1,2}):(\d{2})$/.exec(txt.trim());
  if (!r) return null;
  const h = +r[1], m = +r[2];
  if (h > 23 || m > 59) return null;
  return [h, m];
}

export function horaAMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
