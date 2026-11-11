import { useState } from 'preact/hooks';
import { type ResultadoDia } from '../motor/calculo';
import { diaSemana, fechaDe, fechaES, NOMBRES_MES, sumarDias, type Fecha } from '../motor/tiempo';
import { laborablesDelRango } from '../motor/vacaciones';
import * as repo from '../datos/repo';
import { useCtx } from './contexto';

export const LEYENDA: { c: string; letra: string; texto: string }[] = [
  { c: 'trab', letra: 'T', texto: 'Trabajado' },
  { c: 'vac', letra: 'V', texto: 'Vacaciones' },
  { c: 'ap', letra: 'P', texto: 'Asunto propio' },
  { c: 'fest', letra: 'F', texto: 'Festivo' },
  { c: 'finde', letra: '·', texto: 'Fin de semana' },
  { c: 'aus', letra: 'A', texto: 'Ausencia sin descuento' },
  { c: 'cta', letra: 'C', texto: 'A cuenta del saldo' },
  { c: 'avi', letra: '!', texto: 'Pendiente o sin fichajes' },
];

function codigo(f: Fecha, r: ResultadoDia | undefined, festivo: boolean, inicio: Fecha): { c: string; letra: string } {
  if (r?.porRevisar) return { c: 'avi', letra: '!' };
  if (r?.marca === 'VAC') return { c: 'vac', letra: 'V' };
  if (r?.marca === 'AP') return { c: 'ap', letra: 'P' };
  if (r?.marca === 'AUS') return { c: 'aus', letra: 'A' };
  if (r?.marca === 'CUENTA') return { c: 'cta', letra: 'C' };
  if (festivo) return { c: 'fest', letra: 'F' };
  if (r && r.T > 0) return { c: 'trab', letra: 'T' };
  if (diaSemana(f) >= 6) return { c: 'finde', letra: '·' };
  return { c: f < inicio ? 'antes' : '', letra: '' };
}

function Mes({ anio, mes, mini, onDia }: { anio: number; mes: number; mini?: boolean; onDia: (f: Fecha) => void }) {
  const { res, estado, ahora } = useCtx();
  const fest = new Set(estado.datos.festivos.map((x) => x.fecha));
  const primero = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const hoy = fechaDe(ahora);
  const celdas: (Fecha | null)[] = Array(diaSemana(primero) - 1).fill(null);
  for (let f = primero; f.slice(5, 7) === primero.slice(5, 7); f = sumarDias(f, 1)) celdas.push(f);
  return (
    <div class={`mes ${mini ? 'mini' : ''}`}>
      {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div class="cab">{d}</div>)}
      {celdas.map((f) => {
        if (!f) return <div class="vacia" />;
        const r = res.porFecha.get(f);
        const { c, letra } = codigo(f, r, fest.has(f), estado.datos.config.fechaInicio);
        return (
          <button class={`celda ${c} ${f === hoy ? 'hoy' : ''}`} onClick={() => onDia(f)} data-fecha={f}
            aria-label={`${fechaES(f)}${letra ? ' ' + (LEYENDA.find((l) => l.c === c)?.texto ?? '') : ''}`}>
            <span class="n">{+f.slice(8)}</span>
            {!mini && <span class="letra">{letra}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Calendario() {
  const ctx = useCtx();
  const hoy = fechaDe(ctx.ahora);
  const [vista, setVista] = useState<'mes' | 'anio'>('mes');
  const [anio, setAnio] = useState(+hoy.slice(0, 4));
  const [mes, setMes] = useState(+hoy.slice(5, 7));
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tipo, setTipo] = useState<'VAC' | 'AP'>('VAC');

  const mover = (n: number) => {
    let m = mes + n, y = anio;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setMes(m); setAnio(y);
  };
  const { config, festivos } = ctx.estado.datos;
  const rango = desde && hasta && hasta >= desde ? laborablesDelRango(desde < config.fechaInicio ? config.fechaInicio : desde, hasta, config, festivos) : null;

  return (
    <section>
      <h1>Calendario</h1>
      <div class="selector">
        <button class={`btn ${vista === 'mes' ? 'primario' : ''}`} onClick={() => setVista('mes')}>Mensual</button>
        <button class={`btn ${vista === 'anio' ? 'primario' : ''}`} onClick={() => setVista('anio')}>Anual</button>
      </div>
      {vista === 'mes' ? (
        <>
          <div class="nav-mes">
            <button class="btn" onClick={() => mover(-1)} aria-label="Mes anterior">◀</button>
            <b data-testid="titulo-mes">{NOMBRES_MES[mes]} {anio}</b>
            <button class="btn" onClick={() => mover(1)} aria-label="Mes siguiente">▶</button>
          </div>
          <Mes anio={anio} mes={mes} onDia={ctx.abrirDia} />
        </>
      ) : (
        <>
          <div class="nav-mes">
            <button class="btn" onClick={() => setAnio(anio - 1)} aria-label="Año anterior">◀</button>
            <b>{anio}</b>
            <button class="btn" onClick={() => setAnio(anio + 1)} aria-label="Año siguiente">▶</button>
          </div>
          <div class="anual">
            {Array.from({ length: 12 }, (_, i) => (
              <div>
                <button class="enlace titulo-mini" onClick={() => { setMes(i + 1); setVista('mes'); }}>{NOMBRES_MES[i + 1]}</button>
                <Mes anio={anio} mes={i + 1} mini onDia={ctx.abrirDia} />
              </div>
            ))}
          </div>
        </>
      )}
      <div class="leyenda">
        {LEYENDA.map((l) => <span class="item"><span class={`celda-ley ${l.c}`}>{l.letra}</span>{l.texto}</span>)}
      </div>
      <p class="nota">Toca un día para ver sus fichajes, marcarlo o escribir observaciones.</p>

      <div class="bloque">
        <h2>Marcar varios días</h2>
        <p class="nota">Sábados, domingos y festivos se excluyen solos.</p>
        <div class="filtros">
          <label>Desde<input type="date" value={desde} min={config.fechaInicio} onInput={(e) => setDesde((e.target as HTMLInputElement).value)} /></label>
          <label>Hasta<input type="date" value={hasta} min={desde || config.fechaInicio} onInput={(e) => setHasta((e.target as HTMLInputElement).value)} /></label>
          <label>Tipo
            <select value={tipo} onChange={(e) => setTipo((e.target as HTMLSelectElement).value as 'VAC' | 'AP')}>
              <option value="VAC">Vacaciones</option>
              <option value="AP">Asunto propio</option>
            </select>
          </label>
        </div>
        {rango && <p data-testid="dias-rango"><b>{rango.length} días laborables</b>
          {rango.length > 0 && new Set(rango.map((f) => f.slice(0, 4))).size > 1 &&
            <> ({[...new Set(rango.map((f) => f.slice(0, 4)))].map((y) => `${rango.filter((f) => f.startsWith(y)).length} en ${y}`).join(', ')})</>}
        </p>}
        <button class="btn primario" disabled={!rango || rango.length === 0} onClick={async () => {
          const r = await ctx.ejecutar(() => repo.marcarRango(desde, hasta, tipo));
          if (!r) return;
          await ctx.recargar();
          ctx.avisar(`${r.marcados.length} días marcados.` +
            (r.conOtraMarca.length ? ` ${r.conOtraMarca.length} día(s) ya tenían otra marca y no se han cambiado: ${r.conOtraMarca.map(fechaES).join(', ')}.` : ''), 'ok');
          setDesde(''); setHasta('');
        }}>Marcar</button>
      </div>
    </section>
  );
}

