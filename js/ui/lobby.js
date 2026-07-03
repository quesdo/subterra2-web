/* ============================================================
   lobby.js — Écran de salon (créer/rejoindre une partie en ligne)
   ============================================================ */

import { createRoom, joinRoom, net, broadcast, sendToHost, getConnectedPlayerNames, disconnect } from '../net/peer.js';
import { toast, showModal, hideModal } from './log.js';

/* Callback appelé quand l'hôte lance la partie. */
let onStartOnlineGame = null;
export function setStartOnlineGameCallback(cb) { onStartOnlineGame = cb; }

/* Initialise les événements du lobby. */
export function initLobby() {
  document.getElementById('btn-local-game').addEventListener('click', () => {
    net.mode = 'local';
    buildSetupScreen();
    showScreen('screen-setup');
  });

  document.getElementById('btn-online-game').addEventListener('click', () => {
    showScreen('screen-lobby');
  });

  document.getElementById('btn-create-room').addEventListener('click', handleCreateRoom);
  document.getElementById('btn-join-room').addEventListener('click', handleJoinRoom);
  document.getElementById('btn-copy-code').addEventListener('click', copyRoomCode);
  document.getElementById('btn-start-online').addEventListener('click', handleStartOnline);

  // Entrée clavier : touche Entrée pour rejoindre
  document.getElementById('join-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleJoinRoom();
  });
  document.getElementById('player-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCreateRoom();
  });

  // Configurer les callbacks réseau
  net.onMessage = handleNetMessage;
  net.onPeerLeave = (peerId) => {
    refreshPlayerList();
  };
  net.onError = (err) => {
    toast('Erreur réseau : ' + (err.message || err.type || err), 'bad');
  };
}

/* === CRÉER UN SALON === */
async function handleCreateRoom() {
  const name = document.getElementById('player-name').value.trim() || 'Hôte';
  net.playerName = name;
  try {
    const code = await createRoom(name);
    document.getElementById('room-code').textContent = code;
    document.getElementById('room-code-display').classList.remove('hidden');
    document.getElementById('lobby-status').textContent = 'En attente de joueurs...';
    document.getElementById('btn-start-online').classList.remove('hidden');
    refreshPlayerList();
    toast('Salon créé ! Partagez le code : ' + code, 'good');
  } catch (err) {
    toast('Impossible de créer le salon : ' + (err.message || err), 'bad');
  }
}

/* === REJOINDRE UN SALON === */
async function handleJoinRoom() {
  const name = document.getElementById('player-name').value.trim() || 'Joueur';
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!code || code.length < 6) {
    toast('Entrez un code salon valide (ex: ST-ABCD).', 'bad');
    return;
  }
  net.playerName = name;
  document.getElementById('join-status').textContent = 'Connexion en cours...';
  try {
    await joinRoom(code, name);
    document.getElementById('join-status').textContent = 'Connecté au salon ' + code + ' ! En attente de l\'hôte...';
    toast('Connecté au salon !', 'good');
  } catch (err) {
    document.getElementById('join-status').textContent = 'Échec : ' + (err.message || err.type || 'salon introuvable');
    toast('Impossible de rejoindre : ' + (err.message || err.type || err), 'bad');
  }
}

/* === COPIER LE CODE === */
function copyRoomCode() {
  const code = document.getElementById('room-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    toast('Code copié : ' + code, 'good');
  }).catch(() => {
    toast('Code : ' + code, '');
  });
}

/* === LANCER LA PARTIE (HÔTE) === */
function handleStartOnline() {
  // Annoncer le début aux pairs
  broadcast({ type: 'gameStarting' });
  if (onStartOnlineGame) onStartOnlineGame('host');
}

/* === RAFRAÎCHIR LA LISTE DES JOUEURS === */
function refreshPlayerList() {
  const box = document.getElementById('lobby-players');
  const names = getConnectedPlayerNames();
  box.innerHTML = names.map((n, i) =>
    `<div class="lobby-player">${i === 0 ? '👑' : '🎮'} ${n}</div>`
  ).join('');
  const count = names.length;
  document.getElementById('lobby-status').textContent =
    count <= 1 ? 'En attente de joueurs...' : `${count} joueur(s) connecté(s)`;
}

/* === TRAITEMENT DES MESSAGES RÉSEAU === */
function handleNetMessage(msg, fromPeerId) {
  if (typeof msg === 'string') msg = JSON.parse(msg);

  switch (msg.type) {
    case 'hello':
      // Un pair s'annonce à l'hôte
      net.peers.set(fromPeerId, { name: msg.name, ready: false });
      // Accuser réception
      import('../net/peer.js').then(({ sendToPeer }) => {
        sendToPeer(fromPeerId, { type: 'welcome', roomCode: net.roomCode });
      });
      refreshPlayerList();
      toast(msg.name + ' a rejoint le salon.', '');
      break;

    case 'welcome':
      // L'hôte confirme la connexion
      toast('Bienvenue dans le salon !', 'good');
      break;

    case 'playerList':
      // L'hôte diffuse la liste des joueurs
      net.peers = new Map(msg.players.map(p => [p.id, p]));
      if (net.mode === 'host') refreshPlayerList();
      break;

    case 'gameStarting':
      // L'hôte lance la partie -> les pairs vont au setup
      toast('La partie démarre !', 'good');
      if (net.mode === 'peer' && onStartOnlineGame) onStartOnlineGame('peer');
      break;

    case 'gameConfig':
      // L'hôte envoie la config de partie (explorateurs, difficulté)
      if (net.mode === 'peer' && onStartOnlineGame) onStartOnlineGame('peer', msg.config);
      break;

    case 'gameState':
      // L'hôte diffuse l'état du jeu
      if (net.mode === 'peer') {
        window.__applyRemoteState(msg.state);
      }
      break;

    case 'action':
      // Un pair demande une action -> l'hôte traite
      if (net.mode === 'host') {
        window.__handleRemoteAction(msg, fromPeerId);
      }
      break;
  }
}

/* === NAVIGATION ENTRE ÉCRANS === */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* === BUILD SETUP SCREEN (importé depuis main.js via callback) === */
let buildSetupScreen = () => {};
export function setBuildSetupScreen(fn) { buildSetupScreen = fn; }
