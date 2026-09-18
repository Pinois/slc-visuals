# SLC Visuels

Le logo Salut les Copains animé, à projeter en soirée, piloté depuis un téléphone.

## Lancer

```
npm install
npm start
```

- Écran : http://localhost:3000 (`F` plein écran, `H` panneau, espace pause, `T` tap tempo)
- Télécommande : http://localhost:3000/remote

Le téléphone et le laptop doivent être sur le même réseau. En soirée sans internet :
partage de connexion depuis le laptop, puis ouvre `http://<ip-du-laptop>:3000/remote`
sur le téléphone. Tout est servi en local, aucune dépendance externe.

## Couches

Au départ : le logo en contour qui respire à 120 bpm, une vidéo de fond au hasard à 60 %,
et l'enchaînement toutes les 4 mesures. Tout se règle depuis le panneau ou la télécommande.

La couche « Logo » choisit le contour ou le disque plein, et sa taille. Décochée, le logo
disparaît et il ne reste que la vidéo.

La couche « Nom du DJ » affiche un nom à la place du logo, même police (Inter, embarquée)
et même hauteur de lettres. En alternance : le logo pendant N mesures, puis le nom pendant
N mesures. Les noms sont dans `DJS` en tête de `scene.js`, un `\n` coupe en deux lignes.

La couche « Couleur tournante » colore le logo ou le nom d'une teinte qui fait le tour du
cercle chromatique, unie ou en dégradé. Le slider règle la vitesse.

## Tempo

Les effets sont écrits en temps musicaux, pas en secondes. Tape le tempo sur TAP (ou `T`
sur l'écran) : le premier tap cale le temps fort, à partir de quatre taps le BPM se règle.
`½×` et `2×` corrigent une frappe à la moitié ou au double. `resync` recale le temps fort
sans toucher au BPM, utile quand ça dérive après quelques minutes.

## Vidéos de fond

Des fichiers mp4 dans `public/videos/`. Ils ne sont pas dans le dépôt (trop lourds) : le
laptop est la source, et en ligne elles sont dans un bucket MinIO (voir Déployer). La couche « Vidéo de fond »
les liste, règle leur opacité, et choisit si le disque du logo reste opaque ou laisse voir
la vidéo. Le glitch s'applique aussi à la vidéo, les autres effets restent sur le logo.

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

Les vidéos vivent dans un bucket MinIO public. Le serveur lit la liste du bucket, le
navigateur charge les vidéos directement depuis MinIO.

1. Crée le bucket `slc-visuals` dans la console MinIO.
2. Access Policy du bucket, en « custom », pour autoriser la lecture et le listing anonymes :

```json
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow", "Principal": { "AWS": ["*"] }, "Action": ["s3:GetBucketLocation", "s3:ListBucket"], "Resource": ["arn:aws:s3:::slc-visuals"] },
  { "Effect": "Allow", "Principal": { "AWS": ["*"] }, "Action": ["s3:GetObject"], "Resource": ["arn:aws:s3:::slc-visuals/*"] }
] }
```

3. Sur le laptop, une fois `rclone config` fait (type s3, provider Minio, endpoint
   `https://storage.pnwa.dev`, une clé d'accès créée dans la console) :

```
rclone sync public/videos/ minio:slc-visuals/ --include "*.mp4" --progress
```

À refaire après chaque ajout. Pas besoin de redéployer, le serveur relit le bucket à
chaque demande de liste.

Variables :

| Variable | Rôle |
|---|---|
| `PORT` | Port d'écoute, défaut 3000 |
| `REMOTE_KEY` | Si définie, seule l'URL `/remote?key=<valeur>` peut piloter l'écran |
| `VIDEOS_URL` | URL du bucket, `https://storage.pnwa.dev/slc-visuals`. Absente, le serveur sert `public/videos/` |

## Structure

| Fichier | Rôle |
|---|---|
| `public/scene.js` | La scène : couches et valeurs par défaut. Le contrat entre tout le reste. |
| `public/engine.js` | Le rendu canvas 2D. Reçoit une scène, dessine. À remplacer par un rendu three.js le jour venu. |
| `public/ui.js` | Les contrôles (couches, tempo, pause), partagés par l'écran et la télécommande. |
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
