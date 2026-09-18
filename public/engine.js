// Rendu canvas 2D du logo SLC. Reçoit une scène (voir scene.js), dessine en boucle.
// Un rendu three.js pourra remplacer ce fichier en gardant la même interface :
//   const engine = await createEngine(canvas); engine.setScene(scene); engine.scene

import { normalizeScene, chainBars, colorBars, SALUTS, themeFiles } from './scene.js';

const GLOW = 1;          // intensité globale des halos
const PARTICLES = 450;   // poussière de l'éclatement
const BG = '#050505', INK = '#E7E7E7', DISC = '#2B2B2B';
const RING = 0.96;        // l'anneau du logo en contour, un peu plus serré que dans le SVG
const CAP = 46.5;         // hauteur des lettres du logo dans le repère 174, le texte DJ s'y aligne
const FONT_PX = CAP / 0.727; // Inter : hauteur de capitale = 0,727 em

const rand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ss = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const heart = (p) => { const g = (c, w) => Math.exp(-Math.pow((p - c) / w, 2)); return Math.min(1, g(0.18, 0.055) + 0.55 * g(0.36, 0.045)); };
const envBurst = (p, mode) => {
  if (mode === 'brutal') return p < 0.07 ? ss(p, 0, 0.07) : 1 - ss(p, 0.07, 0.82);
  return p < 0.64 ? ss(p, 0.02, 0.64) : 1 - ss(p, 0.64, 0.73);
};

// Lit les tracés des lettres dans logo.svg et en tire ce dont le rendu a besoin :
// Path2D, centre de chaque lettre, et points sur le contour pour la poussière.
async function loadLogo() {
  const svgText = await (await fetch('logo.svg')).text();
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const ds = [...doc.querySelectorAll('path')].map((p) => p.getAttribute('d'));
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 174 174');
  svg.style.cssText = 'position:absolute;width:174px;height:174px;left:-9999px;top:0';
  document.body.appendChild(svg);
  const els = ds.map((d) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.appendChild(p); return p; });
  const centers = els.map((p) => { const b = p.getBBox(); return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 }; });
  const lens = els.map((p) => p.getTotalLength()), tot = lens.reduce((a, b) => a + b, 0);
  const pts = []; let seed = 0;
  els.forEach((p, pi) => {
    const n = Math.max(24, Math.round(PARTICLES * lens[pi] / tot));
    for (let j = 0; j < n; j++) {
      const pt = p.getPointAtLength(lens[pi] * j / n);
      const rr = (k) => rand(seed * 13.7 + k);
      pts.push({ x: pt.x, y: pt.y, ang: rr(1) * Math.PI * 2, mag: 16 + rr(2) * 72, spin: (rr(3) - 0.5) * 3, exp: 1 + rr(4) * 1.4 });
      seed++;
    }
  });
  svg.remove();
  return { paths: ds.map((d) => new Path2D(d)), centers, pts };
}

// videos : fichiers disponibles (pour l'enchaînement), videoBase : où les charger.
// onChange : appelé quand le moteur change la scène lui-même.
export async function createEngine(canvas, { videos = [], videoBase = 'videos/', onChange = () => {} } = {}) {
  const logo = await loadLogo();
  // même police que le logo pour les noms de DJ, embarquée pour marcher hors ligne
  await new FontFace('Inter', 'url(inter-italic.woff2)', { style: 'italic', weight: '600' }).load().then((f) => document.fonts.add(f)).catch(() => {});
  let scene = normalizeScene(null);
  // tA compte en temps musicaux (4 temps par mesure). Les périodes ci-dessous sont en temps.
  let tA = 0, last = performance.now(), eB = 0;
  const T = { resp: 8, coeur: 1, burst: 16, liqMa: 16, rafales: 32, continu: 4 };
  let W, H, cx, cy, R, cv, x;

  // temps où tombent les rafales de glitch, sur un cycle de 8 mesures
  const bursts = []; for (let t = 4, k = 0; t < T.rafales - 2; k++) { bursts.push(t); t += 4 + Math.round(rand(k * 3.7 + 11) * 4); }
  // déplacements aléatoires des 36 morceaux de l'éclatement "découpes"
  const chunkR = []; for (let i = 0; i < 36; i++) chunkR.push({ ax: (rand(i * 5.1 + 1) - 0.5) * 2, ay: (rand(i * 5.1 + 2) - 0.5) * 2, rot: (rand(i * 5.1 + 3) - 0.5) * 0.9, m: 0.4 + rand(i * 5.1 + 4) * 0.6 });

  const ph = (per) => (((tA % per) + per) % per) / per;

  // vidéo de fond : un <video> muet en boucle, dessiné sous le logo en remplissant l'écran
  const vid = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' });
  let vidFile = '';
  function syncVideo(s) {
    const v = s.L.video, file = v.on ? v.opt : '';
    if (file !== vidFile) { vidFile = file; vid.src = file ? (blobs.get(file)?.url || videoBase + encodeURIComponent(file)) : ''; }
    if (file && !s.paused) vid.play().catch(() => {}); else vid.pause();
  }
  // avec l'enchaînement, chaque vidéo démarre à un endroit au hasard
  vid.onloadedmetadata = () => { if (scene.L.chain.on && vid.duration > 20) vid.currentTime = Math.random() * (vid.duration - 10); };
  // préchargement : les vidéos à venir sont téléchargées en avance, une à la fois, et gardées en mémoire
  // (jusqu'à CACHE_CAP octets, les plus anciennes partent). Une vidéo en cache démarre et se cale instantanément.
  const CACHE_CAP = 800e6;
  const blobs = new Map(); let cacheBytes = 0, loading = '';
  async function prefetch(file) {
    loading = file;
    try {
      const b = await (await fetch(videoBase + encodeURIComponent(file))).blob();
      for (const [k, v] of blobs) {
        if (cacheBytes + b.size <= CACHE_CAP) break;
        if (k === vidFile) continue;
        URL.revokeObjectURL(v.url); cacheBytes -= v.size; blobs.delete(k);
      }
      blobs.set(file, { url: URL.createObjectURL(b), size: b.size }); cacheBytes += b.size;
    } catch { /* réseau, on réessaiera */ } finally { loading = ''; }
  }
  // la suivante à charger : d'abord ce que le tirage va donner, puis le reste du thème
  function upcoming() {
    const ch = scene.L.chain, pool = themeFiles(videos, ch.opt2);
    const order = ch.opt === 'ordre' ? pool.slice(pool.indexOf(vidFile) + 1).concat(pool) : [...bag].reverse().concat(pool);
    return order.find((f) => f !== vidFile && !blobs.has(f));
  }
  setInterval(() => {
    if (loading || !vidFile || vid.readyState < 3) return; // la lecture en cours d'abord
    const next = upcoming();
    if (next) prefetch(next);
  }, 1000);

  // tirage sans remise dans le thème choisi : toutes les vidéos passent une fois avant qu'une revienne
  let bag = [], bagTheme = '';
  function nextRandom(pool, theme) {
    if (theme !== bagTheme) { bag = []; bagTheme = theme; }
    if (!bag.length) {
      bag = pool.filter((f) => f !== vidFile);
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    }
    return bag.pop();
  }
  // enchaînement : passe à une autre vidéo sur le temps fort, toutes les N mesures
  let chainMark = -1;
  function chainTick() {
    const ch = scene.L.chain;
    const pool = themeFiles(videos, ch.opt2);
    if (!ch.on || !vidFile || pool.length < 2) { chainMark = -1; return; }
    const per = chainBars(ch.int) * 4, mark = Math.floor(tA / per);
    if (chainMark < 0) { chainMark = mark; return; }
    if (mark === chainMark) return;
    chainMark = mark;
    const file = ch.opt === 'ordre' ? pool[(pool.indexOf(vidFile) + 1) % pool.length] : nextRandom(pool, ch.opt2);
    const next = structuredClone(scene); next.L.video.opt = file;
    api.setScene(next); onChange(scene);
  }
  const DUO = { 'duo-rouge': '#FF2A55', 'duo-cyan': '#22D3EE', 'duo-ambre': '#FFB020' };
  // dessine la vidéo dans c à l'échelle s (1 = plein écran) : cadrage rempli, ou mosaïque de 2 à 8 colonnes
  function drawVideo(c, s) {
    const mo = scene.L.mosaic, cols = mo.on && mo.int > 0 ? 2 + Math.round(mo.int / 100 * 6) : 1;
    const vw = vid.videoWidth, vh = vid.videoHeight;
    if (cols === 1) {
      const sc = Math.max(W / vw, H / vh), w = vw * sc, h = vh * sc;
      c.drawImage(vid, (W - w) / 2 * s, (H - h) / 2 * s, w * s, h * s);
      return;
    }
    const tw = W * s / cols, th = tw * vh / vw, rows = Math.ceil(H * s / th), mirror = mo.opt === 'miroir';
    for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
      const fx = mirror && col % 2, fy = mirror && r % 2;
      c.save();
      c.translate(col * tw + (fx ? tw : 0), r * th + (fy ? th : 0));
      c.scale(fx ? -1 : 1, fy ? -1 : 1);
      c.drawImage(vid, 0, 0, tw, th);
      c.restore();
    }
  }
  // dessine la vidéo (cadrage rempli) dans V avec le filtre choisi, puis V dans f à l'opacité voulue
  function videoPass(f, alpha) {
    if (vid.readyState < 2 || !vid.videoWidth) return;
    const st = scene.L.vfx, fx = st.on && st.int > 0 ? st.opt : '', k = st.int / 100;
    const v = x.V; reset(v);
    if (fx === 'pixel') {
      const b = 2 + 38 * k, pw = Math.max(1, Math.round(W / b)), ph_ = Math.max(1, Math.round(H / b));
      const p = x.P; p.setTransform(1, 0, 0, 1, 0, 0); p.clearRect(0, 0, pw, ph_);
      drawVideo(p, 1 / b);
      v.imageSmoothingEnabled = false;
      v.drawImage(cv.P, 0, 0, pw, ph_, 0, 0, W, H);
      v.imageSmoothingEnabled = true;
    } else {
      v.filter = {
        nb: `grayscale(1) contrast(${(1 + 1.2 * k).toFixed(2)})`,
        flou: `blur(${(24 * k).toFixed(1)}px)`,
        negatif: `invert(${k.toFixed(2)})`,
        teinte: `hue-rotate(${Math.round(360 * ph(8))}deg) saturate(${(1 + 2 * k).toFixed(2)})`,
      }[fx] || (DUO[fx] ? 'grayscale(1)' : 'none');
      drawVideo(v, 1);
      v.filter = 'none';
      if (DUO[fx]) { v.globalCompositeOperation = 'multiply'; v.globalAlpha = k; v.fillStyle = DUO[fx]; v.fillRect(0, 0, W, H); }
    }
    f.globalAlpha = alpha;
    f.drawImage(cv.V, 0, 0);
    f.globalAlpha = 1;
  }

  function setup() {
    const sc = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = window.innerWidth * sc, h = window.innerHeight * sc;
    const mx = Math.max(w, h);
    if (mx > 1600) { const f = 1600 / mx; w *= f; h *= f; }
    W = Math.round(w); H = Math.round(h); cx = W / 2; cy = H / 2;
    canvas.width = W; canvas.height = H;
    cv = {}; x = { D: canvas.getContext('2d') };
    for (const n of ['A', 'B', 'T', 'F', 'tR', 'tC', 'V', 'P']) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      cv[n] = c; x[n] = c.getContext('2d');
    }
  }

  const reset = (c) => { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H); };

  function frame() {
    const st = scene.L;
    R = (0.183 + 0.292 * st.logo.int / 100) * Math.min(W, H); // rayon du logo, réglé par la couche Logo : 0,3 par défaut (40), 0,475 au max pour rester dans l'écran
    eB = st.burst.on && st.burst.int > 0 ? envBurst(ph(T.burst), st.burst.opt2) * (st.burst.int / 100) : 0;
    // 1. géométrie : respiration, poussière
    let src = cv.A;
    renderScene(x.A);
    // 2. passes raster sur la géométrie
    if (st.liqMa.on && st.liqMa.int > 0) { liquidPass(src, x.B, st.liqMa.int / 100); src = cv.B; }
    if (st.burst.on && st.burst.opt === 'decoupes' && eB > 0.004) { const dst = src === cv.A ? cv.B : cv.A; chunkPass(src, dst.getContext('2d')); src = dst; }
    // 3. composition : vidéo, trails, logo
    const f = x.F; reset(f);
    if (st.video.on && st.video.int > 0 && vidFile) videoPass(f, st.video.int / 100);
    if (st.echo.on && st.echo.int > 0) {
      const i = st.echo.int / 100, tc = x.T;
      tc.globalCompositeOperation = 'destination-out';
      tc.fillStyle = 'rgba(0,0,0,' + (0.3 - 0.24 * i).toFixed(3) + ')';
      tc.fillRect(0, 0, W, H);
      tc.globalCompositeOperation = 'source-over';
      tc.globalAlpha = 0.16 + 0.12 * i;
      tc.drawImage(src, 0, 0);
      tc.globalAlpha = 1;
      f.globalCompositeOperation = 'lighter'; f.globalAlpha = 0.85;
      f.drawImage(cv.T, 0, 0);
      f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1;
    }
    f.drawImage(src, 0, 0);
    // 4. glitch, vers l'écran
    glitchPass(st);
  }

  // couleur du logo et du texte : blanc cassé, ou une teinte qui tourne (unie ou en dégradé), dans le repère 174
  function ink(a) {
    const c = scene.L.color;
    if (!c.on) return INK;
    const hue = 360 * ph(colorBars(c.int) * 4);
    if (c.opt !== 'arc') return `hsl(${hue.toFixed(0)} 85% 62%)`;
    const g = a.createLinearGradient(0, 0, 174, 174);
    for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, `hsl(${((hue + i * 72) % 360).toFixed(0)} 85% 62%)`);
    return g;
  }

  // ce qui occupe le centre : le logo, le nom du DJ, la blague, en rotation, chacun pendant ses N mesures
  function slot() {
    const d = scene.L.dj, s = scene.L.salut;
    if (d.on && d.opt2 === 'fixe') return { name: 'dj' };
    const slots = [['logo', chainBars(d.int) * 4]];
    if (d.on) slots.push(['dj', chainBars(d.int) * 4]);
    if (s.on) slots.push(['salut', chainBars(s.int) * 4]);
    if (slots.length === 1) return { name: 'logo' };
    const total = slots.reduce((n, [, b]) => n + b, 0), cycle = Math.floor(tA / total);
    let t = tA - cycle * total;
    for (const [name, b] of slots) { if (t < b) return { name, t, cycle }; t -= b; }
  }

  function setFont(a, k = 1) { a.font = `italic 600 ${(FONT_PX * k).toFixed(1)}px Inter, sans-serif`; }

  // règle la police pour que ces lignes tiennent dans 90 % de l'écran (largeur et hauteur), renvoie le facteur
  function fitFont(a, lines, u) {
    setFont(a); a.textAlign = 'center'; a.textBaseline = 'middle'; a.letterSpacing = '0.04em';
    const widest = Math.max(...lines.map((l) => a.measureText(l).width)), height = lines.length * FONT_PX * 1.05;
    const k = Math.min(1, W / u * 0.9 / widest, H / u * 0.9 / height);
    if (k < 1) setFont(a, k);
    return k;
  }

  // « SALUT / LES / mot » tapé une lettre par croche (plus vite si le créneau est court), mot tiré au sort à chaque cycle
  function drawSalut(a, t, cycle, u) {
    const word = SALUTS[Math.floor(rand(cycle * 3.1 + 5) * SALUTS.length)].toUpperCase();
    const full = ['SALUT', 'LES', word], nChars = full.join('').length;
    const step = Math.min(0.5, chainBars(scene.L.salut.int) * 4 * 0.6 / nChars); // temps par lettre : tout est écrit à 60 % du créneau au plus tard
    let left = Math.floor(t / step), lines = [];
    for (const l of full) { if (left <= 0) break; lines.push(l.slice(0, left)); left -= l.length; }
    const k = fitFont(a, full, u); // mesuré sur le texte complet, la taille ne bouge pas pendant la frappe
    const lh = FONT_PX * k * 1.05, y0 = 87 - (full.length - 1) * lh / 2;
    lines.forEach((l, i) => a.fillText(l, 87, y0 + i * lh));
  }

  function drawName(a, name, u) {
    const lines = name.split('\n');
    const k = fitFont(a, lines, u);
    const lh = FONT_PX * k * 1.05, y0 = 87 - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => a.fillText(l, 87, y0 + i * lh));
  }

  function renderScene(a) {
    const st = scene.L;
    reset(a);
    if (!st.logo.on) return;
    let w01 = 0, S = 1, sL = [1, 1, 1];
    if (st.resp.on && st.resp.int > 0) {
      const i = st.resp.int / 100, coeur = st.resp.opt === 'coeur', p = ph(coeur ? T.coeur : T.resp);
      const wf = (pp) => coeur ? heart((pp + 0.18) % 1) : 0.5 + 0.5 * Math.sin(2 * Math.PI * pp - Math.PI / 2);
      w01 = wf(p);
      S = 1 + 0.075 * i * (w01 - 0.35);
      sL = [0, 1, 2].map((k) => 1 + 0.085 * i * (wf(((p - 0.055 * (k + 1)) % 1 + 1) % 1) - 0.35));
      const hr = R * S * (1.3 + 0.45 * w01);
      const gr = a.createRadialGradient(cx, cy, R * S * 0.85, cx, cy, hr);
      const ha = 0.2 * i * (0.25 + 0.75 * w01) * GLOW;
      gr.addColorStop(0, 'rgba(231,231,231,' + ha.toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(231,231,231,0)');
      a.fillStyle = gr;
      a.beginPath(); a.arc(cx, cy, hr, 0, 2 * Math.PI); a.fill();
    }
    const u = R / 87 * S;
    const baseT = () => a.setTransform(u, 0, 0, u, cx - 87 * u, cy - 87 * u);
    baseT();
    const color = ink(a);
    const dust = st.burst.on && st.burst.opt === 'poussiere' && eB > 0.004;
    const sl = slot();
    if (sl.name !== 'logo') {
      a.globalAlpha = dust ? Math.max(0, 1 - eB * 1.6) : 1;
      a.fillStyle = color;
      if (a.globalAlpha > 0.01) sl.name === 'dj' ? drawName(a, st.dj.opt, u) : drawSalut(a, sl.t, sl.cycle, u);
      a.globalAlpha = 1;
      a.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }
    // disque plein, ou anneau (version contour du logo : trait de 3 sur 72, ramené au repère 174)
    if (st.logo.opt === 'outline') {
      a.strokeStyle = color; a.lineWidth = 3 * 174 / 72;
      a.beginPath(); a.arc(87, 87, 87 * RING - a.lineWidth / 2, 0, 2 * Math.PI); a.stroke();
    } else if (!(st.video.on && st.video.opt2 === 'partout' && vidFile)) {
      a.fillStyle = DISC;
      a.beginPath(); a.arc(87, 87, 87, 0, 2 * Math.PI); a.fill();
    }
    // lettres
    for (let i = 0; i < 3; i++) {
      baseT();
      const c = logo.centers[i];
      a.translate(c.cx, c.cy); a.scale(sL[i], sL[i]); a.translate(-c.cx, -c.cy);
      a.globalAlpha = dust ? Math.max(0, 1 - eB * 1.6) : 1;
      a.fillStyle = color;
      if (a.globalAlpha > 0.01) a.fill(logo.paths[i]);
    }
    if (dust) {
      baseT();
      a.fillStyle = color;
      const vis = Math.min(1, eB * 4);
      for (const pt of logo.pts) {
        const ee = Math.pow(eB, pt.exp), ang = pt.ang + pt.spin * eB * 2.5;
        a.globalAlpha = (1 - 0.72 * ee) * vis;
        a.fillRect(pt.x + Math.cos(ang) * pt.mag * ee, pt.y + Math.sin(ang) * pt.mag * ee, 1.3, 1.3);
      }
    }
    a.globalAlpha = 1;
    a.setTransform(1, 0, 0, 1, 0, 0);
  }

  function liquidPass(src, dst, i) {
    reset(dst);
    const amp = 0.055 * R * i, p = ph(T.liqMa), h = 6, TP = 2 * Math.PI;
    for (let y = 0; y < H; y += h) {
      const dx = amp * Math.sin(TP * (y / H * 1.8) + TP * p);
      dst.drawImage(src, 0, y, W, h, dx, y, W, h);
    }
  }

  function chunkPass(src, dst) {
    reset(dst);
    const e = eB, x0 = cx - R * 1.15, y0 = cy - R * 1.15, sz = R * 2.3 / 6;
    for (let i = 0; i < 36; i++) {
      const cr = chunkR[i];
      const sx = x0 + (i % 6) * sz, sy = y0 + Math.floor(i / 6) * sz;
      dst.save();
      dst.translate(sx + sz / 2 + cr.ax * cr.m * e * R * 0.7, sy + sz / 2 + cr.ay * cr.m * e * R * 0.7);
      dst.rotate(cr.rot * e);
      dst.globalAlpha = 1 - 0.3 * e;
      dst.drawImage(src, sx, sy, sz, sz, -sz / 2, -sz / 2, sz, sz);
      dst.restore();
    }
  }

  function glitchPass(st) {
    const d = x.D;
    d.setTransform(1, 0, 0, 1, 0, 0); d.globalAlpha = 1; d.globalCompositeOperation = 'source-over';
    d.fillStyle = BG; d.fillRect(0, 0, W, H);
    let g = 0, tick = 0;
    if (st.glitch.on && st.glitch.int > 0) {
      const i = st.glitch.int / 100;
      if (st.glitch.opt === 'rafales') {
        const tt = ph(T.rafales) * T.rafales;
        for (const t0 of bursts) { const dur = 0.5; if (tt >= t0 && tt < t0 + dur) { g = i * Math.sin(Math.PI * (tt - t0) / dur); break; } }
        tick = Math.floor(tt * 16);
      } else {
        tick = Math.floor(ph(T.continu) * T.continu * 8); // triples croches
        g = rand(tick) < 0.12 + 0.72 * i ? i * (0.35 + 0.65 * rand(tick + 3)) : 0;
      }
    }
    const F = cv.F;
    if (g <= 0.003) { d.drawImage(F, 0, 0); return; }
    const rr = (k) => rand(tick * 9.13 + k);
    const ga = rr(1) < 0.12 * g ? 0.25 : 1;
    if (g > 0.22) {
      const dx = W * 0.008 * g * g * (0.5 + rr(2)) + 1;
      for (const [n, color] of [['tR', '#FF2A55'], ['tC', '#22D3EE']]) {
        const t = x[n]; reset(t);
        t.drawImage(F, 0, 0); t.globalCompositeOperation = 'source-in'; t.fillStyle = color; t.fillRect(0, 0, W, H);
      }
      d.globalCompositeOperation = 'lighter'; d.globalAlpha = 0.75 * ga;
      d.drawImage(cv.tR, dx, (rr(3) - 0.5) * 3);
      d.drawImage(cv.tC, -dx, (rr(8) - 0.5) * 3);
      d.globalCompositeOperation = 'source-over';
    }
    d.globalAlpha = ga;
    d.drawImage(F, (rr(4) - 0.5) * 8 * g, (rr(5) - 0.5) * 4 * g);
    d.globalAlpha = 1;
    if (g > 0.15) {
      const ns = Math.floor(1 + 4 * g * rr(6));
      for (let s = 0; s < ns; s++) {
        const y = rr(20 + s) * H * 0.9, h = (0.01 + 0.05 * rr(30 + s)) * H, off = (rr(40 + s) - 0.5) * W * 0.07 * g;
        d.drawImage(F, 0, y, W, h, off, y, W, h);
      }
    }
  }

  setup();
  window.addEventListener('resize', setup);
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!scene.paused) tA += dt * scene.bpm / 60;
    try { chainTick(); frame(); } catch (e) { console.error(e); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const activeKeys = (s) => Object.keys(s.L).filter((k) => s.L[k].on).join();
  const api = {
    get scene() { return scene; },
    get cache() { const pool = themeFiles(videos, scene.L.chain.opt2); return { done: pool.filter((f) => blobs.has(f)).length, total: pool.length, loading }; },
    setScene(s) {
      const next = normalizeScene(s);
      // changement de couches actives : on efface les trails pour ne pas garder de fantôme
      if (activeKeys(next) !== activeKeys(scene)) x.T.clearRect(0, 0, W, H);
      // recalage : le temps fort tombe maintenant
      if (next.sync !== scene.sync) { tA = 0; chainMark = -1; }
      scene = next;
      syncVideo(scene);
    },
  };
  return api;
}
