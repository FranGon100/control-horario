// Migraciones versionadas del formato de datos.
import type { Datos } from '../motor/tipos';

/** Versión actual del formato de datos (y de las copias de seguridad). */
export const VERSION_DATOS = 1;

/** migraciones[n] convierte datos de la versión n a la n + 1. */
export type Migracion = (d: any) => any;
export const MIGRACIONES: Record<number, Migracion> = {
  // Ejemplo para el futuro: 1: (d) => ({ ...d, nuevoCampo: valorPorDefecto }),
};

export function migrar(datos: any, desde: number, hasta = VERSION_DATOS, tabla = MIGRACIONES): Datos {
  if (desde > hasta) throw new Error(`Los datos son de una versión más nueva (${desde}) que la app (${hasta}). Actualiza la app.`);
  let d = datos;
  for (let v = desde; v < hasta; v++) {
    const f = tabla[v];
    if (!f) throw new Error(`Falta la migración de la versión ${v} a la ${v + 1}.`);
    d = f(structuredClone(d));
  }
  return d as Datos;
}
