// Les contrôles : couches, tempo, pause. Servent au panneau à l'écran
// et à la télécommande. Modifient une scène et appellent onChange(scene).

import { LAYERS, BPM_MIN, BPM_MAX, clampBpm } from './scene.js';

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k in e ? (e[k] = v) : e.setAttribute(k, v);
  e.append(...kids);
  return e;
};

// videos : noms des fichiers disponibles dans public/videos (voir /videos côté serveur)
export function mountControls(root, { scene, onChange, videos = [] }) {
  const layers = LAYERS.map((d) => d.k !== 'video' ? d : { ...d, opts: [['', 'aucune'], ...videos.map((f) => [f, f.replace(/\.mp4$/, '')])] });
  const inputs = {};
  const emit = () => onChange(scene);

  const rows = layers.map((def) => {
    const on = el('input', { type: 'checkbox', onchange: () => { scene.L[def.k].on = on.checked; refresh(scene); emit(); } });
    const name = el('span', { className: 'name' }, def.name);
    const label = el('span', { className: 'val' });
    const int = el('input', { type: 'range', min: 0, max: 100, oninput: () => { scene.L[def.k].int = +int.value; refresh(scene); emit(); } });
    const selects = ['opts', 'opts2'].filter((o) => def[o]).map((o) => {
      const key = o === 'opts' ? 'opt' : 'opt2';
      const sel = el('select', { onchange: () => { scene.L[def.k][key] = sel.value; emit(); } },
        ...def[o].map(([v, l]) => el('option', { value: v }, l)));
      return [key, sel];
    });
    inputs[def.k] = { on, int, label, name, def, sel: Object.fromEntries(selects) };
    return el('div', { className: 'layer' },
      el('label', { className: 'head' }, on, name, label),
      int,
      ...(selects.length ? [el('div', { className: 'opts' }, ...selects.map(([, s]) => s))] : []));
  });

  const bpm = el('input', { type: 'range', min: BPM_MIN, max: BPM_MAX, step: 1, oninput: () => { scene.bpm = +bpm.value; refresh(scene); emit(); } });
  const bpmLabel = el('span', { className: 'val' });
  const setBpm = (b) => { scene.bpm = clampBpm(b); refresh(scene); emit(); };
  const resync = () => { scene.sync = Date.now(); emit(); };
  // tap tempo : le premier tap cale le temps fort, à partir de 4 taps le BPM sort de la médiane des intervalles
  let taps = [];
  const tap = () => {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
    taps.push(now);
    if (taps.length === 1) resync();
    if (taps.length >= 4) {
      const iv = taps.slice(-9).map((t, i, a) => t - a[i - 1]).slice(1).sort((a, b) => a - b);
      setBpm(60000 / iv[Math.floor(iv.length / 2)]);
    }
    tapBtn.classList.add('hit'); setTimeout(() => tapBtn.classList.remove('hit'), 80);
  };
  const tapBtn = el('button', { type: 'button', className: 'tap', onclick: tap }, 'TAP');
  const tempo = el('div', { className: 'tempo' }, tapBtn,
    el('button', { type: 'button', onclick: () => setBpm(scene.bpm / 2) }, '½×'),
    el('button', { type: 'button', onclick: () => setBpm(scene.bpm * 2) }, '2×'),
    el('button', { type: 'button', onclick: resync }, 'resync'));
  const togglePause = () => { scene.paused = !scene.paused; refresh(scene); emit(); };
  const pause = el('button', { type: 'button', onclick: togglePause });

  root.append(
    el('div', { className: 'layers' }, ...rows),
    el('div', { className: 'foot' },
      el('label', { className: 'head' }, el('span', { className: 'name' }, 'tempo'), bpmLabel),
      bpm, tempo, pause));

  function refresh(s) {
    scene = s;
    for (const def of layers) {
      const l = s.L[def.k], i = inputs[def.k];
      i.on.checked = l.on;
      i.int.value = l.int;
      i.label.textContent = def.fmt ? def.fmt(l.int) : l.int + '%';
      i.name.classList.toggle('off', !l.on);
      for (const [key, sel] of Object.entries(i.sel)) sel.value = l[key];
    }
    bpm.value = s.bpm;
    bpmLabel.textContent = s.bpm + ' bpm';
    pause.textContent = s.paused ? '▶ reprendre' : '❚❚ pause';
    pause.classList.toggle('active', s.paused);
  }
  refresh(scene);
  return { refresh, togglePause, tap };
}
