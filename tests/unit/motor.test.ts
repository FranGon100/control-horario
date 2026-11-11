import { describe, expect, it } from 'vitest';
import { calcular, partirPorDia } from '../../src/motor/calculo';
import { duracion } from '../../src/motor/formato';
import { validarConjunto, estadoJornada, permitido } from '../../src/motor/secuencia';
import { laborablesDelRango, resumenVacaciones } from '../../src/motor/vacaciones';
import { calc, datos, en, H, m } from './ayuda';

const dia = (d: ReturnType<typeof calc>, f: string) => d.porFecha.get(f)!;

describe('§14.1 escenarios del motor', () => {
  it('1 · jornada normal', () => {
    const r = dia(calc(datos(m('2026-11-16', 'E 09:00', 'S 17:00')), '2026-11-16'), '2026-11-16');
    expect([r.T, r.ORD, r.ADIC, r.DEF]).toEqual([H(8), H(8), 0, 0]);
    expect(duracion(r.saldo)).toBe('00 h 00 min');
  });

  it('2 · trabajo de 08:00 a 18:00', () => {
    const r = dia(calc(datos(m('2026-11-17', 'E 08:00', 'S 18:00')), '2026-11-17'), '2026-11-17');
    expect([r.T, r.ORD, r.ADIC]).toEqual([H(10), H(8), H(2)]);
    expect(duracion(r.saldo)).toBe('+02 h 00 min');
  });

  it('3 · gestión de una hora', () => {
    const r = dia(calc(datos(m('2026-11-18', 'E 09:00', 'G 10:00', 'R 11:00', 'S 17:00')), '2026-11-18'), '2026-11-18');
    expect([r.T, r.DEF]).toEqual([H(7), H(1)]);
    expect(duracion(r.saldo)).toBe('-01 h 00 min');
  });

  it('4 · recuperación de la hora', () => {
    const res = calc(datos([
      ...m('2026-11-18', 'E 09:00', 'G 10:00', 'R 11:00', 'S 17:00'),
      ...m('2026-11-19', 'E 09:00', 'S 18:00'),
    ]), '2026-11-19');
    expect(duracion(dia(res, '2026-11-19').saldo)).toBe('+01 h 00 min');
    expect(res.totales.recuperado).toBe(H(1));
    expect(res.totales.pendiente).toBe(0);
    expect(duracion(res.totales.saldo)).toBe('00 h 00 min');
  });

  it('5 · recuperación parcial', () => {
    const res = calc(datos([
      ...m('2026-11-23', 'E 09:00', 'G 10:00', 'R 11:00', 'S 17:00'),
      ...m('2026-11-24', 'E 09:00', 'S 17:30'),
    ]), '2026-11-24');
    expect(res.totales.recuperado).toBe(30);
    expect(res.totales.pendiente).toBe(30);
    expect(duracion(res.totales.saldo)).toBe('-00 h 30 min');
  });

  it('6 · sábado', () => {
    const r = dia(calc(datos(m('2026-11-21', 'E 09:00', 'S 13:00')), '2026-11-21'), '2026-11-21');
    expect(duracion(r.saldo)).toBe('+04 h 00 min');
  });

  it('7 · domingo', () => {
    const r = dia(calc(datos(m('2026-11-22', 'E 10:00', 'S 12:30')), '2026-11-22'), '2026-11-22');
    expect(duracion(r.saldo)).toBe('+02 h 30 min');
  });

  it('8 · festivo', () => {
    const r = dia(calc(datos(m('2026-12-08', 'E 09:00', 'S 12:00')), '2026-12-08'), '2026-12-08');
    expect(r.tipo).toBe('NO_LABORABLE');
    expect(duracion(r.saldo)).toBe('+03 h 00 min');
  });

  it('9 · dos gestiones el mismo día', () => {
    const r = dia(calc(datos(m('2026-11-25', 'E 09:00', 'G 10:00', 'R 10:30', 'G 12:00', 'R 12:45', 'S 17:00')), '2026-11-25'), '2026-11-25');
    expect([r.T, r.DEF]).toEqual([H(6, 45), H(1, 15)]);
    expect(duracion(r.saldo)).toBe('-01 h 15 min');
    expect(r.gestiones).toBe(2);
  });

  it('10 · olvido de fichaje', () => {
    const movs = m('2026-11-26', 'E 09:00');
    const res = calc(datos(movs), '2026-11-27', '08:00');
    const r = dia(res, '2026-11-26');
    expect(r.estado).toBe('PENDIENTE');
    expect(r.saldo).toBe(0);
    expect(r.porRevisar).toBe(true);
    expect(res.olvido?.entrada.id).toBe(movs[0].id);
    expect(res.diasPorRevisar.map((d) => d.fecha)).toContain('2026-11-26');
    // Ninguna hora inventada: no aparece ninguna SALIDA.
    expect(r.movimientos.map((x) => x.tipo)).toEqual(['E']);
    // Se añade a mano la SALIDA de las 17:00.
    const [s] = m('2026-11-26', 'S 17:00');
    s.origen = 'manual'; s.original = null; s.modificado = en('2026-11-27', '08:01');
    const res2 = calc(datos([...movs, s]), '2026-11-27', '08:01');
    const r2 = dia(res2, '2026-11-26');
    expect(r2.estado).toBe('CERRADO');
    expect(duracion(r2.saldo)).toBe('00 h 00 min');
    expect(r2.movimientos[1].origen).toBe('manual');
  });

  it('11 · modificación manual', () => {
    const movs = m('2026-11-27', 'E 09:00', 'S 17:00');
    expect(duracion(dia(calc(datos(movs), '2026-11-27'), '2026-11-27').saldo)).toBe('00 h 00 min');
    const editado = movs.map((x) => x.tipo === 'S'
      ? { ...x, t: en('2026-11-27', '18:30'), origen: x.origen, modificado: en('2026-11-27', '19:00'), original: { t: x.t, tipo: x.tipo } }
      : x);
    expect(duracion(dia(calc(datos(editado), '2026-11-27'), '2026-11-27').saldo)).toBe('+01 h 30 min');
  });

  it('12 · cambio de mes', () => {
    const res = calc(datos([
      ...m('2026-11-30', 'E 09:00', 'S 17:00', 'E 22:00'),
      ...m('2026-12-01', 'S 02:00', 'E 09:00', 'S 18:00'),
    ]), '2026-12-01');
    const a = dia(res, '2026-11-30'), b = dia(res, '2026-12-01');
    expect(duracion(a.saldo)).toBe('+02 h 00 min');
    expect(duracion(b.saldo)).toBe('+03 h 00 min');
    expect(b.acumulado - a.acumulado).toBe(b.saldo);
    const nov = res.meses.find((x) => x.mes === 11)!, dic = res.meses.find((x) => x.mes === 12)!;
    expect(nov.saldo).toBe(H(2));
    expect(dic.saldo).toBe(H(3));
    expect(dic.acumulado).toBe(H(5));
    expect(a.salidaDiaSiguiente).toBe(true);
  });

  it('13 · cambio de año', () => {
    const d = datos([
      ...m('2026-12-31', 'E 09:00', 'S 17:00', 'E 22:00'),
      ...m('2027-01-01', 'S 01:00'),
    ]);
    const res = calc(d, '2027-01-01');
    const a = dia(res, '2026-12-31'), b = dia(res, '2027-01-01');
    expect(duracion(a.saldo)).toBe('+02 h 00 min');
    expect(b.tipo).toBe('NO_LABORABLE');
    expect(duracion(b.saldo)).toBe('+01 h 00 min');
    expect(b.acumulado).toBe(a.acumulado + H(1));
    const v27 = resumenVacaciones(2027, d.config, d.dias, d.festivos, '2027-01-01');
    expect(v27.diasDeAlta).toBe(365);
    expect(v27.diasAltaTranscurridos).toBe(1);
  });

  it('14 · registro de vacaciones', () => {
    const d = datos([]);
    expect(laborablesDelRango('2026-12-07', '2026-12-11', d.config, d.festivos)).toEqual(['2026-12-09', '2026-12-10', '2026-12-11']);
    const r = laborablesDelRango('2026-12-24', '2027-01-04', d.config, d.festivos);
    expect(r.filter((f) => f.startsWith('2026'))).toEqual(['2026-12-24', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31']);
    expect(r.filter((f) => f.startsWith('2027'))).toEqual(['2027-01-04']);
    d.config.anual['2026'] = { vacaciones: 22 };
    d.dias = r.map((fecha) => ({ fecha, marca: 'VAC' as const }));
    const v = resumenVacaciones(2026, d.config, d.dias, d.festivos, '2026-12-31');
    expect(v.diasDeAlta).toBe(46);
    expect(v.derecho!.toFixed(2)).toBe('2.77');
    expect(v.disfrutadas).toBe(5);
    const v27 = resumenVacaciones(2027, d.config, d.dias, d.festivos, '2026-12-31');
    expect(v27.planificadas).toBe(1);
  });

  it('17 · cruce de medianoche', () => {
    const res = calc(datos([
      ...m('2026-11-20', 'E 09:00', 'S 17:00', 'E 22:00'),
      ...m('2026-11-21', 'S 02:00'),
    ]), '2026-11-21');
    expect(duracion(dia(res, '2026-11-20').saldo)).toBe('+02 h 00 min');
    expect(duracion(dia(res, '2026-11-21').saldo)).toBe('+02 h 00 min');
  });

  it('18 · cambio de hora (marzo y octubre)', () => {
    const res = calc(datos([
      ...m('2027-03-27', 'E 22:00'), ...m('2027-03-28', 'S 06:00'),
      ...m('2027-10-30', 'E 22:00'), ...m('2027-10-31', 'S 06:00'),
    ]), '2027-10-31');
    expect(dia(res, '2027-03-27').T).toBe(H(2));
    expect(dia(res, '2027-03-28').T).toBe(H(5));
    expect(dia(res, '2027-03-27').T + dia(res, '2027-03-28').T).toBe(H(7));
    expect(dia(res, '2027-10-30').T).toBe(H(2));
    expect(dia(res, '2027-10-31').T).toBe(H(7));
    expect(duracion(dia(res, '2027-10-30').T + dia(res, '2027-10-31').T)).toBe('+09 h 00 min');
  });

  it('19 · llegada tarde', () => {
    const r = dia(calc(datos(m('2026-12-02', 'E 09:20', 'S 17:00')), '2026-12-02'), '2026-12-02');
    expect(duracion(r.saldo)).toBe('-00 h 20 min');
  });

  it('20 · saldo tras cada fichaje', () => {
    const movs = m('2026-12-03', 'E 09:00', 'G 10:00', 'R 11:00', 'S 18:00');
    const saldos = movs.map((_, i) => {
      const res = calcular(datos(movs.slice(0, i + 1)), movs[i].t);
      return duracion(res.porFecha.get('2026-12-03')!.saldo);
    });
    expect(saldos).toEqual(['00 h 00 min', '00 h 00 min', '-01 h 00 min', '00 h 00 min']);
  });

  it('21 · día laborable sin fichajes', () => {
    const r = dia(calc(datos([]), '2026-12-11'), '2026-12-10');
    expect(r.estado).toBe('SIN_FICHAJES');
    expect(r.saldo).toBe(0);
    expect(r.porRevisar).toBe(true);
    const r2 = dia(calc(datos([], [['2026-12-10', 'CUENTA']]), '2026-12-11'), '2026-12-10');
    expect(duracion(r2.saldo)).toBe('-08 h 00 min');
    expect(r2.porRevisar).toBe(false);
  });

  it('22 · salida sin regreso', () => {
    const r = dia(calc(datos(m('2026-12-11', 'E 09:00', 'G 15:00', 'S 15:40')), '2026-12-11'), '2026-12-11');
    expect([r.T, r.DEF]).toEqual([H(6), H(2)]);
    expect(duracion(r.saldo)).toBe('-02 h 00 min');
  });

  it('23 · trabajo en día de vacaciones', () => {
    const r = dia(calc(datos(m('2026-12-14', 'E 10:00', 'S 12:00'), [['2026-12-14', 'VAC']]), '2026-12-14'), '2026-12-14');
    expect(r.DEF).toBe(0);
    expect(duracion(r.saldo)).toBe('+02 h 00 min');
  });

  it('24 · secuencias inválidas', () => {
    const dosE = m('2026-12-15', 'E 09:00', 'E 10:00');
    const e1 = validarConjunto(dosE, en('2026-12-15', '23:00'));
    expect(e1.length).toBeGreaterThan(0);
    expect(e1[0]).toMatch(/Dos ENTRADAS seguidas/);
    const rSinG = m('2026-12-15', 'E 09:00', 'R 10:00');
    const e2 = validarConjunto(rSinG, en('2026-12-15', '23:00'));
    expect(e2[0]).toMatch(/REGRESO DE GESTIÓN .* sin una GESTIÓN PARTICULAR antes/);
    // Máquina de estados de los botones.
    expect(permitido(estadoJornada(m('2026-12-15', 'E 09:00')), 'E')).toBe(false);
    expect(permitido(estadoJornada([]), 'R')).toBe(false);
    expect(permitido(estadoJornada(m('2026-12-15', 'E 09:00', 'G 10:00')), 'S')).toBe(true);
  });
});

describe('§6.5 ejemplos del usuario', () => {
  it('1 y 2 · gestión de 1 h y recuperación al día siguiente', () => {
    const d1 = m('2026-11-18', 'E 09:00', 'G 10:00', 'R 11:00', 'S 17:00');
    let res = calc(datos(d1), '2026-11-18');
    expect(res.totales.pendiente).toBe(H(1));
    expect(res.totales.saldo).toBe(-H(1));
    res = calc(datos([...d1, ...m('2026-11-19', 'E 09:00', 'S 18:00')]), '2026-11-19');
    expect(res.totales.pendiente).toBe(0);
    expect(res.totales.saldo).toBe(0);
  });
  it('3 · 1 h pendiente y después 2 h adicionales', () => {
    const res = calc(datos([
      ...m('2026-11-18', 'E 09:00', 'G 10:00', 'R 11:00', 'S 17:00'),
      ...m('2026-11-19', 'E 09:00', 'S 19:00'),
    ]), '2026-11-19');
    expect(res.totales.recuperado).toBe(H(1));
    expect(res.totales.aFavor).toBe(H(1));
    expect(res.totales.saldo).toBe(H(1));
  });
  it('4 · sábado 09:00-13:00', () => {
    expect(calc(datos(m('2026-11-21', 'E 09:00', 'S 13:00')), '2026-11-21').totales.saldo).toBe(H(4));
  });
  it('5 · festivo 09:00-12:00', () => {
    expect(calc(datos(m('2026-12-08', 'E 09:00', 'S 12:00')), '2026-12-08').totales.saldo).toBe(H(3));
  });
});

// Generador pseudoaleatorio determinista.
function prng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

function historialAleatorio(seed: number) {
  const r = prng(seed);
  const movs: ReturnType<typeof m> = [];
  let f = '2026-11-16';
  for (let i = 0; i < 40; i++) {
    const n = Math.floor(r() * 4);
    if (n > 0) {
      let h = 6 + Math.floor(r() * 4);
      const ent: string[] = [`E ${String(h).padStart(2, '0')}:${r() < 0.5 ? '00' : '30'}`];
      for (let g = 0; g < n - 1; g++) {
        h += 1 + Math.floor(r() * 2);
        ent.push(`G ${String(h).padStart(2, '0')}:15`);
        if (r() < 0.8) ent.push(`R ${String(h).padStart(2, '0')}:45`);
        else break;
      }
      h += 2 + Math.floor(r() * 6);
      ent.push(`S ${String(Math.min(h, 23)).padStart(2, '0')}:50`);
      movs.push(...m(f, ...ent));
    }
    const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1);
    f = d.toISOString().slice(0, 10);
  }
  return movs;
}

describe('§6.6 propiedades', () => {
  for (const seed of [1, 7, 42, 99, 2026]) {
    it(`saldo neto = suma diaria = a favor − pendiente (semilla ${seed})`, () => {
      const movs = historialAleatorio(seed);
      expect(validarConjunto(movs, en('2027-02-01', '00:00'))).toEqual([]);
      const res = calc(datos(movs), '2027-01-15');
      const suma = res.dias.reduce((s, d) => s + d.saldo, 0);
      expect(res.totales.saldo).toBe(suma);
      expect(res.totales.saldo).toBe(res.totales.aFavor - res.totales.pendiente);
      expect(res.totales.aFavor === 0 || res.totales.pendiente === 0).toBe(true);
      expect(res.dias[res.dias.length - 1].acumulado).toBe(suma);
    });
    it(`recalcular es estable y añadir+borrar no cambia nada (semilla ${seed})`, () => {
      const movs = historialAleatorio(seed);
      const d = datos(movs);
      const a = calc(d, '2027-01-15'), b = calc(d, '2027-01-15');
      expect(b.totales).toEqual(a.totales);
      expect(b.dias.map((x) => x.saldo)).toEqual(a.dias.map((x) => x.saldo));
      const extra = m('2027-01-10', 'E 10:00', 'S 11:00'); // domingo
      const c = calc(datos([...movs, ...extra]), '2027-01-15');
      expect(c.totales.saldo).toBe(a.totales.saldo + H(1));
      const e = calc(datos(movs.filter((x) => !extra.includes(x))), '2027-01-15');
      expect(e.totales).toEqual(a.totales);
    });
  }

  it('las partes de un tramo partido por medianoche suman su duración real', () => {
    const casos: [string, string, string, string][] = [
      ['2026-11-20', '22:00', '2026-11-21', '02:00'],
      ['2027-03-27', '20:15', '2027-03-28', '07:45'],
      ['2027-10-30', '21:00', '2027-10-31', '05:30'],
      ['2026-12-30', '23:59', '2027-01-02', '00:01'],
    ];
    for (const [fa, ha, fb, hb] of casos) {
      const a = en(fa, ha), b = en(fb, hb);
      const partes = partirPorDia([{ a, b }]);
      const total = [...partes.values()].reduce((s, x) => s + x, 0);
      expect(total).toBe((b - a) / 60000);
    }
  });

  it('editar un movimiento antiguo recalcula todos los días afectados', () => {
    const movs = [
      ...m('2026-11-16', 'E 09:00', 'S 17:00'),
      ...m('2026-11-17', 'E 09:00', 'S 17:00', 'E 22:00'),
      ...m('2026-11-18', 'S 01:00', 'E 09:00', 'S 17:00'),
    ];
    const antes = calc(datos(movs), '2026-11-20');
    // La salida de la madrugada del 18 pasa a las 03:00.
    const s = movs[5];
    const editados = movs.map((x) => (x === s ? { ...x, t: en('2026-11-18', '03:00') } : x));
    const despues = calc(datos(editados), '2026-11-20');
    expect(despues.porFecha.get('2026-11-18')!.saldo - antes.porFecha.get('2026-11-18')!.saldo).toBe(H(2));
    expect(despues.porFecha.get('2026-11-20')!.acumulado - antes.porFecha.get('2026-11-20')!.acumulado).toBe(H(2));
  });
});
