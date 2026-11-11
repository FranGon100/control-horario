import { nombreArchivoCopia } from '../datos/formatoCopia';
import * as repo from '../datos/repo';
import type { Ctx } from './contexto';

/** Ofrece compartir o descargar una copia interna (o una nueva si no se indica). */
export async function guardarCopiaFuera(ctx: Ctx, id?: string) {
  const ci = await ctx.ejecutar(async () => (id && (await repo.leerCopiaInterna(id))) || repo.crearCopiaAhora(Date.now()));
  if (!ci) return;
  const archivo = new File([ci.json], nombreArchivoCopia(ci.fecha), { type: 'application/json' });
  ctx.ofrecerArchivo(archivo, async () => {
    await repo.marcarCopiaGuardadaFuera(Date.now());
    await ctx.recargar();
  });
}
