import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Resultado } from '../motor/calculo';
import type { Fecha } from '../motor/tiempo';
import type { Estado } from '../datos/repo';

export type Pestana = 'inicio' | 'control' | 'calendario' | 'resumen' | 'config';

export interface Ctx {
  estado: Estado;
  res: Resultado;
  /** Instante actual (ms). */
  ahora: number;
  recargar: () => Promise<void>;
  avisar: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
  confirmar: (texto: string, si?: string, no?: string) => Promise<boolean>;
  abrirDia: (f: Fecha) => void;
  irA: (p: Pestana, opciones?: { soloRevisar?: boolean }) => void;
  /** Muestra las opciones Compartir / Descargar para un archivo generado. */
  ofrecerArchivo: (archivo: File, alGuardar?: () => void) => void;
  /** Lanza una operación mostrando el error en lenguaje llano si falla. */
  ejecutar: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
}

export const Contexto = createContext<Ctx>(null as unknown as Ctx);
export const useCtx = () => useContext(Contexto);
