// Formato de duraciones (en minutos enteros).

const pad = (n: number) => String(n).padStart(2, '0');

/** `+12 h 35 min`, `-04 h 20 min`, `00 h 00 min`. */
export function duracion(min: number): string {
  const s = min > 0 ? '+' : min < 0 ? '-' : '';
  const a = Math.abs(min);
  return `${s}${pad(Math.floor(a / 60))} h ${pad(a % 60)} min`;
}

/** Igual que duracion pero sin signo (para tiempos que nunca son negativos). */
export function duracionSinSigno(min: number): string {
  const a = Math.abs(min);
  return `${pad(Math.floor(a / 60))} h ${pad(a % 60)} min`;
}

/** `+02:00`, `-00:30`, `00:00`. */
export function hhmm(min: number, conSigno = true): string {
  const s = conSigno ? (min > 0 ? '+' : min < 0 ? '-' : '') : min < 0 ? '-' : '';
  const a = Math.abs(min);
  return `${s}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** Horas decimales (sin redondeo forzado más allá de la precisión de minuto). */
export function horasDecimales(min: number): number {
  return Math.round((min / 60) * 10000) / 10000;
}

/** Número con dos decimales en formato español. */
export function dosDecimales(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
