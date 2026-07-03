/* ============================================================
   peer.js — Couche PeerJS (WebRTC pair-à-pair)
   Gère : créer/rejoindre un salon, envoyer/recevoir des messages.
   Utilise le broker gratuit PeerJS par défaut pour le signalling.
   ============================================================ */

/* Préfixe pour les IDs peer, afin d'éviter les collisions avec d'autres
   utilisateurs du broker public PeerJS. */
const PEER_PREFIX = 'subterra2-';

/* Génère un code de salon court et lisible (ex: "ST-AB7K"). */
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I/L
  let code = 'ST-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/* Convertit un code salon en ID peer déterministe (l'hôte utilise cet ID). */
function codeToPeerId(code) {
  return PEER_PREFIX + code.toUpperCase();
}

/* État réseau global. */
export const net = {
  mode: 'local',        // 'local' | 'host' | 'peer'
  peer: null,           // instance PeerJS
  roomCode: null,       // code du salon (côté hôte et pair)
  connections: [],      // connexions DataConnection (vers pairs)
  hostConnection: null, // connexion vers l'hôte (côté pair)
  onMessage: null,      // callback(msg, fromPeerId)
  onPeerJoin: null,     // callback(peerId, playerName)
  onPeerLeave: null,    // callback(peerId)
  onError: null,        // callback(error)
  playerName: 'Joueur',
  peers: new Map(),     // peerId -> { name, ready }
};

/* === CRÉER UN SALON (HÔTE) === */
export function createRoom(playerName) {
  return new Promise((resolve, reject) => {
    net.mode = 'host';
    net.playerName = playerName || 'Hôte';
    const code = generateRoomCode();
    net.roomCode = code;
    const peerId = codeToPeerId(code);

    const peer = new Peer(peerId, { debug: 1 });
    net.peer = peer;

    peer.on('open', () => {
      console.log('[net] Salon créé :', code, '(peerId:', peerId + ')');
      resolve(code);
    });

    // Un pair se connecte à l'hôte
    peer.on('connection', (conn) => {
      console.log('[net] Connexion entrante de', conn.peer);
      net.connections.push(conn);
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.error('[net] Erreur Peer (hôte) :', err);
      if (net.onError) net.onError(err);
      // Si l'ID est déjà pris, régénérer
      if (err.type === 'unavailable-id') {
        reject(new Error('Ce code salon est déjà utilisé, réessayez.'));
      } else {
        reject(err);
      }
    });
  });
}

/* === REJOINDRE UN SALON (PAIR) === */
export function joinRoom(code, playerName) {
  return new Promise((resolve, reject) => {
    net.mode = 'peer';
    net.playerName = playerName || 'Joueur';
    net.roomCode = code.toUpperCase();
    const hostPeerId = codeToPeerId(net.roomCode);

    const peer = new Peer({ debug: 1 });
    net.peer = peer;

    peer.on('open', () => {
      console.log('[net] Pair connecté, tentative de liaison à', hostPeerId);
      const conn = peer.connect(hostPeerId, { reliable: true });
      net.hostConnection = conn;
      net.connections.push(conn); // pour uniformité

      conn.on('open', () => {
        console.log('[net] Connecté à l\'hôte', hostPeerId);
        // S'annoncer à l'hôte
        conn.send({ type: 'hello', name: net.playerName });
        resolve(code);
      });

      conn.on('error', (err) => {
        console.error('[net] Erreur connexion pair :', err);
        reject(err);
      });

      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.error('[net] Erreur Peer (pair) :', err);
      if (net.onError) net.onError(err);
      reject(err);
    });
  });
}

/* === CONFIGURATION D'UNE CONNEXION (réception messages) === */
function setupConnection(conn) {
  conn.on('data', (msg) => {
    console.log('[net] Message reçu :', msg.type, 'de', conn.peer);
    if (net.onMessage) net.onMessage(msg, conn.peer);
  });

  conn.on('close', () => {
    console.log('[net] Connexion fermée :', conn.peer);
    net.connections = net.connections.filter(c => c !== conn);
    if (net.hostConnection === conn) net.hostConnection = null;
    net.peers.delete(conn.peer);
    if (net.onPeerLeave) net.onPeerLeave(conn.peer);
  });

  conn.on('error', (err) => {
    console.error('[net] Erreur connexion :', err);
  });
}

/* === ENVOI === */

/* Envoie un message à TOUS les pairs connectés (côté hôte). */
export function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const conn of net.connections) {
    if (conn.open) {
      conn.send(data);
    }
  }
}

/* Envoie un message à l'hôte (côté pair). */
export function sendToHost(msg) {
  if (net.hostConnection && net.hostConnection.open) {
    net.hostConnection.send(JSON.stringify(msg));
  } else {
    console.warn('[net] Pas de connexion hôte active pour envoyer');
  }
}

/* Envoie un message à un pair spécifique (côté hôte). */
export function sendToPeer(peerId, msg) {
  const conn = net.connections.find(c => c.peer === peerId);
  if (conn && conn.open) {
    conn.send(JSON.stringify(msg));
  }
}

/* === DÉCONNEXION === */
export function disconnect() {
  for (const conn of net.connections) {
    try { conn.close(); } catch (e) {}
  }
  if (net.peer) {
    try { net.peer.destroy(); } catch (e) {}
  }
  net.mode = 'local';
  net.peer = null;
  net.connections = [];
  net.hostConnection = null;
  net.roomCode = null;
  net.peers.clear();
}

/* Liste les noms des pairs connectés (pour le lobby). */
export function getConnectedPlayerNames() {
  const names = [net.playerName + ' (hôte)'];
  for (const [pid, info] of net.peers) {
    names.push(info.name);
  }
  return names;
}
