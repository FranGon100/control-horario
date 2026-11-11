import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { calcular } from '../motor/calculo';
import { type Fecha } from '../motor/tiempo';
import * as repo from '../datos/repo';
import { Contexto, type Ctx, type Pestana } from './contexto';
import { Modal } from './comun';
import { compartir, descargar, puedeCompartir } from './compartir';
import { Inicio } from './Inicio';
import { ControlHorario } from './ControlHorario';
import { Calendario } from './Calendario';
import { Resumen } from './Resumen';
import { Configuracion } from './Configuracion';
import { Asistente } from './Asistente';
import { DiaDetalle } from './DiaDetalle';
import { Olvido } from './Olvido';
import { AvisoVersion } from './AvisoVersion';

const PESTANAS: { id: Pestana; texto: string; icono: string }[] = [
  { id: 'inicio', texto: 'Inicio', icono: '⏱' },
  { id: 'control', texto: 'Control horario', icono: '☰' },
  { id: 'calendario', texto: 'Calendario', icono: '▦' },
  { id: 'resumen', texto: 'Resumen', icono: '∑' },
  { id: 'config', texto: 'Config. y copias', icono: '⚙' },
];

interface Toast { texto: string; tipo: 'ok' | 'error' | 'info'; id: number }
interface Pregunta { texto: string; si: string; no: string; resolver: (b: boolean) => void }

export function App() {
  const [estado, setEstado] = useState<repo.Estado | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [pestana, setPestana] = useState<Pestana>('inicio');
  const [soloRevisar, setSoloRevisar] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);
  const [dia, setDia] = useState<Fecha | null>(null);
  const [archivo, setArchivo] = useState<{ f: File; alGuardar?: () => void } | null>(null);
  const timerToast = useRef<number | undefined>(undefined);

  const recargar = useCallback(async () => {
    setEstado(await repo.leerDatos());
  }, []);

  const avisar = useCallback((texto: string, tipo: Toast['tipo'] = 'info') => {
    setToast({ texto, tipo, id: Date.now() });
    clearTimeout(timerToast.current);
    timerToast.current = window.setTimeout(() => setToast(null), tipo === 'error' ? 6000 : 3500);
  }, []);

  const confirmar = useCallback(
    (texto: string, si = 'Sí', no = 'Cancelar') => new Promise<boolean>((resolver) => setPregunta({ texto, si, no, resolver })),
    [],
  );

  const ejecutar = useCallback(async <T,>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof repo.ErrorUsuario ? e.message
        : `No se ha podido guardar. ${(e as Error)?.message ?? ''}`.trim();
      avisar(msg, 'error');
      return undefined;
    }
  }, [avisar]);

  // Arranque: abrir datos, pedir almacenamiento persistente y copia semanal.
  useEffect(() => {
    (async () => {
      try {
        const t = Date.now();
        await repo.cargar(t);
        try { await navigator.storage?.persist?.(); } catch { /* no disponible */ }
        await repo.copiaSemanalSiToca(t);
        await recargar();
      } catch (e) {
        setErrorCarga((e as Error).message);
      }
    })();
    const alVolver = async () => {
      if (document.visibilityState !== 'visible') return;
      setAhora(Date.now());
      try {
        await repo.copiaSemanalSiToca(Date.now());
        await recargar();
      } catch { /* se reintenta en la próxima vuelta */ }
    };
    document.addEventListener('visibilitychange', alVolver);
    const reloj = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      clearInterval(reloj);
    };
  }, [recargar]);

  const minuto = Math.floor(ahora / 60_000);
  const res = useMemo(
    () => (estado ? calcular(estado.datos, minuto * 60_000 + 59_999) : null),
    [estado, minuto],
  );

  if (errorCarga)
    return (
      <div class="pantalla">
        <h1>No se han podido abrir los datos</h1>
        <p>{errorCarga}</p>
        <p>No borres los datos del navegador. Cierra la app y vuelve a abrirla.</p>
      </div>
    );
  if (!estado || !res) return <div class="pantalla cargando">Cargando…</div>;

  const ctx: Ctx = {
    estado, res, ahora, recargar, avisar, confirmar, ejecutar,
    abrirDia: setDia,
    irA: (p, o) => { setSoloRevisar(!!o?.soloRevisar); setPestana(p); window.scrollTo(0, 0); },
    ofrecerArchivo: (f, alGuardar) => setArchivo({ f, alGuardar }),
  };

  return (
    <Contexto.Provider value={ctx}>
      <AvisoVersion />
      {!estado.meta.asistenteHecho ? (
        <Asistente />
      ) : (
        <>
          <main class="pantalla" data-pestana={pestana}>
            {pestana === 'inicio' && <Inicio />}
            {pestana === 'control' && <ControlHorario soloRevisar={soloRevisar} />}
            {pestana === 'calendario' && <Calendario />}
            {pestana === 'resumen' && <Resumen />}
            {pestana === 'config' && <Configuracion />}
          </main>
          <nav class="barra">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                class={pestana === p.id ? 'activa' : ''}
                aria-current={pestana === p.id ? 'page' : undefined}
                onClick={() => ctx.irA(p.id)}
              >
                <span class="icono" aria-hidden="true">{p.icono}</span>
                <span>{p.texto}</span>
              </button>
            ))}
          </nav>
          <Olvido />
        </>
      )}
      {dia && <DiaDetalle fecha={dia} onCerrar={() => setDia(null)} />}
      {archivo && (
        <Modal titulo="Archivo listo" onCerrar={() => setArchivo(null)} id="archivo">
          <p class="nombre-archivo">{archivo.f.name}</p>
          {puedeCompartir(archivo.f) && (
            <button
              class="btn grande primario"
              onClick={() => ejecutar(async () => {
                if (await compartir(archivo.f)) { archivo.alGuardar?.(); setArchivo(null); }
              })}
            >Compartir (Drive, correo…)</button>
          )}
          <button
            class="btn grande"
            onClick={() => { descargar(archivo.f); archivo.alGuardar?.(); setArchivo(null); avisar('Archivo descargado en «Descargas».', 'ok'); }}
          >Descargar</button>
        </Modal>
      )}
      {pregunta && (
        <Modal titulo="Confirmar" id="confirmar">
          <p class="pregunta">{pregunta.texto}</p>
          <div class="botones-fila">
            <button class="btn" onClick={() => { pregunta.resolver(false); setPregunta(null); }}>{pregunta.no}</button>
            <button class="btn primario" onClick={() => { pregunta.resolver(true); setPregunta(null); }}>{pregunta.si}</button>
          </div>
        </Modal>
      )}
      {toast && (
        <div key={toast.id} class={`toast ${toast.tipo}`} role="status" aria-live="polite" data-testid="toast"
          onClick={() => setToast(null)}>
          {toast.texto.split('\n').map((l) => <div>{l}</div>)}
        </div>
      )}
    </Contexto.Provider>
  );
}

