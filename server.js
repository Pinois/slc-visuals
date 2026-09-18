// Sert public/ et relaie la scène en WebSocket entre l'écran et la télécommande.
//   PORT        port d'écoute (défaut 3000)
//   REMOTE_KEY  si défini, seuls les clients connectés avec ?key=<REMOTE_KEY> peuvent envoyer

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3000;
const KEY = process.env.REMOTE_KEY || '';
const ROOT = fileURLToPath(new URL('./public/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const ROUTES = { '/': '/index.html', '/remote': '/remote.html' };

const http = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  path = ROUTES[path] || path;
  const file = join(ROOT, normalize(path));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('404');
  }
});

// ponytail: une seule scène globale en mémoire, un seul écran. Passer à des "rooms" si plusieurs écrans indépendants.
let last = null;
const wss = new WebSocketServer({ server: http, path: '/ws' });
wss.on('connection', (ws, req) => {
  const canSend = !KEY || new URL(req.url, 'http://x').searchParams.get('key') === KEY;
  if (last) ws.send(last);
  ws.on('message', (msg) => {
    if (!canSend || msg.length > 4096) return;
    last = msg.toString();
    for (const c of wss.clients) if (c !== ws && c.readyState === c.OPEN) c.send(last);
  });
});

http.listen(PORT, () => console.log(`SLC visuels : http://localhost:${PORT}  télécommande : http://localhost:${PORT}/remote${KEY ? '?key=' + KEY : ''}`));
