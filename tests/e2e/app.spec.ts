import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { calcular } from '../../src/motor/calculo';
import { hhmm } from '../../src/motor/formato';
import { abrir, fichar, hacerAsistente, hora, leerIDB, madrid, saldoActual } from './ayuda';

test('flujo de los cuatro botones con confirmación y saldo', async ({ page }) => {
  await abrir(page, '2026-11-16 08:50');
  await hacerAsistente(page);
  await expect(page.getByTestId('estado')).toHaveText('FUERA');

  // Botón inactivo: explica por qué.
  await page.getByRole('button', { name: 'SALIDA', exact: true }).click({ force: true });
  await expect(page.getByTestId('toast')).toHaveText('Primero ficha la ENTRADA.');

  await fichar(page, 'ENTRADA', '2026-11-16 09:00');
  await expect(page.getByTestId('estado')).toHaveText('TRABAJANDO');
  expect(await saldoActual(page)).toBe('00 h 00 min');

  await fichar(page, 'GESTIÓN PARTICULAR', '2026-11-16 10:00');
  await expect(page.getByTestId('estado')).toHaveText('EN GESTIÓN');
  await fichar(page, 'REGRESO DE GESTIÓN', '2026-11-16 11:00');
  expect(await saldoActual(page)).toBe('-01 h 00 min');
  await fichar(page, 'SALIDA', '2026-11-16 18:00');
  await expect(page.getByTestId('estado')).toHaveText('FUERA');
  expect(await saldoActual(page)).toBe('00 h 00 min');

  // Salida estando en gestión: pide confirmación.
  await fichar(page, 'ENTRADA', '2026-11-16 19:00');
  await fichar(page, 'GESTIÓN PARTICULAR', '2026-11-16 19:30');
  await hora(page, '2026-11-16 19:40');
  await page.getByRole('button', { name: 'SALIDA', exact: true }).click();
  await expect(page.getByText('No has vuelto de la gestión. ¿Terminar la jornada?')).toBeVisible();
  await page.getByRole('button', { name: 'Sí, terminar' }).click();
  await expect(page.getByTestId('toast')).toContainText('SALIDA registrada · 19:40');
  expect(await saldoActual(page)).toBe('+00 h 30 min');

  // Persistencia: recargar y cerrar/abrir.
  await page.reload();
  expect(await saldoActual(page)).toBe('+00 h 30 min');
  const ctx = page.context();
  await page.close();
  const p2 = await ctx.newPage();
  await p2.clock.install({ time: madrid('2026-11-16 20:00') });
  await p2.goto('./');
  await expect(p2.getByTestId('estado')).toHaveText('FUERA');
  expect(await saldoActual(p2)).toBe('+00 h 30 min');
  expect((await leerIDB(p2)).movimientos.length).toBe(7);
});

test('sin conexión: funciona y no hace ninguna petición de red', async ({ page, context }) => {
  await abrir(page, '2026-11-17 08:50');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await hacerAsistente(page);

  await context.setOffline(true);
  const red: string[] = [];
  page.on('request', (r) => red.push(r.url()));
  page.on('requestfailed', (r) => red.push('FALLO ' + r.url()));
  await page.reload();
  await expect(page.getByTestId('estado')).toHaveText('FUERA');
  const tras = page.waitForTimeout(0);
  await tras;
  // Tras recargar, todo lo sirve el service worker (caché).
  for (const u of red) expect(u).not.toMatch(/^FALLO/);
  const respuestas = red.length;
  red.length = 0;

  await fichar(page, 'ENTRADA', '2026-11-17 09:00');
  await fichar(page, 'GESTIÓN PARTICULAR', '2026-11-17 12:00');
  await fichar(page, 'REGRESO DE GESTIÓN', '2026-11-17 12:30');
  await fichar(page, 'SALIDA', '2026-11-17 17:30');
  await page.getByRole('button', { name: /Resumen/ }).click();
  await page.getByRole('button', { name: /Calendario/ }).click();
  await page.getByRole('button', { name: /Control horario/ }).click();
  expect(red, 'peticiones durante el uso sin conexión').toEqual([]);
  await page.getByRole('button', { name: /Inicio/ }).click();
  expect(await saldoActual(page)).toBe('00 h 00 min');
  expect(respuestas).toBeGreaterThan(0);
});

test('aviso de olvido al día siguiente e indicación manual de la hora', async ({ page }) => {
  await abrir(page, '2026-11-26 08:50');
  await hacerAsistente(page);
  await fichar(page, 'ENTRADA', '2026-11-26 09:00');
  await hora(page, '2026-11-27 08:00');
  await page.reload();
  await expect(page.getByText('Tienes una jornada abierta desde el 26/11/2026 a las 09:00')).toBeVisible();
  await page.getByRole('button', { name: 'Indicar la hora ahora' }).click();
  await page.getByTestId('hora-olvido').fill('17:00');
  await page.getByRole('button', { name: 'Guardar salida' }).click();
  await expect(page.getByTestId('olvido')).toHaveCount(0);
  const d = await leerIDB(page);
  const s = d.movimientos.find((m) => m.tipo === 'S')!;
  expect(s.origen).toBe('manual');
  expect(calcular(d, madrid('2026-11-27 08:00').getTime()).porFecha.get('2026-11-26')!.saldo).toBe(0);
});

test('aviso de copia semanal al avanzar el reloj 7 días', async ({ page }) => {
  await abrir(page, '2026-11-16 08:00');
  await hacerAsistente(page);
  await expect(page.getByTestId('aviso-copia')).toBeVisible();
  await page.getByTestId('aviso-copia').getByRole('button', { name: 'Posponer' }).click();
  await page.getByRole('button', { name: 'Posponer' }).last().click();
  await expect(page.getByTestId('aviso-copia')).toHaveCount(0);
  await hora(page, '2026-11-22 08:00');
  await page.reload();
  await expect(page.getByTestId('estado')).toBeVisible();
  await expect(page.getByTestId('aviso-copia')).toHaveCount(0);
  await hora(page, '2026-11-23 08:00');
  await page.reload();
  await expect(page.getByTestId('aviso-copia')).toBeVisible();
});

test('histórico: editar, añadir y borrar fichajes con recálculo', async ({ page }) => {
  await abrir(page, '2026-11-27 08:50');
  await hacerAsistente(page);
  await fichar(page, 'ENTRADA', '2026-11-27 09:00');
  await fichar(page, 'SALIDA', '2026-11-27 17:00');
  await hora(page, '2026-11-27 20:00');
  await page.getByRole('button', { name: /Control horario/ }).click();
  await page.locator('[data-fecha="2026-11-27"]').click();
  const dia = page.getByTestId('dia');
  await expect(dia.getByTestId('saldo-dia')).toContainText('00 h 00 min');

  // Editar la salida a las 18:30.
  await dia.getByTestId('editar').click();
  await dia.getByLabel('Hora del fichaje 2').fill('18:30');
  await dia.getByTestId('guardar-dia').click();
  await expect(dia.getByTestId('saldo-dia')).toContainText('+01 h 30 min');
  await expect(dia.getByText(/modificado a mano .* antes: SALIDA 17:00/)).toBeVisible();

  // Añadir una gestión olvidada (13:00-14:00) y comprobar el recálculo.
  await dia.getByTestId('editar').click();
  await dia.getByTestId('anadir-fila').click();
  await dia.getByLabel('Tipo del fichaje 3').selectOption('G');
  await dia.getByLabel('Hora del fichaje 3').fill('13:00');
  await dia.getByTestId('guardar-dia').click();
  await expect(dia.getByTestId('errores')).toBeVisible(); // orden incorrecto: no se guarda
  // Reordenar: E 09:00, G 13:00, R 14:00, S 18:30
  await dia.getByLabel('Tipo del fichaje 2').selectOption('G');
  await dia.getByLabel('Hora del fichaje 2').fill('13:00');
  await dia.getByLabel('Tipo del fichaje 3').selectOption('R');
  await dia.getByLabel('Hora del fichaje 3').fill('14:00');
  await dia.getByTestId('anadir-fila').click();
  await dia.getByLabel('Tipo del fichaje 4').selectOption('S');
  await dia.getByLabel('Hora del fichaje 4').fill('18:30');
  await dia.getByTestId('guardar-dia').click();
  await expect(dia.getByTestId('saldo-dia')).toContainText('+00 h 30 min');

  // Borrar la gestión y el regreso (con confirmación).
  await dia.getByTestId('editar').click();
  await dia.getByLabel('Eliminar fichaje 2').click();
  await page.getByTestId('confirmar').getByRole('button', { name: 'Eliminar' }).click();
  await dia.getByLabel('Eliminar fichaje 2').click();
  await page.getByTestId('confirmar').getByRole('button', { name: 'Eliminar' }).click();
  await dia.getByTestId('guardar-dia').click();
  await expect(dia.getByTestId('saldo-dia')).toContainText('+01 h 30 min');
  const d = await leerIDB(page);
  expect(d.movimientos.map((m) => m.tipo).sort().join('')).toBe('ES');
});

async function crearHistorial(page: import('@playwright/test').Page) {
  await abrir(page, '2026-11-30 08:50');
  await hacerAsistente(page);
  await fichar(page, 'ENTRADA', '2026-11-30 09:00');
  await fichar(page, 'SALIDA', '2026-11-30 17:00');
  await fichar(page, 'ENTRADA', '2026-11-30 22:00');
  await hora(page, '2026-12-01 01:59');
  await expect(page.getByText('Tienes una jornada abierta desde el 30/11/2026 a las 22:00')).toBeVisible();
  await page.getByRole('button', { name: 'Sigo trabajando' }).click();
  await page.getByTestId('toast').click();
  await fichar(page, 'SALIDA', '2026-12-01 02:00');
  await fichar(page, 'ENTRADA', '2026-12-01 09:20');
  await fichar(page, 'GESTIÓN PARTICULAR', '2026-12-01 12:00');
  await fichar(page, 'REGRESO DE GESTIÓN', '2026-12-01 12:30');
  await fichar(page, 'SALIDA', '2026-12-01 18:00');
  // Vacaciones del 09/12 al 11/12 desde el calendario.
  await page.getByRole('button', { name: /Calendario/ }).click();
  await page.getByLabel('Desde').fill('2026-12-07');
  await page.getByLabel('Hasta').fill('2026-12-11');
  await expect(page.getByTestId('dias-rango')).toContainText('3 días laborables');
  await page.getByRole('button', { name: 'Marcar', exact: true }).click();
  await expect(page.getByTestId('toast')).toContainText('3 días marcados');
  await page.getByTestId('toast').click();
  await hora(page, '2026-12-02 10:00');
}

test('15 · exportación completa a Excel coincide con el motor', async ({ page }) => {
  await crearHistorial(page);
  await page.getByRole('button', { name: /Resumen/ }).click();
  await page.getByTestId('exportar').click();
  const descarga = page.waitForEvent('download');
  await page.getByTestId('archivo').getByRole('button', { name: 'Descargar' }).click();
  const d = await descarga;
  expect(d.suggestedFilename()).toBe('control-horario_2026-12-02.xlsx');
  const ruta = await d.path();

  const datos = await leerIDB(page);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await readFile(ruta)) as any);
  // Instante del cálculo según la hoja (hora de Madrid guardada como fecha de Excel).
  const calc = wb.getWorksheet('SALDO ACUMULADO')!.getCell('B8').value as Date;
  const ahora = madrid(calc.toISOString().slice(0, 16).replace('T', ' ')).getTime() + 59_000;
  const res = calcular(datos, ahora);
  expect(wb.worksheets.map((w) => w.name)).toEqual([
    'HISTÓRICO DIARIO', 'MOVIMIENTOS DE FICHAJE', 'RESUMEN MENSUAL', 'VACACIONES Y ASUNTOS PROPIOS', 'SALDO ACUMULADO',
  ]);
  const val = (w: ExcelJS.Worksheet, f: number, c: number) => w.getRow(f).getCell(c).value;

  // 1 · Histórico diario: una fila por día del motor.
  const h = wb.getWorksheet('HISTÓRICO DIARIO')!;
  expect(h.rowCount - 1).toBe(res.dias.length);
  res.dias.forEach((dia, i) => {
    const f = i + 2;
    expect((val(h, f, 1) as Date).toISOString().slice(0, 10)).toBe(dia.fecha);
    expect(val(h, f, 7)).toBe(hhmm(dia.T, false));
    expect(val(h, f, 15)).toBe(hhmm(dia.saldo));
    expect(val(h, f, 16)).toBeCloseTo(dia.saldo / 60, 3);
    expect(val(h, f, 17)).toBe(hhmm(dia.acumulado));
  });
  expect(h.getRow(2).getCell(1).numFmt).toBe('dd/mm/yyyy');

  // 2 · Movimientos.
  const m = wb.getWorksheet('MOVIMIENTOS DE FICHAJE')!;
  expect(m.rowCount - 1).toBe(datos.movimientos.length);
  expect(val(m, 2, 2)).toBe('09:00');
  expect(val(m, 2, 4)).toBe('botón');

  // 3 · Resumen mensual.
  const r = wb.getWorksheet('RESUMEN MENSUAL')!;
  expect(r.rowCount - 1).toBe(res.meses.length);
  res.meses.forEach((mes, i) => {
    expect(val(r, i + 2, 1)).toBe(mes.anio);
    expect(val(r, i + 2, 12)).toBe(hhmm(mes.saldo));
    expect(val(r, i + 2, 14)).toBe(hhmm(mes.acumulado));
  });

  // 4 · Vacaciones: 2026 con 3 días planificados y derecho 22 × 46 / 365.
  const v = wb.getWorksheet('VACACIONES Y ASUNTOS PROPIOS')!;
  expect(val(v, 2, 1)).toBe(2026);
  expect(val(v, 2, 5)).toBeCloseTo(2.77, 2);
  expect(val(v, 2, 8)).toBe(3);

  // 5 · Saldo acumulado.
  const s = wb.getWorksheet('SALDO ACUMULADO')!;
  expect(val(s, 2, 2)).toBe(hhmm(res.totales.ADIC, false));
  expect(val(s, 3, 2)).toBe(hhmm(res.totales.pendiente, false));
  expect(val(s, 4, 2)).toBe(hhmm(res.totales.recuperado, false));
  expect(val(s, 6, 2)).toBe(hhmm(res.totales.saldo));
  // 30/11: +02:00 · 01/12: T 10:10, ORD 07:10 → ADIC 03:00, DEF 00:50 → +02:10
  expect(res.totales.saldo).toBe(4 * 60 + 10);
});

test('16 · copia de seguridad: crear, borrar todo, restaurar y mismo saldo', async ({ page }) => {
  await crearHistorial(page);
  const antes = await leerIDB(page);
  await page.getByRole('button', { name: /Inicio/ }).click();
  const saldoAntes = await saldoActual(page);
  await page.getByRole('button', { name: /Config/ }).click();
  await page.getByTestId('guardar-copia').click();
  const descarga = page.waitForEvent('download');
  await page.getByTestId('archivo').getByRole('button', { name: 'Descargar' }).click();
  const d = await descarga;
  expect(d.suggestedFilename()).toMatch(/^control-horario_copia_2026-12-02_\d{4}\.json$/);
  const ruta = await d.path();
  await expect(page.getByTestId('ultima-fuera')).toContainText('02/12/2026');

  // Borrar todos los datos.
  await page.evaluate(() => new Promise<void>((ok) => {
    const r = indexedDB.deleteDatabase('control-horario');
    r.onsuccess = () => ok(); r.onerror = () => ok(); r.onblocked = () => ok();
  }));
  await page.reload();
  await hacerAsistente(page);
  expect((await leerIDB(page)).movimientos).toEqual([]);

  // Restaurar desde el archivo.
  await page.getByRole('button', { name: /Config/ }).click();
  await page.getByTestId('archivo-restaurar').setInputFiles(ruta);
  await expect(page.getByTestId('previa-movs')).toContainText(String(antes.movimientos.length));
  await page.getByTestId('confirmar-restaurar').click();
  await page.getByTestId('confirmar').getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByTestId('restaurado-ok')).toBeVisible();
  await page.getByTestId('restaurar').getByText('Cerrar', { exact: true }).click();

  const despues = await leerIDB(page);
  const orden = (x: any) => JSON.stringify({
    movimientos: [...x.movimientos].sort((a: any, b: any) => a.t - b.t),
    dias: [...x.dias].sort((a: any, b: any) => (a.fecha < b.fecha ? -1 : 1)),
    festivos: [...x.festivos].sort((a: any, b: any) => (a.fecha < b.fecha ? -1 : 1)),
    config: x.config,
  });
  expect(orden(despues)).toBe(orden(antes));
  await page.getByRole('button', { name: /Inicio/ }).click();
  expect(await saldoActual(page)).toBe(saldoAntes);
});

test('a 360 px de ancho ninguna pantalla se desplaza en horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await crearHistorial(page);
  const pantallas: [RegExp, string][] = [[/Inicio/, 'inicio'], [/Control horario/, 'control'], [/Calendario/, 'calendario'], [/Resumen/, 'resumen'], [/Config/, 'config']];
  for (const [nombre, id] of pantallas) {
    await page.getByRole('button', { name: nombre }).click();
    await page.screenshot({ path: `test-results/pantalla-360-${id}.png`, fullPage: true });
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde, id).toBeLessThanOrEqual(0);
  }
  await page.getByRole('button', { name: /Inicio/ }).click();
  for (const b of ['ENTRADA', 'SALIDA', 'GESTIÓN PARTICULAR', 'REGRESO DE GESTIÓN'])
    await expect(page.getByRole('button', { name: b, exact: true })).toBeInViewport();
  await page.getByRole('button', { name: /Control horario/ }).click();
  await page.locator('[data-fecha="2026-12-01"]').click();
  await page.screenshot({ path: 'test-results/pantalla-360-dia.png' });
});
