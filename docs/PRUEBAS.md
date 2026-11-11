# Pruebas

Ejecutadas el 11/11/2026: `npm test` → **65/65 correctas** (Vitest) · `npm run e2e` → **8/8 correctas** (Playwright, Chromium emulando Pixel 7, zona Europe/Madrid, reloj simulado). Las pruebas unitarias también pasan con el dispositivo en otras zonas horarias (`TZ=America/New_York` y `TZ=Asia/Tokyo`). GitHub Actions las repite antes de cada publicación.

Archivos: `tests/unit/motor.test.ts`, `tests/unit/tiempo.test.ts`, `tests/unit/datos.test.ts`, `tests/e2e/app.spec.ts`.

| N.º | Escenario | Resultado esperado | Resultado obtenido | ¿Correcto? | Cómo |
|---|---|---|---|---|---|
| 1 | Jornada normal | T 08:00, ORD 08:00, ADIC 0, DEF 0, saldo 00 h 00 min | Igual | Sí | Unitaria |
| 2 | 08:00-18:00 | T 10:00, ORD 08:00, ADIC 02:00, +02 h 00 min | Igual | Sí | Unitaria |
| 3 | Gestión de una hora | T 07:00, DEF 01:00, -01 h 00 min | Igual | Sí | Unitaria + extremo a extremo |
| 4 | Recuperación de la hora | Día +01 h 00 min; recuperado 01:00, pendiente 0, saldo 00 h 00 min | Igual | Sí | Unitaria |
| 5 | Recuperación parcial | Recuperado 00:30, pendiente 00:30, saldo -00 h 30 min | Igual | Sí | Unitaria |
| 6 | Sábado | +04 h 00 min | Igual | Sí | Unitaria |
| 7 | Domingo | +02 h 30 min | Igual | Sí | Unitaria |
| 8 | Festivo 08/12/2026 | +03 h 00 min | Igual | Sí | Unitaria |
| 9 | Dos gestiones | T 06:45, DEF 01:15, -01 h 15 min | Igual | Sí | Unitaria |
| 10 | Olvido de fichaje | PENDIENTE, aporta 0, aviso, sin horas inventadas; tras S 17:00 manual: 00 h 00 min y marcado manual | Igual | Sí | Unitaria + datos + extremo a extremo |
| 11 | Modificación manual | 00 h 00 min → +01 h 30 min, marcado y valor original conservado | Igual | Sí | Datos + extremo a extremo |
| 12 | Cambio de mes | 30/11 +02 h 00 min; 01/12 +03 h 00 min; acumulado continúa | Igual | Sí | Unitaria |
| 13 | Cambio de año | 31/12 +02 h 00 min; 01/01 festivo +01 h 00 min; sin reinicio; ejercicio 2027 abierto | Igual | Sí | Unitaria |
| 14 | Vacaciones por rango | 3 días; 5 en 2026 y 1 en 2027; 22 × 46 ÷ 365 = 2,77 | Igual | Sí | Unitaria + datos + extremo a extremo |
| 15 | Exportación a Excel | 5 hojas con los nombres exactos y valores iguales al motor | Igual (se compara fila a fila) | Sí | Extremo a extremo |
| 16 | Copia y restauración | Datos idénticos y mismo saldo tras borrar todo y restaurar | Igual | Sí | Datos + extremo a extremo |
| 17 | Cruce de medianoche | Viernes +02 h 00 min; sábado +02 h 00 min | Igual | Sí | Unitaria + datos |
| 18 | Cambio de hora | Marzo 07 h 00 min (2 + 5); octubre 09 h 00 min (2 + 7) | Igual | Sí | Unitaria |
| 19 | Llegada tarde | -00 h 20 min | Igual | Sí | Unitaria |
| 20 | Saldo tras cada fichaje | 00:00 → 00:00 → -01:00 → 00:00 | Igual | Sí | Unitaria + extremo a extremo |
| 21 | Laborable sin fichajes | Aporta 0 y avisa; «a cuenta del saldo» -08 h 00 min | Igual | Sí | Unitaria |
| 22 | Salida sin regreso | T 06:00, DEF 02:00, -02 h 00 min | Igual | Sí | Unitaria |
| 23 | Trabajo en vacaciones | +02 h 00 min, sin tiempo a recuperar | Igual | Sí | Unitaria |
| 24 | Secuencias inválidas | Dos E seguidas y R sin G rechazadas con mensaje claro | Igual | Sí | Unitaria + datos |
| §6.5 | Cinco ejemplos del usuario | -1 h; 0; +1 h (1 h recuperada, 1 h a favor); +4 h; +3 h | Igual | Sí | Unitaria |
| §6.6 | Propiedades | Saldo = suma diaria = a favor − pendiente (uno es 0); recalcular estable; añadir y borrar = igual; medianoche suma exacta; editar recalcula días afectados | Igual (5 historiales aleatorios + casos fijos) | Sí | Unitaria |
| — | Cuatro botones | Confirmación visual, cambio de estado, saldo actualizado, confirmación al salir en gestión, botón inactivo explica por qué | Igual | Sí | Extremo a extremo |
| — | Persistencia | Datos tras recargar y tras cerrar y abrir | Igual | Sí | Extremo a extremo |
| — | Sin conexión | Tras la primera carga funciona sin red y no hace ninguna petición | 0 peticiones durante el uso; recarga servida por el service worker | Sí | Extremo a extremo |
| — | Copia semanal | Aviso al llegar a 7 días, no antes | Igual | Sí | Datos + extremo a extremo |
| — | Aviso de olvido | Al día siguiente con sesión abierta | Igual | Sí | Extremo a extremo |
| — | Histórico | Editar, añadir y borrar con recálculo; edición inválida no se guarda | Igual | Sí | Datos + extremo a extremo |
| — | Migraciones | Copia interna antes de migrar; migraciones en orden; error si falta una | Igual | Sí | Datos |
| — | Copias dañadas | Rechazo por suma de comprobación o formato | Igual | Sí | Datos |
| — | Pantalla 360 px | Sin desplazamiento horizontal; 4 botones visibles | Igual | Sí | Extremo a extremo |
| — | Aviso «Hay una versión nueva» | Aparece al publicar una versión nueva | No probado automáticamente | — | Pendiente en el móvil |
| — | Instalación, modo avión, compartir de Android, abrir el Excel en el móvil | — | No se puede probar aquí | — | Pendiente en el móvil |
