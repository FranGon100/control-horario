// Exportación a Excel (.xlsx) generada en el propio teléfono con ExcelJS (empaquetada).
import ExcelJS from 'exceljs';
import { calcular } from '../motor/calculo';
import { hhmm, horasDecimales } from '../motor/formato';
import { descomponer, diaSemana, fechaDe, horaDe, NOMBRES_DIA, NOMBRES_MES, partes, type Fecha } from '../motor/tiempo';
import { NOMBRE_MARCA, NOMBRE_MOV, type Datos } from '../motor/tipos';
import { aniosConActividad, resumenAsuntos, resumenVacaciones } from '../motor/vacaciones';

export const HOJAS = [
  'HISTÓRICO DIARIO',
  'MOVIMIENTOS DE FICHAJE',
  'RESUMEN MENSUAL',
  'VACACIONES Y ASUNTOS PROPIOS',
  'SALDO ACUMULADO',
] as const;

const ESTADO = { CERRADO: 'Cerrado', EN_CURSO: 'En curso', PENDIENTE: 'Pendiente', SIN_FICHAJES: 'Sin fichajes' };

/** Fecha real de Excel (sin hora). */
const fechaExcel = (f: Fecha) => { const [y, m, d] = descomponer(f); return new Date(Date.UTC(y, m - 1, d)); };
/** Fecha y hora de Madrid como fecha real de Excel. */
const fechaHoraExcel = (t: number) => { const p = partes(t); return new Date(Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi)); };

/** Dos columnas por duración: texto ±HH:MM y horas decimales. */
const dur = (min: number, signo = false) => [hhmm(min, signo), horasDecimales(min)];
const cab = (nombre: string) => [`${nombre} (HH:MM)`, `${nombre} (horas)`];

function hoja(wb: ExcelJS.Workbook, nombre: string, cabecera: string[], filas: unknown[][], formatos: Record<number, string> = {}) {
  const ws = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(cabecera).font = { bold: true };
  for (const f of filas) ws.addRow(f);
  ws.columns.forEach((c, i) => {
    c.width = Math.max(10, Math.min(40, (cabecera[i]?.length ?? 8) + 2));
    if (formatos[i + 1]) c.numFmt = formatos[i + 1];
  });
  return ws;
}

export async function construirLibro(datos: Datos, ahora: number): Promise<ExcelJS.Workbook> {
  const res = calcular(datos, ahora);
  const hoy = fechaDe(ahora);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Control Horario';
  wb.created = new Date(ahora);
  const FMT_F = 'dd/mm/yyyy', FMT_FH = 'dd/mm/yyyy hh:mm', FMT_H = '0.00';

  // 1 · HISTÓRICO DIARIO
  hoja(wb, HOJAS[0], [
    'Fecha', 'Día de la semana', 'Tipo de día', 'Entrada', 'Salida', 'Gestiones particulares',
    ...cab('Tiempo trabajado'), ...cab('Horas ordinarias'), ...cab('Horas adicionales'),
    ...cab('Tiempo a recuperar'), ...cab('Saldo diario'), ...cab('Saldo acumulado'), 'Estado', 'Observaciones',
  ], res.dias.map((d) => [
    fechaExcel(d.fecha), NOMBRES_DIA[diaSemana(d.fecha)],
    d.festivo ? `Festivo (${d.festivo.nombre})` : d.marca ? NOMBRE_MARCA[d.marca] : d.finDeSemana ? 'Fin de semana' : d.tipo === 'LABORABLE' ? 'Laborable' : 'No laborable',
    d.entrada !== undefined ? horaDe(d.entrada) : '',
    d.salida !== undefined ? horaDe(d.salida) + (d.salidaDiaSiguiente ? ' (+1)' : '') : '',
    d.gestiones,
    ...dur(d.T), ...dur(d.ORD), ...dur(d.ADIC), ...dur(d.DEF), ...dur(d.saldo, true), ...dur(d.acumulado, true),
    ESTADO[d.estado] + (d.porRevisar && d.estado === 'SIN_FICHAJES' ? ' (por revisar)' : ''),
    d.obs ?? '',
  ]), { 1: FMT_F, 8: FMT_H, 10: FMT_H, 12: FMT_H, 14: FMT_H, 16: FMT_H, 18: FMT_H });

  // 2 · MOVIMIENTOS DE FICHAJE
  hoja(wb, HOJAS[1], ['Fecha', 'Hora', 'Tipo', 'Origen', 'Modificado', 'Fecha de modificación', 'Valor original', 'Computa'],
    datos.movimientos.map((m) => [
      fechaExcel(fechaDe(m.t)), horaDe(m.t), NOMBRE_MOV[m.tipo],
      m.origen === 'boton' ? 'botón' : 'manual',
      m.modificado !== undefined ? 'sí' : 'no',
      m.modificado !== undefined ? fechaHoraExcel(m.modificado) : '',
      m.original === null ? 'añadido a mano' : m.original ? `${NOMBRE_MOV[m.original.tipo]} ${horaDe(m.original.t)} del ${fechaDe(m.original.t).split('-').reverse().join('/')}` : '',
      fechaDe(m.t) < datos.config.fechaInicio ? 'no (prueba)' : 'sí',
    ]), { 1: FMT_F, 6: FMT_FH });

  // 3 · RESUMEN MENSUAL
  hoja(wb, HOJAS[2], ['Año', 'Mes', 'Días trabajados', ...cab('Tiempo trabajado'), ...cab('Horas ordinarias'),
    ...cab('Horas adicionales'), ...cab('Tiempo a recuperar'), ...cab('Saldo del mes'), ...cab('Saldo acumulado a fin de mes')],
  res.meses.map((m) => [m.anio, NOMBRES_MES[m.mes], m.diasTrabajados, ...dur(m.T), ...dur(m.ORD), ...dur(m.ADIC),
    ...dur(m.DEF), ...dur(m.saldo, true), ...dur(m.acumulado, true)]),
  { 5: FMT_H, 7: FMT_H, 9: FMT_H, 11: FMT_H, 13: FMT_H, 15: FMT_H });

  // 4 · VACACIONES Y ASUNTOS PROPIOS
  const anios = aniosConActividad(datos.config, datos.dias, hoy);
  const n = (x: number | undefined) => (x === undefined ? 'sin definir' : Math.round(x * 100) / 100);
  const ws4 = hoja(wb, HOJAS[3], [
    'Año', 'Vacaciones: días anuales', 'Días de alta', 'Ajuste vacaciones', 'Derecho del año', 'Generadas a hoy',
    'Disfrutadas', 'Planificadas', 'Pendientes', 'Previsión a 31/12',
    'Asuntos propios: cantidad anual', 'Ajuste asuntos propios', 'Asuntos propios disfrutados', 'Asuntos propios planificados', 'Asuntos propios disponibles',
  ], anios.map((y) => {
    const v = resumenVacaciones(y, datos.config, datos.dias, datos.festivos, hoy);
    const a = resumenAsuntos(y, datos.config, datos.dias, datos.festivos, hoy);
    return [y, v.anuales ?? 'sin definir', v.diasDeAlta, n(v.ajuste), n(v.derecho), n(v.generadas), v.disfrutadas, v.planificadas,
      n(v.pendientes), n(v.prevision), a.anuales ?? 'sin definir', n(a.ajuste), a.disfrutados, a.planificados, n(a.disponibles)];
  }), { 4: FMT_H, 5: FMT_H, 6: FMT_H, 9: FMT_H, 10: FMT_H, 12: FMT_H, 15: FMT_H });
  ws4.addRow([]);
  ws4.addRow(['Listado de días']).font = { bold: true };
  ws4.addRow(['Fecha', 'Tipo', 'Año', 'Situación']).font = { bold: true };
  for (const y of anios) {
    const v = resumenVacaciones(y, datos.config, datos.dias, datos.festivos, hoy);
    const a = resumenAsuntos(y, datos.config, datos.dias, datos.festivos, hoy);
    const filas: [Fecha, string, string][] = [
      ...v.fechasDisfrutadas.map((f) => [f, 'Vacaciones', 'disfrutado'] as [Fecha, string, string]),
      ...v.fechasPlanificadas.map((f) => [f, 'Vacaciones', 'planificado'] as [Fecha, string, string]),
      ...a.fechasDisfrutadas.map((f) => [f, 'Asunto propio', 'disfrutado'] as [Fecha, string, string]),
      ...a.fechasPlanificadas.map((f) => [f, 'Asunto propio', 'planificado'] as [Fecha, string, string]),
    ].sort((p, q) => (p[0] < q[0] ? -1 : 1));
    for (const [f, t, s] of filas) ws4.addRow([fechaExcel(f), t, y, s]).getCell(1).numFmt = FMT_F;
  }

  // 5 · SALDO ACUMULADO
  const t = res.totales;
  const ws5 = hoja(wb, HOJAS[4], ['Concepto', 'Valor (HH:MM)', 'Valor (horas)'], [
    ['Horas adicionales realizadas', ...dur(t.ADIC)],
    ['Tiempo pendiente de recuperar', ...dur(t.pendiente)],
    ['Tiempo recuperado', ...dur(t.recuperado)],
    ['Tiempo a favor', ...dur(t.aFavor)],
    ['Saldo neto', ...dur(t.saldo, true)],
    ['Días por revisar (no cuentan)', res.diasPorRevisar.length, ''],
    ['Calculado el', fechaHoraExcel(ahora), ''],
  ], { 3: FMT_H });
  ws5.getCell('B8').numFmt = FMT_FH;
  ws5.getColumn(1).width = 34;
  ws5.addRow([]);
  ws5.addRow(['Evolución día a día']).font = { bold: true };
  ws5.addRow(['Fecha', ...cab('Saldo diario'), ...cab('Saldo acumulado')]).font = { bold: true };
  for (const d of res.dias) {
    const r = ws5.addRow([fechaExcel(d.fecha), ...dur(d.saldo, true), ...dur(d.acumulado, true)]);
    r.getCell(1).numFmt = FMT_F;
    r.getCell(3).numFmt = FMT_H;
    r.getCell(5).numFmt = FMT_H;
  }
  return wb;
}

export function nombreArchivoExcel(ahora: number) {
  return `control-horario_${fechaDe(ahora)}.xlsx`;
}

export async function generarExcel(datos: Datos, ahora: number): Promise<File> {
  const wb = await construirLibro(datos, ahora);
  const buf = await wb.xlsx.writeBuffer();
  return new File([buf as ArrayBuffer], nombreArchivoExcel(ahora), {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
