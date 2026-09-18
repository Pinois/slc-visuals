// La scène : l'état complet de ce qui s'affiche. Un objet JSON, partagé entre
// le rendu, le panneau à l'écran et la télécommande.
//   { bpm, sync, paused, L: { <couche>: { on, int, opt?, opt2? } } }
// bpm : tempo, les effets sont écrits en temps musicaux. sync : horodatage du dernier
// recalage, le moteur remet sa phase à zéro (temps fort) quand il change.

export const LAYERS = [
  { k: 'logo', name: 'Logo', opts: [['outline', 'Contour'], ['plein', 'Plein']], fmt: (v) => 'taille ' + v },
  { k: 'resp', name: 'Respiration', opts: [['sinus', 'Sinus'], ['coeur', 'Cardiaque']] },
  { k: 'glitch', name: 'Glitch / Strobe', opts: [['rafales', 'Rafales'], ['continu', 'Continu']] },
  { k: 'liqMa', name: 'Liquide' },
  { k: 'burst', name: 'Éclatement', opts: [['poussiere', 'Poussière'], ['decoupes', 'Découpes']], opts2: [['brutal', 'Explosion brute'], ['inverse', 'Retour brusque']] },
  { k: 'echo', name: 'Echo / Trails' },
  // opts (la liste des fichiers) est remplie à l'exécution depuis /videos
  { k: 'video', name: 'Vidéo de fond', opts: [], opts2: [['autour', 'Autour du disque'], ['partout', 'Partout']] },
  { k: 'chain', name: 'Enchaînement vidéo', opts: [['aleatoire', 'Aléatoire'], ['ordre', "Dans l'ordre"]], fmt: (v) => chainBars(v) + ' mes.' },
  { k: 'mosaic', name: 'Mosaïque vidéo', opts: [['normal', 'Répétée'], ['miroir', 'En miroir']] },
  { k: 'vfx', name: 'Filtre vidéo', opts: [['nb', 'Noir et blanc'], ['duo-rouge', 'Duotone rouge'], ['duo-cyan', 'Duotone cyan'], ['duo-ambre', 'Duotone ambre'], ['pixel', 'Pixels'], ['flou', 'Flou'], ['negatif', 'Négatif'], ['teinte', 'Teinte tournante']] },
];

export function defaultLayers() {
  return {
    logo: { on: true, int: 40, opt: 'outline' },
    resp: { on: true, int: 55, opt: 'sinus' },
    glitch: { on: false, int: 40, opt: 'rafales' },
    liqMa: { on: false, int: 50 },
    burst: { on: false, int: 60, opt: 'poussiere', opt2: 'brutal' },
    echo: { on: false, int: 40 },
    video: { on: true, int: 60, opt: '', opt2: 'autour' },
    chain: { on: true, int: 13, opt: 'aleatoire' },
    mosaic: { on: false, int: 40, opt: 'miroir' },
    vfx: { on: false, int: 60, opt: 'nb' },
  };
}

export function defaultScene() {
  return { bpm: 120, sync: 0, paused: false, L: defaultLayers() };
}

// enchaînement : le slider donne un nombre de mesures, de 1 à 32
export const chainBars = (int) => Math.max(1, Math.round(int / 100 * 32));

export const BPM_MIN = 60, BPM_MAX = 180;
export const clampBpm = (b) => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(b)));

// Ramène n'importe quel objet reçu (réseau, vieux format) à une scène valide.
export function normalizeScene(s) {
  const d = defaultScene();
  if (!s || typeof s !== 'object') return d;
  const L = defaultLayers();
  for (const k in L) if (s.L && typeof s.L[k] === 'object') L[k] = { ...L[k], ...s.L[k] };
  L.video.opt = String(L.video.opt ?? '');
  return {
    bpm: Number.isFinite(+s.bpm) ? clampBpm(+s.bpm) : d.bpm,
    sync: Number.isFinite(+s.sync) ? +s.sync : 0,
    paused: !!s.paused,
    L,
  };
}
