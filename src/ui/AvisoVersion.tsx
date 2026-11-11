import { useEffect, useState } from 'preact/hooks';

let actualizar: ((recargar?: boolean) => Promise<void>) | null = null;
let avisar: (() => void) | null = null;
let pendiente = false;

/** Llamado desde main.tsx cuando el service worker detecta una versión nueva. */
export function hayVersionNueva(fn: (recargar?: boolean) => Promise<void>) {
  actualizar = fn;
  pendiente = true;
  avisar?.();
}

export function AvisoVersion() {
  const [visible, setVisible] = useState(pendiente);
  useEffect(() => { avisar = () => setVisible(true); return () => { avisar = null; }; }, []);
  if (!visible) return null;
  return (
    <div class="aviso-version" role="status" data-testid="aviso-version">
      <span>Hay una versión nueva</span>
      <button class="btn primario mini" onClick={() => actualizar?.(true)}>Actualizar</button>
    </div>
  );
}
