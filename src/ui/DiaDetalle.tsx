import { useState } from 'preact/hooks';
import { ordenar } from '../motor/secuencia';
import { fechaDe, fechaES, horaDe, NOMBRES_DIA, diaSemana, type Fecha } from '../motor/tiempo';
import { NOMBRE_MARCA, NOMBRE_MOV, type Marca, type Movimiento, type TipoMov } from '../motor/tipos';
import * as repo from '../datos/repo';
import { useCtx } from './contexto';
import { Dur, Fila, Modal, Saldo } from './comun';
import { descripcionTipo, TEXTO_ESTADO_DIA } from './ControlHorario';

interface FilaEd { key: number; id?: string; tipo: TipoMov; hora: string }

export function etiquetaManual(m: Movimiento): string | null {
  if (m.origen === 'manual' && m.original === null) return 'añadido a mano';
  if (m.modificado !== undefined) {
    const o = m.original;
    return `modificado a mano el ${fechaES(fechaDe(m.modificado))} ${horaDe(m.modificado)}` +
      (o ? ` · antes: ${NOMBRE_MOV[o.tipo]} ${horaDe(o.t)}${fechaDe(o.t) !== fechaDe(m.t) ? ` del ${fechaES(fechaDe(o.t))}` : ''}` : '');
  }
  return null;
}

let claves = 0;

export function DiaDetalle({ fecha, onCerrar }: { fecha: Fecha; onCerrar: () => void }) {
  const ctx = useCtx();
  const { estado, res } = ctx;
  const r = res.porFecha.get(fecha);
  const movs = ordenar(estado.datos.movimientos.filter((m) => fechaDe(m.t) === fecha));
  const info = estado.datos.dias.find((d) => d.fecha === fecha);
  const [editando, setEditando] = useState(false);
  const [filas, setFilas] = useState<FilaEd[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [obs, setObs] = useState(info?.obs ?? '');
  const inicio = estado.datos.config.fechaInicio;
  const esPrueba = fecha < inicio;

  const empezar = () => {
    setFilas(movs.map((m) => ({ key: ++claves, id: m.id, tipo: m.tipo, hora: horaDe(m.t) })));
    setErrores([]);
    setEditando(true);
  };
  const cambiar = (k: number, c: Partial<FilaEd>) => setFilas(filas.map((f) => (f.key === k ? { ...f, ...c } : f)));

  const guardar = async () => {
    try {
      await repo.guardarDia(fecha, filas, Date.now());
      await ctx.recargar();
      setEditando(false);
      setErrores([]);
      ctx.avisar('Cambios guardados. Saldo recalculado.', 'ok');
    } catch (e) {
      setErrores((e as Error).message.split('\n'));
    }
  };

  const marcar = async (m: Marca | undefined) => {
    if (await ctx.ejecutar(async () => { await repo.marcarDia(fecha, m); return true; })) {
      await ctx.recargar();
      ctx.avisar(m ? `Día marcado: ${NOMBRE_MARCA[m]}` : 'Marca quitada.', 'ok');
    }
  };

  return (
    <Modal titulo={`${NOMBRES_DIA[diaSemana(fecha)]} ${fechaES(fecha)}`} onCerrar={onCerrar} id="dia">
      {esPrueba ? (
        <p class="etq-bloque">Prueba · no computa (anterior a la fecha de inicio)</p>
      ) : r ? (
        <>
          <p class="sub">{descripcionTipo(r)} · {TEXTO_ESTADO_DIA[r.estado]}</p>
          {r.estado === 'PENDIENTE' && <p class="aviso">⚠ Jornada pendiente: falta la SALIDA. No cuenta en el saldo hasta completarla.</p>}
          {r.porRevisar && r.estado === 'SIN_FICHAJES' && (
            <p class="aviso">⚠ Día laborable sin fichajes. Añade los fichajes o marca el día (vacaciones, asunto propio, ausencia sin descuento o a cuenta del saldo).</p>
          )}
          <div class="resumen-dia">
            <Fila k="Tiempo trabajado" v={<Dur min={r.T} />} />
            <Fila k="Horas ordinarias" v={<Dur min={r.ORD} />} />
            <Fila k="Horas adicionales" v={<Dur min={r.ADIC} />} />
            <Fila k="Tiempo a recuperar" v={<Dur min={r.DEF} />} />
            <Fila k="Gestiones particulares" v={<>{r.gestiones} · <Dur min={r.minutosGestion} /></>} />
            <Fila k="Saldo del día" v={<Saldo min={r.saldo} />} testid="saldo-dia" />
          </div>
        </>
      ) : null}

      <h3>Fichajes</h3>
      {!editando ? (
        <>
          {movs.length === 0 && <p class="vacio">Sin fichajes este día.</p>}
          <ul class="movs">
            {movs.map((m) => {
              const et = etiquetaManual(m);
              return (
                <li key={m.id}>
                  <b>{horaDe(m.t)}</b> {NOMBRE_MOV[m.tipo]}
                  {m.pendiente && <span class="etq aviso-etq">pendiente</span>}
                  {et && <div class="etq manual">{et}</div>}
                </li>
              );
            })}
          </ul>
          {r?.salidaDiaSiguiente && r.salida !== undefined && <p class="nota">La salida de esta jornada es del día siguiente a las {horaDe(r.salida)} (+1).</p>}
          <button class="btn" onClick={empezar} data-testid="editar">{movs.length ? 'Editar o añadir fichajes' : 'Añadir fichajes'}</button>
        </>
      ) : (
        <div class="editor">
          <p class="nota">Escribe las horas en orden. Los cambios quedan marcados como manuales.</p>
          {filas.map((f, i) => (
            <div class="fila-ed" key={f.key}>
              <span class="num">{i + 1}</span>
              <select value={f.tipo} aria-label={`Tipo del fichaje ${i + 1}`} onChange={(e) => cambiar(f.key, { tipo: (e.target as HTMLSelectElement).value as TipoMov })}>
                {(['E', 'G', 'R', 'S'] as TipoMov[]).map((t) => <option value={t}>{NOMBRE_MOV[t]}</option>)}
              </select>
              <input type="time" value={f.hora} aria-label={`Hora del fichaje ${i + 1}`} onInput={(e) => cambiar(f.key, { hora: (e.target as HTMLInputElement).value })} />
              <button class="btn peligro mini" aria-label={`Eliminar fichaje ${i + 1}`} onClick={async () => {
                if (await ctx.confirmar(`¿Eliminar el fichaje ${NOMBRE_MOV[f.tipo]} ${f.hora}? Se borrará al pulsar «Guardar cambios».`, 'Eliminar', 'Cancelar'))
                  setFilas(filas.filter((x) => x.key !== f.key));
              }}>✕</button>
            </div>
          ))}
          <button class="btn" onClick={() => {
            const ult = filas[filas.length - 1]?.tipo;
            const sig: TipoMov = !ult || ult === 'S' ? 'E' : ult === 'G' ? 'R' : 'S';
            setFilas([...filas, { key: ++claves, tipo: sig, hora: '' }]);
          }} data-testid="anadir-fila">+ Añadir fichaje</button>
          {errores.length > 0 && (
            <div class="errores" role="alert" data-testid="errores">
              <b>No se ha guardado:</b>
              <ul>{errores.map((e) => <li>{e}</li>)}</ul>
            </div>
          )}
          <div class="botones-fila">
            <button class="btn" onClick={() => setEditando(false)}>Cancelar</button>
            <button class="btn primario" onClick={guardar} data-testid="guardar-dia">Guardar cambios</button>
          </div>
        </div>
      )}

      {r?.laborableBase && !esPrueba && (
        <>
          <h3>Marcar el día</h3>
          <div class="marcas">
            {(['VAC', 'AP', 'AUS', 'CUENTA'] as Marca[]).map((m) => (
              <button class={`btn marca-${m} ${r.marca === m ? 'activa' : ''}`} aria-pressed={r.marca === m}
                onClick={() => marcar(r.marca === m ? undefined : m)}>
                {r.marca === m ? '✓ ' : ''}{NOMBRE_MARCA[m]}{m === 'CUENTA' ? ' (−8 h)' : ''}
              </button>
            ))}
          </div>
          {r.marca && <button class="btn" onClick={() => marcar(undefined)}>Quitar marca</button>}
        </>
      )}

      <h3>Observaciones</h3>
      <textarea rows={3} value={obs} onInput={(e) => setObs((e.target as HTMLTextAreaElement).value)} aria-label="Observaciones" />
      <button class="btn" disabled={(info?.obs ?? '') === obs.trim()} onClick={async () => {
        if (await ctx.ejecutar(async () => { await repo.guardarObservacion(fecha, obs); return true; })) {
          await ctx.recargar(); ctx.avisar('Observación guardada.', 'ok');
        }
      }}>Guardar observación</button>
    </Modal>
  );
}
