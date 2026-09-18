// Sert public/ et relaie la scène en WebSocket entre l'écran et la télécommande.
//   PORT        port d'écoute (défaut 3000)
//   REMOTE_KEY  si défini, seuls les clients connectés avec ?key=<REMOTE_KEY> peuvent envoyer
//   VIDEOS_URL  si défini, les vidéos viennent d'un bucket S3 public (MinIO) à cette URL
//               au lieu de public/videos ; le bucket doit autoriser GetObject et ListBucket anonymes

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3000;
const KEY = process.env.REMOTE_KEY || '';
const VIDEOS_URL = (process.env.VIDEOS_URL || '').replace(/\/$/, '');
const ROOT = fileURLToPath(new URL('./public/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
const ROUTES = { '/': '/index.html', '/remote': '/remote.html' };

const http = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/videos') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
    return res.end(JSON.stringify(await listVideos()));
  }
  path = ROUTES[path] || path;
  const file = join(ROOT, normalize(path));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  const type = MIME[extname(file)] || 'application/octet-stream';
  try {
    if (type === 'video/mp4') return await streamVideo(req, res, file);
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('404');
  }
});

// { base, files } : d'où charger les vidéos et lesquelles. Bucket S3 public si VIDEOS_URL, sinon public/videos.
async function listVideos() {
  let files;
  if (VIDEOS_URL) {
    const xml = await fetch(VIDEOS_URL + '/?list-type=2').then((r) => r.text()).catch(() => '');
    files = [...xml.matchAll(/<Key>([^<]+\.mp4)<\/Key>/g)].map((m) => decodeURIComponent(m[1].replace(/&amp;/g, '&')));
  } else {
    files = (await readdir(join(ROOT, 'videos')).catch(() => [])).filter((f) => f.endsWith('.mp4'));
  }
  return { base: VIDEOS_URL ? VIDEOS_URL + '/' : 'videos/', files: files.sort() };
}

// Les vidéos sont servies par morceaux (Range), sinon le navigateur ne peut ni chercher ni boucler proprement.
async function streamVideo(req, res, file) {
  const size = (await stat(file)).size;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  const start = m && m[1] ? +m[1] : 0, end = m && m[2] ? Math.min(+m[2], size - 1) : size - 1;
  if (start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end(); }
  res.writeHead(m ? 206 : 200, {
    'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': end - start + 1,
    ...(m && { 'content-range': `bytes ${start}-${end}/${size}` }),
  });
  createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
}

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
