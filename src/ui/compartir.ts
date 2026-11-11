// Guardar archivos fuera de la app: menú de compartir de Android o descarga.

export function puedeCompartir(archivo: File): boolean {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [archivo] });
  } catch {
    return false;
  }
}

/** true si el usuario completó el envío; false si lo canceló. */
export async function compartir(archivo: File): Promise<boolean> {
  try {
    await navigator.share({ files: [archivo], title: archivo.name });
    return true;
  } catch (e) {
    if ((e as Error).name === 'AbortError') return false;
    throw e;
  }
}

export function descargar(archivo: File) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
