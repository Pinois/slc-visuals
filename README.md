# SLC Visuels

Animations du logo Salut les Copains, à projeter en soirée.

## Lancer

Ouvre la page : https://pinois.github.io/slc-visuals/

Puis `F` pour le plein écran, `H` pour masquer le panneau, espace pour mettre en pause,
`1` à `4` pour les presets.

## Les deux versions

| Fichier | Quoi |
|---|---|
| `slc-visuels-v2.dc.html` | Moteur de couches : 10 effets cumulables (respiration, glitch, liquide, éclatement, écho, kaléidoscope, scan, tunnel, morphing), presets et réglage de vitesse. C'est celle à utiliser. |
| `slc-visuels.dc.html` | Le prototype d'origine, gardé pour référence. |

## En local

Les fichiers chargent React depuis unpkg, il faut donc une connexion. Sers le dossier
par HTTP plutôt que d'ouvrir le fichier directement :

```
python3 -m http.server 8000
```

Puis va sur http://localhost:8000.

## Éditer

Les `.dc.html` viennent de Claude Design. Réimporte le fichier là-bas pour modifier
les animations, puis réexporte ici. `support.js` est le runtime, ne pas y toucher.
