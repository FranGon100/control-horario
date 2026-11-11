// Máquina de estados de los fichajes y validación de secuencias.
import { fechaDe, fechaES, horaDe } from './tiempo';
import type { Movimiento, TipoMov } from './tipos';
import { NOMBRE_MOV } from './tipos';

export type EstadoJornada = 'FUERA' | 'TRABAJANDO' | 'EN_GESTION';

export interface Sesion {
  movs: Movimiento[];
  entrada: Movimiento;
  salida?: Movimiento;
  /** Sin salida y seguida de otra entrada (dejada pendiente). */
  incompleta: boolean;
}

export function ordenar(movs: Movimiento[]): Movimiento[] {
  return [...movs].sort((a, b) => a.t - b.t || a.seq - b.seq);
}

const cuando = (m: Movimiento) => `${fechaES(fechaDe(m.t))} ${horaDe(m.t)}`;

export interface Analisis {
  sesiones: Sesion[];
  errores: string[];
}

/** Agrupa los movimientos en sesiones y detecta secuencias imposibles. */
export function analizar(movsDesordenados: Movimiento[]): Analisis {
  const movs = ordenar(movsDesordenados);
  const sesiones: Sesion[] = [];
  const errores: string[] = [];
  let actual: Sesion | null = null;

  for (const m of movs) {
    if (!actual) {
      if (m.tipo === 'E') {
        actual = { movs: [m], entrada: m, incompleta: false };
        sesiones.push(actual);
      } else if (m.tipo === 'S') errores.push(`SALIDA del ${cuando(m)} sin una ENTRADA antes.`);
      else if (m.tipo === 'G') errores.push(`GESTIÓN PARTICULAR del ${cuando(m)} sin una ENTRADA antes.`);
      else errores.push(`REGRESO DE GESTIÓN del ${cuando(m)} sin una GESTIÓN PARTICULAR antes.`);
      continue;
    }
    const ultimo: TipoMov = actual.movs[actual.movs.length - 1].tipo;
    const enGestion = ultimo === 'G';
    switch (m.tipo) {
      case 'E':
        if (actual.entrada.pendiente) {
          actual.incompleta = true;
          actual = { movs: [m], entrada: m, incompleta: false };
          sesiones.push(actual);
        } else {
          errores.push(
            `Dos ENTRADAS seguidas sin SALIDA (${cuando(actual.entrada)} y ${cuando(m)}). Falta la SALIDA de la primera.`,
          );
        }
        break;
      case 'S':
        actual.movs.push(m);
        actual.salida = m;
        actual = null;
        break;
      case 'G':
        if (enGestion) errores.push(`Dos GESTIONES seguidas sin REGRESO (${cuando(m)}).`);
        else actual.movs.push(m);
        break;
      case 'R':
        if (!enGestion) errores.push(`REGRESO DE GESTIÓN del ${cuando(m)} sin una GESTIÓN PARTICULAR antes.`);
        else actual.movs.push(m);
        break;
    }
  }
  return { sesiones, errores };
}

/** Sesión abierta (la última, si no tiene salida). */
export function sesionAbierta(movs: Movimiento[]): Sesion | null {
  const { sesiones } = analizar(movs);
  const u = sesiones[sesiones.length - 1];
  return u && !u.salida && !u.incompleta ? u : null;
}

/** Estado actual para los botones. Una sesión dejada pendiente cuenta como FUERA. */
export function estadoJornada(movs: Movimiento[]): EstadoJornada {
  const s = sesionAbierta(movs);
  if (!s || s.entrada.pendiente) return 'FUERA';
  return s.movs[s.movs.length - 1].tipo === 'G' ? 'EN_GESTION' : 'TRABAJANDO';
}

const PERMITIDOS: Record<EstadoJornada, TipoMov[]> = {
  FUERA: ['E'],
  TRABAJANDO: ['S', 'G'],
  EN_GESTION: ['R', 'S'],
};

export function permitido(estado: EstadoJornada, tipo: TipoMov): boolean {
  return PERMITIDOS[estado].includes(tipo);
}

/** Frase que explica por qué un botón no está activo. */
export function motivoInactivo(estado: EstadoJornada, tipo: TipoMov): string {
  if (estado === 'FUERA') return 'Primero ficha la ENTRADA.';
  if (tipo === 'E') return 'Ya tienes la jornada iniciada. Para volver a entrar, primero ficha la SALIDA.';
  if (estado === 'TRABAJANDO' && tipo === 'R') return 'No estás en una gestión particular.';
  if (estado === 'EN_GESTION' && tipo === 'G') return 'Ya estás en una gestión particular. Ficha el REGRESO DE GESTIÓN.';
  return `${NOMBRE_MOV[tipo]} no está disponible ahora.`;
}

/**
 * Valida una lista completa de movimientos (tras una edición o un alta manual).
 * Devuelve la lista de errores en español; vacía si es correcta.
 */
export function validarConjunto(movs: Movimiento[], ahora: number): string[] {
  const errores: string[] = [];
  for (const m of movs) {
    if (m.t > ahora) errores.push(`${NOMBRE_MOV[m.tipo]} del ${cuando(m)} está en el futuro.`);
    if (m.t % 60_000 !== 0) errores.push(`${NOMBRE_MOV[m.tipo]} del ${cuando(m)} tiene segundos.`);
  }
  errores.push(...analizar(movs).errores);
  return errores;
}
