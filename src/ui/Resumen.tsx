import { useState } from 'preact/hooks';
import { dosDecimales } from '../motor/formato';
import { fechaDe, fechaES, NOMBRES_MES } from '../motor/tiempo';
import { aniosConActividad, resumenAsuntos, resumenVacaciones } from '../motor/vacaciones';
import { useCtx } from './contexto';
import { Dur, Fila, Saldo } from './comun';

const dec = (n: number | undefined) => (n === undefined ? 'sin definir' : dosDecimales(n));

export function Resumen() {
  const ctx = useCtx();
  const { res, estado, ahora } = ctx;
  const hoy = fechaDe(ahora);
  const { config, dias, festivos } = estado.datos;
  const anios = aniosConActividad(config, dias, hoy);
  const [anio, setAnio] = useState(+hoy.slice(0, 4));
  const [exportando, setExportando] = useState(false);
  const t = res.totales;
  const v = resumenVacaciones(anio, config, dias, festivos, hoy);
  const a = resumenAsuntos(anio, config, dias, festivos, hoy);

  const exportar = async () => {
    setExportando(true);
    try {
      const archivo = await ctx.ejecutar(async () => {
        const { generarExcel } = await import('../export/excel');
        return generarExcel(estado.datos, Date.now());
      });
      if (archivo) ctx.ofrecerArchivo(archivo);
    } finally {
      setExportando(false);
    }
  };

  return (
    <section>
      <h1>Resumen</h1>
      <div class="bloque" data-testid="desglose">
        <h2>Saldo de horas</h2>
        <Fila k="Horas adicionales realizadas" v={<Dur min={t.ADIC} />} testid="r-adic" />
        <Fila k="Tiempo pendiente de recuperar" v={<Dur min={t.pendiente} />} testid="r-pendiente" />
        <Fila k="Tiempo recuperado" v={<Dur min={t.recuperado} />} testid="r-recuperado" />
        <Fila k="Tiempo a favor" v={<Dur min={t.aFavor} />} />
        <Fila k={<b>Saldo neto</b>} v={<Saldo min={t.saldo} />} testid="r-saldo" />
        {res.diasPorRevisar.length > 0 && (
          <button class="enlace aviso-revisar" onClick={() => ctx.irA('control', { soloRevisar: true })}>
            ⚠ Saldo sin contar {res.diasPorRevisar.length} día(s) por revisar
          </button>
        )}
      </div>

      <div class="bloque">
        <h2>Por meses</h2>
        <div class="tabla-scroll">
          <table class="tabla">
            <thead><tr><th>Mes</th><th>Trab.</th><th>Adic.</th><th>A recup.</th><th>Saldo</th><th>Acum.</th></tr></thead>
            <tbody>
              {[...res.meses].reverse().map((m) => (
                <tr>
                  <td>{NOMBRES_MES[m.mes].slice(0, 3)} {String(m.anio).slice(2)}</td>
                  <td><Dur min={m.T} /></td>
                  <td><Dur min={m.ADIC} /></td>
                  <td><Dur min={m.DEF} /></td>
                  <td><Saldo min={m.saldo} /></td>
                  <td><Saldo min={m.acumulado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div class="bloque">
        <div class="nav-mes">
          <h2>Vacaciones y asuntos propios</h2>
          <select value={anio} onChange={(e) => setAnio(+(e.target as HTMLSelectElement).value)} aria-label="Año">
            {anios.map((y) => <option value={y}>{y}</option>)}
          </select>
        </div>
        <h3>Vacaciones {anio} (días laborables)</h3>
        <div data-testid="vacaciones">
          <Fila k="Días anuales" v={v.anuales ?? 'sin definir'} />
          <Fila k={`Días de alta en el año`} v={v.diasDeAlta} />
          <Fila k="Ajuste manual" v={dosDecimales(v.ajuste)} />
          <Fila k="Derecho del año" v={dec(v.derecho)} />
          <Fila k="Generadas a hoy" v={dec(v.generadas)} />
          <Fila k="Disfrutadas" v={v.disfrutadas} />
          <Fila k="Planificadas" v={v.planificadas} />
          <Fila k={<b>Pendientes</b>} v={<b>{dec(v.pendientes)}</b>} />
          <Fila k="Previsión a 31/12" v={dec(v.prevision)} />
        </div>
        {(v.fechasDisfrutadas.length > 0 || v.fechasPlanificadas.length > 0) && (
          <p class="nota">Días: {[...v.fechasDisfrutadas, ...v.fechasPlanificadas].map(fechaES).join(', ')}</p>
        )}
        <h3>Asuntos propios {anio}</h3>
        <div data-testid="asuntos">
          <Fila k="Cantidad anual" v={a.anuales ?? 'sin definir'} />
          <Fila k="Ajuste manual" v={dosDecimales(a.ajuste)} />
          <Fila k="Disfrutados" v={a.disfrutados} />
          <Fila k="Planificados" v={a.planificados} />
          <Fila k={<b>Disponibles</b>} v={<b>{dec(a.disponibles)}</b>} />
        </div>
        {(a.fechasDisfrutadas.length > 0 || a.fechasPlanificadas.length > 0) && (
          <p class="nota">Días: {[...a.fechasDisfrutadas, ...a.fechasPlanificadas].map(fechaES).join(', ')}</p>
        )}
        {(v.anuales === undefined || a.anuales === undefined) && (
          <button class="enlace" onClick={() => ctx.irA('config')}>Indicar los días de {anio} en Configuración</button>
        )}
      </div>

      <button class="btn grande primario" onClick={exportar} disabled={exportando} data-testid="exportar">
        {exportando ? 'Generando…' : 'EXPORTAR A EXCEL'}
      </button>
    </section>
  );
}
