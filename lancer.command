#!/bin/bash
# Double-clic dans le Finder : démarre le serveur en local, ouvre l'écran, affiche l'adresse de la télécommande.
# Rien ne passe par internet : vidéos, police et logo sont servis depuis ce dossier.
cd "$(dirname "$0")"
[ -d node_modules ] || npm install --no-fund --no-audit
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr bridge100 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
clear
echo "SLC visuels"
echo "  Écran        : http://localhost:3000"
echo "  Télécommande : http://${IP:-<ip-du-laptop>}:3000/remote   (téléphone sur le même réseau)"
echo "  Vidéos       : $(ls public/videos/*.mp4 2>/dev/null | wc -l | tr -d ' ') fichiers dans public/videos"
echo
echo "Ferme cette fenêtre pour arrêter."
sleep 1; open http://localhost:3000
exec node server.js
