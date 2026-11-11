import { expect, type Page } from '@playwright/test';
import type { Datos } from '../../src/motor/tipos';

/** Hora de Madrid en invierno (noviembre-marzo): UTC+1. */
export const madrid = (s: string) => new Date(s.replace(' ', 'T') + ':00+01:00');

export async function abrir(page: Page, cuando: string) {
  await page.clock.install({ time: madrid(cuando) });
  await page.goto('./');
}

export async function hacerAsistente(page: Page) {
  await expect(page.getByTestId('asistente')).toBeVisible();
  for (const y of [2026, 2027]) {
    await page.getByTestId(`vac-${y}`).fill('22');
    await page.getByTestId(`ap-${y}`).fill('2');
  }
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Es correcto, siguiente' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByTestId('terminar-asistente').click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByTestId('estado')).toBeVisible();
}

export async function hora(page: Page, cuando: string) {
  await page.clock.setSystemTime(madrid(cuando));
  await page.clock.runFor(1100);
}

export async function fichar(page: Page, boton: 'ENTRADA' | 'SALIDA' | 'GESTIÓN PARTICULAR' | 'REGRESO DE GESTIÓN', cuando: string) {
  await hora(page, cuando);
  await page.getByRole('button', { name: boton, exact: true }).click();
  await expect(page.getByTestId('toast')).toContainText(`registrada · ${cuando.slice(11)}`);
  await page.getByTestId('toast').click();
}

/** Lee los datos guardados en IndexedDB desde la página. */
export function leerIDB(page: Page): Promise<Datos> {
  return page.evaluate(() => new Promise<any>((ok, mal) => {
    const r = indexedDB.open('control-horario');
    r.onerror = () => mal(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction(['movimientos', 'dias', 'festivos', 'ajustes']);
      const out: any = {};
      for (const s of ['movimientos', 'dias', 'festivos']) tx.objectStore(s).getAll().onsuccess = (e: any) => { out[s] = e.target.result; };
      tx.objectStore('ajustes').get('config').onsuccess = (e: any) => { out.config = e.target.result.valor; };
      tx.oncomplete = () => { db.close(); ok(out); };
    };
  }));
}

export async function saldoActual(page: Page) {
  return (await page.locator('.caja-saldo .saldo').textContent())?.trim();
}
