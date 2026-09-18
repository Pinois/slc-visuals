# SLC Visuels

Le logo Salut les Copains animé, à projeter en soirée, piloté depuis un téléphone.

## Lancer

```
npm install
npm start
```

- Écran : http://localhost:3000 (`F` plein écran, `H` panneau, espace pause, `T` tap tempo, `1` à `5` presets)
- Télécommande : http://localhost:3000/remote

Le téléphone et le laptop doivent être sur le même réseau. En soirée sans internet :
partage de connexion depuis le laptop, puis ouvre `http://<ip-du-laptop>:3000/remote`
sur le téléphone. Tout est servi en local, aucune dépendance externe.

## Tempo

Les effets sont écrits en temps musicaux, pas en secondes. Tape le tempo sur TAP (ou `T`
sur l'écran) : le premier tap cale le temps fort, à partir de quatre taps le BPM se règle.
`½×` et `2×` corrigent une frappe à la moitié ou au double. `resync` recale le temps fort
sans toucher au BPM, utile quand ça dérive après quelques minutes.

## Vidéos de fond

Des fichiers mp4 dans `public/videos/`. Ils ne sont pas dans le dépôt (trop lourds) : le
laptop est la source, et le serveur reçoit une copie. La couche « Vidéo de fond »
les liste, règle leur opacité, et choisit si le disque du logo reste opaque ou laisse voir
la vidéo. Le glitch et le scan s'appliquent à la vidéo, les autres effets restent sur le logo.

La couche « Enchaînement vidéo » passe à une autre vidéo sur le temps fort, toutes les N
mesures (le slider, de 1 à 32), au hasard ou dans l'ordre. Chaque vidéo démarre alors à un
endroit aléatoire, pas au début.

La couche « Mosaïque vidéo » répète la vidéo en 2 à 8 colonnes, droite ou en miroir
(les tuiles voisines sont retournées, effet kaléidoscope). Utile pour les vidéos en petit format.

La couche « Filtre vidéo » rend la vidéo plus abstraite : noir et blanc contrasté, duotone
(rouge, cyan, ambre), pixels, flou, négatif, ou teinte qui tourne sur 2 mesures. Le slider
règle la force du filtre.

Pour en ajouter une depuis YouTube (il faut `yt-dlp` et `ffmpeg`) :

```
./dl.sh <url> <nom>
```

Sortie : `public/videos/<nom>.mp4`, 720p H.264, 3 minutes à partir du début donné, sans son,
entre 5 et 50 Mo selon la vidéo.

## Déployer (Coolify)

Application Docker à partir du dépôt, le `Dockerfile` est à la racine. Port 3000.

Les vidéos vivent dans un volume persistant monté sur `/app/public/videos` (Storages
dans Coolify). Pour envoyer les vidéos du laptop vers le serveur, avec le chemin du volume
que Coolify affiche :

```
rsync -avz --delete public/videos/ <utilisateur>@<serveur>:<chemin-du-volume>/
```

Variables :

| Variable | Rôle |
|---|---|
| `PORT` | Port d'écoute, défaut 3000 |
| `REMOTE_KEY` | Si définie, seule l'URL `/remote?key=<valeur>` peut piloter l'écran |

## Structure

| Fichier | Rôle |
|---|---|
| `public/scene.js` | La scène : couches, presets, valeurs par défaut. Le contrat entre tout le reste. |
| `public/engine.js` | Le rendu canvas 2D. Reçoit une scène, dessine. À remplacer par un rendu three.js le jour venu. |
| `public/ui.js` | Les contrôles (presets, couches, vitesse, pause), partagés par l'écran et la télécommande. |
| `public/sync.js` | Liaison WebSocket avec reconnexion. |
| `public/index.html` | La page écran. |
| `public/remote.html` | La page télécommande. |
| `public/logo.svg` | Le logo, source unique des tracés utilisés par le rendu. |
| `public/videos/` | Les vidéos de fond. |
| `dl.sh` | Télécharge et réduit une vidéo YouTube dans `public/videos/`. |
| `server.js` | Sert `public/` et relaie la scène entre les clients. |

## Ajouter un effet

1. Une entrée dans `LAYERS` et `defaultLayers()` dans `scene.js`.
2. Une passe dans `engine.js`, appelée depuis `frame()`.

Les contrôles et la télécommande se mettent à jour tout seuls.
