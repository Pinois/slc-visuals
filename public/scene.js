// La scène : l'état complet de ce qui s'affiche. Un objet JSON, partagé entre
// le rendu, le panneau à l'écran et la télécommande.
//   { speed, paused, L: { <couche>: { on, int, opt?, opt2? } } }

export const LAYERS = [
  { k: 'resp', name: 'Respiration', opts: [['sinus', 'Sinus'], ['coeur', 'Cardiaque']] },
  { k: 'glitch', name: 'Glitch / Strobe', opts: [['rafales', 'Rafales'], ['continu', 'Continu']] },
  { k: 'liqMa', name: 'Liquide macro' },
  { k: 'liqMi', name: 'Liquide micro' },
  { k: 'burst', name: 'Éclatement', opts: [['poussiere', 'Poussière'], ['decoupes', 'Découpes']], opts2: [['brutal', 'Explosion brute'], ['inverse', 'Retour brusque']] },
  { k: 'echo', name: 'Echo / Trails' },
  { k: 'scan', name: 'Scan' },
  { k: 'tunnel', name: 'Tunnel' },
];

export const PRESETS = [
  { name: 'Warm-up', speed: 0.8, L: { resp: { on: true, int: 55, opt: 'sinus' }, tunnel: { on: true, int: 35 }, echo: { on: true, int: 25 } } },
  { name: 'Peak time', speed: 1.1, L: { resp: { on: true, int: 70, opt: 'coeur' }, glitch: { on: true, int: 60, opt: 'rafales' }, scan: { on: true, int: 45 } } },
  { name: 'Ambient', speed: 0.6, L: { liqMa: { on: true, int: 50 }, liqMi: { on: true, int: 30 }, echo: { on: true, int: 20 } } },
  { name: 'Chaos', speed: 1.4, L: { glitch: { on: true, int: 100, opt: 'continu' }, burst: { on: true, int: 80, opt: 'poussiere', opt2: 'brutal' }, liqMi: { on: true, int: 60 } } },
  { name: 'Off', speed: 1, L: {} },
];

export function defaultLayers() {
  return {
    resp: { on: false, int: 55, opt: 'sinus' },
    glitch: { on: false, int: 40, opt: 'rafales' },
    liqMa: { on: false, int: 50 },
    liqMi: { on: false, int: 40 },
    burst: { on: false, int: 60, opt: 'poussiere', opt2: 'brutal' },
    echo: { on: false, int: 40 },
    scan: { on: false, int: 50 },
    tunnel: { on: false, int: 40 },
  };
}

export function defaultScene() {
  const L = defaultLayers();
  L.resp.on = true;
  return { speed: 1, paused: false, L };
}

// Une scène complète à partir d'un preset, en gardant l'état de pause.
export function presetScene(preset, base) {
  const L = defaultLayers();
  for (const k in preset.L) L[k] = { ...L[k], ...preset.L[k] };
  return { speed: preset.speed, paused: base?.paused ?? false, L };
}

// Ramène n'importe quel objet reçu (réseau, vieux format) à une scène valide.
export function normalizeScene(s) {
  const d = defaultScene();
  if (!s || typeof s !== 'object') return d;
  const L = defaultLayers();
  for (const k in L) if (s.L && typeof s.L[k] === 'object') L[k] = { ...L[k], ...s.L[k] };
  const speed = Number(s.speed);
  return {
    speed: Number.isFinite(speed) ? Math.min(2, Math.max(0.2, speed)) : d.speed,
    paused: !!s.paused,
    L,
  };
}
