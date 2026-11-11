// Datos de partida (§3 y §4 de la especificación).
import type { Config, Festivo } from '../motor/tipos';

export const CONFIG_INICIAL: Config = {
  fechaInicio: '2026-11-16',
  horarios: [{ desde: '2026-11-16', entrada: '09:00', salida: '17:00', dias: [1, 2, 3, 4, 5] }],
  anual: {},
};

/** Festivos de la ciudad de Zaragoza comprobados el 11/11/2026 (ver docs/ESPECIFICACION.md §4). */
export const FESTIVOS_INICIALES: Festivo[] = [
  { fecha: '2026-12-07', nombre: 'Día de la Constitución (trasladado del domingo 6)' },
  { fecha: '2026-12-08', nombre: 'Inmaculada Concepción' },
  { fecha: '2026-12-25', nombre: 'Natividad del Señor' },
  { fecha: '2027-01-01', nombre: 'Año Nuevo' },
  { fecha: '2027-01-06', nombre: 'Epifanía del Señor' },
  { fecha: '2027-01-29', nombre: 'San Valero (local)', sinConfirmar: true },
  { fecha: '2027-03-05', nombre: 'Cincomarzada (local)', sinConfirmar: true },
  { fecha: '2027-03-25', nombre: 'Jueves Santo' },
  { fecha: '2027-03-26', nombre: 'Viernes Santo' },
  { fecha: '2027-04-23', nombre: 'San Jorge (Día de Aragón)' },
  { fecha: '2027-05-01', nombre: 'Fiesta del Trabajo' },
  { fecha: '2027-08-16', nombre: 'Asunción de la Virgen (trasladado del domingo 15)' },
  { fecha: '2027-10-12', nombre: 'Fiesta Nacional de España' },
  { fecha: '2027-11-01', nombre: 'Todos los Santos' },
  { fecha: '2027-12-06', nombre: 'Día de la Constitución' },
  { fecha: '2027-12-08', nombre: 'Inmaculada Concepción' },
  { fecha: '2027-12-25', nombre: 'Natividad del Señor' },
];
