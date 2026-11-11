import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { calcular } from '../../src/motor/calculo';
import { duracion } from '../../src/motor/formato';
import { cerrar } from '../../src/datos/db';
import { leerCopia } from '../../src/datos/formatoCopia';
import { migrar } from '../../src/datos/migraciones';
import * as repo from '../../src/datos/repo';
import { en } from './ayuda';

beforeEach(async () => {
  await cerrar();
  (globalThis as any).indexedDB = new IDBFactory();
});

const saldoDia = async (f: string, ahora: number) => {
  const { datos } = await repo.leerDatos();
  return duracion(calcular(datos, ahora).porFecha.get(f)!.saldo);
};

describe('datos (IndexedDB)', () => {
  it('primer arranque: carga configuración y festivos iniciales', async () => {
    const e = await repo.cargar(en('2026-11-16', '08:00'));
    expect(e.meta.asistenteHecho).toBe(false);
    expect(e.datos.config.fechaInicio).toBe('2026-11-16');
    expect(e.datos.config.anual).toEqual({});
    expect(e.datos.festivos.filter((f) => f.sinConfirmar).map((f) => f.fecha)).toEqual(['2027-01-29', '2027-03-05']);
  });

  it('fichajes con la máquina de estados (rechaza secuencias imposibles)', async () => {
    await repo.cargar(en('2026-11-16', '08:00'));
    await repo.fichar('E', en('2026-11-16', '09:00') + 35_000);
    await expect(repo.fichar('E', en('2026-11-16', '09:05'))).rejects.toThrow(/primero ficha la SALIDA/i);
    await expect(repo.fichar('R', en('2026-11-16', '09:05'))).rejects.toThrow(/No estás en una gestión/);
    await repo.fichar('G', en('2026-11-16', '10:00'));
    await repo.fichar('R', en('2026-11-16', '11:00'));
    await repo.fichar('S', en('2026-11-16', '17:00'));
    const { datos } = await repo.leerDatos();
    expect(datos.movimientos.map((m) => m.tipo).join('')).toBe('EGRS');
    expect(datos.movimientos[0].t).toBe(en('2026-11-16', '09:00')); // segundos descartados
    expect(await saldoDia('2026-11-16', en('2026-11-16', '18:00'))).toBe('-01 h 00 min');
  });

  it('14.1 n.º 10 · olvido: pendiente, sin horas inventadas, y salida manual', async () => {
    await repo.cargar(en('2026-11-26', '08:00'));
    await repo.fichar('E', en('2026-11-26', '09:00'));
    const ahora = en('2026-11-27', '08:00');
    const { datos } = await repo.leerDatos();
    expect(repo.olvidoSinResponder(datos.movimientos, ahora)).not.toBeNull();
    await expect(repo.fichar('E', ahora)).rejects.toThrow(/jornada abierta/);
    expect(await saldoDia('2026-11-26', ahora)).toBe('00 h 00 min');
    await repo.responderOlvido({ opcion: 'hora', fecha: '2026-11-26', hora: '17:00' }, ahora);
    const d2 = (await repo.leerDatos()).datos;
    const s = d2.movimientos.find((m) => m.tipo === 'S')!;
    expect(s.origen).toBe('manual');
    expect(s.original).toBeNull();
    expect(s.modificado).toBe(ahora);
    expect(await saldoDia('2026-11-26', ahora)).toBe('00 h 00 min');
    expect(calcular(d2, ahora).porFecha.get('2026-11-26')!.estado).toBe('CERRADO');
  });

  it('olvido: «Dejar pendiente» permite una nueva entrada', async () => {
    await repo.cargar(en('2026-11-26', '08:00'));
    await repo.fichar('E', en('2026-11-26', '09:00'));
    const ahora = en('2026-11-27', '08:55');
    await repo.responderOlvido({ opcion: 'pendiente' }, ahora);
    await repo.fichar('E', en('2026-11-27', '09:00'));
    const { datos } = await repo.leerDatos();
    const r = calcular(datos, en('2026-11-27', '09:00'));
    expect(r.porFecha.get('2026-11-26')!.estado).toBe('PENDIENTE');
    expect(r.diasPorRevisar.some((d) => d.fecha === '2026-11-26')).toBe(true);
    // Se completa desde el histórico y deja de estar pendiente.
    await repo.guardarDia('2026-11-26', [
      { id: datos.movimientos[0].id, tipo: 'E', hora: '09:00' },
      { tipo: 'S', hora: '17:00' },
    ], en('2026-11-27', '10:00'));
    const d2 = (await repo.leerDatos()).datos;
    expect(d2.movimientos[0].pendiente).toBeUndefined();
    expect(calcular(d2, en('2026-11-27', '10:00')).porFecha.get('2026-11-26')!.estado).toBe('CERRADO');
  });

  it('olvido: «Sigo trabajando»', async () => {
    await repo.cargar(en('2026-11-20', '08:00'));
    await repo.fichar('E', en('2026-11-20', '22:00'));
    await repo.responderOlvido({ opcion: 'sigo' }, en('2026-11-21', '00:30'));
    await repo.fichar('S', en('2026-11-21', '02:00'));
    const { datos } = await repo.leerDatos();
    const r = calcular(datos, en('2026-11-21', '02:00'));
    expect(r.porFecha.get('2026-11-20')!.T).toBe(120);
    expect(r.porFecha.get('2026-11-21')!.T).toBe(120);
  });

  it('14.1 n.º 11 · modificación manual conserva el valor original', async () => {
    await repo.cargar(en('2026-11-27', '08:00'));
    await repo.fichar('E', en('2026-11-27', '09:00'));
    await repo.fichar('S', en('2026-11-27', '17:00'));
    expect(await saldoDia('2026-11-27', en('2026-11-27', '19:00'))).toBe('00 h 00 min');
    const { datos } = await repo.leerDatos();
    const [e, s] = datos.movimientos;
    await repo.guardarDia('2027-11-27'.replace('2027', '2026'), [
      { id: e.id, tipo: 'E', hora: '09:00' },
      { id: s.id, tipo: 'S', hora: '18:30' },
    ], en('2026-11-27', '19:00'));
    const d2 = (await repo.leerDatos()).datos;
    const s2 = d2.movimientos.find((m) => m.id === s.id)!;
    expect(s2.original).toEqual({ t: en('2026-11-27', '17:00'), tipo: 'S' });
    expect(s2.modificado).toBe(en('2026-11-27', '19:00'));
    expect(d2.movimientos.find((m) => m.id === e.id)!.modificado).toBeUndefined();
    expect(await saldoDia('2026-11-27', en('2026-11-27', '19:00'))).toBe('+01 h 30 min');
    // Una segunda edición mantiene el valor original de la primera.
    await repo.guardarDia('2026-11-27', [
      { id: e.id, tipo: 'E', hora: '09:00' },
      { id: s.id, tipo: 'S', hora: '18:00' },
    ], en('2026-11-27', '19:30'));
    const s3 = (await repo.leerDatos()).datos.movimientos.find((m) => m.id === s.id)!;
    expect(s3.original).toEqual({ t: en('2026-11-27', '17:00'), tipo: 'S' });
  });

  it('edición inválida no se guarda (secuencia, orden y futuro)', async () => {
    await repo.cargar(en('2026-11-16', '08:00'));
    const ahora = en('2026-11-16', '12:00');
    await expect(repo.guardarDia('2026-11-16', [{ tipo: 'E', hora: '09:00' }, { tipo: 'E', hora: '10:00' }], ahora)).rejects.toThrow(/Dos ENTRADAS/);
    await expect(repo.guardarDia('2026-11-16', [{ tipo: 'E', hora: '10:00' }, { tipo: 'S', hora: '09:00' }], ahora)).rejects.toThrow(/en orden/);
    await expect(repo.guardarDia('2026-11-16', [{ tipo: 'E', hora: '09:00' }, { tipo: 'S', hora: '13:00' }], ahora)).rejects.toThrow(/futuro/);
    await expect(repo.guardarDia('2026-11-16', [{ tipo: 'E', hora: '9h' }], ahora)).rejects.toThrow(/HH:MM/);
    expect((await repo.leerDatos()).datos.movimientos).toEqual([]);
  });

  it('marcas de día: rango de vacaciones excluye festivos y no mezcla con asuntos propios', async () => {
    await repo.cargar(en('2026-12-01', '08:00'));
    await repo.marcarDia('2026-12-10', 'AP');
    const r = await repo.marcarRango('2026-12-07', '2026-12-11', 'VAC');
    expect(r.marcados).toEqual(['2026-12-09', '2026-12-11']);
    expect(r.conOtraMarca).toEqual(['2026-12-10']);
    await expect(repo.marcarDia('2026-12-12', 'VAC')).rejects.toThrow(/laborables/);
    await repo.guardarObservacion('2026-12-09', 'Prueba');
    await repo.marcarDia('2026-12-09', undefined);
    const { datos } = await repo.leerDatos();
    expect(datos.dias.find((d) => d.fecha === '2026-12-09')).toEqual({ fecha: '2026-12-09', obs: 'Prueba' });
  });

  it('fichajes de prueba anteriores a la fecha de inicio se pueden borrar', async () => {
    await repo.cargar(en('2026-11-12', '08:00'));
    await repo.fichar('E', en('2026-11-12', '09:00'));
    await repo.fichar('S', en('2026-11-12', '10:00'));
    await repo.fichar('E', en('2026-11-16', '09:00'));
    expect(await repo.borrarPrueba()).toBe(2);
    expect((await repo.leerDatos()).datos.movimientos.length).toBe(1);
  });
});

describe('copias de seguridad', () => {
  it('copia semanal: solo si han pasado 7 días', async () => {
    await repo.cargar(en('2026-11-16', '08:00'));
    expect(await repo.copiaSemanalSiToca(en('2026-11-16', '08:00'))).not.toBeNull();
    expect((await repo.leerDatos()).meta.avisoCopia).toBe(true);
    await repo.posponerAvisoCopia();
    expect(await repo.copiaSemanalSiToca(en('2026-11-22', '08:00'))).toBeNull();
    expect(await repo.copiaSemanalSiToca(en('2026-11-23', '08:00'))).not.toBeNull();
    expect((await repo.listarCopias()).length).toBe(2);
  });

  it('16 · crear, borrar todo, restaurar: datos idénticos y mismo saldo', async () => {
    await repo.cargar(en('2026-11-16', '08:00'));
    await repo.fichar('E', en('2026-11-16', '09:00'));
    await repo.fichar('S', en('2026-11-16', '18:15'));
    await repo.marcarDia('2026-11-17', 'VAC');
    await repo.guardarObservacion('2026-11-17', 'Viaje');
    const antes = (await repo.leerDatos()).datos;
    const ahora = en('2026-11-17', '20:00');
    const ci = await repo.crearCopiaAhora(ahora);
    // Borrar todos los datos.
    await cerrar();
    (globalThis as any).indexedDB = new IDBFactory();
    await repo.cargar(ahora);
    expect((await repo.leerDatos()).datos.movimientos).toEqual([]);
    const previa = await repo.prepararRestauracion(ci.json);
    expect(previa.copia.resumen.movimientos).toBe(2);
    const { diferencias } = await repo.restaurar(previa, ahora);
    expect(diferencias).toEqual([]);
    const despues = (await repo.leerDatos()).datos;
    const ord = (x: typeof antes) => JSON.stringify({ ...x, dias: [...x.dias].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)), festivos: [...x.festivos].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)) });
    expect(ord(despues)).toBe(ord(antes));
    expect(calcular(despues, ahora).totales).toEqual(calcular(antes, ahora).totales);
    // Se guardó copia del estado anterior a restaurar.
    expect((await repo.listarCopias()).some((c) => c.tipo === 'antes-restaurar')).toBe(true);
  });

  it('rechaza copias dañadas o ajenas', async () => {
    await repo.cargar(en('2026-11-16', '08:00'));
    await repo.fichar('E', en('2026-11-16', '09:00'));
    const ci = await repo.crearCopiaAhora(en('2026-11-16', '10:00'));
    const c = JSON.parse(ci.json);
    c.datos.movimientos[0].t += 60_000;
    await expect(repo.prepararRestauracion(JSON.stringify(c))).rejects.toThrow(/suma de comprobación/);
    await expect(repo.prepararRestauracion('{"hola":1}')).rejects.toThrow(/no es una copia/);
    await expect(repo.prepararRestauracion('no es json')).rejects.toThrow(/no se puede leer/);
  });
});

describe('migraciones', () => {
  it('aplica migraciones en orden y falla si falta una', () => {
    const tabla = { 1: (d: any) => ({ ...d, x: 1 }), 2: (d: any) => ({ ...d, x: d.x + 1 }) };
    expect((migrar({ a: 0 }, 1, 3, tabla) as any).x).toBe(2);
    expect(() => migrar({}, 1, 3, { 1: (d: any) => d })).toThrow(/Falta la migración/);
    expect(() => migrar({}, 5, 3, tabla)).toThrow(/más nueva/);
  });

  it('copia de una versión anterior se migra al leerla', async () => {
    // Con la versión actual (1) no hay migraciones: una copia v1 se lee tal cual.
    await repo.cargar(en('2026-11-16', '08:00'));
    const ci = await repo.crearCopiaAhora(en('2026-11-16', '10:00'));
    const { datos } = await leerCopia(ci.json);
    expect(datos.config.fechaInicio).toBe('2026-11-16');
  });

  it('al abrir datos de una versión anterior: copia interna y migración', async () => {
    await repo.cargar(en('2026-11-16', '08:00'));
    await repo.fichar('E', en('2026-11-16', '09:00'));
    // Simula una versión 2 de la app que añade un campo a la configuración.
    const tabla = { 1: (d: any) => ({ ...d, config: { ...d.config, nuevo: true } }) };
    const e = await repo.cargar(en('2026-11-16', '10:00'), { version: 2, tabla });
    expect(e.meta.version).toBe(2);
    expect((e.datos.config as any).nuevo).toBe(true);
    expect(e.datos.movimientos.length).toBe(1);
    const copias = await repo.listarCopias();
    expect(copias.map((c) => c.tipo)).toEqual(['antes-migrar']);
    expect(JSON.parse(copias[0].json).datos.movimientos.length).toBe(1);
  });
});
