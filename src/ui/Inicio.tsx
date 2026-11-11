import { useState } from 'preact/hooks';
import { trabajadoHoyEnVivo } from '../motor/calculo';
import { estadoJornada, motivoInactivo, permitido, sesionAbierta } from '../motor/secuencia';
import { diferenciaDias, fechaDe, fechaES, horaDe, NOMBRES_DIA, diaSemana, partes } from '../motor/tiempo';
import { NOMBRE_MOV, type TipoMov } from '../motor/tipos';
import * as repo from '../datos/repo';
import { useCtx } from './contexto';
import { Dur, Saldo } from './comun';
import { guardarCopiaFuera } from './copias';

const BOTONES: { tipo: TipoMov; texto: string; clase: string }[] = [
  { tipo: 'E', texto: 'ENTRADA', clase: 'b-entrada' },
  { tipo: 'S', texto: 'SALIDA', clase: 'b-salida' },
  { tipo: 'G', texto: 'GESTIÓN PARTICULAR', clase: 'b-gestion' },
  { tipo: 'R', texto: 'REGRESO DE GESTIÓN', clase: 'b-regreso' },
];

const TEXTO_ESTADO = { FUERA: 'FUERA', TRABAJANDO: 'TRABAJANDO', EN_GESTION: 'EN GESTIÓN' } as const;

/** Avisos de festivos (§4): año en curso sin festivos o próximo año sin festivos a menos de 60 días. */
export function avisoFestivos(festivos: { fecha: string }[], hoy: string): string | null {
  const anio = +hoy.slice(0, 4);
  const tiene = (y: number) => festivos.some((f) => f.fecha.startsWith(`${y}-`));
  if (!tiene(anio)) return `No hay festivos cargados para ${anio}. Añádelos en Configuración.`;
  if (diferenciaDias(hoy, `${anio + 1}-01-01`) < 60 && !tiene(anio + 1))
    return `Faltan los festivos de ${anio + 1}. Añádelos en Configuración.`;
  return null;
}

export function Inicio() {
  const ctx = useCtx();
  const { estado, res, ahora } = ctx;
  const movs = estado.datos.movimientos;
  const [guardando, setGuardando] = useState(false);
  const est = estadoJornada(movs);
  const sesion = sesionAbierta(movs);
  const hoy = fechaDe(ahora);
  const p = partes(ahora);
  const olvido = repo.olvidoSinResponder(movs, ahora);

  async function pulsar(tipo: TipoMov) {
    if (guardando) return;
    if (olvido) { ctx.avisar('Primero responde al aviso de la jornada abierta.', 'error'); return; }
    if (!permitido(est, tipo)) { ctx.avisar(motivoInactivo(est, tipo), 'info'); return; }
    if (est === 'EN_GESTION' && tipo === 'S' &&
      !(await ctx.confirmar('No has vuelto de la gestión. ¿Terminar la jornada?', 'Sí, terminar', 'No'))) return;
    setGuardando(true);
    try {
      const m = await ctx.ejecutar(() => repo.fichar(tipo, Date.now()));
      if (m) {
        await ctx.recargar();
        ctx.avisar(`${NOMBRE_MOV[tipo]} registrada · ${horaDe(m.t)}`, 'ok');
      }
    } finally {
      setGuardando(false);
    }
  }

  const pendientes = res.diasPorRevisar.length;
  const avisoF = avisoFestivos(estado.datos.festivos, hoy);
  const sinConfirmar = estado.datos.festivos.filter((f) => f.sinConfirmar);
  const entradaSesion = sesion && !sesion.entrada.pendiente ? sesion.entrada : null;

  return (
    <section class="inicio">
      <div class="cabecera-inicio">
        <div class="fecha-hoy">{NOMBRES_DIA[diaSemana(hoy)]} {fechaES(hoy)}</div>
        <div class="reloj" data-testid="reloj">{String(p.h).padStart(2, '0')}:{String(p.mi).padStart(2, '0')}</div>
      </div>
      <div class="estado-jornada">
        <span class={`chip estado-${est}`} data-testid="estado">{TEXTO_ESTADO[est]}</span>
        {entradaSesion && (
          <span>Entrada: {horaDe(entradaSesion.t)}{fechaDe(entradaSesion.t) !== hoy ? ` (${fechaES(fechaDe(entradaSesion.t))})` : ''}</span>
        )}
      </div>
      <div class="trabajado-hoy">Trabajado hoy: <b data-testid="trabajado-hoy"><Dur min={trabajadoHoyEnVivo(movs, ahora)} /></b></div>
      <div class="caja-saldo">
        <div class="etiqueta">SALDO ACTUAL</div>
        <Saldo min={res.totales.saldo} class="enorme" />
        {pendientes > 0 && (
          <button class="enlace aviso-revisar" onClick={() => ctx.irA('control', { soloRevisar: true })} data-testid="aviso-revisar">
            ⚠ Saldo sin contar {pendientes} día(s) por revisar
          </button>
        )}
      </div>

      <div class="avisos-inicio">
      {estado.meta.avisoCopia && (
        <div class="aviso fijo" data-testid="aviso-copia">
          <b>Copia semanal creada. Guárdala fuera de la app</b>
          <div class="botones-fila">
            <button class="btn primario" onClick={() => guardarCopiaFuera(ctx, estado.meta.copiaPendienteId)}>GUARDAR COPIA</button>
            <button class="btn" onClick={async () => {
              if (await ctx.confirmar('¿Posponer el aviso? La copia sigue guardada dentro de la app.', 'Posponer', 'Cancelar')) {
                await ctx.ejecutar(repo.posponerAvisoCopia); await ctx.recargar();
              }
            }}>Posponer</button>
          </div>
        </div>
      )}
      {avisoF && <div class="aviso" data-testid="aviso-festivos">⚠ {avisoF}</div>}
      {sinConfirmar.length > 0 && (
        <div class="aviso">⚠ Festivos locales sin confirmar: {sinConfirmar.map((f) => fechaES(f.fecha)).join(', ')}.{' '}
          <button class="enlace" onClick={() => ctx.irA('config')}>Revisar</button></div>
      )}
      {res.olvido && !olvido && (
        <div class="aviso" data-testid="aviso-pendiente">
          ⚠ Jornada pendiente del {fechaES(fechaDe(res.olvido.entrada.t))} (entrada {horaDe(res.olvido.entrada.t)}).{' '}
          <button class="enlace" onClick={() => ctx.abrirDia(fechaDe(res.olvido!.entrada.t))}>Completar</button>
        </div>
      )}
      </div>

      <div class="botonera">
        {BOTONES.map((b) => {
          const activo = permitido(est, b.tipo) && !olvido;
          return (
            <button
              key={b.tipo}
              class={`fichar ${b.clase} ${activo ? '' : 'inactivo'}`}
              aria-disabled={!activo || guardando}
              disabled={guardando}
              onClick={() => pulsar(b.tipo)}
            >{b.texto}</button>
          );
        })}
      </div>
    </section>
  );
}
