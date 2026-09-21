/* main.js — Game orchestrator: screen transitions, actions, peril, turns */
import { createGameState, log, getActiveExplorer, getCell, getExplorerAt } from './engine/state.js';
import {
  reveal, move, explore, performHeal, attack, dig, run,
  manageObject, push, crawl, getMoveTargets, getRevealTargets,
  getDigTargets, canDoAction, spendAP, onTilePlaced,
  triggerSpikes, triggerDarts,
  drawTileForReveal, confirmTilePlacement,
  drawTileForExplore, confirmExplorePlacement,
} from './engine/actions.js';
import {
  canUseAbility, useIlluminate, useSprint, useOrder, useResearch,
  useExcavate, useConsolidate, useScope, useSnipe, useGrenade,
  useDemolish, useAnnihilate, usePrepare, useHeal, useRevive,
  usePurify, useAdventurer, hasScholar, hasAgile,
  drawTileForScope, confirmScopePlacement,
  drawTileForResearch, confirmResearchPlacement,
} from './engine/abilities.js';
import { startExplorerTurn, endExplorerTurn, endGameTurn, getTurnOrder } from './engine/turn.js';
import { checkEndConditions, getMedal } from './engine/endgame.js';
import { rollPeril, rollDie, PERIL_FACES } from './engine/perils.js';
import { resolvePeril } from './engine/peril-resolution.js';
import { tryPlaceSanctuary, retrieveArtifact, isSanctuaryUnlocked } from './engine/artefact.js';
import { DIRS, DIR_DELTA, OPP, areConnected, getAdjacentConnectedCells, lineOfSight, rotateWalls } from './engine/board.js';
import { EXPLORERS, ABILITIES } from './engine/explorers.js';
import { TEMPLE_TILES } from './engine/tiles.js';
import { initBoard, renderBoard, fitView, clearHighlights,
         highlightMoveTargets, highlightRevealEdges, highlightDigTargets,
         highlightCellTargets } from './ui/render.js';
import { refreshHUD } from './ui/hud.js';
import { renderActionButtons } from './ui/actions.js';
import { refreshLog, toast } from './ui/log.js';

/* ── Global UI state ── */
const ui = {
  state: null,
  selectedExplorers: [],
  difficulty: 'normal',
  pendingAction: null,
  pendingAbility: null,
  pendingAbilityStep: 0,
  pendingAbilityData: null,
  runStepsLeft: 0,
  illuminateRevealsLeft: 0,
  sprintMovesLeft: 0,
};

/* ============================================================
   SCREEN NAVIGATION
   ============================================================ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ============================================================
   TITLE SCREEN
   ============================================================ */
document.getElementById('btn-local-game').addEventListener('click', () => {
  ui.selectedExplorers = [];
  buildSetupScreen();
  showScreen('screen-setup');
});

/* ============================================================
   SETUP SCREEN
   ============================================================ */
function buildSetupScreen() {
  const gallery = document.getElementById('explorer-gallery');
  gallery.innerHTML = EXPLORERS.map(ex => `
    <div class="explorer-card" data-id="${ex.id}">
      <span class="pick-badge"></span>
      <div class="avatar" style="border:3px solid ${ex.color};overflow:hidden;border-radius:50%"><img src="assets/images/explorers/${ex.id}.png" alt="" style="width:100%;height:100%;object-fit:cover"></div>
      <div class="ex-name">${ex.name}</div>
      <div class="ex-hp">${'❤'.repeat(ex.pv)} (${ex.pv} PV)</div>
      <div class="ex-role">${ex.role}</div>
    </div>
  `).join('');

  gallery.querySelectorAll('.explorer-card').forEach(card => {
    card.addEventListener('click', () => toggleExplorer(card.dataset.id));
  });

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

document.getElementById('difficulty-select').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-d]');
  if (!btn) return;
  ui.difficulty = btn.dataset.d;
  document.querySelectorAll('#difficulty-select .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

document.getElementById('btn-setup-back').addEventListener('click', () => showScreen('screen-title'));

document.getElementById('btn-start').addEventListener('click', () => {
  if (ui.selectedExplorers.length < 3) {
    toast('Sélectionnez au moins 3 Explorateurs.', 'bad');
    return;
  }
  startGame();
});

/* ============================================================
   START GAME
   ============================================================ */
function startGame() {
  ui.state = createGameState({
    explorerIds: ui.selectedExplorers,
    difficulty: ui.difficulty,
  });
  log(ui.state, '═══ Sub Terra II — Début de l\'expédition ═══');
  log(ui.state, `Équipe : ${ui.selectedExplorers.map(id => EXPLORERS.find(e => e.id === id).name).join(', ')}.`);
  log(ui.state, `Difficulté : ${ui.difficulty}. Volcan à ${ui.state.volcano.position}.`);
  log(ui.state, `— Tour de ${getActiveExplorer(ui.state).name} —`);

  showScreen('screen-game');
  const svg = document.getElementById('board-svg');
  initBoard(svg);
  startExplorerTurn(ui.state);
  fullRender();
  setTimeout(() => fitView(), 50);
}

/* ============================================================
   FULL RENDER
   ============================================================ */
function fullRender() {
  const state = ui.state;

  while (state.phase === 'explorerTurn' && !state.winner) {
    const explorer = getActiveExplorer(state);
    if (!explorer || (explorer.state !== 'dead' && explorer.state !== 'escaped')) break;
    endExplorerTurn(state);
  }

  if (state.winner) { checkGameEnd(); return; }

  renderBoard(state, ui);
  refreshHUD(state);
  renderActionButtons(state, ui);
  refreshLog(state);
}

/* ============================================================
   ACTION HANDLING
   ============================================================ */
ui.onAction = function(actionId) {
  clearHighlights();
  ui.pendingAction = null;
  const state = ui.state;

  switch (actionId) {
    case 'reveal':    startReveal(); break;
    case 'move':      startMove(); break;
    case 'explore':   startExplore(); break;
    case 'heal':      doHeal(); break;
    case 'attack':    doAttack(); break;
    case 'dig':       startDig(); break;
    case 'run':       startRun(); break;
    case 'manage':    startManage(); break;
    case 'push':      doPush(); break;
    case 'crawl':     startCrawl(); break;
    case 'escape':     doEscape(); break;
    case 'endTurn':   startPerilPhase(); break;
  }
};

ui.onAbility = function(abilityId) {
  clearHighlights();
  ui.pendingAbility = abilityId;
  ui.pendingAbilityStep = 0;
  ui.pendingAbilityData = null;

  switch (abilityId) {
    case 'illuminate':  startIlluminate(); break;
    case 'sprint':      startSprint(); break;
    case 'order':       startOrder(); break;
    case 'research':    startResearch(); break;
    case 'excavate':    startExcavate(); break;
    case 'consolidate': doConsolidate(); break;
    case 'scope':       startScope(); break;
    case 'snipe':       startSnipe(); break;
    case 'grenade':     startGrenade(); break;
    case 'demolish':    startDemolish(); break;
    case 'annihilate':  doAnnihilate(); break;
    case 'prepare':     doPrepare(); break;
    case 'heal':        startAbilityHeal(); break;
    case 'revive':      startRevive(); break;
    case 'purify':      startPurify(); break;
    case 'adventurer':  toast('Aventurière : dépensez 1 PV pour relancer un dé (utilisé pendant les jets).'); break;
  }
};

/* ── Reveal ── */
function startReveal() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  const dirs = getRevealTargets(state);
  if (dirs.length === 0) { toast('Aucune issue à révéler.', 'bad'); return; }
  ui.pendingAction = 'reveal';
  highlightRevealEdges(state, cell, dirs, (dir) => {
    const draw = drawTileForReveal(state, dir);
    if (!draw.ok) {
      toast(draw.reason === 'empty_bag' ? 'Sac de tuiles vide.' : 'Placement impossible.', 'bad');
      afterAction();
      return;
    }
    if (draw.tiles.length > 1) {
      showTileChoiceModal(draw, (chosenTile) => {
        showRotationPickerModal(draw, chosenTile, (tile, rotation) => {
          const result = confirmTilePlacement(state, tile.tileDef, rotation, tile.x, tile.y);
          returnTileToBag(state, draw, chosenTile);
          if (result.ok) {
            checkBagEmpty();
            afterAction();
          } else {
            toast('Placement impossible.', 'bad');
            afterAction();
          }
        });
      });
    } else {
      const chosenTile = draw.tiles[0];
      showRotationPickerModal(draw, chosenTile, (tile, rotation) => {
        const result = confirmTilePlacement(state, tile.tileDef, rotation, tile.x, tile.y);
        if (result.ok) {
          checkBagEmpty();
          afterAction();
        } else {
          toast('Placement impossible.', 'bad');
          afterAction();
        }
      });
    }
  });
  toast('Cliquez une issue dorée pour révéler.');
}

/* ── Move ── */
function startMove() {
  const state = ui.state;
  const targets = getMoveTargets(state);
  if (targets.length === 0) { toast('Aucune tuile atteignable.', 'bad'); return; }
  ui.pendingAction = 'move';
  highlightMoveTargets(state, targets, (t) => {
    const result = move(state, t.x, t.y);
    afterAction();
  });
  toast('Cliquez une tuile surlignée.');
}

/* ── Explore ── */
function startExplore() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  const dirs = getRevealTargets(state);
  if (dirs.length === 0) { toast('Aucune issue à explorer.', 'bad'); return; }
  ui.pendingAction = 'explore';
  highlightRevealEdges(state, cell, dirs, (dir) => {
    const draw = drawTileForExplore(state, dir);
    if (!draw.ok) {
      toast(draw.reason === 'empty_bag' ? 'Sac de tuiles vide.' : 'Exploration impossible.', 'bad');
      afterAction();
      return;
    }
    if (draw.tiles.length > 1) {
      showTileChoiceModal(draw, (chosenTile) => {
        showRotationPickerModal(draw, chosenTile, (tile, rotation) => {
          const result = confirmExplorePlacement(state, tile.tileDef, rotation, tile.x, tile.y, draw.dir);
          returnTileToBag(state, draw, chosenTile);
          if (result.ok) {
            checkBagEmpty();
            afterAction();
          } else {
            toast('Exploration impossible.', 'bad');
            afterAction();
          }
        });
      });
    } else {
      const chosenTile = draw.tiles[0];
      showRotationPickerModal(draw, chosenTile, (tile, rotation) => {
        const result = confirmExplorePlacement(state, tile.tileDef, rotation, tile.x, tile.y, draw.dir);
        if (result.ok) {
          checkBagEmpty();
          afterAction();
        } else {
          toast('Exploration impossible.', 'bad');
          afterAction();
        }
      });
    }
  });
  toast('Explorer : révéler + entrer immédiatement.');
}

/* ── Heal ── */
function doHeal() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  const hurtHere = state.explorers.filter(e =>
    e.x === explorer.x && e.y === explorer.y &&
    (e.state === 'active' || e.state === 'down') && e.hp < e.maxHp
  );
  if (hurtHere.length === 0) { toast('Personne à soigner ici.', 'bad'); return; }
  if (hurtHere.length === 1) {
    performHeal(state, hurtHere[0].id);
    afterAction();
  } else {
    const cells = [{ x: explorer.x, y: explorer.y }];
    highlightCellTargets(state, cells, () => {
      // If multiple hurt explorers on same tile, heal the active one by default
      performHeal(state, explorer.id);
      afterAction();
    });
    toast('Cliquez pour soigner un allié sur cette tuile.');
  }
}

/* ── Attack ── */
function doAttack() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell || !cell.guardians || cell.guardians.length === 0) {
    toast('Aucun Gardien ici.', 'bad');
    return;
  }
  const result = attack(state);
  if (result.ok) {
    toast(result.eliminated ? `Gardien éliminé (jet: ${result.roll})` : `Attaque ratée (jet: ${result.roll})`,
           result.eliminated ? '' : 'bad');
  }
  afterAction();
}

/* ── Dig ── */
function startDig() {
  const state = ui.state;
  const targets = getDigTargets(state);
  if (targets.length === 0) { toast('Aucun éboulis à creuser.', 'bad'); return; }
  ui.pendingAction = 'dig';
  highlightDigTargets(state, targets, (t) => {
    const result = dig(state, t.x, t.y);
    afterAction();
  });
  toast('Cliquez un éboulis surligné.');
}

/* ── Run (2 PA, up to 3 moves) ── */
function startRun() {
  const state = ui.state;
  if (state.ap < 2) { toast('Pas assez de PA pour Courir (2 PA).', 'bad'); return; }
  const targets = getMoveTargets(state);
  if (targets.length === 0) { toast('Aucune tuile atteignable.', 'bad'); return; }
  state.ap += 1;  // bonus AP: 3 moves for 2 PA (move() spends 1 AP each)
  ui.runStepsLeft = 3;
  ui.pendingAction = 'run';
  doRunStep();
}

function doRunStep() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  if (ui.runStepsLeft <= 0 || explorer.state !== 'active') {
    afterAction();
    return;
  }
  const targets = getMoveTargets(state);
  if (targets.length === 0) {
    afterAction();
    return;
  }
  toast(`Courir : ${ui.runStepsLeft} déplacement(s) restant(s).`);
  highlightMoveTargets(state, targets, (t) => {
    move(state, t.x, t.y);
    ui.runStepsLeft--;
    fullRender();
    if (ui.runStepsLeft > 0 && getActiveExplorer(state).state === 'active') {
      doRunStep();
    } else {
      afterAction();
    }
  });
}

/* ── Manage Object ── */
function startManage() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell) return;

  const options = [];
  if (!explorer.item) {
    if (cell.keyMarker) options.push({ action: 'pickup', label: 'Ramasser la Clé' });
    if (state.artifactOnGround && state.artifactOnGround.x === explorer.x && state.artifactOnGround.y === explorer.y)
      options.push({ action: 'pickup', label: 'Ramasser l\'Artefact' });
    if (cell.isSanctuary && state.artifactOnSanctuary)
      options.push({ action: 'pickup', label: 'Récupérer l\'Artefact' });
    const alliesWithItems = state.explorers.filter(e =>
      e.id !== explorer.id && e.item && e.x === explorer.x && e.y === explorer.y
    );
    for (const ally of alliesWithItems) {
      options.push({ action: 'take', target: ally.id, label: `Prendre ${ally.item === 'key' ? 'Clé' : 'Artefact'} de ${ally.name}` });
    }
  }
  if (explorer.item) {
    if (explorer.item === 'key' && cell.isSanctuary)
      options.push({ action: 'place_key_sanctuary', label: 'Poser la Clé sur le Sanctuaire' });
    const allies = state.explorers.filter(e =>
      e.id !== explorer.id && !e.item && e.x === explorer.x && e.y === explorer.y &&
      (e.state === 'active' || e.state === 'down')
    );
    for (const ally of allies) {
      options.push({ action: 'give', target: ally.id, label: `Donner à ${ally.name}` });
    }
    options.push({ action: 'drop', label: 'Déposer' });
  }

  if (options.length === 0) {
    toast('Rien à manier ici.', 'bad');
    return;
  }

  if (options.length === 1) {
    executeManage(options[0]);
    afterAction();
  } else {
    showManageMenu(options);
  }
}

function showManageMenu(options) {
  const bar = document.getElementById('action-bar');
  bar.innerHTML = '<div style="width:100%;text-align:center;color:var(--c-ember);font-size:13px;margin-bottom:4px">Manier un objet</div>';
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.className = 'act-btn';
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      executeManage(opt);
      afterAction();
    });
    bar.appendChild(btn);
  }
  const cancel = document.createElement('button');
  cancel.className = 'act-btn';
  cancel.textContent = 'Annuler';
  cancel.addEventListener('click', () => { fullRender(); });
  bar.appendChild(cancel);
}

function executeManage(opt) {
  const state = ui.state;
  const result = manageObject(state, opt.action, opt.target);
  if (!result.ok) {
    toast('Action impossible.', 'bad');
  }
}

/* ── Push (Se dépasser) ── */
function doPush() {
  const state = ui.state;
  const result = push(state);
  if (!result.ok) {
    toast(result.reason === 'already_pushed' ? 'Déjà dépassé ce tour.' : 'Impossible de se dépasser.', 'bad');
    return;
  }
  afterAction();
}

/* ── Escape ── */
function doEscape() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell || !cell.isEntry || cell.exitDir !== 'N') {
    toast('Vous devez être sur la tuile de sortie.', 'bad');
    return;
  }
  if (explorer.item === 'artifact') {
    state.artifactEscaped = true;
    log(state, `🏆 ${explorer.name} s'échappe avec l'Artefact !`);
  } else {
    log(state, `🚪 ${explorer.name} quitte le temple (sauvé).`);
  }
  explorer.state = 'escaped';
  afterAction();
}

/* ── Crawl (when down) ── */
function startCrawl() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell) return;
  const targets = [];
  for (const dir of DIRS) {
    const [dx, dy] = DIR_DELTA[dir];
    const nx = explorer.x + dx;
    const ny = explorer.y + dy;
    const nb = getCell(state, nx, ny);
    if (!nb) continue;
    if (!areConnected(state.board, explorer.x, explorer.y, nx, ny)) continue;
    if (nb.flipped) continue;
    if (nb.rubble && !hasAgile(state)) continue;
    targets.push({ x: nx, y: ny });
  }
  if (targets.length === 0) { toast('Aucune tuile atteignable.', 'bad'); return; }
  ui.pendingAction = 'crawl';
  highlightMoveTargets(state, targets, (t) => {
    crawl(state, t.x, t.y);
    startPerilPhase();
  });
  toast('Ramper : déplacez-vous puis le tour se termine.');
}

/* ============================================================
   ABILITY IMPLEMENTATIONS
   ============================================================ */

function startIlluminate() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  const dirs = getRevealTargets(state);
  if (dirs.length === 0) { toast('Aucune issue.', 'bad'); return; }
  const result = useIlluminate(state);
  if (!result.ok) { toast('Capacité impossible.', 'bad'); return; }
  state.ap += 2;  // 2 free reveals (reveal() spends 1 AP each)
  ui.illuminateRevealsLeft = 2;
  ui.pendingAction = 'illuminate';
  doIlluminateReveal();
}

function doIlluminateReveal() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  const dirs = getRevealTargets(state);
  if (dirs.length === 0 || ui.illuminateRevealsLeft <= 0) {
    afterAction();
    return;
  }
  toast(`Illuminer : révélation ${3 - ui.illuminateRevealsLeft}/2 (gratuite).`);
  highlightRevealEdges(state, cell, dirs, (dir) => {
    const draw = drawTileForReveal(state, dir);
    if (!draw.ok) {
      ui.illuminateRevealsLeft--;
      fullRender();
      if (ui.illuminateRevealsLeft > 0 && getRevealTargets(state).length > 0) {
        doIlluminateReveal();
      } else {
        afterAction();
      }
      return;
    }
    state.ap += 1;
    if (draw.tiles.length > 1) {
      showTileChoiceModal(draw, (chosenTile) => {
        showRotationPickerModal(draw, chosenTile, (tile, rotation) => {
          const result = confirmTilePlacement(state, tile.tileDef, rotation, tile.x, tile.y);
          returnTileToBag(state, draw, chosenTile);
          if (result.ok) checkBagEmpty();
          ui.illuminateRevealsLeft--;
          fullRender();
          if (ui.illuminateRevealsLeft > 0 && getRevealTargets(state).length > 0) {
            doIlluminateReveal();
          } else {
            afterAction();
          }
        });
      });
    } else {
      const chosenTile = draw.tiles[0];
      showRotationPickerModal(draw, chosenTile, (tile, rotation) => {
        const result = confirmTilePlacement(state, tile.tileDef, rotation, tile.x, tile.y);
        if (result.ok) checkBagEmpty();
        ui.illuminateRevealsLeft--;
        fullRender();
        if (ui.illuminateRevealsLeft > 0 && getRevealTargets(state).length > 0) {
          doIlluminateReveal();
        } else {
          afterAction();
        }
      });
    }
  });
}

function startSprint() {
  const state = ui.state;
  const targets = getMoveTargets(state);
  if (targets.length === 0) { toast('Aucune tuile.', 'bad'); return; }
  const result = useSprint(state);
  if (!result.ok) { toast('Capacité impossible.', 'bad'); return; }
  state.ap += 2;  // 2 free moves (move() spends 1 AP each)
  ui.sprintMovesLeft = 2;
  ui.pendingAction = 'sprint';
  doSprintMove();
}

function doSprintMove() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  if (ui.sprintMovesLeft <= 0 || explorer.state !== 'active') {
    afterAction();
    return;
  }
  const targets = getMoveTargets(state);
  if (targets.length === 0) { afterAction(); return; }
  toast(`Sprinter : déplacement ${3 - ui.sprintMovesLeft}/2 (gratuit).`);
  highlightMoveTargets(state, targets, (t) => {
    move(state, t.x, t.y);
    ui.sprintMovesLeft--;
    fullRender();
    if (ui.sprintMovesLeft > 0 && getActiveExplorer(state).state === 'active') {
      doSprintMove();
    } else {
      afterAction();
    }
  });
}

function startOrder() {
  const state = ui.state;
  const allies = state.explorers.filter(e => e.state === 'active' && e.id !== getActiveExplorer(state).id);
  if (allies.length === 0) { toast('Aucun allié ordonnable.', 'bad'); return; }
  const cells = allies.map(e => ({ x: e.x, y: e.y, explorerId: e.id }));
  highlightCellTargets(state, cells.map(c => ({ x: c.x, y: c.y })), (clicked) => {
    const ally = allies.find(a => a.x === clicked.x && a.y === clicked.y);
    if (!ally) { afterAction(); return; }
    const allyTargets = [];
    const cell = getCell(state, ally.x, ally.y);
    if (cell) {
      for (const dir of DIRS) {
        const [dx, dy] = DIR_DELTA[dir];
        const nx = ally.x + dx;
        const ny = ally.y + dy;
        const nb = getCell(state, nx, ny);
        if (!nb || nb.flipped) continue;
        if (!areConnected(state.board, ally.x, ally.y, nx, ny)) continue;
        if (nb.rubble) continue;
        allyTargets.push({ x: nx, y: ny });
      }
    }
    if (allyTargets.length === 0) { toast(`${ally.name} ne peut bouger.`, 'bad'); afterAction(); return; }
    highlightMoveTargets(state, allyTargets, (t) => {
      useOrder(state, ally.id, t.x, t.y);
      afterAction();
    });
  });
  toast('Ordonner : cliquez un allié à déplacer.');
}

function startResearch() {
  const state = ui.state;
  if (state.journalBag.length === 0) { toast('Plus de tuiles Journal.', 'bad'); return; }
  toast('Rechercher : cliquez une tuile puis une issue.');
  selectTileThenEdge((cell, dir) => {
    const [dx, dy] = DIR_DELTA[dir];
    const tx = cell.x + dx;
    const ty = cell.y + dy;
    const draw = drawTileForResearch(state, tx, ty);
    if (!draw.ok) {
      toast(draw.reason === 'no_journal_tiles' ? 'Plus de tuiles Journal.' : 'Placement impossible.', 'bad');
      afterAction();
      return;
    }
    const chosenTile = draw.tiles[0];
    showRotationPickerModal(draw, chosenTile, (tile, rotation) => {
      const result = confirmResearchPlacement(state, tile.tileDef, rotation, tile.x, tile.y);
      if (!result.ok) {
        toast('Placement impossible.', 'bad');
      }
      afterAction();
    });
  });
}

function startExcavate() {
  const state = ui.state;
  const targets = getDigTargets(state);
  if (targets.length === 0) { toast('Aucun éboulis à excaver.', 'bad'); return; }
  highlightDigTargets(state, targets, (t) => {
    const result = useExcavate(state, t.x, t.y);
    if (!result.ok) { toast('Excavation impossible.', 'bad'); }
    afterAction();
  });
  toast('Excaver : cliquez un éboulis.');
}

function doConsolidate() {
  const state = ui.state;
  const result = useConsolidate(state);
  if (!result.ok) { toast('Consolidation impossible.', 'bad'); }
  afterAction();
}

function startScope() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const targets = [];
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      if (dx === 0 && dy === 0) continue;
      if (Math.abs(dx) + Math.abs(dy) > 3) continue;
      if (dx !== 0 && dy !== 0) continue;
      const tx = explorer.x + dx;
      const ty = explorer.y + dy;
      if (getCell(state, tx, ty)) continue;
      if (!scopeCanTarget(state, explorer.x, explorer.y, tx, ty)) continue;
      targets.push({ x: tx, y: ty });
    }
  }
  if (targets.length === 0) { toast('Aucune tuile visible.', 'bad'); return; }
  highlightCellTargets(state, targets, (t) => {
    const draw = drawTileForScope(state, t.x, t.y);
    if (!draw.ok) {
      toast(draw.reason === 'empty_bag' ? 'Sac de tuiles vide.' : 'Lunette impossible.', 'bad');
      afterAction();
      return;
    }
    const chosenTile = draw.tiles[0];
    showRotationPickerModal(draw, chosenTile, (tile, rotation) => {
      const result = confirmScopePlacement(state, tile.tileDef, rotation, tile.x, tile.y);
      if (!result.ok) { toast('Lunette impossible.', 'bad'); }
      checkBagEmpty();
      afterAction();
    });
  });
  toast('Lunette : révéler une tuile visible (≤3).');
}

function scopeCanTarget(state, ex, ey, tx, ty) {
  const dx = tx - ex;
  const dy = ty - ey;
  if (dx !== 0 && dy !== 0) return false;
  const steps = Math.abs(dx) + Math.abs(dy);
  if (steps === 0 || steps > 3) return false;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  let cx = ex, cy = ey;
  for (let i = 0; i < steps - 1; i++) {
    const dir = sx === 1 ? 'E' : sx === -1 ? 'W' : sy === 1 ? 'S' : 'N';
    const [ddx, ddy] = DIR_DELTA[dir];
    const nx = cx + ddx;
    const ny = cy + ddy;
    const next = getCell(state, nx, ny);
    if (!next) return false;
    if (!areConnected(state.board, cx, cy, nx, ny)) return false;
    if (next.rubble) return false;
    if (next.flipped) return false;
    cx = nx;
    cy = ny;
  }
  return true;
}

function startSnipe() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const targets = [];
  for (const cell of state.board.cells.values()) {
    if (cell.flipped) continue;
    if (cell.x === explorer.x && cell.y === explorer.y) continue;
    if (!cell.guardians || cell.guardians.length === 0) continue;
    if (!lineOfSight(state.board, explorer.x, explorer.y, cell.x, cell.y, 3)) continue;
    targets.push({ x: cell.x, y: cell.y });
  }
  if (targets.length === 0) { toast('Aucun Gardien visible.', 'bad'); return; }
  highlightCellTargets(state, targets, (t) => {
    const result = useSnipe(state, t.x, t.y);
    if (!result.ok) { toast('Tir impossible.', 'bad'); }
    afterAction();
  });
  toast('Tir de précision : cliquez un Gardien visible (≤3).');
}

function startGrenade() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell) return;
  const targets = [];
  for (const dir of DIRS) {
    const [dx, dy] = DIR_DELTA[dir];
    const nx = explorer.x + dx;
    const ny = explorer.y + dy;
    const nb = getCell(state, nx, ny);
    if (!nb || nb.flipped) continue;
    if (!areConnected(state.board, explorer.x, explorer.y, nx, ny)) continue;
    targets.push({ x: nx, y: ny });
  }
  if (targets.length === 0) { toast('Aucune tuile adjacente.', 'bad'); return; }
  highlightCellTargets(state, targets, (t) => {
    const result = useGrenade(state, t.x, t.y);
    if (!result.ok) { toast('Grenade impossible.', 'bad'); }
    afterAction();
  });
  toast('Grenade : cliquez une tuile adjacente connectée.');
}

function startDemolish() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell) return;
  const dirs = [];
  for (const dir of DIRS) {
    if (cell.walls[dir]) continue;
    const [dx, dy] = DIR_DELTA[dir];
    const nx = explorer.x + dx;
    const ny = explorer.y + dy;
    const nb = getCell(state, nx, ny);
    if (!nb) continue;
    dirs.push(dir);
  }
  if (dirs.length === 0) { toast('Aucun mur à démolir.', 'bad'); return; }
  highlightRevealEdges(state, cell, dirs, (dir) => {
    const result = useDemolish(state, dir);
    if (!result.ok) { toast('Démolition impossible.', 'bad'); }
    afterAction();
  });
  toast('Démolir : cliquez le mur à détruire.');
}

function doAnnihilate() {
  const state = ui.state;
  const result = useAnnihilate(state);
  if (!result.ok) { toast('Aucun Gardien sur votre tuile.', 'bad'); }
  afterAction();
}

function doPrepare() {
  const state = ui.state;
  const result = usePrepare(state);
  if (!result.ok) { toast('Se préparer impossible.', 'bad'); }
  afterAction();
}

function startAbilityHeal() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);
  const targets = state.explorers.filter(e =>
    e.id !== explorer.id && (e.state === 'active' || e.state === 'down') &&
    lineOfSight(state.board, explorer.x, explorer.y, e.x, e.y, 2)
  );
  if (targets.length === 0) { toast('Aucun allié à soigner visible.', 'bad'); return; }
  const cells = targets.map(e => ({ x: e.x, y: e.y }));
  highlightCellTargets(state, cells, (c) => {
    const target = targets.find(t => t.x === c.x && t.y === c.y);
    if (target) {
      const result = useHeal(state, target.id);
      if (!result.ok) { toast('Guérison impossible.', 'bad'); }
    }
    afterAction();
  });
  toast('Guérir : cliquez un allié visible (≤2).');
}

function startRevive() {
  const state = ui.state;
  const targets = state.explorers.filter(e =>
    e.id !== getActiveExplorer(state).id && e.state !== 'dead' && e.state !== 'escaped'
  );
  if (targets.length === 0) { toast('Aucun allié.', 'bad'); return; }
  const cells = targets.map(e => ({ x: e.x, y: e.y }));
  highlightCellTargets(state, cells, (c) => {
    const target = targets.find(t => t.x === c.x && t.y === c.y);
    if (target) {
      const result = useRevive(state, target.id);
      if (!result.ok) { toast('Ranimat impossible.', 'bad'); }
    }
    afterAction();
  });
  toast('Ranimer : cliquez un allié.');
}

function startPurify() {
  const state = ui.state;
  const targets = [];
  for (const cell of state.board.cells.values()) {
    if (cell.flipped || cell.isSanctuary) continue;
    if (cell.x === getActiveExplorer(state).x && cell.y === getActiveExplorer(state).y) continue;
    if (cell.guardians && cell.guardians.length > 0) {
      targets.push({ x: cell.x, y: cell.y });
    }
  }
  if (targets.length === 0) { toast('Aucun Gardien à purifier.', 'bad'); return; }
  highlightCellTargets(state, targets, (c) => {
    const result = usePurify(state, c.x, c.y);
    if (!result.ok) { toast('Purification impossible.', 'bad'); }
    afterAction();
  });
  toast('Purifier : cliquez une tuile avec Gardiens.');
}

/* ── Helper: select tile then edge (for Research) ── */
function selectTileThenEdge(callback) {
  const state = ui.state;
  const tilesLayer = document.getElementById('board-svg').querySelector('#tiles-layer');
  const handler = (e) => {
    const g = e.target.closest('.tile-group');
    if (!g) return;
    const cx = parseInt(g.dataset.x);
    const cy = parseInt(g.dataset.y);
    const cell = getCell(state, cx, cy);
    if (!cell || cell.flipped) return;
    tilesLayer.removeEventListener('click', handler);
    const dirs = [];
    for (const dir of DIRS) {
      if (cell.walls[dir]) {
        const [dx, dy] = DIR_DELTA[dir];
        const nx = cell.x + dx;
        const ny = cell.y + dy;
        if (!getCell(state, nx, ny)) dirs.push(dir);
      }
    }
    if (dirs.length === 0) { toast('Aucune issue ouverte sur cette tuile.', 'bad'); return; }
    highlightRevealEdges(state, cell, dirs, (dir) => callback(cell, dir));
  };
  tilesLayer.addEventListener('click', handler);
}

/* ============================================================
   TILE CHOICE & ROTATION PICKER MODALS
   ============================================================ */

const TILE_TYPE_LABELS = {
  normale: 'Normale',
  pont: 'Pont',
  cle: 'Clé',
  lave: 'Lave',
  piege_pics: 'Piège à pics',
  piege_flechettes: 'Piège à fléchettes',
  ruines: 'Ruines',
  gardien: 'Gardien',
  journal: 'Journal',
};

const TILE_IMAGE_MAP = {
  normale: 'normal', pont: 'bridge', cle: 'key', lave: 'lava',
  piege_pics: 'spikes', piege_flechettes: 'darts', ruines: 'ruins',
  gardien: 'guardian', journal: null,
};

function buildTilePreviewSVG(tileDef, rotation) {
  const rotated = rotateWalls(tileDef.walls, rotation);
  const ns = 'http://www.w3.org/2000/svg';
  const size = 90;
  const pad = 4;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.style.verticalAlign = 'middle';
  svg.style.borderRadius = '6px';

  const colors = {
    normale: '#8b7355', pont: '#6b8b9b', cle: '#d4af37', lave: '#e8552a',
    piege_pics: '#8b4c3c', piege_flechettes: '#7a5c3a', ruines: '#9c8b6b',
    gardien: '#4a3c2a', journal: '#b8a088',
  };
  const color = colors[tileDef.type] || '#8b7355';
  const imgFile = TILE_IMAGE_MAP[tileDef.type];

  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('x', pad);
  bg.setAttribute('y', pad);
  bg.setAttribute('width', size - pad * 2);
  bg.setAttribute('height', size - pad * 2);
  bg.setAttribute('rx', 4);
  bg.setAttribute('fill', color);
  svg.appendChild(bg);

  if (imgFile) {
    const img = document.createElementNS(ns, 'image');
    img.setAttribute('href', `assets/images/tiles/${imgFile}.png`);
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `assets/images/tiles/${imgFile}.png`);
    img.setAttribute('x', pad);
    img.setAttribute('y', pad);
    img.setAttribute('width', size - pad * 2);
    img.setAttribute('height', size - pad * 2);
    img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const cx = pad + (size - pad * 2) / 2;
    const cy = pad + (size - pad * 2) / 2;
    img.setAttribute('transform', `rotate(${rotation} ${cx} ${cy})`);
    svg.appendChild(img);
  }

  const wallThick = 4;
  const dirs = ['N', 'E', 'S', 'W'];
  for (const dir of dirs) {
    if (!rotated[dir]) continue;
    const wall = document.createElementNS(ns, 'line');
    wall.setAttribute('stroke', '#f5a623');
    wall.setAttribute('stroke-width', wallThick);
    wall.setAttribute('stroke-linecap', 'round');
    if (dir === 'N') { wall.setAttribute('x1', pad); wall.setAttribute('y1', pad); wall.setAttribute('x2', size - pad); wall.setAttribute('y2', pad); }
    else if (dir === 'S') { wall.setAttribute('x1', pad); wall.setAttribute('y1', size - pad); wall.setAttribute('x2', size - pad); wall.setAttribute('y2', size - pad); }
    else if (dir === 'E') { wall.setAttribute('x1', size - pad); wall.setAttribute('y1', pad); wall.setAttribute('x2', size - pad); wall.setAttribute('y2', size - pad); }
    else { wall.setAttribute('x1', pad); wall.setAttribute('y1', pad); wall.setAttribute('x2', pad); wall.setAttribute('y2', size - pad); }
    svg.appendChild(wall);
  }
  return svg;
}

function closeModal(modal) {
  if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
}

function returnTileToBag(state, draw, chosenTile) {
  if (!draw._drawnTileIds) return;
  for (const t of draw.tiles) {
    if (t === chosenTile) continue;
    if (t._drawnId) state.tileBag.push(t._drawnId);
  }
}

function cancelTileDraw(state, draw) {
  if (!draw._drawnTileIds) return;
  state.tileBag.push(...draw._drawnTileIds);
}

function showTileChoiceModal(draw, onChosen) {
  const modal = document.createElement('div');
  modal.id = 'tile-choice-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.3);z-index:300;display:flex;align-items:center;justify-content:center;pointer-events:none;';

  const card = document.createElement('div');
  card.style.cssText = 'background:rgba(42,32,26,.95);border:2px solid var(--c-ember);border-radius:12px;padding:24px;box-shadow:0 0 30px rgba(245,166,35,.5);text-align:center;max-width:600px;pointer-events:all;';
  card.innerHTML = '<h3 style="color:var(--c-ember);margin:0 0 16px;letter-spacing:1px;">Choisissez une tuile</h3>';

  const tilesRow = document.createElement('div');
  tilesRow.style.cssText = 'display:flex;gap:20px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;';

  for (const t of draw.tiles) {
    const tileBtn = document.createElement('div');
    tileBtn.style.cssText = 'cursor:pointer;padding:12px;border:2px solid var(--c-border);border-radius:8px;transition:all .15s;text-align:center;';
    const label = TILE_TYPE_LABELS[t.tileDef.type] || t.tileDef.type;
    tileBtn.innerHTML = `<div style="margin-bottom:8px;color:var(--c-text);font-weight:700;">${label}</div>`;
    tileBtn.appendChild(buildTilePreviewSVG(t.tileDef, 0));
    tileBtn.innerHTML += `<div style="margin-top:6px;font-size:12px;color:var(--c-text-dim);">${t.rotations.length} rotation(s)</div>`;

    tileBtn.addEventListener('mouseenter', () => { tileBtn.style.borderColor = 'var(--c-ember)'; });
    tileBtn.addEventListener('mouseleave', () => { tileBtn.style.borderColor = 'var(--c-border)'; });
    tileBtn.addEventListener('click', () => {
      closeModal(modal);
      onChosen(t);
    });
    tilesRow.appendChild(tileBtn);
  }
  card.appendChild(tilesRow);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'act-btn';
  cancelBtn.textContent = 'Annuler';
  cancelBtn.addEventListener('click', () => {
    closeModal(modal);
    cancelTileDraw(ui.state, draw);
    afterAction();
  });
  card.appendChild(cancelBtn);

  modal.appendChild(card);
  document.body.appendChild(modal);
}

function showRotationPickerModal(draw, chosenTile, onConfirmed) {
  const modal = document.createElement('div');
  modal.id = 'rotation-picker-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.3);z-index:300;display:flex;align-items:center;justify-content:center;pointer-events:none;';

  const card = document.createElement('div');
  card.style.cssText = 'background:rgba(42,32,26,.95);border:2px solid var(--c-ember);border-radius:12px;padding:24px;box-shadow:0 0 30px rgba(245,166,35,.5);text-align:center;max-width:520px;pointer-events:all;';
  const label = TILE_TYPE_LABELS[chosenTile.tileDef.type] || chosenTile.tileDef.type;
  card.innerHTML = `<h3 style="color:var(--c-ember);margin:0 0 16px;letter-spacing:1px;">Choisissez la rotation</h3><div style="margin-bottom:12px;color:var(--c-text);font-weight:700;">${label}</div>`;

  const rotationsRow = document.createElement('div');
  rotationsRow.style.cssText = 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;';

  const validRotations = [0, 90, 180, 270];
  for (const rot of validRotations) {
    const isValid = chosenTile.rotations.includes(rot);
    const btn = document.createElement('div');
    btn.style.cssText = isValid
      ? 'cursor:pointer;padding:8px;border:2px solid var(--c-ember);border-radius:8px;text-align:center;transition:all .15s;'
      : 'padding:8px;border:2px solid var(--c-border);border-radius:8px;text-align:center;opacity:.3;cursor:not-allowed;';
    btn.innerHTML = `<div style="font-size:12px;color:var(--c-text-dim);margin-bottom:4px;">${rot}°</div>`;
    btn.appendChild(buildTilePreviewSVG(chosenTile.tileDef, rot));

    if (isValid) {
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(245,166,35,.15)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = ''; });
      btn.addEventListener('click', () => {
        closeModal(modal);
        onConfirmed(chosenTile, rot);
      });
    }
    rotationsRow.appendChild(btn);
  }
  card.appendChild(rotationsRow);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'act-btn';
  cancelBtn.textContent = 'Annuler';
  cancelBtn.addEventListener('click', () => {
    closeModal(modal);
    cancelTileDraw(ui.state, draw);
    afterAction();
  });
  card.appendChild(cancelBtn);

  modal.appendChild(card);
  document.body.appendChild(modal);
}

/* ============================================================
   BAG / SANCTUARY
   ============================================================ */
function checkBagEmpty() {
  const state = ui.state;
  if (state.tileBag.length === 0 && !state.sanctuary) {
    tryPlaceSanctuary(state);
  }
}

/* ============================================================
   AFTER ACTION
   ============================================================ */
function afterAction() {
  clearHighlights();
  ui.pendingAction = null;
  ui.pendingAbility = null;
  checkEndConditions(ui.state);
  if (checkGameEnd()) return;
  fullRender();
}

/* ============================================================
   PERIL PHASE
   ============================================================ */
function startPerilPhase() {
  clearHighlights();
  const state = ui.state;
  state.phase = 'perilPhase';
  fullRender();
  toast('Lancez le dé de Péril !', 'peril');
}

ui.onRollPeril = function() {
  const state = ui.state;
  const explorer = getActiveExplorer(state);

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:center;justify-content:center;';
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--c-panel);border:2px solid var(--c-lava);border-radius:12px;padding:24px;text-align:center;max-width:360px;box-shadow:0 0 20px rgba(232,85,42,.4);';
  card.innerHTML = `<h3 style="color:var(--c-lava);margin:0 0 8px;">Lancer le dé de Péril ?</h3><p style="color:var(--c-text-dim);margin:0 0 16px;font-size:13px;">Tour de ${explorer.name}</p>`;
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;';
  const yes = document.createElement('button');
  yes.className = 'btn btn-primary';
  yes.textContent = '🎲 Lancer';
  yes.addEventListener('click', () => {
    modal.remove();
    doRollPeril();
  });
  const no = document.createElement('button');
  no.className = 'btn';
  no.textContent = 'Annuler';
  no.addEventListener('click', () => modal.remove());
  btnRow.appendChild(yes);
  btnRow.appendChild(no);
  card.appendChild(btnRow);
  modal.appendChild(card);
  document.body.appendChild(modal);
};

function doRollPeril() {
  const state = ui.state;
  const face = rollPeril();
  const faceData = PERIL_FACES[face];
  const explorer = getActiveExplorer(state);

  showPerilResult(faceData);

  resolvePeril(state, face);
  log(state, `🎲 ${explorer.name} : ${faceData.glyph} ${faceData.label}.`);

  if (state.curseActive) {
    setTimeout(() => {
      const face2 = rollPeril();
      const faceData2 = PERIL_FACES[face2];
      showPerilResult(faceData2);
      resolvePeril(state, face2);
      log(state, `🎲 ${explorer.name} : ${faceData2.glyph} ${faceData2.label}. (2e dé — Malédiction)`);
      setTimeout(() => finishPerilPhase(), 1200);
    }, 1000);
  } else {
    setTimeout(() => finishPerilPhase(), 1200);
  }
}

function showPerilResult(faceData) {
  const el = document.getElementById('peril-result');
  el.innerHTML = `<div style="font-size:48px">${faceData.glyph}</div><div style="margin-top:8px">${faceData.label}</div>`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1500);
  toast(`${faceData.glyph} ${faceData.label}`, 'peril');
}

function finishPerilPhase() {
  const state = ui.state;
  checkEndConditions(state);
  if (checkGameEnd()) return;
  endExplorerTurn(state);
  fullRender();
  if (checkGameEnd()) return;
  toast(`Au tour de ${getActiveExplorer(state).name}.`);
}

/* ============================================================
   END GAME
   ============================================================ */
function checkGameEnd() {
  const state = ui.state;
  if (!state.winner) return false;
  showEndScreen();
  return true;
}

function showEndScreen() {
  const state = ui.state;
  const won = state.winner === 'players';
  const survivors = state.explorers.filter(e => e.state !== 'dead');
  const dead = state.explorers.filter(e => e.state === 'dead');
  const medalEmoji = {
    'Légendaire': '👑', 'Or': '🥇', 'Argent': '🥈', 'Bronze': '🥉',
    'Oubliés à jamais': '💀',
  };

  document.getElementById('end-content').innerHTML = `
    <h1 class="${won ? 'victory' : 'defeat'}">${won ? 'VICTOIRE' : 'DÉFAITE'}</h1>
    <div class="medal">${medalEmoji[state.medal] || ''}</div>
    <div class="end-detail">
      <p><b>${state.medal || '—'}</b></p>
      ${won
        ? `<p>L'Artefact a été ramené à la surface !</p>
           <p>Survivants : ${survivors.map(e => e.name).join(', ') || 'aucun'}</p>
           ${dead.length ? `<p>Héros perdus : ${dead.map(e => e.name).join(', ')}</p>` : ''}`
        : `<p>${state.medal === 'Oubliés à jamais'
            ? "Personne n'a réussi à s'échapper avec l'Artefact..."
            : 'Le volcan a eu raison de l\'expédition.'}</p>`}
      <p>Durée : ${state.turn} tours.</p>
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

/* Initialize */
showScreen('screen-title');
