import { describe, expect, it } from 'vitest';
import { calcular } from '../../src/motor/calculo';
import { duracion, hhmm } from '../../src/motor/formato';
import { fechaDe, horaDe, instanteMadrid, leerFecha, diaSemana } from '../../src/motor/tiempo';
import { calc, datos, en, H, m } from './ayuda';

describe('zona horaria de Madrid', () => {
  it('convierte en invierno y en verano', () => {
    expect(new Date(instanteMadrid('2026-11-16', 9, 0)!).toISOString()).toBe('2026-11-16T08:00:00.000Z');
    expect(new Date(instanteMadrid('2027-07-01', 9, 0)!).toISOString()).toBe('2027-07-01T07:00:00.000Z');
  });
  it('la hora 02:30 del último domingo de marzo no existe', () => {
    expect(instanteMadrid('2027-03-28', 2, 30)).toBeNull();
  });
  it('la hora ambigua de octubre toma la primera', () => {
    expect(new Date(instanteMadrid('2027-10-31', 2, 30)!).toISOString()).toBe('2027-10-31T00:30:00.000Z');
  });
  it('fecha y hora local no dependen de la zona del dispositivo', () => {
    const t = Date.UTC(2026, 11, 31, 23, 30); // 00:30 del 01/01/2027 en Madrid
    expect(fechaDe(t)).toBe('2027-01-01');
    expect(horaDe(t)).toBe('00:30');
  });
  it('lee fechas y días de la semana', () => {
    expect(leerFecha('16/11/2026')).toBe('2026-11-16');
    expect(leerFecha('31/02/2027')).toBeNull();
    expect(diaSemana('2026-11-16')).toBe(1);
    expect(diaSemana('2026-11-22')).toBe(7);
  });
});

describe('formato', () => {
  it('duraciones con signo', () => {
    expect(duracion(H(12, 35))).toBe('+12 h 35 min');
    expect(duracion(-H(4, 20))).toBe('-04 h 20 min');
    expect(duracion(0)).toBe('00 h 00 min');
    expect(hhmm(-30)).toBe('-00:30');
    expect(hhmm(H(2))).toBe('+02:00');
    expect(hhmm(0)).toBe('00:00');
  });
});

describe('detalles del motor', () => {
  it('los días anteriores a la fecha de inicio no computan', () => {
    const res = calc(datos(m('2026-11-13', 'E 09:00', 'S 12:00')), '2026-11-16');
    expect(res.totales.saldo).toBe(0);
    expect(res.movimientosPrueba.length).toBe(2);
    expect(res.dias[0].fecha).toBe('2026-11-16');
  });

  it('día en curso: V solo hasta el último fichaje', () => {
    const movs = m('2026-11-16', 'E 09:30');
    const r = calcular(datos(movs), en('2026-11-16', '12:00')).porFecha.get('2026-11-16')!;
    expect(r.estado).toBe('EN_CURSO');
    expect(r.DEF).toBe(30); // llegó a las 09:30
  });

  it('«Sigo trabajando» mantiene la sesión en curso ese día', () => {
    const movs = m('2026-11-20', 'E 22:00');
    movs[0].sigoFecha = '2026-11-21';
    const res = calc(datos(movs), '2026-11-21', '01:00');
    expect(res.olvido).toBeUndefined();
    expect(res.porFecha.get('2026-11-20')!.estado).toBe('EN_CURSO');
    // Al día siguiente vuelve a preguntarse.
    expect(calc(datos(movs), '2026-11-22', '08:00').olvido).toBeDefined();
  });

  it('sesión dejada pendiente permite otra entrada y no computa', () => {
    const movs = [...m('2026-11-26', 'E 09:00'), ...m('2026-11-27', 'E 09:00', 'S 17:00')];
    movs[0].pendiente = true;
    const res = calc(datos(movs), '2026-11-27');
    expect(res.errores).toEqual([]);
    expect(res.porFecha.get('2026-11-26')!.estado).toBe('PENDIENTE');
    expect(res.porFecha.get('2026-11-27')!.saldo).toBe(0);
    expect(res.diasPorRevisar.length).toBe(1 + 8); // 26/11 pendiente + 8 laborables sin fichajes (16-20 y 23-25)
  });

  it('cambio de horario con fecha de vigencia', () => {
    const d = datos([...m('2026-11-16', 'E 08:00', 'S 16:00'), ...m('2026-11-23', 'E 08:00', 'S 16:00')]);
    d.config.horarios.push({ desde: '2026-11-23', entrada: '08:00', salida: '16:00', dias: [1, 2, 3, 4, 5] });
    const res = calc(d, '2026-11-23');
    expect(res.porFecha.get('2026-11-16')!.saldo).toBe(0); // 1 h a recuperar + 1 h adicional
    expect(res.porFecha.get('2026-11-16')!.DEF).toBe(H(1));
    expect(res.porFecha.get('2026-11-23')!.DEF).toBe(0);
    expect(res.porFecha.get('2026-11-23')!.ADIC).toBe(0);
  });

  it('a cuenta del saldo con fichajes se calcula como laborable', () => {
    const r = calc(datos(m('2026-11-16', 'E 09:00', 'S 13:00'), [['2026-11-16', 'CUENTA']]), '2026-11-16').porFecha.get('2026-11-16')!;
    expect(r.saldo).toBe(-H(4));
  });
});
