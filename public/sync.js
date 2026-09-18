// Liaison WebSocket avec le serveur : reçoit les scènes des autres clients,
// envoie les nôtres. Se reconnecte tout seul.

export function connect({ onScene, onStatus = () => {} }) {
  const url = new URL('/ws', location.href);
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const key = new URLSearchParams(location.search).get('key');
  if (key) url.searchParams.set('key', key);
  let ws;
  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => onStatus(true);
    ws.onmessage = (e) => { try { onScene(JSON.parse(e.data)); } catch { /* message invalide, ignoré */ } };
    ws.onclose = () => { onStatus(false); setTimeout(open, 1000); };
    ws.onerror = () => ws.close();
  };
  open();
  return (scene) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(scene)); };
}
