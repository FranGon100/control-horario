// Servidor estático mínimo que sirve dist/ bajo /control-horario/ (como GitHub Pages).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const RAIZ = new URL('../../dist/', import.meta.url).pathname;
const BASE = '/control-horario/';
const PUERTO = Number(process.env.PUERTO ?? 4173);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(BASE)) { res.writeHead(302, { Location: BASE }); res.end(); return; }
  let rel = decodeURIComponent(url.pathname.slice(BASE.length));
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  rel = normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const ruta = join(RAIZ, rel);
  try {
    if (!(await stat(ruta)).isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(ruta));
  } catch {
    res.writeHead(404); res.end('No encontrado');
  }
}).listen(PUERTO, () => console.log(`Sirviendo en http://localhost:${PUERTO}${BASE}`));
