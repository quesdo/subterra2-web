/* ============================================================
   lobby.js — Écran de salon (créer/rejoindre une partie en ligne)
   ============================================================ */

import { createRoom, joinRoom, net, broadcast, sendToHost, getConnectedPlayerNames, disconnect } from '../net/peer.js';
import { toast, showModal, hideModal } from './log.js';
import { validateAttribution, buildPlayerAssignments } from '../net/lobby.js';
import { getPlayerId } from '../net/client.js';
import { EXPLORERS } from '../data/explorers.js';

/* Callback appelé quand l'hôte lance la partie. */
let onStartOnlineGame = null;
export function setStartOnlineGameCallback(cb) { onStartOnlineGame = cb; }

/* Attribution locale (hôte) : { playerId: [explorerDefId, ...] } */
let attribution = {};
/* Difficulté choisie par l'hôte dans le lobby */
let lobbyDifficulty = 'normal';

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

  document.getElementById('lobby-difficulty-select').addEventListener('change', (e) => {
    lobbyDifficulty = e.target.value;
  });

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
    if (net.mode === 'host') {
      broadcast({ type: 'playerDisconnected', peerId });
      toast('Un joueur s\'est déconnecté.', 'bad');
      if (window.__handlePlayerDisconnect) {
        window.__handlePlayerDisconnect(peerId);
      }
    }
  };
  net.onError = (err) => {
    toast('Erreur réseau : ' + (err.message || err.type || err), 'bad');
  };
}

/* === CRÉER UN SALON === */
async function handleCreateRoom() {
  const name = document.getElementById('player-name').value.trim() || 'Hôte';
  net.playerName = name;
  net.playerId = 'host';
  attribution = { 'host': [] };
  try {
    const code = await createRoom(name);
    document.getElementById('room-code').textContent = code;
    document.getElementById('room-code-display').classList.remove('hidden');
    document.getElementById('lobby-status').textContent = 'En attente de joueurs...';
    document.getElementById('lobby-attribution').classList.remove('hidden');
    document.getElementById('btn-start-online').classList.remove('hidden');
    refreshPlayerList();
    buildExplorerGrid();
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
  net.playerId = getPlayerId();
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

/* === GRILLE D'ATTRIBUTION DES EXPLORATEURS === */
function buildExplorerGrid() {
  const grid = document.getElementById('lobby-explorer-grid');
  if (!grid) return;
  grid.innerHTML = EXPLORERS.map(ex => {
    const assignedTo = getAssignedPlayer(ex.id);
    return `
      <div class="explorer-card lobby-explorer-card" data-id="${ex.id}">
        <div class="avatar">
          <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="${ex.color}"/>
          <text x="24" y="30" text-anchor="middle" font-size="20">${ex.glyph}</text></svg>
        </div>
        <div class="ex-name">${ex.name}</div>
        <div class="ex-assigned">${assignedTo || '—'}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.lobby-explorer-card').forEach(card => {
    card.addEventListener('click', () => handleExplorerClick(card.dataset.id));
  });
}

/* Trouve le playerId à qui un Explorateur est attribué. */
function getAssignedPlayer(explorerId) {
  for (const [pid, ids] of Object.entries(attribution)) {
    if (ids.includes(explorerId)) {
      if (pid === 'host') return net.playerName + ' (hôte)';
      const peer = net.peers.get(pid);
      return peer ? peer.name : pid;
    }
  }
  return null;
}

/* Gère le clic sur un Explorateur dans la grille d'attribution. */
function handleExplorerClick(explorerId) {
  if (net.mode !== 'host') return;
  const playerNames = getConnectedPlayerNames();
  const playerIds = ['host', ...[...net.peers.keys()]];

  const optionsHtml = playerIds.map((pid, i) => {
    const name = i === 0 ? net.playerName + ' (hôte)' : (net.peers.get(pid)?.name || pid);
    const checked = (attribution[pid] || []).includes(explorerId) ? '✓ ' : '';
    return `<button class="btn btn-toggle assign-pick" data-pid="${pid}" data-eid="${explorerId}">${checked}${name}</button>`;
  }).join('') + `<button class="btn btn-ghost assign-pick" data-pid="" data-eid="${explorerId}">— Retirer —</button>`;

  showModal('Attribuer ' + explorerId, `
    <p>Choisissez le joueur qui contrôlera cet Explorateur :</p>
    <div style="display:flex;flex-direction:column;gap:8px">${optionsHtml}</div>
  `, [{ label: 'Annuler', style: 'btn-ghost' }]);

  setTimeout(() => {
    document.querySelectorAll('.assign-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.pid;
        const eid = btn.dataset.eid;
        assignExplorer(eid, pid || null);
        hideModal();
      });
    });
  }, 50);
}

/* Assigne un Explorateur à un joueur (ou retire l'attribution). */
function assignExplorer(explorerId, playerId) {
  if (net.mode !== 'host') return;
  for (const pid of Object.keys(attribution)) {
    attribution[pid] = attribution[pid].filter(id => id !== explorerId);
  }
  if (playerId) {
    if (!attribution[playerId]) attribution[playerId] = [];
    attribution[playerId].push(explorerId);
  }
  buildExplorerGrid();
  updateStartButton();
  broadcastLobbyUpdate();
}

/* Construit la liste des joueurs connectés (hôte + pairs). */
function getLobbyPlayers() {
  const players = [{ playerId: 'host', name: net.playerName }];
  for (const [pid, info] of net.peers) {
    players.push({ playerId: pid, name: info.name });
  }
  return players;
}

/* Met à jour l'état du bouton Lancer. */
function updateStartButton() {
  const players = getLobbyPlayers();
  const result = validateAttribution(attribution, players);
  const btn = document.getElementById('btn-start-online');
  if (btn) btn.disabled = !result.valid;
  const hint = document.getElementById('lobby-attribution-hint');
  if (hint) hint.textContent = result.valid ? '' : result.reason;
}

/* === LANCER LA PARTIE (HÔTE) === */
function handleStartOnline() {
  const players = getLobbyPlayers();
  const result = validateAttribution(attribution, players);
  if (!result.valid) {
    toast(result.reason, 'bad');
    return;
  }
  const assignments = buildPlayerAssignments(attribution, players);
  const config = {
    assignments,
    difficulty: lobbyDifficulty,
  };
  broadcast({ type: 'gameStarting', config });
  if (onStartOnlineGame) onStartOnlineGame('host', config);
}

/* Diffuse l'état du lobby aux clients. */
function broadcastLobbyUpdate() {
  const players = getLobbyPlayers();
  broadcast({
    type: 'lobbyUpdate',
    players: players.map(p => ({ id: p.playerId, name: p.name })),
    attribution,
    difficulty: lobbyDifficulty,
  });
}

/* === RAFRAÎCHIR LA LISTE DES JOUEURS === */
function refreshPlayerList() {
  const box = document.getElementById('lobby-players');
  if (!box) return;
  const names = getConnectedPlayerNames();
  box.innerHTML = names.map((n, i) =>
    `<div class="lobby-player">${i === 0 ? '👑' : '🎮'} ${n}</div>`
  ).join('');
  const count = names.length;
  document.getElementById('lobby-status').textContent =
    count <= 1 ? 'En attente de joueurs...' : `${count} joueur(s) connecté(s)`;
  if (net.mode === 'host') {
    buildExplorerGrid();
    updateStartButton();
    broadcastLobbyUpdate();
  }
}

/* === TRAITEMENT DES MESSAGES RÉSEAU === */
function handleNetMessage(msg, fromPeerId) {
  if (typeof msg === 'string') msg = JSON.parse(msg);

  switch (msg.type) {
    case 'hello':
      // Un pair s'annonce à l'hôte
      net.peers.set(fromPeerId, { name: msg.name, ready: false });
      if (!attribution[fromPeerId]) attribution[fromPeerId] = [];
      // Accuser réception avec playerId
      import('../net/peer.js').then(({ sendToPeer }) => {
        sendToPeer(fromPeerId, { type: 'welcome', roomCode: net.roomCode, playerId: fromPeerId });
      });
      refreshPlayerList();
      toast(msg.name + ' a rejoint le salon.', '');
      break;

    case 'welcome':
      // L'hôte confirme la connexion
      if (msg.playerId) net.playerId = msg.playerId;
      toast('Bienvenue dans le salon !', 'good');
      break;

    case 'lobbyUpdate':
      // L'hôte diffuse l'état du lobby
      if (net.mode === 'peer') {
        attribution = msg.attribution || {};
        lobbyDifficulty = msg.difficulty || 'normal';
        renderPeerLobby(msg.players, msg.attribution, msg.difficulty);
      }
      break;

    case 'gameStarting':
      // L'hôte lance la partie
      toast('La partie démarre !', 'good');
      if (net.mode === 'peer' && onStartOnlineGame) onStartOnlineGame('peer', msg.config);
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

    case 'playerDisconnected':
      if (net.mode === 'peer') {
        toast('Un joueur s\'est déconnecté.', 'bad');
      }
      break;

    case 'playerReconnected':
      if (net.mode === 'peer') {
        toast('Un joueur s\'est reconnecté.', 'good');
      }
      break;

    case 'actionRejected':
      if (net.mode === 'peer') {
        toast('Action refusée : ' + (msg.reason || ''), 'bad');
      }
      break;
  }
}

/* Affiche le lobby vu par un client (lecture seule). */
function renderPeerLobby(players, attr, difficulty) {
  const grid = document.getElementById('lobby-explorer-grid');
  if (!grid) return;
  const playerMap = new Map(players.map(p => [p.id, p.name]));
  grid.innerHTML = EXPLORERS.map(ex => {
    let assignedTo = null;
    for (const [pid, ids] of Object.entries(attr || {})) {
      if (ids.includes(ex.id)) {
        const name = playerMap.get(pid) || pid;
        assignedTo = pid === 'host' ? name + ' (hôte)' : name;
      }
    }
    return `
      <div class="explorer-card lobby-explorer-card" data-id="${ex.id}">
        <div class="avatar">
          <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="${ex.color}"/>
          <text x="24" y="30" text-anchor="middle" font-size="20">${ex.glyph}</text></svg>
        </div>
        <div class="ex-name">${ex.name}</div>
        <div class="ex-assigned">${assignedTo || '—'}</div>
      </div>
    `;
  }).join('');
  const select = document.getElementById('lobby-difficulty-select');
  if (select) {
    select.value = difficulty;
    select.disabled = true;
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
