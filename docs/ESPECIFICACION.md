# PROMPT PARA CLAUDE CODE · App personal «Control Horario» (PWA para Android)

Este documento es la especificación completa de la aplicación. Léelo entero antes de empezar.

## 0. Cómo debes trabajar

- **Usuario.** Fran no programa. Escríbele en español llano, sin jerga, y no le pidas decisiones técnicas. Cuando tenga que hacer algo él (clics en GitHub, instalar en el móvil), dale pasos numerados y exactos.
- **No inventes reglas de negocio.** Todo lo que afecta a los cálculos está definido aquí. Si aparece un caso no cubierto, para y pregunta antes de programarlo.
- **No añadas funciones no pedidas**: sin notificaciones, cuentas, nube, publicidad, suscripciones, funciones sociales ni estadísticas extra. Ante la duda, lo más simple.
- **Arranque.** Responde primero con un plan de 10 a 15 líneas y solo las dudas que te bloqueen. Si no tienes dudas, continúa sin esperar respuesta.
- **Ritmo.** Trabaja por fases (§15), de principio a fin, sin pedir confirmación en cada una.
- **Honestidad.** No des nada por probado si no lo has ejecutado. En el informe final separa «verificado automáticamente» de «pendiente de comprobar en el móvil real».
- **Memoria del proyecto.** Guarda este documento íntegro como `docs/ESPECIFICACION.md` y crea un `CLAUDE.md` con las reglas de negocio resumidas, para futuras sesiones.
- **Repositorio público.** No incluyas datos personales (nombre, empresa, fichajes reales). Los datos de prueba son ficticios.

## 1. Objetivo y prioridades

Aplicación personal de control horario y gestión de vacaciones para **un único usuario**, que la usará a diario en un **Samsung Galaxy A17 (Android)**. Debe instalarse en el teléfono y comportarse como una app convencional, sin pasar por Google Play. Tiene que ser extremadamente sencilla, rápida y fiable.

Prioridades, por este orden: **1) no perder datos · 2) cálculos correctos · 3) sencillez de uso.** Si dos chocan, gana la de número menor.

## 2. Decisiones técnicas cerradas

| Tema | Decisión |
|---|---|
| Tipo de app | PWA instalable, 100 % estática. Sin servidor, sin cuentas, sin base de datos remota. |
| Publicación | GitHub Pages (repositorio público) desplegado con GitHub Actions, por HTTPS. Rutas relativas, para funcionar en `https://<usuario>.github.io/<repo>/`. |
| Sin conexión | Tras la primera carga, la app funciona entera sin red y **no hace ninguna petición de red**. Todo va empaquetado: nada de CDN, fuentes externas ni analítica. |
| Datos | IndexedDB, con nombre de base de datos propio (`control-horario`). Solicitar almacenamiento persistente con `navigator.storage.persist()`. |
| Stack | Vite + TypeScript. Interfaz con lo mínimo (Preact o sin framework: elige y justifícalo en una línea). Vitest para el motor. Playwright para pruebas de extremo a extremo en tamaño móvil. |
| Motor de cálculo | Módulo TypeScript puro en `src/motor/`: sin DOM, sin almacenamiento y sin leer el reloj (recibe `ahora` como parámetro). Es lo primero que se construye y se prueba. |
| Fuente de verdad | Solo se guardan hechos: movimientos, días marcados, festivos y configuración. **Prohibido guardar saldos o totales**: se recalculan siempre desde el histórico completo. |
| Tiempo | Instantes guardados en UTC con precisión de minuto (se descartan los segundos). Toda conversión a fecha y hora local usa la zona fija `Europe/Madrid`, **no la del dispositivo**. Las duraciones se calculan entre instantes, para que los cambios de hora de marzo y octubre salgan bien. |
| Formato | Español (es-ES), 24 horas, fechas DD/MM/AAAA, semana de lunes a domingo. Duraciones con signo: `+12 h 35 min`, `-04 h 20 min`, `00 h 00 min`. |
| Pantalla | Móvil en vertical, usable con una mano entre 360 y 430 px de ancho, sin zoom. Tema claro de alto contraste. Botones táctiles grandes. |

## 3. Datos de partida

- **Fecha de inicio del registro y de incorporación**: lunes **16/11/2026**. Los días anteriores no computan en nada (§7.4).
- **Horario ordinario**: lunes a viernes, entrada 09:00, salida 17:00, 8 horas efectivas, sin pausa.
- **Sábados, domingos y festivos**: sin jornada ordinaria; todo lo trabajado cuenta a favor.
- **Días anuales de vacaciones y de asuntos propios**: **no están definidos**. La app los pide en el primer arranque y son editables después, año a año. No pongas valores por defecto.
- Todo lo anterior es editable en Configuración. Un cambio de horario exige indicar **desde qué fecha aplica**; los días anteriores se siguen calculando con el horario que tenían.

## 4. Festivos precargados (ciudad de Zaragoza)

Comprobados en fuentes oficiales el 11/11/2026. Cárgalos tal cual; no generes festivos por regla.

**2026, desde la fecha de inicio:** 07/12 lunes, Día de la Constitución (trasladado del domingo 6) · 08/12 martes, Inmaculada Concepción · 25/12 viernes, Natividad del Señor.

**2027:** 01/01 viernes, Año Nuevo · 06/01 miércoles, Epifanía del Señor · 25/03 jueves, Jueves Santo · 26/03 viernes, Viernes Santo · 23/04 viernes, San Jorge (Día de Aragón) · 01/05 sábado, Fiesta del Trabajo · 16/08 lunes, Asunción de la Virgen (trasladado del domingo 15) · 12/10 martes, Fiesta Nacional de España · 01/11 lunes, Todos los Santos · 06/12 lunes, Día de la Constitución · 08/12 miércoles, Inmaculada Concepción · 25/12 sábado, Natividad del Señor.

**Locales de Zaragoza en 2027: sin confirmar oficialmente.** En 2026 fueron el 29 de enero (San Valero) y el 5 de marzo (Cincomarzada). Cárgalos para 2027 (viernes 29/01 y viernes 05/03) marcados como «sin confirmar», y haz que la configuración inicial pida al usuario que los confirme o los corrija.

Fuentes:
- 2027, Aragón: Decreto 163/2026, de 9 de septiembre, del Gobierno de Aragón (BOA n.º 180, 16/09/2026) — https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VEROBJ&MLKOB=1466225130707
- 2027, ámbito nacional: Resolución de 8 de octubre de 2026 de la Dirección General de Trabajo (BOE n.º 254, 13/10/2026, BOE-A-2026-21254) — https://www.boe.es/boe/dias/2026/10/13/pdfs/BOE-A-2026-21254.pdf
- 2026, Aragón (Decreto 70/2025, de 9 de julio): calendario del Ayuntamiento de Zaragoza — https://www.zaragoza.es/sede/servicio/transparencia/1940
- Locales de 2026 (acuerdo del Pleno de 29/07/2025) — https://www.zaragoza.es/sede/servicio/tablon-edicto/3870/document.pdf
- Página donde se publican las resoluciones de fiestas locales — https://www.aragon.es/trabajo-y-relaciones-laborales/calendario-laboral

Reglas del calendario:
- El usuario puede añadir, editar y eliminar festivos en cualquier momento; todo se recalcula.
- Si el año en curso no tiene festivos cargados, o faltan menos de 60 días para un año que no los tiene, la app lo avisa y pide introducirlos. Nunca los supone.

## 5. Fichajes

La pantalla de inicio tiene cuatro botones grandes, siempre visibles: **ENTRADA · SALIDA · GESTIÓN PARTICULAR · REGRESO DE GESTIÓN**. Solo están activos los que tienen sentido en cada estado:

| Estado | Botones activos |
|---|---|
| FUERA | ENTRADA |
| TRABAJANDO | SALIDA · GESTIÓN PARTICULAR |
| EN GESTIÓN | REGRESO DE GESTIÓN · SALIDA (con confirmación: «No has vuelto de la gestión. ¿Terminar la jornada?») |

- Cada pulsación guarda fecha, hora (al minuto) y tipo de movimiento, con origen «botón».
- No se pueden registrar dos entradas seguidas sin una salida, ni un regreso sin una gestión previa. Lo impide la máquina de estados, no solo la interfaz.
- Gestiones particulares por jornada: sin límite. Varias sesiones entrada-salida el mismo día: permitidas.
- El fichaje se confirma en pantalla (mensaje grande, por ejemplo «ENTRADA registrada · 09:02», y cambio de estado) **solo después** de que la escritura en IndexedDB haya terminado.
- Sin duplicados: el botón pulsado queda desactivado hasta que termina el guardado.
- Un botón inactivo, al tocarlo, explica en una frase por qué («Primero ficha la ENTRADA»).
- Orden de los movimientos: por instante y, a igualdad de minuto, por orden de registro.

## 6. Motor de cálculo (crítico)

Regla general: cada minuto trabajado fuera del horario ordinario es un minuto a favor; cada minuto del horario ordinario no trabajado es un minuto a recuperar. Relación 1:1, sin multiplicadores ni recargos. Lo que hay a favor compensa automáticamente lo pendiente.

### 6.1 Definiciones

- **Tramo trabajado**: de una ENTRADA o un REGRESO hasta la siguiente GESTIÓN o SALIDA.
- **Gestión particular**: de una GESTIÓN hasta el siguiente REGRESO (o hasta la SALIDA, si no hubo regreso). No es tiempo trabajado.
- **Día**: de 00:00 a 24:00, hora de Madrid. Un tramo que cruza la medianoche se parte, y cada parte cuenta en su día.
- **Tipo de día**:
  - LABORABLE: lunes a viernes, no festivo y sin marca.
  - NO LABORABLE: sábado, domingo o festivo.
  - Con marca VACACIONES, ASUNTO PROPIO o AUSENCIA: se calcula como NO LABORABLE (si se trabaja, todo cuenta a favor).
  - Con marca A CUENTA DEL SALDO: se calcula como LABORABLE cerrado aunque no tenga fichajes.
- **Ventana ordinaria**: en días LABORABLES, de 09:00 a 17:00 (la del horario vigente ese día).

### 6.2 Cálculo de un día

| Magnitud | Día LABORABLE | Día NO LABORABLE |
|---|---|---|
| T · tiempo trabajado | suma de los tramos dentro del día | igual |
| ORD · horas ordinarias | parte de T dentro de la ventana | 0 |
| ADIC · horas adicionales | T − ORD | T |
| DEF · tiempo a recuperar | V − ORD | 0 |
| **Saldo del día** | ADIC − DEF | ADIC |

V es la parte de la ventana que se exige: las 8 horas completas en un día cerrado (§6.3). Llegar tarde o salir antes sin pulsar «Gestión particular» genera tiempo a recuperar igual que una gestión.

### 6.3 Qué días entran en el saldo

| Estado del día | Cuándo | Qué aporta |
|---|---|---|
| CERRADO | Tiene fichajes y ninguna sesión abierta lo toca | Cálculo completo, con V = 8 h |
| EN CURSO | Lo toca la sesión abierta en curso | Cálculo **hasta el último fichaje**: solo tramos ya cerrados, y V = tiempo de ventana transcurrido entre las 09:00 y el último fichaje (0 si es anterior a las 09:00; 8 h como máximo) |
| PENDIENTE | Tiene movimientos de una sesión dejada pendiente por olvido (§7) | 0, con aviso |
| SIN FICHAJES | No tiene fichajes | 0. Si es LABORABLE y ya ha pasado: aviso (§7.3). Si está marcado A CUENTA DEL SALDO: DEF = 8 h |

Una sesión en curso toca todos los días desde el de su ENTRADA hasta hoy. Así el saldo cambia de inmediato con cada fichaje y nunca depende de horas supuestas.

### 6.4 Totales (desde la fecha de inicio; no se reinician ni por mes ni por año)

- ADIC_TOTAL = suma de ADIC · DEF_TOTAL = suma de DEF
- **Tiempo recuperado** = el menor de ADIC_TOTAL y DEF_TOTAL
- **Tiempo pendiente de recuperar** = DEF_TOTAL − recuperado
- Tiempo a favor = ADIC_TOTAL − recuperado
- **Saldo neto** = ADIC_TOTAL − DEF_TOTAL

Desglose que ve el usuario: horas adicionales realizadas (ADIC_TOTAL), tiempo pendiente de recuperar, tiempo recuperado y saldo neto.

### 6.5 Ejemplos del usuario (deben cumplirse exactamente)

1. Jornada 09:00-17:00 con gestión de 10:00 a 11:00 → 1 h pendiente de recuperar, saldo −1 h.
2. Al día siguiente, 09:00-18:00 → se recupera la hora pendiente, saldo 0.
3. 1 h pendiente y después 2 h adicionales → 1 h recuperada, 1 h a favor, saldo +1 h.
4. Sábado de 09:00 a 13:00 → +4 h.
5. Festivo de 09:00 a 12:00 → +3 h.

### 6.6 Propiedades que deben probarse

- Saldo neto = suma de los saldos diarios = tiempo a favor − tiempo pendiente (y uno de estos dos últimos es siempre 0).
- Recalcular dos veces da lo mismo. Añadir un movimiento y borrarlo devuelve el resultado anterior.
- La suma de las partes de un tramo partido por la medianoche es igual a su duración real.
- Editar un movimiento antiguo recalcula todos los días afectados.

## 7. Olvidos y días sin fichajes

**7.1 Detección.** Al abrir la app y antes de aceptar cualquier fichaje, si hay una sesión abierta cuya ENTRADA es de un día anterior a hoy, se muestra «Tienes una jornada abierta desde el DD/MM/AAAA a las HH:MM» con tres opciones:
- **Sigo trabajando** → la sesión sigue en curso (jornada que cruza la medianoche).
- **Indicar la hora ahora** → el usuario escribe la hora que falta; el registro queda marcado como manual.
- **Dejar pendiente** → la sesión queda PENDIENTE, se permite una nueva ENTRADA y el aviso permanece hasta completarla.

Mientras el usuario no responde, la sesión se trata como PENDIENTE.

**7.2 Nunca se inventa una hora.** La app no rellena ni propone horas por su cuenta.

**7.3 Día laborable pasado sin fichajes.** No descuenta nada por sí solo. Se marca «sin fichajes» y el usuario elige: añadir los fichajes · vacaciones · asunto propio · ausencia sin descuento · a cuenta del saldo (−8 h).

**7.4 Días anteriores a la fecha de inicio.** No computan. Se puede fichar para probar; esos movimientos se muestran como «prueba · no computa» y en Configuración hay una opción para eliminarlos todos, con confirmación.

**7.5 Aviso junto al saldo.** Si hay días PENDIENTES o sin fichajes por revisar: «Saldo sin contar N día(s) por revisar», con acceso directo a ellos.

**7.6 Registros manuales.** Todo movimiento añadido o modificado a mano se identifica como tal en todas las pantallas y en el Excel, y conserva la fecha de modificación y el valor original.

## 8. Vacaciones (módulo independiente)

Se cuentan en **días laborables**: nunca descuentan sábados, domingos ni festivos. Cada año natural es un ejercicio.

Para cada año A:
- `díasAnuales[A]`: días laborables de vacaciones reconocidos, configurable.
- `díasDeAlta[A]`: días naturales del año a partir de la fecha de incorporación. En 2026, del 16/11 al 31/12 = **46**. Desde 2027, el año completo.
- **Derecho del año** = díasAnuales × díasDeAlta ÷ días del año (365 o 366) + ajuste manual.
- **Generadas** (a hoy) = díasAnuales × días naturales de alta transcurridos hasta hoy, incluido ÷ días del año + ajuste manual.
- **Disfrutadas** = días marcados como vacaciones con fecha de hoy o anterior. **Planificadas** = con fecha futura.
- **Pendientes** = generadas − disfrutadas.
- Previsión a 31/12 = derecho del año − disfrutadas − planificadas.

Reglas:
- Sin redondeos automáticos; mostrar con dos decimales.
- `ajuste manual` (días en más o en menos, con nota) permite corregir el saldo inicial, un redondeo o días arrastrados de otro año.
- Se registran vacaciones pasadas y futuras, por día o por rango. En un rango, sábados, domingos y festivos se excluyen solos y se muestra «N días laborables». Un rango que cruza de año imputa cada día a su año.
- Si después cambia un festivo, los días de vacaciones se recalculan.

## 9. Asuntos propios (contador independiente)

- Cantidad anual configurable por año; se pide en el primer arranque y puede ser 0. No se prorratea automáticamente.
- Permite registrar días disfrutados, ver los disponibles (cantidad anual + ajuste − disfrutados − planificados), modificar el saldo con un ajuste manual y consultar el histórico por año.
- Nunca se mezcla con vacaciones: un día no puede ser las dos cosas.

## 10. Pantallas

Barra inferior fija con cinco apartados. Sin menús anidados.

**1 · INICIO.** Fecha actual, hora actual, estado de la jornada, hora de entrada, tiempo trabajado hoy (en vivo, incluye el tramo abierto; solo informativo) y **SALDO ACTUAL** en grande, con signo y color (verde a favor, rojo en contra). Los cuatro botones de fichaje ocupan aproximadamente la mitad inferior, cada uno con su color y su texto. Aquí aparecen los avisos (olvidos, días por revisar, copia pendiente).

**2 · CONTROL HORARIO.** Histórico con una fila por día: fecha, día de la semana, entrada, salida, gestiones particulares, tiempo trabajado, horas ordinarias, horas adicionales y saldo diario. Consulta por fecha y filtros por mes y por año. Al tocar un día se abren sus movimientos, donde se puede editar, añadir fichajes olvidados y eliminar con confirmación. La edición se hace por día y se valida el conjunto al guardar: secuencia correcta, orden cronológico, sin solapes y sin horas futuras. Si no es válida, se explica qué falta y no se guarda. Con varias sesiones en un día: entrada = la primera, salida = la última. Una sesión que cruza la medianoche se muestra en su día de entrada con «(+1)» en la salida.

**3 · CALENDARIO.** Vista mensual (por defecto) y anual. Colores con leyenda, más una letra o icono para no depender solo del color: trabajado, vacaciones, asunto propio, festivo, fin de semana, ausencia (sin descuento o a cuenta del saldo), y marca de aviso en días pendientes o sin fichajes. Al tocar un día: fichajes, horas trabajadas, horas adicionales, gestiones particulares, saldo generado y observaciones (texto libre). Desde ahí se marca o desmarca el día como vacaciones, asunto propio, ausencia sin descuento o a cuenta del saldo.

**4 · RESUMEN.** Desglose del saldo (§6.4), resumen por meses, vacaciones (generadas, disfrutadas, pendientes y previsión), asuntos propios y el botón **EXPORTAR A EXCEL**.

**5 · CONFIGURACIÓN Y COPIAS.** Horario y fecha de inicio, días anuales y ajustes por año, festivos, copias de seguridad (§12), estado del almacenamiento y versión de la app.

**Primer arranque.** Un asistente breve pide los días anuales de vacaciones y de asuntos propios, muestra el horario y los festivos precargados para revisarlos, y pide confirmar los festivos locales «sin confirmar».

## 11. Exportación a Excel

- El botón genera en el propio teléfono `control-horario_AAAA-MM-DD.xlsx`, con una librería empaquetada.
- Hojas, con estos nombres exactos:
  1. **HISTÓRICO DIARIO** — fecha, día de la semana, tipo de día, entrada, salida, gestiones particulares, tiempo trabajado, horas ordinarias, horas adicionales, tiempo a recuperar, saldo diario, saldo acumulado, estado y observaciones.
  2. **MOVIMIENTOS DE FICHAJE** — fecha, hora, tipo, origen (botón o manual), modificado, fecha de modificación y valor original.
  3. **RESUMEN MENSUAL** — año, mes, días trabajados, tiempo trabajado, horas ordinarias, horas adicionales, tiempo a recuperar, saldo del mes y saldo acumulado a fin de mes.
  4. **VACACIONES Y ASUNTOS PROPIOS** — resumen por año de ambos contadores y listado de días.
  5. **SALDO ACUMULADO** — desglose actual y evolución día a día.
- Fechas como fecha real de Excel con formato DD/MM/AAAA. Cada duración en dos columnas: texto `±HH:MM` y horas decimales. No uses el formato de hora de Excel para duraciones con signo: Excel no muestra horas negativas.
- Guardar y compartir: si el navegador lo permite (`navigator.canShare` con archivos), abre el menú de compartir de Android; ofrece siempre además «Descargar».

## 12. Copias de seguridad

Motivo del diseño: un navegador no garantiza tareas en segundo plano. La sincronización periódica exige app instalada y su frecuencia no está garantizada (https://developer.chrome.com/docs/capabilities/periodic-background-sync). Por eso la copia semanal se crea al abrir la app, y sacarla fuera de la app es una acción del usuario (compartir o descargar).

- **Contenido** (un archivo JSON `control-horario_copia_AAAA-MM-DD_HHMM.json`): versión del formato, fecha, todos los movimientos con sus marcas de modificación manual y valores originales, días marcados (vacaciones, asuntos propios, ausencias) y observaciones, calendario de festivos, configuración completa, un resumen calculado del histórico de horas (para comprobar la restauración) y una suma de comprobación.
- **Copia semanal automática**: al abrir la app o volver a primer plano, si han pasado 7 días o más desde la última, se crea sola una copia interna y aparece un aviso fijo: «Copia semanal creada. Guárdala fuera de la app», con el botón **GUARDAR COPIA** (compartir o descargar). El aviso no desaparece hasta que el usuario la guarda o lo pospone expresamente.
- **Copia manual**: botón «Crear copia ahora».
- Mostrar siempre la fecha de la última copia automática y la de la última copia guardada fuera.
- **Restaurar**, desde una copia interna o desde un archivo: validar formato y suma de comprobación → mostrar resumen (periodo, número de movimientos, saldo) → pedir confirmación → guardar antes una copia del estado actual → restaurar → recalcular y comparar con el resumen de la copia.
- **No se borra ninguna copia automáticamente.** Lista con fecha y tamaño; borrado solo manual y con confirmación. Si falta espacio, se avisa y se pide autorización.
- Texto fijo en esta pantalla: las copias internas se pierden si se borran los datos del navegador o se desinstala la app; la que protege es la guardada fuera (Drive, correo, Descargas).

## 13. Fiabilidad

- Cada fichaje se guarda en una transacción y solo entonces se confirma en pantalla. Cerrar, recargar o actualizar la app no pierde nada.
- En cada arranque se llama a `navigator.storage.persist()` y Configuración muestra «Almacenamiento protegido: sí / no». Chrome lo concede solo, según el uso y si la app está instalada; sin él, el navegador puede eliminar los datos si falta espacio (https://web.dev/articles/persistent-storage).
- Actualizaciones: service worker versionado, aviso «Hay una versión nueva · Actualizar», migraciones de datos versionadas y probadas, copia interna automática antes de migrar. Una actualización nunca borra datos.
- Todo borrado pide confirmación.
- Coherencia: los cálculos salen siempre del histórico completo; ninguna pantalla guarda cifras propias.

## 14. Pruebas obligatorias

Abreviaturas: E = entrada, S = salida, G = gestión particular, R = regreso. Horario 09:00-17:00. Los números 1 a 16 son los escenarios obligatorios del usuario (el 15 y el 16 están en §14.2); del 17 en adelante son casos añadidos.

### 14.1 Motor (pruebas unitarias con estos valores exactos)

| N.º | Escenario | Fichajes | Resultado esperado |
|---|---|---|---|
| 1 | Jornada normal | lun 16/11/2026: E 09:00, S 17:00 | T 08:00 · ORD 08:00 · ADIC 00:00 · DEF 00:00 · saldo del día 00 h 00 min |
| 2 | Trabajo de 08:00 a 18:00 | mar 17/11/2026: E 08:00, S 18:00 | T 10:00 · ORD 08:00 · ADIC 02:00 · saldo del día +02 h 00 min |
| 3 | Gestión de una hora | mié 18/11/2026: E 09:00, G 10:00, R 11:00, S 17:00 | T 07:00 · DEF 01:00 · saldo del día -01 h 00 min |
| 4 | Recuperación de la hora | n.º 3 + jue 19/11/2026: E 09:00, S 18:00 | Día +01 h 00 min. Conjunto: recuperado 01:00, pendiente 00:00, saldo 00 h 00 min |
| 5 | Recuperación parcial | lun 23/11/2026: E 09:00, G 10:00, R 11:00, S 17:00 · mar 24/11/2026: E 09:00, S 17:30 | Conjunto: recuperado 00:30, pendiente 00:30, saldo -00 h 30 min |
| 6 | Sábado | sáb 21/11/2026: E 09:00, S 13:00 | +04 h 00 min |
| 7 | Domingo | dom 22/11/2026: E 10:00, S 12:30 | +02 h 30 min |
| 8 | Festivo | mar 08/12/2026: E 09:00, S 12:00 | +03 h 00 min |
| 9 | Dos gestiones el mismo día | mié 25/11/2026: E 09:00, G 10:00, R 10:30, G 12:00, R 12:45, S 17:00 | T 06:45 · DEF 01:15 · saldo del día -01 h 15 min |
| 10 | Olvido de fichaje | jue 26/11/2026: E 09:00, sin salida; se evalúa el vie 27/11 | Día PENDIENTE, aporta 0, aviso, ninguna hora inventada. Tras añadir a mano S 17:00: saldo del día 00 h 00 min y registro marcado como manual |
| 11 | Modificación manual | vie 27/11/2026: E 09:00, S 17:00; se edita S a 18:30 | El saldo del día pasa de 00 h 00 min a +01 h 30 min; queda marcado y conserva el valor original |
| 12 | Cambio de mes | lun 30/11/2026: E 09:00, S 17:00, E 22:00 · mar 01/12/2026: S 02:00, E 09:00, S 18:00 | 30/11: +02 h 00 min (noviembre) · 01/12: +03 h 00 min (diciembre) · el acumulado continúa |
| 13 | Cambio de año | jue 31/12/2026: E 09:00, S 17:00, E 22:00 · vie 01/01/2027: S 01:00 | 31/12: +02 h 00 min (2026) · 01/01, festivo: +01 h 00 min (2027) · el saldo no se reinicia; las vacaciones abren ejercicio 2027 |
| 14 | Registro de vacaciones | Rango 07/12-11/12/2026 · rango 24/12/2026-04/01/2027 | 3 días (9, 10 y 11; el 7 y el 8 son festivos) · 5 días en 2026 (24, 28, 29, 30 y 31) y 1 en 2027 (04/01). Prorrata de 2026 con 22 días anuales, valor solo de prueba: 22 × 46 ÷ 365 = 2,77 |
| 17 | Cruce de medianoche | vie 20/11/2026: E 09:00, S 17:00, E 22:00 · sáb 21/11/2026: S 02:00 | Viernes +02 h 00 min · sábado +02 h 00 min |
| 18 | Cambio de hora | sáb 27/03/2027 E 22:00 → dom 28/03/2027 S 06:00 · sáb 30/10/2027 E 22:00 → dom 31/10/2027 S 06:00 | 07 h 00 min reales (2 + 5) · 09 h 00 min reales (2 + 7) |
| 19 | Llegada tarde | mié 02/12/2026: E 09:20, S 17:00 | -00 h 20 min |
| 20 | Saldo tras cada fichaje | jue 03/12/2026: E 09:00 → G 10:00 → R 11:00 → S 18:00 | Saldo del día tras cada fichaje: 00:00 → 00:00 → -01:00 → 00:00 |
| 21 | Día laborable sin fichajes | jue 10/12/2026, sin fichajes, ya pasado | Aporta 0 y avisa. Marcado «a cuenta del saldo»: -08 h 00 min |
| 22 | Salida sin regreso | vie 11/12/2026: E 09:00, G 15:00, S 15:40 | T 06:00 · DEF 02:00 · saldo del día -02 h 00 min |
| 23 | Trabajo en día de vacaciones | lun 14/12/2026 marcado vacaciones: E 10:00, S 12:00 | +02 h 00 min, sin tiempo a recuperar |
| 24 | Secuencias inválidas | Dos E seguidas · R sin G previa | Rechazadas con mensaje claro |

Añade además los cinco ejemplos de §6.5 y las propiedades de §6.6.

### 14.2 Extremo a extremo (Playwright, tamaño móvil, reloj simulado)

- Flujo completo de los cuatro botones con confirmación visual y saldo actualizado.
- Los datos siguen ahí tras recargar y tras cerrar y volver a abrir.
- **Sin conexión**: cortar la red tras la primera carga, repetir el flujo y comprobar que no hay ninguna petición de red.
- **15 · Exportación completa a Excel**: descargar el archivo, abrirlo en la prueba y comparar las cinco hojas con los valores del motor.
- **16 · Copia de seguridad y restauración**: crear copia, borrar todos los datos, restaurar y comprobar datos idénticos y el mismo saldo.
- Aviso de copia semanal al avanzar el reloj 7 días.
- Aviso de olvido al avanzar el reloj al día siguiente con una sesión abierta.
- Edición, alta y borrado de registros desde el histórico, con recálculo.

Si no puedes ejecutar Playwright en tu entorno, déjalo corriendo en GitHub Actions y revisa el resultado; si tampoco puedes verlo, dilo claramente.

### 14.3 Documentación

`docs/PRUEBAS.md`: una tabla con escenario, resultado esperado, resultado obtenido, correcto o no, y cómo se comprobó (unitaria, extremo a extremo o manual).

## 15. Fases

1. **Motor** y sus pruebas unitarias. No sigas si falla alguna.
2. **Datos**: IndexedDB, máquina de estados de fichajes, validaciones de edición y migraciones.
3. **Interfaz**: las cinco pantallas y el asistente de primer arranque.
4. **Excel y copias de seguridad.**
5. **PWA**: manifiesto, iconos, service worker, funcionamiento sin conexión y aviso de versión nueva.
6. **Pruebas de extremo a extremo** y `docs/PRUEBAS.md`.
7. **Publicación**: GitHub Actions que ejecuta las pruebas y solo despliega en GitHub Pages si pasan. Después, `docs/GUIA_USUARIO.md` (dos páginas como máximo: instalar, fichar, corregir un fichaje, vacaciones, copias y qué hacer al cambiar de móvil).

## 16. Entrega

La aplicación no está terminada hasta cumplir todo esto:

- Instalación y funcionamiento en el Samsung A17.
- Funcionamiento sin conexión.
- Fichajes correctos y cálculo correcto del saldo.
- Control de vacaciones y control de asuntos propios.
- Histórico consultable y editable.
- Exportación a Excel funcional.
- Copia de seguridad y restauración probadas.
- Interfaz sencilla y completamente en español.

Tu mensaje final debe incluir:

1. **Pasos para publicar**, con los clics exactos: fusionar los cambios en la rama principal, activar GitHub Pages con origen «GitHub Actions» y la dirección final de la app (comprueba que responde por HTTPS).
2. **Pasos para instalar** en el Samsung: abrir la dirección en Chrome, instalar la aplicación y usarla siempre desde el icono instalado. Advierte que los datos viven en ese navegador y que no debe cambiarse la dirección de la app una vez instalada (antes, copia de seguridad).
3. **Tabla de pruebas** con lo que ha pasado y lo que no.
4. **Lista de comprobación en el móvil real**, que tú no puedes verificar: instalar, abrir en modo avión, fichar con los cuatro botones, exportar a Excel y abrir el archivo, guardar una copia por compartir y por descarga, restaurarla, cerrar y reabrir, y leer todo sin zoom.
5. **Limitaciones conocidas**, sin adornos.

## Anexo · Decisiones añadidas a la especificación original del usuario

Están ya integradas arriba. Se listan para que el usuario pueda revisarlas y cambiarlas:

1. Llegar tarde o salir antes sin pulsar «Gestión particular» también genera tiempo a recuperar (§6.2).
2. Día laborable sin fichajes: avisa y decide el usuario, sin descuento automático (§7.3). *Confirmado por el usuario.*
3. El saldo cambia tras cada fichaje, calculando el día en curso hasta el último fichaje (§6.3). *Confirmado por el usuario.*
4. Se permite SALIDA estando en gestión, con confirmación (§5).
5. Olvido = sesión abierta de un día anterior; tres opciones; lo pendiente no computa (§7.1).
6. Los tramos que cruzan la medianoche se reparten por día natural (§6.1).
7. Trabajar en un día marcado como vacaciones, asunto propio o ausencia cuenta todo a favor (§6.1).
8. Vacaciones: devengo por días naturales de alta, sin redondeo, con ajuste manual por año; pendientes = generadas − disfrutadas (§8).
9. Asuntos propios sin prorrateo automático (§9).
10. Los cambios de horario llevan fecha de vigencia (§3).
11. Los fichajes anteriores a la fecha de inicio son de prueba y no computan (§7.4).
12. Festivos locales de 2027 cargados como «sin confirmar» (§4).
