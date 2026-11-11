# control-horario

Aplicación personal de control horario y vacaciones (PWA para Android), 100 % estática y sin conexión.

- Uso: [docs/GUIA_USUARIO.md](docs/GUIA_USUARIO.md)
- Especificación: [docs/ESPECIFICACION.md](docs/ESPECIFICACION.md)
- Pruebas: [docs/PRUEBAS.md](docs/PRUEBAS.md)

Desarrollo (Node 22):

```bash
npm ci
npm test        # motor y datos (Vitest)
npm run e2e     # compila y prueba en navegador móvil (Playwright)
```

Se publica en GitHub Pages con GitHub Actions solo si pasan todas las pruebas.
