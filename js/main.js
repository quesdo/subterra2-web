/* ============================================================
   main.js — Bootstrap, transitions d'écran, orchestrateur
   ============================================================ */

import { EXPLORERS, ABILITIES } from './data/explorers.js';
import { PERIL_FACES, rollDie } from './data/perils.js';
import { TILE_TYPES } from './data/tiles.js';
import {
  createGame, currentPlayer, explorerCell, endExplorerTurn,
  performReveal, performMove, performExplore, performHeal, performPickup,
  performDropItem, performAttack, performDig, performPush, performCrawl,
  performEscape, useAbility, canUseAbility, resolvePeril,
  getMoveTargets, getOpenEdges, getDigTargets, getGrenadeTargets,
  getSnipeTargets, getScopeTargets, getDemolishTargets, getHealTargets,
  tryPlaceSanctuary, placeKeyOnSanctuary, retrieveArtifact,
} from './engine/game.js';
import { renderBoard, setupPanZoom, clearHighlights,
         highlightRevealEdges, highlightMoveTargets, highlightDigTargets,
         highlightCellTargets, fitView } from './ui/render.js';
import { refreshHUD } from './ui/hud.js';
import { renderActionButtons } from './ui/actions.js';
import { showPerilZone, hidePerilZone, rollAndShow } from './ui/dice.js';
import { initLog, refreshLog, toast, showModal, hideModal } from './ui/log.js';
import { showHelp, hideHelp } from './ui/help.js';
import { initLobby, setStartOnlineGameCallback, setBuildSetupScreen } from './ui/lobby.js';
import { avatarHTML } from './ui/avatar.js';
import { net } from './net/peer.js';
import { isOnline, isHost, isPeer, broadcastGameState, applyRemoteState, sendAction, setupGlobalHandlers } from './net/multiplayer.js';
import { deserializeGame } from './net/serialize.js';

/* État UI global */
const ui = {
  game: null,
  selectedExplorers: [],
  difficulty: 'normal',
  numExplorers: 4,
  pendingAction: null,   // action en cours de ciblage
  perilRolled: [],       // quels dés ont été lancés ce tour
  _viewBox: null,
  onlineMode: 'local',   // 'local' | 'host' | 'peer'
};

/* ============================================================
   NAVIGATION ENTRE ÉCRANS
   ============================================================ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ============================================================
   ÉCRAN TITRE + LOBBY
   ============================================================ */
// Initialiser le lobby
setBuildSetupScreen(() => { ui.selectedExplorers = []; buildSetupScreen(); });
initLobby();

// Le lobby appelle ce callback quand la partie en ligne démarre
setStartOnlineGameCallback((role, config) => {
  if (role === 'host') {
    // L'hôte va au setup pour choisir l'équipe
    ui.selectedExplorers = [];
    ui.onlineMode = 'host';
    buildSetupScreen();
    showScreen('screen-setup');
  } else if (role === 'peer') {
    // Les pairs reçoivent la config de l'hôte, puis attendent l'état
    ui.onlineMode = 'peer';
    if (config) {
      // Config reçue -> démarrer directement
      startOnlineGameAsPeer(config);
    } else {
      // Attente de la config
      toast('En attente de la configuration par l\'hôte...', '');
    }
  }
});

// Configurer les handlers globaux réseau (appelés par lobby.js)
setupGlobalHandlers({
  applyRemoteState: (state) => {
    ui.game = deserializeGame(state);
    fullRender();
  },
  handleRemoteAction: (msg, peerId) => {
    // L'hôte reçoit une demande d'action d'un pair
    handleRemoteAction(msg, peerId);
  },
});

document.getElementById('btn-rules').addEventListener('click', () => {
  buildRulesScreen();
  showScreen('screen-rules');
});
// Bouton d'aide (?) dans la topbar : ouvre l'overlay d'aide en jeu
const btnHelp = document.getElementById('btn-help');
if (btnHelp) {
  btnHelp.addEventListener('click', () => showHelp());
}
// Touche Échap : ferme l'aide (priorité) puis les modales
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const help = document.getElementById('help-overlay');
    if (help && !help.classList.contains('hidden')) { hideHelp(); return; }
    const modal = document.getElementById('modal-overlay');
    if (modal && !modal.classList.contains('hidden')) { hideModal(); }
  }
});
document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => showScreen('screen-' + btn.dataset.back));
});

/* ============================================================
   ÉCRAN RÈGLES
   ============================================================ */
function buildRulesScreen() {
  const c = document.getElementById('rules-content');
  c.innerHTML = `
    <h4>Objectif</h4>
    <p>Coopératif (1-6 joueurs). Explorez le temple, placez le Sanctuaire, apportez les <b>3 Clés</b> pour le déverrouiller, récupérez <b>l'Artefact</b> et ressortez vivant avant l'éruption !</p>

    <h4>Tour de joueur</h4>
    <ul>
      <li><span class="rule-icon">2 PA</span> à dépenser : Révéler, Se déplacer, Explorer, Soigner, Manier un objet, Attaquer, Courir, Creuser, capacités spéciales.</li>
      <li><b>Se dépasser</b> (1×/tour) : −1 PV, +1 PA.</li>
      <li>À la fin : lancer le <b>dé de Péril</b>.</li>
    </ul>

    <h4>Dé de Péril (6 faces)</h4>
    <ul>
      <li><b>🤕 Trébucher</b> — si dépassé ce tour, −1 PV.</li>
      <li><b>🌋 Lave</b> — tous les Explorateurs sur tuile Lave perdent 1 PV.</li>
      <li><b>💥 Effondrement</b> — jet de dé vs n° des Ruines sans Éboulis.</li>
      <li><b>⚔ Piège</b> — pics où vous êtes, fléchettes où vous êtes + adjacents.</li>
      <li><b>👁 Réveiller un Gardien</b> — sur la tuile Gardien la plus proche.</li>
      <li><b>🔃 Activer les Gardiens</b> — tous les Gardiens agissent une fois.</li>
    </ul>

    <h4>Gardiens</h4>
    <p>À chaque activation : <b>1.</b> Attaquer (même tuile qu'un actif) → <b>2.</b> Se déplacer vers le plus proche → <b>3.</b> Creuser un Éboulis adjacent. <b>Fuir</b> une tuile avec Gardien = −1 PV par Gardien.</p>

    <h4>Artefact & Malédiction</h4>
    <p>Quand le sac est vide : le Sanctuaire se place dans la colonne la plus profonde. Posez les 3 Clés, prenez l'Artefact → la <b>malédiction</b> s'active : 2 dés de Péril/tour, éruption +2 cases/tour.</p>

    <h4>Volcan</h4>
    <p>Le marqueur recule chaque tour. À 0, il est prêt. Au prochain 🌋 Lave : <b>éruption</b>, la lave engloutit les tuiles. Sortez avant !</p>

    <h4>Fin</h4>
    <p><b>Victoire</b> si un Explorateur ressort avec l'Artefact (médaille selon les survivants). <b>Défaite</b> si tous sont à terre/morts ou l'Artefact est englouti.</p>
  `;
}

/* ============================================================
   ÉCRAN SETUP
   ============================================================ */
function buildSetupScreen() {
  // Gallerie d'Explorateurs
  const gallery = document.getElementById('explorer-gallery');
  gallery.innerHTML = EXPLORERS.map(ex => `
    <div class="explorer-card" data-id="${ex.id}">
      <span class="pick-badge"></span>
      <div class="avatar">${avatarHTML(ex, 60, { rounded: true })}</div>
      <div class="ex-name">${ex.name}</div>
      <div class="ex-hp">${'❤'.repeat(ex.pv)} (${ex.pv} PV)</div>
      <div class="ex-role">${ex.role}</div>
    </div>
  `).join('');

  gallery.querySelectorAll('.explorer-card').forEach(card => {
    card.addEventListener('click', () => toggleExplorer(card.dataset.id));
  });

  updateSoloHint();
  refreshTeamOrder();
}

function toggleExplorer(id) {
  const idx = ui.selectedExplorers.indexOf(id);
  if (idx >= 0) {
    ui.selectedExplorers.splice(idx, 1);
  } else {
    if (ui.selectedExplorers.length >= 6) {
      toast('Maximum 6 Explorateurs.', 'bad');
      return;
    }
    ui.selectedExplorers.push(id);
  }
  // Mettre à jour l'affichage
  document.querySelectorAll('.explorer-card').forEach(card => {
    const pos = ui.selectedExplorers.indexOf(card.dataset.id);
    card.classList.toggle('selected', pos >= 0);
    const badge = card.querySelector('.pick-badge');
    if (badge) badge.textContent = pos >= 0 ? (pos + 1) : '';
  });
  refreshTeamOrder();
}

function refreshTeamOrder() {
  const order = document.getElementById('team-order');
  if (ui.selectedExplorers.length === 0) {
    order.innerHTML = '<span class="team-label">Ordre du tour : </span><span class="team-empty">(sélectionnez des Explorateurs)</span>';
    return;
  }
  const names = ui.selectedExplorers.map((id, i) => {
    const ex = EXPLORERS.find(e => e.id === id);
    return `${i + 1}. ${ex.name}`;
  }).join(' → ');
  order.innerHTML = `<span class="team-label">Ordre du tour : </span>${names}`;
}

function updateSoloHint() {
  const hint = document.getElementById('solo-hint');
  if (ui.numExplorers === 1) {
    hint.textContent = 'Solo : vous contrôlerez 3 à 6 Explorateurs. Sélectionnez-en au moins 3.';
  } else if (ui.numExplorers === 2) {
    hint.textContent = 'À 2 joueurs : chacun contrôle 2 Explorateurs. Sélectionnez-en 4.';
  } else {
    hint.textContent = '';
  }
}

// Boutons de compte de joueurs
document.getElementById('player-count').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-n]');
  if (!btn) return;
  ui.numExplorers = parseInt(btn.dataset.n);
  document.querySelectorAll('#player-count .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateSoloHint();
});
// Difficulté
document.getElementById('difficulty').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-d]');
  if (!btn) return;
  ui.difficulty = btn.dataset.d;
  document.querySelectorAll('#difficulty .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

document.getElementById('btn-start').addEventListener('click', () => {
  const n = ui.numExplorers;
  let min = n;
  if (n === 1) min = 3;
  else if (n === 2) min = 4;
  if (ui.selectedExplorers.length < min) {
    toast(`Sélectionnez au moins ${min} Explorateurs.`, 'bad');
    return;
  }
  startGame();
});

/* ============================================================
   DÉMARRAGE DE LA PARTIE
   ============================================================ */
function startGame() {
  const explorerDefs = ui.selectedExplorers.map(id => EXPLORERS.find(e => e.id === id));
  // Le comptage « Explorateurs » pour la piste Volcan = nombre d'unités en jeu
  // (en solo ou à 2, on contrôle plusieurs Explorateurs).
  const effectiveExplorers = explorerDefs.length;
  ui.game = createGame({
    explorers: explorerDefs,
    difficulty: ui.difficulty,
    numExplorers: effectiveExplorers,
  });
  // Ajouter un log de bienvenue
  ui.game.logEntries = [];
  log('═══ Sub Terra II — Début de l\'expédition ═══', 'system');
  log(`Équipe : ${explorerDefs.map(e => e.name).join(', ')}.`, 'system');
  log(`Difficulté : ${ui.difficulty}. Volcan à ${ui.game.volcano.position}.`, 'system');
  log(`— Tour de ${currentPlayer(ui.game).name} —`, 'system');

  showScreen('screen-game');
  initLog();
  setupPanZoom(ui);
  fullRender();

  // Si hôte en ligne : annoncer la config + diffuser l'état initial
  if (ui.onlineMode === 'host') {
    import('./net/peer.js').then(({ broadcast }) => {
      broadcast({ type: 'gameConfig', config: {
        explorers: ui.selectedExplorers,
        difficulty: ui.difficulty,
        numExplorers: effectiveExplorers,
      }});
      broadcastGameState(ui.game);
    });
  }
}

/* Démarrage côté pair : reçoit la config de l'hôte */
function startOnlineGameAsPeer(config) {
  if (!config) return;
  ui.selectedExplorers = config.explorers || [];
  ui.difficulty = config.difficulty || 'normal';
  ui.numExplorers = config.numExplorers || 4;
  ui.onlineMode = 'peer';
  showScreen('screen-game');
  initLog();
  setupPanZoom(ui);
  // L'état initial viendra via gameState. Afficher un message d'attente.
  toast('En attente de l\'état de la partie...', '');
}

/* Log helper local */
function log(msg, type = '') {
  ui.game.logEntries.push({ turn: ui.game.turn, msg, type });
}

/* ============================================================
   RENDU COMPLET
   ============================================================ */
function fullRender() {
  renderBoard(ui.game, ui);
  refreshHUD(ui.game, ui);
  renderActionButtons(ui.game, ui);
  refreshLog(ui.game);
  fitView(ui);
}

/* ============================================================
   GESTION DES ACTIONS
   ============================================================ */
ui.onAction = function (actionId) {
  const game = ui.game;
  const p = currentPlayer(game);

  // Si une action de ciblage est en cours et qu'on change d'action, annuler
  clearHighlights();
  ui.pendingAction = null;

  switch (actionId) {
    case 'reveal':    startReveal(); break;
    case 'move':      startMove(); break;
    case 'explore':   startExplore(); break;
    case 'heal':      doHeal(); break;
    case 'pickup':    performPickup(game); afterAction(); break;
    case 'attack':    performAttack(game); afterAction(); break;
    case 'run':       startRun(); break;
    case 'dig':       startDig(); break;
    case 'push':      performPush(game); afterAction(); break;
    case 'crawl':     startCrawl(); break;
    case 'escape':    performEscape(game); afterAction(); break;
    case 'endTurn':   startPerilPhase(); break;
  }
};

ui.onAbility = function (abilityId) {
  const game = ui.game;
  const p = currentPlayer(game);
  const ability = p.abilities.find(a => a.id === abilityId);
  if (!ability || ability.passive) return;
  if (!canUseAbility(game, abilityId)) return;

  clearHighlights();
  // Capacités nécessitant un ciblage
  switch (ability.effect) {
    case 'dig':
      startAbilityDig(abilityId); break;
    case 'reveal_twice':
      startAbilityRevealTwice(abilityId); break;
    case 'move_twice':
      startAbilityMoveTwice(abilityId); break;
    case 'grenade':
      startAbilityCellTarget(abilityId, getGrenadeTargets(game, p), '💥 Grenade'); break;
    case 'snipe':
      startAbilityCellTarget(abilityId, getSnipeTargets(game, p), '🎯 Tir'); break;
    case 'scope':
      startAbilityScope(abilityId); break;
    case 'demolish':
      startAbilityDemolish(abilityId); break;
    case 'heal':
      startAbilityHeal(abilityId); break;
    case 'revive':
      startAbilityRevive(abilityId); break;
    case 'purify':
      startAbilityPurify(abilityId); break;
    case 'annihilate':
      useAbility(game, abilityId); afterAction(); break;
    case 'prepare':
      useAbility(game, abilityId); afterAction(); break;
    case 'consolidate':
      useAbility(game, abilityId); afterAction(); break;
    case 'research':
      startAbilityResearch(abilityId); break;
    case 'order':
      startAbilityOrder(abilityId); break;
  }
};

/* --- Révéler --- */
function startReveal() {
  const game = ui.game;
  const p = currentPlayer(game);
  const cell = explorerCell(game, p);
  const edges = getOpenEdges(game, p);
  if (edges.length === 0) { toast('Aucune issue ouverte.', 'bad'); return; }
  ui.pendingAction = 'reveal';
  highlightRevealEdges(game, ui, cell, (dir) => {
    const result = performReveal(game, cell, dir);
    if (result && result.needsRotationChoice) {
      // Plusieurs orientations possibles : laisser l'utilisateur choisir
      showRotationChoice(result, cell, dir, 'reveal');
    } else {
      checkBagEmpty();
      afterAction();
    }
  });
  toast('Cliquez une issue dorée pour révéler.', '');
}

/* Affiche un dialogue de choix d'orientation pour une tuile à placer.
   context = 'reveal' | 'explore' | 'scope' | 'research' */
function showRotationChoice(choice, cell, dir, context) {
  const game = ui.game;
  const { tileDef, rotations } = choice;
  const typeName = tileDef.type.charAt(0).toUpperCase() + tileDef.type.slice(1);
  // Construire un aperçu visuel de chaque orientation
  const options = rotations.map(r => {
    const label = r === 0 ? '0° (telle quelle)' : `${r}°`;
    return `<button class="btn btn-toggle rotation-pick" data-rot="${r}" style="display:flex;flex-direction:column;align-items:center;padding:8px">
      <svg viewBox="-50 -50 100 100" width="60" height="60">
        <image href="assets/images/tiles/${tileDef.type}.png" x="-48" y="-48" width="96" height="96"
          transform="rotate(${r})" preserveAspectRatio="xMidYMid slice"/>
      </svg>
      <span style="font-size:11px;display:block;margin-top:4px">${label}</span>
    </button>`;
  }).join('');
  showModal('Choisir l\'orientation', `
    <p>Tuile piochée : <b>${typeName}</b>. Plusieurs orientations sont possibles.</p>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${options}</div>
  `, [{ label: 'Annuler', style: 'btn-ghost', onClick: () => { afterAction(); } }]);
  // Placer la modale sur le côté (ne pas cacher le plateau)
  document.getElementById('modal-overlay').classList.add('side');
  // Brancher les boutons d'orientation
  setTimeout(() => {
    document.querySelectorAll('.rotation-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        const rot = parseInt(btn.dataset.rot);
        hideModal();
        // Re-piocher la même tuile avec la rotation choisie
        if (context === 'reveal') {
          performReveal(game, cell, dir, rot);
          checkBagEmpty();
        } else if (context === 'explore') {
          performExplore(game, cell, dir, rot);
        }
        afterAction();
      });
    });
  }, 50);
}

function checkBagEmpty() {
  const game = ui.game;
  if (game.bag.length === 0 && !game.sanctuary) {
    tryPlaceSanctuary(game);
  }
}

/* --- Se déplacer --- */
function startMove() {
  const game = ui.game;
  const p = currentPlayer(game);
  const targets = getMoveTargets(game, p);
  if (targets.length === 0) { toast('Aucune tuile atteignable.', 'bad'); return; }
  ui.pendingAction = 'move';
  highlightMoveTargets(game, ui, targets, (t) => {
    performMove(game, t.cell);
    afterAction();
  });
}

/* --- Explorer --- */
function startExplore() {
  const game = ui.game;
  const p = currentPlayer(game);
  const cell = explorerCell(game, p);
  const edges = getOpenEdges(game, p);
  if (edges.length === 0) { toast('Aucune issue ouverte.', 'bad'); return; }
  ui.pendingAction = 'explore';
  highlightRevealEdges(game, ui, cell, (dir) => {
    const result = performExplore(game, cell, dir);
    if (result && result.needsRotationChoice) {
      showRotationChoice(result, cell, dir, 'explore');
    } else {
      checkBagEmpty();
      afterAction();
    }
  });
  toast('Explorer : révéler + entrer immédiatement.', '');
}

/* --- Soigner --- */
function doHeal() {
  const game = ui.game;
  const p = currentPlayer(game);
  const cell = explorerCell(game, p);
  // Cibles soignables sur la tuile : soi-même si blessé, + alliés blessés présents
  const selfHurt = p.hp < p.maxHp;
  const hurtAlliesHere = game.explorers.filter(e =>
    e.id !== p.id && isOnCellLocal(e, cell) && e.hp < e.maxHp &&
    (e.state === 'active' || e.state === 'down')
  );

  if (selfHurt && hurtAlliesHere.length === 0) {
    // Cas simple : se soigner soi-même
    performHeal(game, p);
    afterAction();
  } else if (hurtAlliesHere.length > 0) {
    // Choix entre soi-même et les alliés présents
    const candidates = selfHurt ? [p, ...hurtAlliesHere] : hurtAlliesHere;
    if (candidates.length === 1) {
      performHeal(game, candidates[0]);
      afterAction();
    } else {
      // Surligner les tuiles des candidats pour choisir
      const cells = candidates.map(c => game.board.cells.get(c.position)).filter(Boolean);
      highlightCellTargets(game, cells, (c) => {
        const target = candidates.find(t => t.x === c.x && t.y === c.y);
        if (target) { performHeal(game, target); afterAction(); }
      });
      toast('Soigner : cliquez un Explorateur à soigner.', '');
    }
  } else {
    toast('Personne à soigner ici.', 'bad');
    afterAction();
  }
}
function isOnCellLocal(explorer, cell) {
  return explorer.x === cell.x && explorer.y === cell.y;
}

/* --- Courir = 2 PA pour jusqu'à 3 déplacements (manuel p.11) --- */
function startRun() {
  const game = ui.game;
  const p = currentPlayer(game);
  const targets = getMoveTargets(game, p);
  if (targets.length === 0) { toast('Aucune tuile atteignable.', 'bad'); return; }
  if (game.ap < 2) { toast('Pas assez de PA pour Courir (2 PA).', 'bad'); return; }
  // Dépenser les 2 PA une seule fois au début de la course
  game.ap -= 2;
  ui.pendingAction = 'run';
  let stepsLeft = 3;
  toast("Courir : jusqu'à 3 déplacements. Cliquez une tuile.", '');
  const doStep = () => {
    highlightMoveTargets(game, ui, getMoveTargets(game, p), (t) => {
      performMove(game, t.cell, 0);  // déplacement gratuit (les 2 PA déjà dépensés)
      stepsLeft--;
      fullRender();
      if (stepsLeft > 0 && getMoveTargets(game, p).length > 0 && p.state === 'active') {
        toast(`Encore ${stepsLeft} déplacement(s) (ou cliquez ailleurs pour finir).`, '');
        doStep();
      } else {
        afterAction();
      }
    });
  };
  doStep();
}

/* --- Creuser --- */
function startDig() {
  const game = ui.game;
  const p = currentPlayer(game);
  const targets = getDigTargets(game, p);
  if (targets.length === 0) { toast('Aucun Éboulis à creuser.', 'bad'); return; }
  ui.pendingAction = 'dig';
  highlightDigTargets(game, targets, (c) => {
    performDig(game, c);
    afterAction();
  });
}

/* --- Ramper (à terre) --- */
function startCrawl() {
  const game = ui.game;
  const p = currentPlayer(game);
  const targets = getMoveTargets(game, p, true);
  if (targets.length === 0) { toast('Aucune tuile atteignable.', 'bad'); return; }
  ui.pendingAction = 'crawl';
  highlightMoveTargets(game, ui, targets, (t) => {
    performCrawl(game, t.cell);
    // Après ramper, le tour est terminé
    startPerilPhase();
  });
}

/* ============================================================
   CAPACITÉS — CIBLAGES SPÉCIFIQUES
   ============================================================ */
function startAbilityDig(abilityId) {
  const game = ui.game; const p = currentPlayer(game);
  const targets = getDigTargets(game, p);
  highlightDigTargets(game, targets, (c) => {
    useAbility(game, abilityId, c); afterAction();
  });
}
function startAbilityRevealTwice(abilityId) {
  const game = ui.game; const p = currentPlayer(game);
  const cell = explorerCell(game, p);
  if (getOpenEdges(game, p).length === 0) { toast('Aucune issue.', 'bad'); return; }
  highlightRevealEdges(game, ui, cell, (dir) => {
    useAbility(game, abilityId);  // coûte 1 PA
    const result = performReveal(game, cell, dir, null, 0);  // révélation gratuite
    if (result && result.needsRotationChoice) {
      showRotationChoice(result, cell, dir, 'reveal');
      return;
    }
    checkBagEmpty();
    // 2e révélation gratuite
    if (getOpenEdges(game, p).length > 0 && game.bag.length > 0) {
      toast('2e révélation (gratuite).', '');
      highlightRevealEdges(game, ui, cell, (dir2) => {
        const r2 = performReveal(game, cell, dir2, null, 0);  // gratuit
        if (r2 && r2.needsRotationChoice) { showRotationChoice(r2, cell, dir2, 'reveal'); return; }
        checkBagEmpty();
        afterAction();
      });
    } else {
      afterAction();
    }
  });
}
function startAbilityMoveTwice(abilityId) {
  const game = ui.game; const p = currentPlayer(game);
  const targets = getMoveTargets(game, p);
  if (targets.length === 0) { toast('Aucune tuile.', 'bad'); return; }
  useAbility(game, abilityId);  // coûte 1 PA
  highlightMoveTargets(game, ui, getMoveTargets(game, p), (t) => {
    performMove(game, t.cell, 0);  // déplacement gratuit
    fullRender();
    if (getMoveTargets(game, p).length > 0 && p.state === 'active') {
      toast('2e déplacement gratuit.', '');
      highlightMoveTargets(game, ui, getMoveTargets(game, p), (t2) => {
        performMove(game, t2.cell, 0);  // déplacement gratuit
        afterAction();
      });
    } else {
      afterAction();
    }
  });
}
function startAbilityCellTarget(abilityId, targets, label) {
  const game = ui.game;
  if (targets.length === 0) { toast('Aucune cible.', 'bad'); return; }
  highlightCellTargets(game, targets, (c) => {
    useAbility(game, abilityId, c); afterAction();
  });
  toast(label + ' : cliquez une cible.', '');
}
function startAbilityScope(abilityId) {
  const game = ui.game; const p = currentPlayer(game);
  const targets = getScopeTargets(game, p);
  if (targets.length === 0) { toast('Aucune tuile visible.', 'bad'); return; }
  // Surligner les tuiles sources
  highlightCellTargets(game, targets.map(t => t.cell), (c) => {
    const t = targets.find(tt => tt.cell.id === c.id);
    useAbility(game, abilityId, t); checkBagEmpty(); afterAction();
  });
  toast('Lunette : révéler une tuile visible (≤3).', '');
}
function startAbilityDemolish(abilityId) {
  const game = ui.game; const p = currentPlayer(game);
  const targets = getDemolishTargets(game, p);
  if (targets.length === 0) { toast('Aucun mur à démolir.', 'bad'); return; }
  highlightCellTargets(game, targets.map(t => t.cell), (c) => {
    const t = targets.find(tt => tt.cell.id === c.id);
    useAbility(game, abilityId, t); afterAction();
  });
  toast('Démolir : cliquez le mur à détruire.', '');
}
function startAbilityHeal(abilityId) {
  const game = ui.game; const p = currentPlayer(game);
  const targets = getHealTargets(game, p);
  if (targets.length === 0) { toast('Aucun allié à soigner.', 'bad'); return; }
  // Les cibles sont des explorateurs : on montre leurs tuiles
  const cells = targets.map(e => game.board.cells.get(e.position)).filter(Boolean);
  highlightCellTargets(game, cells, (c) => {
    const e = targets.find(tt => tt.x === c.x && tt.y === c.y);
    useAbility(game, abilityId, e); afterAction();
  });
  toast('Guérir : cliquez un allié visible (≤2).', '');
}
function startAbilityRevive(abilityId) {
  const game = ui.game; const p = currentPlayer(game);
  const targets = game.explorers.filter(e => e.id !== p.id && e.state !== 'dead' && e.state !== 'escaped');
  const cells = targets.map(e => game.board.cells.get(e.position)).filter(Boolean);
  if (cells.length === 0) { toast('Aucun allié.', 'bad'); return; }
  highlightCellTargets(game, cells, (c) => {
    const e = targets.find(tt => tt.x === c.x && tt.y === c.y);
    useAbility(game, abilityId, e); afterAction();
  });
  toast('Ranimer : cliquez un allié.', '');
}
function startAbilityPurify(abilityId) {
  const game = ui.game; const p = currentPlayer(game);
  const cells = [...game.board.cells.values()].filter(c => c.guardians.length > 0 && !c.isSanctuary && c.id !== p.position && !c.flipped);
  if (cells.length === 0) { toast('Aucun Gardien à purifier.', 'bad'); return; }
  highlightCellTargets(game, cells, (c) => {
    useAbility(game, abilityId, c); afterAction();
  });
  toast('Purifier : cliquez une tuile avec Gardiens.', '');
}
function startAbilityResearch(abilityId) {
  const game = ui.game; const p = currentPlayer(game);
  if (game.journalBag.length === 0) { toast('Plus de tuiles Journal.', 'bad'); return; }
  // Placer une tuile Journal à côté de n'importe quelle tuile : on laisse
  // l'utilisateur cliquer une tuile, puis une issue.
  toast('Rechercher : cliquez une tuile puis une issue.', '');
  selectTileThenEdge((cell, dir) => {
    useAbility(game, abilityId, { anchorCell: cell, openDir: dir });
    afterAction();
  });
}
function startAbilityOrder(abilityId) {
  const game = ui.game; const p = currentPlayer(game);
  const allies = game.explorers.filter(e => e.state === 'active' && e.id !== p.id);
  const cells = allies.map(e => game.board.cells.get(e.position)).filter(Boolean);
  if (cells.length === 0) { toast('Aucun allié ordonnable.', 'bad'); return; }
  highlightCellTargets(game, cells, (c) => {
    const ally = allies.find(a => a.x === c.x && a.y === c.y);
    // Puis choisir la destination de l'allié
    const allyTargets = getMoveTargets(game, ally);
    if (allyTargets.length === 0) { toast(`${ally.name} ne peut bouger.`, 'bad'); afterAction(); return; }
    highlightMoveTargets(game, ui, allyTargets, (t) => {
      useAbility(game, abilityId, { explorer: ally, cell: t.cell });
      afterAction();
    });
  });
  toast('Ordonner : cliquez un allié à déplacer.', '');
}

/* Helper : sélectionner une tuile puis une de ses issues ouvertes. */
function selectTileThenEdge(callback) {
  const game = ui.game;
  const tilesLayer = document.getElementById('tiles-layer');
  const handler = (e) => {
    const g = e.target.closest('.tile-group');
    if (!g) return;
    const cellId = g.dataset.cellId;
    const cell = game.board.cells.get(cellId);
    if (!cell || cell.flipped) return;
    tilesLayer.removeEventListener('click', handler);
    const edges = [];
    const { DIRS, DELTA } = tileData();
    for (const dir of DIRS) {
      if (!cell.walls[dir]) continue;
      const [dx, dy] = DELTA[dir];
      if (!game.board.cells.has(`${cell.x + dx},${cell.y + dy}`)) edges.push(dir);
    }
    if (edges.length === 0) { toast('Aucune issue ouverte.', 'bad'); return; }
    highlightRevealEdges(game, ui, cell, (dir) => callback(cell, dir));
  };
  tilesLayer.addEventListener('click', handler);
}
function tileData() {
  // import local pour éviter boucle
  return { DIRS: ['N','E','S','W'], DELTA: { N:[0,-1], E:[1,0], S:[0,1], W:[-1,0] } };
}

/* ============================================================
   APRÈS CHAQUE ACTION
   ============================================================ */
function afterAction() {
  clearHighlights();
  ui.pendingAction = null;
  // Vérifier les conditions de fin (éruption, tous à terre)
  if (checkGameEnd()) return;
  fullRender();
  // En ligne : diffuser le nouvel état aux autres joueurs.
  // Modèle "tour-par-tour avec diffusion" : le joueur actif exécute son
  // action localement puis broadcast l'état complet. Les autres se contentent
  // d'afficher l'état reçu. Pas besoin d'hôte autoritaire.
  if (ui.onlineMode !== 'local' && ui.game) {
    broadcastGameState(ui.game);
  }
}

/* ============================================================
   ACTIONS À DISTANCE (multijoueur — hôte reçoit d'un pair)
   ============================================================ */
function handleRemoteAction(msg, fromPeerId) {
  if (ui.onlineMode !== 'host') return;
  const game = ui.game;
  if (!game) return;
  const p = currentPlayer(game);
  // Exécuter l'action demandée sur l'état de l'hôte
  const { id, args } = msg;
  switch (id) {
    case 'reveal':
      if (args.cellId && args.dir) {
        const cell = game.board.cells.get(args.cellId);
        performReveal(game, cell, args.dir, args.rotation || null);
      }
      break;
    case 'move':
      if (args.cellId) {
        const cell = game.board.cells.get(args.cellId);
        performMove(game, cell, args.costAP ?? 1);
      }
      break;
    case 'explore':
      if (args.cellId && args.dir) {
        const cell = game.board.cells.get(args.cellId);
        performExplore(game, cell, args.dir, args.rotation || null);
      }
      break;
    case 'heal':
      if (args.targetId) {
        const target = game.explorers.find(e => e.id === args.targetId);
        performHeal(game, target || p);
      } else {
        performHeal(game, p);
      }
      break;
    case 'pickup':  performPickup(game); break;
    case 'attack':  performAttack(game); break;
    case 'dig':
      if (args.cellId) {
        const cell = game.board.cells.get(args.cellId);
        performDig(game, cell);
      }
      break;
    case 'push':    performPush(game); break;
    case 'crawl':
      if (args.cellId) {
        const cell = game.board.cells.get(args.cellId);
        performCrawl(game, cell);
      }
      break;
    case 'escape':  performEscape(game); break;
    case 'endTurn': startPerilPhase(); return; // géré séparément
    case 'ability':
      if (args.abilityId) useAbility(game, args.abilityId, args.target);
      break;
  }
  // L'hôte exécute afterAction (qui diffusera l'état)
  afterAction();
}

/* ============================================================
   PHASE DE PÉRIL
   ============================================================ */
function startPerilPhase() {
  clearHighlights();
  const game = ui.game;
  game.phase = 'perilRoll';
  ui.perilRolled = [];
  showPerilZone(game, ui);
  hideEndTurnButton();
  toast('Lancez le dé de Péril !', 'peril');
}

ui.onRollPeril = function (dieIndex) {
  const game = ui.game;
  if (ui.perilRolled[dieIndex]) return;
  const dice = document.querySelectorAll('#peril-dice .die');
  const die = dice[dieIndex];
  rollAndShow(die, (faceId) => {
    ui.perilRolled[dieIndex] = faceId;
    const p = currentPlayer(game);
    logLocal(`🎲 ${p.name} : ${PERIL_FACES[faceId].glyph} ${PERIL_FACES[faceId].label}.`, 'peril');
    toast(`${PERIL_FACES[faceId].glyph} ${PERIL_FACES[faceId].label}`, 'peril');
    resolvePeril(game, faceId, p);
    fullRender();
    // Si 2 dés attendus, attendre le 2e
    const needTwo = game.curseActive;
    const allRolled = needTwo ? ui.perilRolled.length >= 2 && ui.perilRolled[1] : true;
    if (allRolled) {
      // Vérifier fin
      if (checkGameEnd()) return;
      // Terminer le tour du joueur
      setTimeout(() => {
        hidePerilZone();
        showEndTurnButton();
        finishExplorerTurn();
      }, 800);
    }
  });
};

function hideEndTurnButton() {
  const btn = document.querySelector('[data-action="endTurn"]');
  if (btn) btn.style.display = 'none';
}
function showEndTurnButton() {
  const btn = document.querySelector('[data-action="endTurn"]');
  if (btn) btn.style.display = '';
}

function finishExplorerTurn() {
  const game = ui.game;
  // Gérer les actions spéciales sur le sanctuaire avant de passer
  const p = currentPlayer(game);
  const cell = explorerCell(game, p);
  // Si sur le sanctuaire avec une clé, proposer de la poser automatiquement
  // (géré via bouton ramasser/poser — pas auto)
  endExplorerTurn(game);
  // Propagation post-tour si éruption en cours
  fullRender();
  if (checkGameEnd()) return;
  // Repasser en phase exploration pour le joueur suivant
  game.phase = 'explorerTurn';
  toast(`Au tour de ${currentPlayer(game).name}.`, '');
  fullRender();
}

function logLocal(msg, type = '') {
  ui.game.logEntries.push({ turn: ui.game.turn, msg, type });
}

/* ============================================================
   FIN DE PARTIE
   ============================================================ */
function checkGameEnd() {
  const game = ui.game;
  if (!game.winner) return false;
  showEndScreen();
  return true;
}

function showEndScreen() {
  const game = ui.game;
  const won = game.winner === 'players';
  const survivors = game.explorers.filter(e => e.state !== 'dead');
  const dead = game.explorers.filter(e => e.state === 'dead');
  const medalEmoji = {
    'Légendaire': '👑', 'Or': '🥇', 'Argent': '🥈', 'Bronze': '🥉',
    'Oubliés à jamais': '💀',
  };
  document.getElementById('end-content').innerHTML = `
    <h1 class="${won ? 'victory' : 'defeat'}">${won ? 'VICTOIRE' : 'DÉFAITE'}</h1>
    <div class="medal">${medalEmoji[game.medal] || ''}</div>
    <div class="end-detail">
      <p><b>${game.medal}</b></p>
      ${won
        ? `<p>L'Artefact a été ramené à la surface !</p>
           <p>Survivants : ${survivors.map(e => e.name).join(', ') || 'aucun'}</p>
           ${dead.length ? `<p>Héros perdus : ${dead.map(e => e.name).join(', ')}</p>` : ''}`
        : `<p>${game.medal === 'Oubliés à jamais'
            ? "Personne n'a réussi à s'échapper avec l'Artefact..."
            : 'Le volcan a eu raison de l\'expédition.'}</p>`}
      <p>Durée : ${game.turn} tours.</p>
    </div>
    <div class="end-actions">
      <button class="btn btn-primary btn-lg" id="end-replay">Nouvelle expédition</button>
      <button class="btn btn-ghost" id="end-title">Écran titre</button>
    </div>
  `;
  showScreen('screen-end');
  document.getElementById('end-replay').addEventListener('click', () => {
    ui.selectedExplorers = [];
    buildSetupScreen();
    showScreen('screen-setup');
  });
  document.getElementById('end-title').addEventListener('click', () => showScreen('screen-title'));
}

/* Menu (placeholder) */
document.getElementById('btn-menu').addEventListener('click', () => {
  showModal('Menu', `
    <p>Tour ${ui.game ? ui.game.turn : '-'} · Phase : ${ui.game ? ui.game.phase : '-'}</p>
    <p>Sac : ${ui.game ? ui.game.bag.length : '-'} tuile(s) restante(s).</p>
    ${ui.game && ui.game.sanctuary ? '<p>Sanctuaire découvert.</p>' : ''}
    ${ui.game && ui.game.curseActive ? '<p style="color:var(--c-blood)">☠ Malédiction active.</p>' : ''}
  `, [
    { label: 'Reprendre', style: 'btn-primary' },
    { label: 'Abandonner', style: 'btn-ghost', onClick: () => showScreen('screen-title') },
  ]);
});
