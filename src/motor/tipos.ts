import type { Fecha } from './tiempo';

/** E = entrada, S = salida, G = gestión particular, R = regreso de gestión. */
export type TipoMov = 'E' | 'S' | 'G' | 'R';

export const NOMBRE_MOV: Record<TipoMov, string> = {
  E: 'ENTRADA',
  S: 'SALIDA',
  G: 'GESTIÓN PARTICULAR',
  R: 'REGRESO DE GESTIÓN',
};

export interface Movimiento {
  id: string;
  /** Instante UTC en ms, siempre múltiplo de un minuto. */
  t: number;
  tipo: TipoMov;
  /** Orden de registro (desempata movimientos del mismo minuto). */
  seq: number;
  origen: 'boton' | 'manual';
  /** Instante de la última modificación manual. */
  modificado?: number;
  /** Valor antes de la primera modificación manual (null si se añadió a mano). */
  original?: { t: number; tipo: TipoMov } | null;
  /** Solo en una ENTRADA: sesión dejada pendiente por olvido. */
  pendiente?: boolean;
  /** Solo en una ENTRADA: fecha en la que el usuario respondió «Sigo trabajando». */
  sigoFecha?: Fecha;
}

/** VAC = vacaciones, AP = asunto propio, AUS = ausencia sin descuento, CUENTA = a cuenta del saldo. */
export type Marca = 'VAC' | 'AP' | 'AUS' | 'CUENTA';

export const NOMBRE_MARCA: Record<Marca, string> = {
  VAC: 'Vacaciones',
  AP: 'Asunto propio',
  AUS: 'Ausencia sin descuento',
  CUENTA: 'A cuenta del saldo',
};

export interface Dia {
  fecha: Fecha;
  marca?: Marca;
  obs?: string;
}

export interface Festivo {
  fecha: Fecha;
  nombre: string;
  sinConfirmar?: boolean;
}

export interface Horario {
  /** Fecha desde la que aplica. */
  desde: Fecha;
  entrada: string; // 'HH:MM'
  salida: string; // 'HH:MM'
  /** Días de la semana con jornada ordinaria (1 = lunes … 7 = domingo). */
  dias: number[];
}

export interface Ajuste {
  dias: number;
  nota: string;
}

export interface Anual {
  vacaciones?: number;
  asuntos?: number;
  ajustesVac?: Ajuste[];
  ajustesAP?: Ajuste[];
}

export interface Config {
  fechaInicio: Fecha;
  horarios: Horario[];
  anual: Record<string, Anual>;
}

export interface Datos {
  movimientos: Movimiento[];
  dias: Dia[];
  festivos: Festivo[];
  config: Config;
}
