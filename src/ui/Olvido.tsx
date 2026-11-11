import { useState } from 'preact/hooks';
import { fechaDe, fechaES, horaDe } from '../motor/tiempo';
import * as repo from '../datos/repo';
import { useCtx } from './contexto';
import { Modal } from './comun';

/** Aviso de jornada abierta de un día anterior (§7.1). */
export function Olvido() {
  const ctx = useCtx();
  const e = repo.olvidoSinResponder(ctx.estado.datos.movimientos, ctx.ahora);
  const [modoHora, setModoHora] = useState(false);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  if (!e) return null;
  const fE = fechaDe(e.t);

  const responder = async (r: repo.RespuestaOlvido) => {
    const ok = await ctx.ejecutar(async () => { await repo.responderOlvido(r, Date.now()); return true; });
    if (ok) {
      setModoHora(false); setHora(''); setFecha('');
      await ctx.recargar();
      ctx.avisar(r.opcion === 'hora' ? `SALIDA registrada a mano · ${r.hora}` : 'Hecho.', 'ok');
    }
  };

  return (
    <Modal titulo="Jornada abierta" id="olvido">
      <p class="pregunta">Tienes una jornada abierta desde el {fechaES(fE)} a las {horaDe(e.t)}</p>
      {!modoHora ? (
        <div class="columna">
          <button class="btn grande" onClick={() => responder({ opcion: 'sigo' })}>Sigo trabajando</button>
          <button class="btn grande primario" onClick={() => { setFecha(fE); setModoHora(true); }}>Indicar la hora ahora</button>
          <button class="btn grande" onClick={() => responder({ opcion: 'pendiente' })}>Dejar pendiente</button>
        </div>
      ) : (
        <div class="columna">
          <label>Día de la SALIDA
            <input type="date" value={fecha} min={fE} onInput={(ev) => setFecha((ev.target as HTMLInputElement).value)} />
          </label>
          <label>Hora de la SALIDA (HH:MM)
            <input type="time" value={hora} data-testid="hora-olvido" onInput={(ev) => setHora((ev.target as HTMLInputElement).value)} />
          </label>
          <div class="botones-fila">
            <button class="btn" onClick={() => setModoHora(false)}>Volver</button>
            <button class="btn primario" disabled={!hora || !fecha} onClick={() => responder({ opcion: 'hora', fecha, hora })}>Guardar salida</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
