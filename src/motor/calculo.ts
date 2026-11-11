// Motor de cálculo del saldo horario. Puro: no lee el reloj ni guarda nada.
import { analizar, type Sesion } from './secuencia';
import {
  diaSemana, fechaDe, horaAMinutos, inicioDia, instanteMadrid, MIN, sumarDias, type Fecha,
} from './tiempo';
import type { Datos, Festivo, Horario, Marca, Movimiento } from './tipos';

export type EstadoDia = 'CERRADO' | 'EN_CURSO' | 'PENDIENTE' | 'SIN_FICHAJES';
export type TipoDia = 'LABORABLE' | 'NO_LABORABLE';

export interface Tramo {
  a: number;
  b: number;
}

export interface ResultadoDia {
  fecha: Fecha;
  tipo: TipoDia;
  /** Lunes-viernes (según horario) y no festivo, sin tener en cuenta marcas. */
  laborableBase: boolean;
  festivo?: Festivo;
  finDeSemana: boolean;
  marca?: Marca;
  obs?: string;
  estado: EstadoDia;
  /** Minutos. */
  T: number;
  ORD: number;
  ADIC: number;
  DEF: number;
  saldo: number;
  acumulado: number;
  /** Laborable pasado sin fichajes ni marca, o día pendiente. */
  porRevisar: boolean;
  /** Primera ENTRADA del día. */
  entrada?: number;
  /** SALIDA de la última sesión que empezó este día (puede ser del día siguiente). */
  salida?: number;
  salidaDiaSiguiente?: boolean;
  gestiones: number;
  minutosGestion: number;
  movimientos: Movimiento[];
}

export interface Totales {
  ADIC: number;
  DEF: number;
  recuperado: number;
  pendiente: number;
  aFavor: number;
  saldo: number;
}

export interface ResultadoMes {
  anio: number;
  mes: number;
  diasTrabajados: number;
  T: number;
  ORD: number;
  ADIC: number;
  DEF: number;
  saldo: number;
  acumulado: number;
}

export interface Resultado {
  dias: ResultadoDia[];
  porFecha: Map<Fecha, ResultadoDia>;
  totales: Totales;
  meses: ResultadoMes[];
  diasPorRevisar: ResultadoDia[];
  /** Movimientos anteriores a la fecha de inicio (no computan). */
  movimientosPrueba: Movimiento[];
  /** Sesión abierta tratada como PENDIENTE por olvido (de un día anterior). */
  olvido?: Sesion;
  errores: string[];
}

export function horarioVigente(horarios: Horario[], f: Fecha): Horario | undefined {
  let h: Horario | undefined;
  for (const x of [...horarios].sort((a, b) => (a.desde < b.desde ? -1 : 1))) if (x.desde <= f) h = x;
  return h;
}

export function ventana(h: Horario, f: Fecha): Tramo | null {
  const e = horaAMinutos(h.entrada), s = horaAMinutos(h.salida);
  const a = instanteMadrid(f, Math.floor(e / 60), e % 60);
  const b = instanteMadrid(f, Math.floor(s / 60), s % 60);
  if (a === null || b === null || b <= a) return null;
  return { a, b };
}

/** Día con jornada ordinaria según horario y festivos (sin marcas). */
export function esLaborableBase(f: Fecha, horarios: Horario[], festivos: Set<Fecha>): boolean {
  const h = horarioVigente(horarios, f);
  return !!h && h.dias.includes(diaSemana(f)) && !festivos.has(f);
}

const solape = (x: Tramo, y: Tramo) => Math.max(0, Math.min(x.b, y.b) - Math.max(x.a, y.a));

/** Tramos trabajados y de gestión de una sesión. Solo tramos cerrados. */
export function tramosSesion(s: Sesion): { trabajo: Tramo[]; gestion: Tramo[]; abierto?: { desde: number; tipo: 'trabajo' | 'gestion' } } {
  const trabajo: Tramo[] = [], gestion: Tramo[] = [];
  for (let i = 0; i < s.movs.length - 1; i++) {
    const m = s.movs[i], n = s.movs[i + 1];
    if (m.tipo === 'E' || m.tipo === 'R') trabajo.push({ a: m.t, b: n.t });
    else if (m.tipo === 'G') gestion.push({ a: m.t, b: n.t });
  }
  const u = s.movs[s.movs.length - 1];
  const abierto = s.salida || s.incompleta ? undefined
    : { desde: u.t, tipo: u.tipo === 'G' ? 'gestion' as const : 'trabajo' as const };
  return { trabajo, gestion, abierto };
}

/** Recorta tramos a un día natural de Madrid y suma minutos. */
export function partirPorDia(tramos: Tramo[]): Map<Fecha, number> {
  const r = new Map<Fecha, number>();
  for (const t of tramos) {
    let f = fechaDe(t.a);
    while (true) {
      const d0 = inicioDia(f), d1 = inicioDia(sumarDias(f, 1));
      const s = solape(t, { a: d0, b: d1 });
      if (s > 0) r.set(f, (r.get(f) ?? 0) + s / MIN);
      if (d1 >= t.b) break;
      f = sumarDias(f, 1);
    }
  }
  return r;
}

export function calcular(datos: Datos, ahora: number): Resultado {
  const { config } = datos;
  const inicio = config.fechaInicio;
  const hoy = fechaDe(ahora);
  const festivos = new Map(datos.festivos.map((f) => [f.fecha, f]));
  const festivosSet = new Set(festivos.keys());
  const marcas = new Map(datos.dias.map((d) => [d.fecha, d]));
  const { sesiones, errores } = analizar(datos.movimientos);

  const ultimoFichaje = datos.movimientos.reduce((x, m) => (m.t <= ahora && m.t > x ? m.t : x), -Infinity);

  // Clasificar sesiones y días que tocan.
  const diasPendientes = new Set<Fecha>();
  const diasEnCurso = new Set<Fecha>();
  const diasConFichajes = new Set<Fecha>();
  const tramosTrabajo: Tramo[] = [];
  const tramosGestion: Tramo[] = [];
  let olvido: Sesion | undefined;

  const rango = (a: Fecha, b: Fecha, set: Set<Fecha>) => {
    for (let f = a; f <= b; f = sumarDias(f, 1)) set.add(f);
  };

  sesiones.forEach((s, i) => {
    const fE = fechaDe(s.entrada.t);
    const fU = fechaDe(s.movs[s.movs.length - 1].t);
    const abierta = !s.salida && !s.incompleta && i === sesiones.length - 1;
    const tr = tramosSesion(s);
    if (s.salida) {
      rango(fE, fU, diasConFichajes);
      tramosTrabajo.push(...tr.trabajo);
      tramosGestion.push(...tr.gestion);
    } else if (s.incompleta || (abierta && (s.entrada.pendiente || (fE < hoy && s.entrada.sigoFecha !== hoy)))) {
      rango(fE, fU, diasPendientes);
      if (abierta) olvido = s;
    } else {
      // En curso: toca desde su entrada hasta hoy.
      rango(fE, hoy > fU ? hoy : fU, diasEnCurso);
      tramosTrabajo.push(...tr.trabajo);
      tramosGestion.push(...tr.gestion);
    }
  });

  const trabajoPorDia = partirPorDia(tramosTrabajo);
  const gestionPorDia = partirPorDia(tramosGestion);

  // Movimientos por día.
  const movsPorDia = new Map<Fecha, Movimiento[]>();
  for (const s of sesiones) for (const m of s.movs) {
    const f = fechaDe(m.t);
    if (!movsPorDia.has(f)) movsPorDia.set(f, []);
    movsPorDia.get(f)!.push(m);
  }
  // Entrada/salida por día de entrada.
  const entradaSalida = new Map<Fecha, { e?: number; s?: number; sig?: boolean }>();
  for (const s of sesiones) {
    const f = fechaDe(s.entrada.t);
    const x = entradaSalida.get(f) ?? {};
    if (x.e === undefined) x.e = s.entrada.t;
    x.s = s.salida?.t;
    x.sig = s.salida ? fechaDe(s.salida.t) !== f : false;
    entradaSalida.set(f, x);
  }

  // Fin del rango de días.
  let fin = hoy;
  for (const m of datos.movimientos) { const f = fechaDe(m.t); if (f > fin) fin = f; }
  for (const d of datos.dias) if (d.marca && d.fecha > fin) fin = d.fecha;

  const dias: ResultadoDia[] = [];
  const porFecha = new Map<Fecha, ResultadoDia>();
  let acumulado = 0;

  for (let f = inicio; f <= fin; f = sumarDias(f, 1)) {
    const h = horarioVigente(config.horarios, f);
    const ds = diaSemana(f);
    const laborableBase = esLaborableBase(f, config.horarios, festivosSet);
    const info = marcas.get(f);
    const marca = laborableBase ? info?.marca : undefined;
    const tipo: TipoDia = laborableBase && (!marca || marca === 'CUENTA') ? 'LABORABLE' : 'NO_LABORABLE';
    const win = tipo === 'LABORABLE' && h ? ventana(h, f) : null;
    const durVentana = win ? (win.b - win.a) / MIN : 0;

    let estado: EstadoDia;
    if (diasPendientes.has(f)) estado = 'PENDIENTE';
    else if (diasEnCurso.has(f)) estado = 'EN_CURSO';
    else if (diasConFichajes.has(f)) estado = 'CERRADO';
    else estado = 'SIN_FICHAJES';

    let T = 0, ORD = 0, V = 0;
    if (estado === 'CERRADO' || estado === 'EN_CURSO') {
      T = trabajoPorDia.get(f) ?? 0;
      if (win) {
        for (const t of tramosTrabajo) ORD += solape(t, win) / MIN;
        if (estado === 'CERRADO') V = durVentana;
        else V = Math.min(durVentana, Math.max(0, (Math.min(ultimoFichaje, win.b) - win.a) / MIN));
      }
    } else if (estado === 'SIN_FICHAJES' && marca === 'CUENTA') {
      V = durVentana;
    }
    const ADIC = T - ORD;
    const DEF = tipo === 'LABORABLE' ? V - ORD : 0;
    const saldo = ADIC - DEF;
    acumulado += saldo;

    const es = entradaSalida.get(f);
    const r: ResultadoDia = {
      fecha: f,
      tipo,
      laborableBase,
      festivo: festivos.get(f),
      finDeSemana: ds >= 6,
      marca,
      obs: info?.obs,
      estado,
      T, ORD, ADIC, DEF, saldo, acumulado,
      porRevisar: estado === 'PENDIENTE' || (estado === 'SIN_FICHAJES' && laborableBase && !marca && f < hoy),
      entrada: es?.e,
      salida: es?.s,
      salidaDiaSiguiente: es?.sig,
      gestiones: (movsPorDia.get(f) ?? []).filter((m) => m.tipo === 'G').length,
      minutosGestion: gestionPorDia.get(f) ?? 0,
      movimientos: movsPorDia.get(f) ?? [],
    };
    dias.push(r);
    porFecha.set(f, r);
  }

  const ADIC = dias.reduce((s, d) => s + d.ADIC, 0);
  const DEF = dias.reduce((s, d) => s + d.DEF, 0);
  const recuperado = Math.min(ADIC, DEF);
  const totales: Totales = {
    ADIC, DEF, recuperado,
    pendiente: DEF - recuperado,
    aFavor: ADIC - recuperado,
    saldo: ADIC - DEF,
  };

  const meses: ResultadoMes[] = [];
  for (const d of dias) {
    const anio = +d.fecha.slice(0, 4), mes = +d.fecha.slice(5, 7);
    let m = meses[meses.length - 1];
    if (!m || m.anio !== anio || m.mes !== mes) {
      m = { anio, mes, diasTrabajados: 0, T: 0, ORD: 0, ADIC: 0, DEF: 0, saldo: 0, acumulado: 0 };
      meses.push(m);
    }
    if (d.T > 0) m.diasTrabajados++;
    m.T += d.T; m.ORD += d.ORD; m.ADIC += d.ADIC; m.DEF += d.DEF; m.saldo += d.saldo;
    m.acumulado = d.acumulado;
  }

  return {
    dias,
    porFecha,
    totales,
    meses,
    diasPorRevisar: dias.filter((d) => d.porRevisar),
    movimientosPrueba: datos.movimientos.filter((m) => fechaDe(m.t) < inicio),
    olvido,
    errores,
  };
}

/** Tiempo trabajado hoy en vivo, incluido el tramo abierto (solo informativo). */
export function trabajadoHoyEnVivo(movs: Movimiento[], ahora: number): number {
  const { sesiones } = analizar(movs);
  const tramos: Tramo[] = [];
  sesiones.forEach((s, i) => {
    const tr = tramosSesion(s);
    tramos.push(...tr.trabajo);
    if (i === sesiones.length - 1 && tr.abierto?.tipo === 'trabajo' && !s.entrada.pendiente && ahora > tr.abierto.desde)
      tramos.push({ a: tr.abierto.desde, b: ahora });
  });
  return partirPorDia(tramos).get(fechaDe(ahora)) ?? 0;
}
