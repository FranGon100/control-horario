import { useEffect, useState } from 'preact/hooks';
import { dosDecimales } from '../motor/formato';
import { fechaDe, fechaES, horaDe, leerHora, NOMBRES_DIA } from '../motor/tiempo';
import type { Ajuste, Anual, Config, Festivo, Horario } from '../motor/tipos';
import { aniosConActividad } from '../motor/vacaciones';
import * as repo from '../datos/repo';
import { nombreArchivoCopia } from '../datos/formatoCopia';
import { useCtx } from './contexto';
import { Fila, tamanoLegible } from './comun';
import { guardarCopiaFuera } from './copias';
import { Restaurar } from './Restaurar';

declare const __VERSION__: string;

const TIPO_COPIA = { auto: 'semanal', manual: 'manual', 'antes-restaurar': 'antes de restaurar', 'antes-migrar': 'antes de actualizar' };

function Horarios() {
  const ctx = useCtx();
  const cfg = ctx.estado.datos.config;
  const [nuevo, setNuevo] = useState<Horario>({ desde: '', entrada: '09:00', salida: '17:00', dias: [1, 2, 3, 4, 5] });
  const [inicio, setInicio] = useState(cfg.fechaInicio);
  const guardar = async (c: Config, msg: string) => {
    if (await ctx.ejecutar(async () => { await repo.guardarConfig(c); return true; })) { await ctx.recargar(); ctx.avisar(msg, 'ok'); }
  };
  const ordenados = [...cfg.horarios].sort((a, b) => (a.desde < b.desde ? -1 : 1));
  return (
    <div class="bloque">
      <h2>Horario y fecha de inicio</h2>
      <label>Fecha de inicio del registro e incorporación
        <input type="date" value={inicio} onInput={(e) => setInicio((e.target as HTMLInputElement).value)} />
      </label>
      {inicio !== cfg.fechaInicio && inicio && (
        <button class="btn primario" onClick={async () => {
          if (await ctx.confirmar(`¿Cambiar la fecha de inicio al ${fechaES(inicio)}? Todo se recalculará. Los días anteriores no computan.`, 'Cambiar'))
            await guardar({ ...cfg, fechaInicio: inicio }, 'Fecha de inicio cambiada.');
        }}>Guardar fecha de inicio</button>
      )}
      <h3>Horarios</h3>
      {ordenados.map((h) => (
        <div class="tarjeta">
          <div>Desde el <b>{fechaES(h.desde)}</b>: {h.entrada} a {h.salida}</div>
          <div class="nota">{h.dias.map((d) => NOMBRES_DIA[d]).join(', ')}</div>
          {cfg.horarios.length > 1 && (
            <button class="btn peligro mini" onClick={async () => {
              if (await ctx.confirmar(`¿Eliminar el horario que empieza el ${fechaES(h.desde)}? Los días afectados se recalcularán con el horario anterior.`, 'Eliminar'))
                await guardar({ ...cfg, horarios: cfg.horarios.filter((x) => x !== h) }, 'Horario eliminado.');
            }}>Eliminar</button>
          )}
        </div>
      ))}
      <h3>Cambio de horario</h3>
      <p class="nota">Indica desde qué fecha aplica. Los días anteriores mantienen su horario.</p>
      <div class="filtros">
        <label>Desde<input type="date" value={nuevo.desde} onInput={(e) => setNuevo({ ...nuevo, desde: (e.target as HTMLInputElement).value })} /></label>
        <label>Entrada<input type="time" value={nuevo.entrada} onInput={(e) => setNuevo({ ...nuevo, entrada: (e.target as HTMLInputElement).value })} /></label>
        <label>Salida<input type="time" value={nuevo.salida} onInput={(e) => setNuevo({ ...nuevo, salida: (e.target as HTMLInputElement).value })} /></label>
      </div>
      <div class="dias-semana">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <label class="check"><input type="checkbox" checked={nuevo.dias.includes(d)} onChange={(e) => {
            const on = (e.target as HTMLInputElement).checked;
            setNuevo({ ...nuevo, dias: on ? [...nuevo.dias, d].sort() : nuevo.dias.filter((x) => x !== d) });
          }} />{NOMBRES_DIA[d].slice(0, 3)}</label>
        ))}
      </div>
      <button class="btn" disabled={!nuevo.desde} onClick={async () => {
        const e = leerHora(nuevo.entrada), s = leerHora(nuevo.salida);
        if (!e || !s || e[0] * 60 + e[1] >= s[0] * 60 + s[1]) { ctx.avisar('La salida debe ser posterior a la entrada.', 'error'); return; }
        if (cfg.horarios.some((h) => h.desde === nuevo.desde)) { ctx.avisar('Ya hay un horario que empieza ese día.', 'error'); return; }
        if (await ctx.confirmar(`¿Aplicar ${nuevo.entrada}-${nuevo.salida} desde el ${fechaES(nuevo.desde)}?`, 'Aplicar'))
          await guardar({ ...cfg, horarios: [...cfg.horarios, nuevo] }, 'Horario añadido.');
      }}>Añadir cambio de horario</button>
    </div>
  );
}

function AjustesLista({ lista, onCambiar }: { lista: Ajuste[]; onCambiar: (l: Ajuste[]) => void }) {
  const ctx = useCtx();
  const [dias, setDias] = useState('');
  const [nota, setNota] = useState('');
  return (
    <div class="ajustes">
      {lista.map((a, i) => (
        <div class="fila-kv">
          <span>{a.dias > 0 ? '+' : ''}{dosDecimales(a.dias)} · {a.nota}</span>
          <button class="btn peligro mini" onClick={async () => {
            if (await ctx.confirmar('¿Eliminar este ajuste?', 'Eliminar')) onCambiar(lista.filter((_, j) => j !== i));
          }}>✕</button>
        </div>
      ))}
      <div class="filtros">
        <label>Días (+/−)<input inputMode="decimal" value={dias} onInput={(e) => setDias((e.target as HTMLInputElement).value)} placeholder="-1,5" /></label>
        <label>Nota<input value={nota} onInput={(e) => setNota((e.target as HTMLInputElement).value)} /></label>
      </div>
      <button class="btn mini" onClick={() => {
        const n = Number(dias.replace(',', '.'));
        if (!dias.trim() || !Number.isFinite(n) || n === 0) { ctx.avisar('Escribe un número de días distinto de 0.', 'error'); return; }
        if (!nota.trim()) { ctx.avisar('Escribe una nota que explique el ajuste.', 'error'); return; }
        onCambiar([...lista, { dias: n, nota: nota.trim() }]);
        setDias(''); setNota('');
      }}>Añadir ajuste</button>
    </div>
  );
}

function leerNumero(txt: string): number | undefined | null {
  if (!txt.trim()) return undefined;
  const n = Number(txt.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function DiasAnuales() {
  const ctx = useCtx();
  const { config, dias } = ctx.estado.datos;
  const hoy = fechaDe(ctx.ahora);
  const anios = aniosConActividad(config, dias, hoy);
  const sig = +hoy.slice(0, 4) + 1;
  if (!anios.includes(sig)) anios.push(sig);
  const guardarAnual = async (y: number, a: Anual) => {
    const c = { ...config, anual: { ...config.anual, [y]: a } };
    if (await ctx.ejecutar(async () => { await repo.guardarConfig(c); return true; })) { await ctx.recargar(); ctx.avisar('Guardado.', 'ok'); }
  };
  return (
    <div class="bloque">
      <h2>Vacaciones y asuntos propios por año</h2>
      {anios.map((y) => <Anio key={y} anio={y} a={config.anual[y] ?? {}} onGuardar={(a) => guardarAnual(y, a)} />)}
    </div>
  );
}

function Anio({ anio, a, onGuardar }: { anio: number; a: Anual; onGuardar: (a: Anual) => void }) {
  const ctx = useCtx();
  const [vac, setVac] = useState(a.vacaciones?.toString().replace('.', ',') ?? '');
  const [ap, setAp] = useState(a.asuntos?.toString().replace('.', ',') ?? '');
  return (
    <div class="tarjeta">
      <h3>{anio}</h3>
      <div class="filtros">
        <label>Días de vacaciones al año<input inputMode="decimal" value={vac} onInput={(e) => setVac((e.target as HTMLInputElement).value)} placeholder="sin definir" /></label>
        <label>Días de asuntos propios<input inputMode="decimal" value={ap} onInput={(e) => setAp((e.target as HTMLInputElement).value)} placeholder="sin definir" /></label>
      </div>
      <button class="btn mini" onClick={() => {
        const v = leerNumero(vac), p = leerNumero(ap);
        if (v === null || p === null) { ctx.avisar('Escribe un número igual o mayor que 0.', 'error'); return; }
        const n: Anual = { ...a, vacaciones: v, asuntos: p };
        if (v === undefined) delete n.vacaciones;
        if (p === undefined) delete n.asuntos;
        onGuardar(n);
      }}>Guardar días de {anio}</button>
      <h4>Ajustes de vacaciones {anio}</h4>
      <AjustesLista lista={a.ajustesVac ?? []} onCambiar={(l) => onGuardar({ ...a, ajustesVac: l })} />
      <h4>Ajustes de asuntos propios {anio}</h4>
      <AjustesLista lista={a.ajustesAP ?? []} onCambiar={(l) => onGuardar({ ...a, ajustesAP: l })} />
    </div>
  );
}

export function Festivos({ soloSinConfirmar = false }: { soloSinConfirmar?: boolean }) {
  const ctx = useCtx();
  const fest = [...ctx.estado.datos.festivos].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const [edit, setEdit] = useState<{ anterior?: string; f: Festivo } | null>(null);
  const guardar = async (f: Festivo, anterior?: string) => {
    if (await ctx.ejecutar(async () => { await repo.guardarFestivo(f, anterior); return true; })) {
      await ctx.recargar(); setEdit(null); ctx.avisar('Festivo guardado. Todo se ha recalculado.', 'ok');
    }
  };
  const lista = soloSinConfirmar ? fest.filter((f) => f.sinConfirmar) : fest;
  return (
    <div data-testid="festivos">
      {[...new Set(lista.map((f) => f.fecha.slice(0, 4)))].map((y) => (
        <>
          {!soloSinConfirmar && <h3>{y}</h3>}
          {lista.filter((f) => f.fecha.startsWith(y)).map((f) => (
            <div class={`tarjeta festivo ${f.sinConfirmar ? 'sin-confirmar' : ''}`}>
              {edit?.anterior === f.fecha ? (
                <EditorFestivo f={edit.f} onGuardar={(n) => guardar(n, f.fecha)} onCancelar={() => setEdit(null)} />
              ) : (
                <>
                  <div><b>{fechaES(f.fecha)}</b> {NOMBRES_DIA[new Date(f.fecha + 'T12:00:00Z').getUTCDay() || 7]} · {f.nombre}</div>
                  {f.sinConfirmar && <div class="txt-aviso">⚠ Sin confirmar</div>}
                  <div class="botones-fila">
                    {f.sinConfirmar && <button class="btn primario mini" onClick={() => guardar({ ...f, sinConfirmar: false }, f.fecha)}>Confirmar</button>}
                    <button class="btn mini" onClick={() => setEdit({ anterior: f.fecha, f: { ...f, sinConfirmar: false } })}>{f.sinConfirmar ? 'Corregir' : 'Editar'}</button>
                    <button class="btn peligro mini" onClick={async () => {
                      if (await ctx.confirmar(`¿Eliminar el festivo del ${fechaES(f.fecha)}? Todo se recalculará.`, 'Eliminar')) {
                        await ctx.ejecutar(() => repo.borrarFestivo(f.fecha)); await ctx.recargar();
                      }
                    }}>Eliminar</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </>
      ))}
      {!soloSinConfirmar && (edit && !edit.anterior ? (
        <div class="tarjeta"><EditorFestivo f={edit.f} onGuardar={(n) => guardar(n)} onCancelar={() => setEdit(null)} /></div>
      ) : (
        <button class="btn" onClick={() => setEdit({ f: { fecha: '', nombre: '' } })}>+ Añadir festivo</button>
      ))}
    </div>
  );
}

function EditorFestivo({ f, onGuardar, onCancelar }: { f: Festivo; onGuardar: (f: Festivo) => void; onCancelar: () => void }) {
  const [x, setX] = useState(f);
  return (
    <div class="columna">
      <label>Fecha<input type="date" value={x.fecha} onInput={(e) => setX({ ...x, fecha: (e.target as HTMLInputElement).value })} /></label>
      <label>Nombre<input value={x.nombre} onInput={(e) => setX({ ...x, nombre: (e.target as HTMLInputElement).value })} /></label>
      <div class="botones-fila">
        <button class="btn" onClick={onCancelar}>Cancelar</button>
        <button class="btn primario" disabled={!x.fecha} onClick={() => onGuardar(x)}>Guardar</button>
      </div>
    </div>
  );
}

function Copias() {
  const ctx = useCtx();
  const { meta } = ctx.estado;
  const [copias, setCopias] = useState<repo.CopiaInterna[]>([]);
  const [restaurar, setRestaurar] = useState<string | null>(null);
  const cargarLista = async () => setCopias(await repo.listarCopias());
  useEffect(() => { cargarLista(); }, [ctx.estado]);
  const total = copias.reduce((s, c) => s + c.tamano, 0);
  return (
    <div class="bloque" data-testid="copias">
      <h2>Copias de seguridad</h2>
      <p class="aviso fijo-texto">
        Las copias internas se pierden si se borran los datos del navegador o se desinstala la app.
        La que te protege es la copia guardada fuera (Drive, correo, Descargas).
      </p>
      <Fila k="Última copia automática" v={meta.ultimaCopiaAuto ? `${fechaES(fechaDe(meta.ultimaCopiaAuto))} ${horaDe(meta.ultimaCopiaAuto)}` : 'ninguna'} testid="ultima-auto" />
      <Fila k="Última copia guardada fuera" v={meta.ultimaCopiaFuera ? `${fechaES(fechaDe(meta.ultimaCopiaFuera))} ${horaDe(meta.ultimaCopiaFuera)}` : 'ninguna'} testid="ultima-fuera" />
      <div class="columna">
        <button class="btn grande primario" onClick={() => guardarCopiaFuera(ctx)} data-testid="guardar-copia">Guardar copia fuera de la app</button>
        <button class="btn" onClick={async () => {
          if (await ctx.ejecutar(() => repo.crearCopiaAhora(Date.now()))) { await cargarLista(); ctx.avisar('Copia creada dentro de la app.', 'ok'); }
        }} data-testid="crear-copia">Crear copia ahora</button>
        <label class="btn">Restaurar desde un archivo…
          <input type="file" accept=".json,application/json" class="oculto" data-testid="archivo-restaurar" onChange={async (e) => {
            const input = e.target as HTMLInputElement;
            const file = input.files?.[0];
            input.value = '';
            if (file) setRestaurar(await file.text());
          }} />
        </label>
      </div>
      <h3>Copias dentro de la app ({copias.length} · {tamanoLegible(total)})</h3>
      <ul class="lista-copias">
        {copias.map((c) => (
          <li class="tarjeta" data-testid="copia">
            <div><b>{fechaES(fechaDe(c.fecha))} {horaDe(c.fecha)}</b> · {TIPO_COPIA[c.tipo]} · {tamanoLegible(c.tamano)}</div>
            <div class="botones-fila">
              <button class="btn mini" onClick={() => guardarCopiaFuera(ctx, c.id)}>Guardar fuera</button>
              <button class="btn mini" onClick={() => setRestaurar(c.json)}>Restaurar</button>
              <button class="btn peligro mini" onClick={async () => {
                if (await ctx.confirmar(`¿Borrar la copia del ${fechaES(fechaDe(c.fecha))} ${horaDe(c.fecha)}? No se puede deshacer.`, 'Borrar')) {
                  await ctx.ejecutar(() => repo.borrarCopia(c.id)); await cargarLista();
                }
              }}>Borrar</button>
            </div>
          </li>
        ))}
      </ul>
      <p class="nota">Nombre de los archivos: {nombreArchivoCopia(ctx.ahora)}</p>
      {restaurar !== null && <Restaurar texto={restaurar} onCerrar={() => { setRestaurar(null); cargarLista(); }} />}
    </div>
  );
}

function Almacenamiento() {
  const [protegido, setProtegido] = useState<boolean | null>(null);
  const [uso, setUso] = useState<string>('');
  useEffect(() => {
    (async () => {
      try {
        setProtegido(await navigator.storage.persisted());
        const e = await navigator.storage.estimate();
        if (e.usage !== undefined && e.quota) setUso(`${tamanoLegible(e.usage)} usados de ${tamanoLegible(e.quota)} disponibles`);
      } catch { setProtegido(false); }
    })();
  }, []);
  return (
    <div class="bloque">
      <h2>Almacenamiento y versión</h2>
      <Fila k="Almacenamiento protegido" v={protegido === null ? '…' : protegido ? 'sí' : 'no'} testid="protegido" />
      {protegido === false && <p class="nota">Chrome lo concede solo con el uso y si la app está instalada. Sin protección, el navegador podría borrar los datos si el teléfono se queda sin espacio: guarda copias fuera.</p>}
      {uso && <Fila k="Espacio" v={uso} />}
      <Fila k="Versión de la app" v={__VERSION__} />
    </div>
  );
}

export function Configuracion() {
  const ctx = useCtx();
  const prueba = ctx.res.movimientosPrueba;
  return (
    <section>
      <h1>Configuración y copias</h1>
      <Copias />
      <Horarios />
      <DiasAnuales />
      <div class="bloque">
        <h2>Festivos</h2>
        <Festivos />
      </div>
      <div class="bloque">
        <h2>Fichajes de prueba</h2>
        <p class="nota">Fichajes anteriores a la fecha de inicio: {prueba.length}. No computan.</p>
        <button class="btn peligro" disabled={prueba.length === 0} onClick={async () => {
          if (await ctx.confirmar(`¿Eliminar los ${prueba.length} fichajes de prueba? No se puede deshacer.`, 'Eliminar')) {
            const n = await ctx.ejecutar(repo.borrarPrueba);
            if (n !== undefined) { await ctx.recargar(); ctx.avisar(`${n} fichajes de prueba eliminados.`, 'ok'); }
          }
        }}>Eliminar fichajes de prueba</button>
      </div>
      <Almacenamiento />
    </section>
  );
}
