# Control Horario · notas para futuras sesiones

Especificación completa (fuente de verdad): `docs/ESPECIFICACION.md`. Léela antes de cambiar cálculos.

## Cómo trabajar
- El usuario (Fran) no programa: español llano, pasos numerados, sin decisiones técnicas.
- No inventar reglas de negocio: si un caso no está cubierto, preguntar antes de programarlo.
- No añadir funciones no pedidas (ni notificaciones, ni cuentas, ni nube, ni estadísticas extra).
- Repositorio público: nada de datos personales; datos de prueba ficticios.
- Prioridades: 1) no perder datos · 2) cálculos correctos · 3) sencillez.

## Estructura
- `src/motor/`: cálculo puro (sin DOM, sin almacenamiento, sin reloj: recibe `ahora`). Probado en `tests/unit/`.
- `src/datos/`: IndexedDB (`control-horario`), operaciones validadas (`repo.ts`), copias (`formatoCopia.ts`), migraciones (`migraciones.ts`, `VERSION_DATOS`).
- `src/ui/`: Preact. `src/export/excel.ts`: ExcelJS (carga diferida).
- `tests/e2e/`: Playwright en tamaño móvil, servidor estático en `/control-horario/`.
- Comandos: `npm test` (motor y datos), `npm run e2e` (compila y prueba en navegador).

## Reglas de negocio (resumen)
- Solo se guardan hechos (movimientos, días marcados, festivos, configuración). Nunca saldos: todo se recalcula.
- Instantes en UTC al minuto; fecha/hora local siempre en `Europe/Madrid`. Duraciones entre instantes (cambios de hora correctos).
- Inicio: 16/11/2026. Lo anterior es «prueba · no computa». Horario L-V 09:00-17:00; cambios con fecha de vigencia.
- Movimientos E/S/G/R. Máquina de estados: FUERA→E; TRABAJANDO→S,G; EN GESTIÓN→R,S (S con confirmación). Orden: instante y, a igualdad, `seq`.
- Tramo trabajado: de E o R a la siguiente G o S. Gestión: de G a R (o S). Tramos partidos por medianoche.
- Día LABORABLE (L-V, no festivo, sin marca o marca CUENTA): ORD = T dentro de la ventana; ADIC = T − ORD; DEF = V − ORD; saldo = ADIC − DEF.
  NO LABORABLE (fin de semana, festivo, o marca VAC/AP/AUS): ADIC = T, DEF = 0.
- Estado del día: CERRADO (V = ventana completa) · EN CURSO (solo tramos cerrados; V = ventana hasta el último fichaje) · PENDIENTE (aporta 0) · SIN FICHAJES (0; laborable pasado sin marca = por revisar; marca CUENTA = −8 h).
- Totales desde el inicio sin reiniciar: recuperado = min(ADIC, DEF); pendiente = DEF − recuperado; a favor = ADIC − recuperado; saldo = ADIC − DEF.
- Olvido: sesión abierta con ENTRADA de un día anterior. Opciones: Sigo trabajando (`sigoFecha` = hoy; se vuelve a preguntar cada día), Indicar hora (SALIDA manual), Dejar pendiente (`pendiente` en la E; permite nueva E). Sin respuesta = PENDIENTE. Nunca se inventa una hora.
- Manual: añadido → `origen: 'manual'`, `original: null`; modificado → `modificado` + `original` (se conserva el primero).
- Vacaciones en días laborables, por año natural: derecho = anuales × díasDeAlta ÷ díasDelAño + ajuste; generadas igual con días de alta transcurridos (hoy incluido); pendientes = generadas − disfrutadas; previsión = derecho − disfrutadas − planificadas. Sin redondeo (2 decimales).
- Asuntos propios: disponibles = anual + ajuste − disfrutados − planificados. Un día tiene una sola marca.
- Marcas solo en días laborables y desde la fecha de inicio.
- Copias JSON con SHA-256, resumen recalculado y migraciones. Copia semanal automática al abrir o volver a la app; ninguna copia se borra sola.
