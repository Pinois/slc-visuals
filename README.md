# SLC Visuels

Le logo Salut les Copains animé, à projeter en soirée, piloté depuis un téléphone.

## Lancer

```
npm install
npm start
```

- Écran : http://localhost:3000 (`F` plein écran, `H` panneau, espace pause, `1` à `5` presets)
- Télécommande : http://localhost:3000/remote

Le téléphone et le laptop doivent être sur le même réseau. En soirée sans internet :
partage de connexion depuis le laptop, puis ouvre `http://<ip-du-laptop>:3000/remote`
sur le téléphone. Tout est servi en local, aucune dépendance externe.

## Déployer (Coolify)

Application Docker à partir du dépôt, le `Dockerfile` est à la racine. Port 3000.
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
| `server.js` | Sert `public/` et relaie la scène entre les clients. |

## Ajouter un effet

1. Une entrée dans `LAYERS` et `defaultLayers()` dans `scene.js`.
2. Une passe dans `engine.js`, appelée depuis `frame()`.

Les contrôles et la télécommande se mettent à jour tout seuls.
