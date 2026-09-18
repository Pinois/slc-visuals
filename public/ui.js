// Les contrôles : presets, couches, vitesse, pause. Servent au panneau à l'écran
// et à la télécommande. Modifient une scène et appellent onChange(scene).

import { LAYERS, PRESETS, presetScene } from './scene.js';

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k in e ? (e[k] = v) : e.setAttribute(k, v);
  e.append(...kids);
  return e;
};

export function mountControls(root, { scene, onChange }) {
  const inputs = {};
  const emit = () => onChange(scene);

  const presets = el('div', { className: 'presets' },
    ...PRESETS.map((pr) => el('button', { type: 'button', onclick: () => { scene = presetScene(pr, scene); refresh(scene); emit(); } }, pr.name)));

  const rows = LAYERS.map((def) => {
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
    inputs[def.k] = { on, int, label, name, sel: Object.fromEntries(selects) };
    return el('div', { className: 'layer' },
      el('label', { className: 'head' }, on, name, label),
      int,
      ...(selects.length ? [el('div', { className: 'opts' }, ...selects.map(([, s]) => s))] : []));
  });

  const speed = el('input', { type: 'range', min: 0.2, max: 2, step: 0.05, oninput: () => { scene.speed = +speed.value; refresh(scene); emit(); } });
  const speedLabel = el('span', { className: 'val' });
  const togglePause = () => { scene.paused = !scene.paused; refresh(scene); emit(); };
  const pause = el('button', { type: 'button', onclick: togglePause });

  root.append(
    presets,
    el('div', { className: 'layers' }, ...rows),
    el('div', { className: 'foot' },
      el('label', { className: 'head' }, el('span', { className: 'name' }, 'vitesse'), speedLabel),
      speed, pause));

  function refresh(s) {
    scene = s;
    for (const def of LAYERS) {
      const l = s.L[def.k], i = inputs[def.k];
      i.on.checked = l.on;
      i.int.value = l.int;
      i.label.textContent = l.int + '%';
      i.name.classList.toggle('off', !l.on);
      for (const [key, sel] of Object.entries(i.sel)) sel.value = l[key];
    }
    speed.value = s.speed;
    speedLabel.textContent = s.speed.toFixed(2).replace(/0$/, '') + '×';
    pause.textContent = s.paused ? '▶ reprendre' : '❚❚ pause';
    pause.classList.toggle('active', s.paused);
  }
  refresh(scene);
  return { refresh, togglePause, applyPreset: (i) => { scene = presetScene(PRESETS[i], scene); refresh(scene); emit(); } };
}
