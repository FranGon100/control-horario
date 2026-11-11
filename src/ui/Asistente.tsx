import { useState } from 'preact/hooks';
import { fechaDe, fechaES, NOMBRES_DIA } from '../motor/tiempo';
import * as repo from '../datos/repo';
import { useCtx } from './contexto';
import { Festivos } from './Configuracion';

/** Primer arranque: días anuales, horario, festivos y festivos locales sin confirmar. */
export function Asistente() {
  const ctx = useCtx();
  const { config, festivos } = ctx.estado.datos;
  const [paso, setPaso] = useState(0);
  const anioInicio = +config.fechaInicio.slice(0, 4);
  const anioHoy = +fechaDe(ctx.ahora).slice(0, 4);
  const anios = [...new Set([anioInicio, Math.max(anioInicio, anioHoy), Math.max(anioInicio, anioHoy) + 1])];
  const [valores, setValores] = useState<Record<number, { vac: string; ap: string }>>(
    Object.fromEntries(anios.map((y) => [y, { vac: '', ap: '' }])),
  );
  const [error, setError] = useState('');
  const sinConfirmar = festivos.filter((f) => f.sinConfirmar);
  const h = config.horarios[0];

  const guardarDias = async () => {
    const anual = { ...config.anual };
    for (const y of anios) {
      const v = valores[y];
      const vac = Number(v.vac.replace(',', '.')), ap = Number(v.ap.replace(',', '.'));
      if (!v.vac.trim() || !v.ap.trim() || !Number.isFinite(vac) || !Number.isFinite(ap) || vac < 0 || ap < 0) {
        setError(`Escribe los días de ${y} (puede ser 0).`);
        return;
      }
      anual[y] = { ...anual[y], vacaciones: vac, asuntos: ap };
    }
    if (await ctx.ejecutar(async () => { await repo.guardarConfig({ ...config, anual }); return true; })) {
      await ctx.recargar();
      setError('');
      setPaso(1);
    }
  };

  return (
    <main class="pantalla asistente" data-testid="asistente">
      <h1>Bienvenido a Control Horario</h1>
      <p class="sub">Paso {paso + 1} de 4</p>
      {paso === 0 && (
        <div class="bloque">
          <h2>Días de vacaciones y asuntos propios</h2>
          <p class="nota">Días laborables que te corresponden en un año completo. Las vacaciones se calculan en proporción a los días de alta. Podrás cambiarlos en Configuración.</p>
          {anios.map((y) => (
            <div class="tarjeta">
              <h3>{y}</h3>
              <div class="filtros">
                <label>Vacaciones (días al año)
                  <input inputMode="decimal" data-testid={`vac-${y}`} value={valores[y].vac}
                    onInput={(e) => setValores({ ...valores, [y]: { ...valores[y], vac: (e.target as HTMLInputElement).value } })} />
                </label>
                <label>Asuntos propios
                  <input inputMode="decimal" data-testid={`ap-${y}`} value={valores[y].ap}
                    onInput={(e) => setValores({ ...valores, [y]: { ...valores[y], ap: (e.target as HTMLInputElement).value } })} />
                </label>
              </div>
            </div>
          ))}
          {error && <p class="errores" role="alert">{error}</p>}
          <button class="btn grande primario" onClick={guardarDias}>Siguiente</button>
        </div>
      )}
      {paso === 1 && (
        <div class="bloque">
          <h2>Horario</h2>
          <p>Fecha de inicio: <b>{fechaES(config.fechaInicio)}</b></p>
          <p>{h.dias.map((d) => NOMBRES_DIA[d]).join(', ')}: <b>{h.entrada} a {h.salida}</b>.</p>
          <p class="nota">Sábados, domingos y festivos no tienen jornada ordinaria: todo lo trabajado cuenta a favor. Si cambia, hazlo en Configuración indicando desde qué fecha aplica.</p>
          <button class="btn grande primario" onClick={() => setPaso(2)}>Es correcto, siguiente</button>
        </div>
      )}
      {paso === 2 && (
        <div class="bloque">
          <h2>Festivos precargados (Zaragoza)</h2>
          <p class="nota">Revísalos. Puedes añadir, corregir o eliminar.</p>
          <Festivos />
          <button class="btn grande primario" onClick={() => setPaso(3)}>Siguiente</button>
        </div>
      )}
      {paso === 3 && (
        <div class="bloque">
          <h2>Festivos locales sin confirmar</h2>
          {sinConfirmar.length > 0 ? (
            <>
              <p class="nota">Las fiestas locales de Zaragoza de 2027 aún no son oficiales. Se han cargado como las de 2026. Confírmalas o corrígelas.</p>
              <Festivos soloSinConfirmar />
            </>
          ) : <p>✓ No queda ningún festivo sin confirmar.</p>}
          <button class="btn grande primario" data-testid="terminar-asistente" onClick={async () => {
            if (sinConfirmar.length && !(await ctx.confirmar('Quedan festivos sin confirmar. Se mostrará un aviso hasta que los revises. ¿Continuar?', 'Continuar'))) return;
            await ctx.ejecutar(repo.terminarAsistente);
            await ctx.recargar();
          }}>Empezar a usar la app</button>
        </div>
      )}
    </main>
  );
}
