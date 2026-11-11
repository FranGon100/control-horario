import { useState } from 'preact/hooks';
import type { ResultadoDia } from '../motor/calculo';
import { fechaDe, fechaES, horaDe, NOMBRES_DIA, NOMBRES_MES, diaSemana } from '../motor/tiempo';
import { NOMBRE_MARCA } from '../motor/tipos';
import { useCtx } from './contexto';
import { Dur, Saldo } from './comun';

export const TEXTO_ESTADO_DIA = {
  CERRADO: 'cerrado',
  EN_CURSO: 'en curso',
  PENDIENTE: 'PENDIENTE',
  SIN_FICHAJES: 'sin fichajes',
} as const;

export function descripcionTipo(d: ResultadoDia): string {
  if (d.festivo) return `Festivo · ${d.festivo.nombre}`;
  if (d.finDeSemana) return 'Fin de semana';
  if (d.marca) return NOMBRE_MARCA[d.marca];
  return d.tipo === 'LABORABLE' ? 'Laborable' : 'No laborable';
}

function FilaDia({ d }: { d: ResultadoDia }) {
  const ctx = useCtx();
  return (
    <button class={`dia-fila ${d.porRevisar ? 'revisar' : ''}`} onClick={() => ctx.abrirDia(d.fecha)} data-fecha={d.fecha}>
      <div class="l1">
        <span class="f"><b>{fechaES(d.fecha)}</b> {NOMBRES_DIA[diaSemana(d.fecha)]}</span>
        <Saldo min={d.saldo} />
      </div>
      <div class="l2">
        {d.entrada !== undefined ? <>E {horaDe(d.entrada)}</> : null}
        {d.salida !== undefined ? <> · S {horaDe(d.salida)}{d.salidaDiaSiguiente ? ' (+1)' : ''}</> : null}
        {d.gestiones > 0 && <> · {d.gestiones} gestión{d.gestiones > 1 ? 'es' : ''} (<Dur min={d.minutosGestion} />)</>}
        {d.movimientos.some((m) => m.origen === 'manual' || m.modificado) && <span class="etq manual">manual</span>}
      </div>
      <div class="l3">
        Trab. <Dur min={d.T} /> · Ord. <Dur min={d.ORD} /> · Adic. <Dur min={d.ADIC} />
      </div>
      <div class="l4">
        {descripcionTipo(d)}
        {d.estado !== 'CERRADO' && <> · <span class={d.porRevisar ? 'txt-aviso' : ''}>{d.porRevisar ? '⚠ ' : ''}{TEXTO_ESTADO_DIA[d.estado]}{d.porRevisar && d.estado === 'SIN_FICHAJES' ? ' · por revisar' : ''}</span></>}
        {d.obs && <> · 📝</>}
      </div>
    </button>
  );
}

export function ControlHorario({ soloRevisar }: { soloRevisar: boolean }) {
  const ctx = useCtx();
  const { res, ahora, estado } = ctx;
  const hoy = fechaDe(ahora);
  const anios = [...new Set(res.dias.map((d) => d.fecha.slice(0, 4)))].sort().reverse();
  const [anio, setAnio] = useState(hoy.slice(0, 4));
  const [mes, setMes] = useState(soloRevisar ? '' : hoy.slice(5, 7));
  const [revisar, setRevisar] = useState(soloRevisar);
  const [buscar, setBuscar] = useState('');

  let dias = res.dias.filter((d) =>
    d.fecha <= hoy
      ? d.movimientos.length || d.marca || d.festivo || d.porRevisar || d.obs || d.fecha === hoy || d.T > 0 || d.saldo !== 0
      : d.marca || d.obs || d.movimientos.length);
  if (revisar) dias = dias.filter((d) => d.porRevisar);
  else {
    dias = dias.filter((d) => d.fecha.startsWith(anio));
    if (mes) dias = dias.filter((d) => d.fecha.slice(5, 7) === mes);
  }
  dias = [...dias].reverse();

  const prueba = res.movimientosPrueba;

  return (
    <section>
      <h1>Control horario</h1>
      <div class="filtros">
        <label>Año
          <select value={anio} onChange={(e) => { setAnio((e.target as HTMLSelectElement).value); setRevisar(false); }}>
            {(anios.includes(anio) ? anios : [anio, ...anios]).map((a) => <option value={a}>{a}</option>)}
          </select>
        </label>
        <label>Mes
          <select value={mes} onChange={(e) => { setMes((e.target as HTMLSelectElement).value); setRevisar(false); }}>
            <option value="">Todos</option>
            {NOMBRES_MES.slice(1).map((n, i) => <option value={String(i + 1).padStart(2, '0')}>{n}</option>)}
          </select>
        </label>
        <label>Ir a fecha
          <input type="date" value={buscar} min={estado.datos.config.fechaInicio}
            onChange={(e) => {
              const v = (e.target as HTMLInputElement).value;
              setBuscar(v);
              if (v) ctx.abrirDia(v);
            }} />
        </label>
      </div>
      <label class="check">
        <input type="checkbox" checked={revisar} onChange={(e) => setRevisar((e.target as HTMLInputElement).checked)} />
        Solo días por revisar ({res.diasPorRevisar.length})
      </label>
      <div class="lista-dias" data-testid="historico">
        {dias.length === 0 && <p class="vacio">No hay días que mostrar.</p>}
        {dias.map((d) => <FilaDia key={d.fecha} d={d} />)}
      </div>
      {prueba.length > 0 && !revisar && (
        <div class="bloque">
          <h2>Fichajes de prueba · no computan</h2>
          <p class="nota">Anteriores a la fecha de inicio ({fechaES(estado.datos.config.fechaInicio)}). Se pueden eliminar en Configuración.</p>
          {[...new Set(prueba.map((m) => fechaDe(m.t)))].sort().reverse().map((f) => (
            <button class="dia-fila prueba" onClick={() => ctx.abrirDia(f)}>
              <div class="l1"><span class="f"><b>{fechaES(f)}</b> {NOMBRES_DIA[diaSemana(f)]}</span><span class="etq">prueba · no computa</span></div>
              <div class="l2">{prueba.filter((m) => fechaDe(m.t) === f).map((m) => `${m.tipo} ${horaDe(m.t)}`).join(' · ')}</div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
