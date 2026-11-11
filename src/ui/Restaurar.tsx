import { useEffect, useState } from 'preact/hooks';
import { duracion } from '../motor/formato';
import { fechaDe, fechaES, horaDe } from '../motor/tiempo';
import * as repo from '../datos/repo';
import { useCtx } from './contexto';
import { Fila, Modal } from './comun';

/** Restaurar: validar → resumen → confirmar → copia del estado actual → restaurar → comprobar. */
export function Restaurar({ texto, onCerrar }: { texto: string; onCerrar: () => void }) {
  const ctx = useCtx();
  const [previa, setPrevia] = useState<repo.PreviaRestauracion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string[] | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    repo.prepararRestauracion(texto).then(setPrevia, (e) => setError((e as Error).message));
  }, [texto]);

  const r = previa?.copia.resumen;
  return (
    <Modal titulo="Restaurar copia" onCerrar={onCerrar} id="restaurar">
      {error && <p class="errores" role="alert">{error}</p>}
      {!error && !previa && <p>Comprobando la copia…</p>}
      {previa && r && resultado === null && (
        <>
          <p>Copia válida (suma de comprobación correcta).</p>
          <Fila k="Fecha de la copia" v={`${fechaES(fechaDe(previa.copia.fecha))} ${horaDe(previa.copia.fecha)}`} />
          <Fila k="Periodo" v={r.desde ? `${fechaES(r.desde)} – ${fechaES(r.hasta!)}` : 'sin fichajes'} />
          <Fila k="Movimientos" v={r.movimientos} testid="previa-movs" />
          <Fila k="Días marcados" v={r.diasMarcados} />
          <Fila k="Saldo" v={duracion(r.saldo)} testid="previa-saldo" />
          <p class="aviso">Los datos actuales se sustituirán por los de la copia. Antes se guardará una copia del estado actual dentro de la app.</p>
          <div class="botones-fila">
            <button class="btn" onClick={onCerrar}>Cancelar</button>
            <button class="btn primario" disabled={trabajando} data-testid="confirmar-restaurar" onClick={async () => {
              if (!(await ctx.confirmar('¿Seguro que quieres restaurar esta copia?', 'Restaurar'))) return;
              setTrabajando(true);
              const x = await ctx.ejecutar(() => repo.restaurar(previa, Date.now()));
              setTrabajando(false);
              if (x) { setResultado(x.diferencias); await ctx.recargar(); }
            }}>Restaurar</button>
          </div>
        </>
      )}
      {resultado !== null && (
        resultado.length === 0
          ? <p class="ok-texto" data-testid="restaurado-ok">✓ Copia restaurada. El resumen recalculado coincide con el de la copia.</p>
          : <div class="errores" role="alert">
              <b>Copia restaurada, pero el resumen no coincide:</b>
              <ul>{resultado.map((d) => <li>{d}</li>)}</ul>
              <p>La copia del estado anterior está en la lista de copias.</p>
            </div>
      )}
      {resultado !== null && <button class="btn primario" onClick={onCerrar}>Cerrar</button>}
    </Modal>
  );
}
