import { calcular } from '../../src/motor/calculo';
import { instanteMadrid } from '../../src/motor/tiempo';
import type { Datos, Dia, Marca, Movimiento, TipoMov } from '../../src/motor/tipos';
import { CONFIG_INICIAL, FESTIVOS_INICIALES } from '../../src/datos/inicial';

let seq = 0;
/** m('2026-11-16', 'E 09:00', 'S 17:00') */
export function m(fecha: string, ...entradas: string[]): Movimiento[] {
  return entradas.map((x) => {
    const [tipo, hora] = x.split(' ');
    const [h, mi] = hora.split(':').map(Number);
    const t = instanteMadrid(fecha, h, mi);
    if (t === null) throw new Error('hora inexistente');
    seq++;
    return { id: `m${seq}`, t, tipo: tipo as TipoMov, seq, origen: 'boton' as const };
  });
}

export function datos(movimientos: Movimiento[], marcas: [string, Marca][] = [], extra: Partial<Datos> = {}): Datos {
  const dias: Dia[] = marcas.map(([fecha, marca]) => ({ fecha, marca }));
  return {
    movimientos,
    dias,
    festivos: FESTIVOS_INICIALES,
    config: structuredClone(CONFIG_INICIAL),
    ...extra,
  };
}

export const en = (fecha: string, hora: string) => {
  const [h, mi] = hora.split(':').map(Number);
  return instanteMadrid(fecha, h, mi)!;
};

export const calc = (d: Datos, fecha: string, hora = '23:59') => calcular(d, en(fecha, hora));
export const H = (h: number, mi = 0) => h * 60 + mi;
