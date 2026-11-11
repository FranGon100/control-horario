// Contadores de vacaciones y asuntos propios. Puro.
import { esLaborableBase } from './calculo';
import { diferenciaDias, diasDelAnio, sumarDias, type Fecha } from './tiempo';
import type { Config, Dia, Festivo, Marca } from './tipos';

export interface ResumenVacaciones {
  anio: number;
  anuales?: number;
  diasDeAlta: number;
  diasAltaTranscurridos: number;
  ajuste: number;
  derecho?: number;
  generadas?: number;
  disfrutadas: number;
  planificadas: number;
  pendientes?: number;
  prevision?: number;
  fechasDisfrutadas: Fecha[];
  fechasPlanificadas: Fecha[];
}

export interface ResumenAsuntos {
  anio: number;
  anuales?: number;
  ajuste: number;
  disfrutados: number;
  planificados: number;
  disponibles?: number;
  fechasDisfrutadas: Fecha[];
  fechasPlanificadas: Fecha[];
}

/** Días laborables de un rango (excluye sábados, domingos y festivos). */
export function laborablesDelRango(desde: Fecha, hasta: Fecha, config: Config, festivos: Festivo[]): Fecha[] {
  const set = new Set(festivos.map((f) => f.fecha));
  const r: Fecha[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) if (esLaborableBase(f, config.horarios, set)) r.push(f);
  return r;
}

/** Días naturales de alta del año y transcurridos hasta `hoy` (incluido). */
export function diasAlta(anio: number, inicio: Fecha, hoy: Fecha): { total: number; transcurridos: number } {
  const ini = `${anio}-01-01`, fin = `${anio}-12-31`;
  const desde = inicio > ini ? inicio : ini;
  if (desde > fin) return { total: 0, transcurridos: 0 };
  const total = diferenciaDias(desde, fin) + 1;
  const hasta = hoy < fin ? hoy : fin;
  const transcurridos = hasta < desde ? 0 : diferenciaDias(desde, hasta) + 1;
  return { total, transcurridos };
}

function diasMarcados(anio: number, marca: Marca, dias: Dia[], config: Config, festivos: Festivo[]): Fecha[] {
  const set = new Set(festivos.map((f) => f.fecha));
  return dias
    .filter((d) => d.marca === marca && d.fecha.startsWith(`${anio}-`) && d.fecha >= config.fechaInicio)
    .filter((d) => esLaborableBase(d.fecha, config.horarios, set))
    .map((d) => d.fecha)
    .sort();
}

const suma = (a?: { dias: number }[]) => (a ?? []).reduce((s, x) => s + x.dias, 0);

export function resumenVacaciones(anio: number, config: Config, dias: Dia[], festivos: Festivo[], hoy: Fecha): ResumenVacaciones {
  const a = config.anual[String(anio)] ?? {};
  const { total, transcurridos } = diasAlta(anio, config.fechaInicio, hoy);
  const nd = diasDelAnio(anio);
  const ajuste = suma(a.ajustesVac);
  const fechas = diasMarcados(anio, 'VAC', dias, config, festivos);
  const fechasDisfrutadas = fechas.filter((f) => f <= hoy);
  const fechasPlanificadas = fechas.filter((f) => f > hoy);
  const disfrutadas = fechasDisfrutadas.length, planificadas = fechasPlanificadas.length;
  const anuales = a.vacaciones;
  const derecho = anuales === undefined ? undefined : (anuales * total) / nd + ajuste;
  const generadas = anuales === undefined ? undefined : (anuales * transcurridos) / nd + ajuste;
  return {
    anio, anuales, diasDeAlta: total, diasAltaTranscurridos: transcurridos, ajuste,
    derecho, generadas, disfrutadas, planificadas,
    pendientes: generadas === undefined ? undefined : generadas - disfrutadas,
    prevision: derecho === undefined ? undefined : derecho - disfrutadas - planificadas,
    fechasDisfrutadas, fechasPlanificadas,
  };
}

export function resumenAsuntos(anio: number, config: Config, dias: Dia[], festivos: Festivo[], hoy: Fecha): ResumenAsuntos {
  const a = config.anual[String(anio)] ?? {};
  const ajuste = suma(a.ajustesAP);
  const fechas = diasMarcados(anio, 'AP', dias, config, festivos);
  const fechasDisfrutadas = fechas.filter((f) => f <= hoy);
  const fechasPlanificadas = fechas.filter((f) => f > hoy);
  const anuales = a.asuntos;
  return {
    anio, anuales, ajuste,
    disfrutados: fechasDisfrutadas.length,
    planificados: fechasPlanificadas.length,
    disponibles: anuales === undefined ? undefined : anuales + ajuste - fechas.length,
    fechasDisfrutadas, fechasPlanificadas,
  };
}

/** Años con actividad: desde el de inicio hasta el mayor entre hoy y el último día marcado. */
export function aniosConActividad(config: Config, dias: Dia[], hoy: Fecha): number[] {
  const desde = +config.fechaInicio.slice(0, 4);
  let hasta = +hoy.slice(0, 4);
  for (const d of dias) if (d.marca) hasta = Math.max(hasta, +d.fecha.slice(0, 4));
  for (const k of Object.keys(config.anual)) hasta = Math.max(hasta, +k);
  const r: number[] = [];
  for (let y = desde; y <= hasta; y++) r.push(y);
  return r;
}
