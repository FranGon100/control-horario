import type { ComponentChildren } from 'preact';
import { duracion, duracionSinSigno } from '../motor/formato';

export function Modal(p: { titulo: string; children: ComponentChildren; onCerrar?: () => void; id?: string }) {
  return (
    <div class="velo" role="dialog" aria-modal="true" aria-label={p.titulo} data-testid={p.id}>
      <div class="modal">
        <div class="modal-cab">
          <h2>{p.titulo}</h2>
          {p.onCerrar && (
            <button class="cerrar" onClick={p.onCerrar} aria-label="Cerrar">✕</button>
          )}
        </div>
        <div class="modal-cuerpo">{p.children}</div>
      </div>
    </div>
  );
}

/** Duración con signo y color (verde a favor, rojo en contra). */
export function Saldo(p: { min: number; class?: string }) {
  const c = p.min > 0 ? 'pos' : p.min < 0 ? 'neg' : 'cero';
  return <span class={`saldo ${c} ${p.class ?? ''}`}>{duracion(p.min)}</span>;
}

export const Dur = (p: { min: number }) => <span>{duracionSinSigno(p.min)}</span>;

export function Fila(p: { k: ComponentChildren; v: ComponentChildren; testid?: string }) {
  return (
    <div class="fila-kv" data-testid={p.testid}>
      <span class="k">{p.k}</span>
      <span class="v">{p.v}</span>
    </div>
  );
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`;
}
