import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import { hayVersionNueva } from './ui/AvisoVersion';
import './estilos.css';

render(<App />, document.getElementById('app')!);

if ('serviceWorker' in navigator) {
  const actualizar = registerSW({
    immediate: true,
    onNeedRefresh() {
      hayVersionNueva(actualizar);
    },
  });
  // Comprobar si hay versión nueva al volver a la app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
      navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => undefined);
  });
}
