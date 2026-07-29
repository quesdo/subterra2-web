/* ============================================================
   game.js — État de partie, tour, actions, victoire/défaite
   ============================================================ */

import { TEMPLE_TILES, JOURNAL_TILES, TILE_TYPES, DIRS, OPP, DELTA } from '../data/tiles.js';
import { EXPLORERS, ABILITIES } from '../data/explorers.js';
import { PERIL_FACES, rollPeril, rollDie } from '../data/perils.js';
import { createBoard, key, placeTile, placeSanctuary, neighbor, areConnected,
         reachableNeighbors, bfs, shortestPath, nearestCell, lineOfSight,
         cellsOfType, computeColumns, maxDepth, getValidRotations } from './board.js';
import { createVolcano, advanceEruption, tryErupt, spreadLava, initialEruption, VOLCANO_MAX } from './volcano.js';
import { createGuardianPool, wakeNearestGuardian, activateAllGuardians, spawnGuardian, removeGuardian, removeAllGuardians } from './guardians.js';

/* Crée une nouvelle partie. */
export function createGame(config) {
  // config = { explorers: [explorerDef...], difficulty, numExplorers }
  const board = createBoard();
  const volcano = createVolcano(config.difficulty, config.numExplorers);
  const pool = createGuardianPool();

  // Instancier les Explorateurs choisis
  const explorers = config.explorers.map((def, idx) => {
    const cell = board.cells.get('0,0'); // croisement central
    return {
      id: def.id + '_' + idx,
      defId: def.id,
      name: def.name,
      role: def.role,
      color: def.color,
      glyph: def.glyph,
      maxHp: def.pv,
      hp: def.pv,
      abilities: def.abilities.map(aid => ({
        ...ABILITIES[aid],
        usesLeft: ABILITIES[aid].uses,
      })),
      position: '0,0',  // = key(x,y)
      x: cell.x, y: cell.y,
      state: 'active',        // active | down | escaped | dead
      item: null,             // objet porté (clé/artefact)
      shielded: false,        // marqueur Bouclier (Se préparer)
      pushedThisTurn: false,  // s'est dépassé ce tour
      abilityCooldown: {},    // capacité -> true si bloquée au prochain tour
      orderIndex: idx,
    };
  });

  // Sac de tuiles (mélanger)
  const bag = shuffle([...TEMPLE_TILES]);

  // Tuiles Journal (pour l'Aristocrate)
  const journalBag = [...JOURNAL_TILES];

  return {
    board,
    volcano,
    pool,
    explorers,
    bag,
    journalBag,
    difficulty: config.difficulty,
    numExplorers: config.numExplorers,
    turn: 1,
    currentExplorerIdx: 0,
    phase: 'explorerTurn',   // explorerTurn | perilRoll | guardiansActivate | end
    ap: 2,                   // points d'action du joueur courant
    pushedThisTurn: false,
    curseActive: false,      // malédiction (après artefact récupéré)
    keysPlacedOnSanctuary: 0,
    artifactRetrieved: false,
    artifactEscaped: false,
    sanctuary: null,
    winner: null,            // null | 'players' | 'game'
    medal: null,
    logEntries: [],
    history: [],             // pour journal d'annulation minimal
    selection: null,         // action en cours de ciblage
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Helper : le joueur courant */
export function currentPlayer(game) {
  return game.explorers[game.currentExplorerIdx];
}

/* Helper : un Explorateur est-il sur cette case ?
   (comparaison par clé de coordonnées, l'explorateur stocke position = "x,y") */
export function isOnCell(explorer, cell) {
  return explorer.position === key(cell.x, cell.y);
}

/* Helper : tous les Explorateurs sur une case */
export function explorersOnCell(game, cell) {
  const k = key(cell.x, cell.y);
  return game.explorers.filter(e => e.position === k);
}

/* Helper : case d'un explorateur */
export function explorerCell(game, explorer) {
  return game.board.cells.get(explorer.position);
}

/* Helper : case par id */
function cellById(game, id) {
  return game.board.cells.get(id);
}

/* Helper : case par coordonnées */
function cellAt(game, x, y) {
  return game.board.cells.get(key(x, y));
}

/* Journal de log */
export function log(game, msg, type = '') {
  const entry = { turn: game.turn, msg, type };
  game.logEntries.push(entry);
  return entry;
}

/* ============================================================
   ACTIONS — chaque fonction valide puis mute l'état
   ============================================================ */

/* Vérifie si une action est possible pour le joueur courant. */
export function canDoAction(game, actionId) {
  const p = currentPlayer(game);
  if (game.phase !== 'explorerTurn') return false;
  if (p.state !== 'active' && actionId !== 'crawl') return false;

  switch (actionId) {
    case 'reveal':    return game.ap >= 1 && hasOpenEdges(game, p);
    case 'move':      return game.ap >= 1 && getMoveTargets(game, p).length > 0;
    case 'explore':   return game.ap >= 1 && getExploreTargets(game, p).length > 0;
    case 'heal':      return game.ap >= 1 && (p.hp < p.maxHp || hasAllyHere(game, p));
    case 'pickup':    return game.ap >= 1 && getItemHere(game, p);
    case 'attack':    return game.ap >= 1 && hasEnemyHere(game, p);
    case 'run':       return game.ap >= 2 && getMoveTargets(game, p).length > 0;
    case 'dig':       return game.ap >= 2 && getDigTargets(game, p).length > 0;
    case 'push':      return !p.pushedThisTurn && p.state === 'active' && p.hp > 0;
    case 'crawl':     return p.state === 'down' && getMoveTargets(game, p, true).length > 0;
    case 'escape':    return canEscape(game, p);
    case 'endTurn':   return true;
    default:          return canUseAbility(game, actionId);
  }
}

/* --- Révéler : piocher et placer une tuile ---
   L'UI doit appeler performReveal(game, sourceCell, openDir, chosenRotation).
   - Si chosenRotation est null et qu'une seule rotation est valide, on la prend.
   - Si plusieurs rotations sont valides et chosenRotation est null, on retourne
     { needsRotationChoice: true, tileDef, rotations } pour que l'UI demande.
   Règle "totalement bloqué" (manuel p.19) : si AUCUNE tuile du sac ne peut
   être placée, on défausse et on place le Sanctuaire. */
export function performReveal(game, sourceCell, openDir, chosenRotation = null, costAP = 1) {
  if (game.bag.length === 0) {
    log(game, 'Le sac de tuiles est vide.', 'system');
    return null;
  }
  // Essayer chaque tuile du sac jusqu'à en trouver une placable
  let attempts = 0;
  const total = game.bag.length;
  while (attempts < total) {
    const tileDef = game.bag.shift();
    const validRotations = getValidRotations(sourceCell, openDir, tileDef);
    if (validRotations.length > 0) {
      // Tuile placable ! Si plusieurs rotations et pas de choix, demander à l'UI
      if (chosenRotation === null && validRotations.length > 1) {
        // Remettre la tuile EN TÊTE du sac (elle sera re-piochée après choix)
        game.bag.unshift(tileDef);
        return { needsRotationChoice: true, tileDef, rotations: validRotations, sourceCell, openDir };
      }
      const placed = placeTile(game.board.cells, sourceCell, openDir, tileDef, chosenRotation);
      if (placed) {
        log(game, `🗺️ ${currentPlayer(game).name} révèle une tuile ${TILE_TYPES[placed.type].label}.`);
        onTilePlaced(game, placed);
        spendAP(game, costAP);
        return placed;
      }
    }
    // Placement impossible : remettre au fond du sac, essayer la suivante
    game.bag.push(tileDef);
    attempts++;
  }
  // Aucune tuile du sac n'a pu être placée -> règle "totalement bloqué"
  log(game, '⚠ Aucune tuile ne peut être placée ici. (situation bloquée)', 'system');
  spendAP(game, costAP);
  return null;
}

/* Effets déclenchés quand une tuile est placée. */
function onTilePlaced(game, cell) {
  switch (cell.type) {
    case 'key':
      cell.keyMarker = true;
      log(game, '🔑 Une Clé apparaît sur la tuile !', 'good');
      break;
    case 'ruins':
      cell.rubble = true;
      log(game, '🪨 La tuile Ruines reçoit un Éboulis.');
      break;
    case 'guardian':
      if (game.pool.available > 0) {
        spawnGuardian(game.pool, cell);
        log(game, '👁 Un Gardien se matérialise !', 'bad');
      }
      break;
    // lava, spikes, darts, normal, bridge, journal : pas d'effet à la pose
  }
}

/* --- Se déplacer ---
   costAP = nombre de PA à dépenser (défaut 1 ; 0 pour déplacement gratuit
   via Sprint, Courir, etc.) */
export function performMove(game, targetCell, costAP = 1) {
  const p = currentPlayer(game);
  const cell = explorerCell(game, p);
  // Vérifier connectivité
  const reachable = getMoveTargets(game, p);
  if (!reachable.find(r => r.cell.id === targetCell.id)) {
    return false;
  }
  // Fuite : quitter une tuile avec Gardien = -1 PV/gardien
  const fleeingGuardians = cell.guardians.length;
  if (fleeingGuardians > 0 && !p.shielded) {
    p.hp = Math.max(0, p.hp - fleeingGuardians);
    log(game, `💨 ${p.name} fuit ${fleeingGuardians} Gardien(s) : -${fleeingGuardians} PV.`, 'bad');
    if (p.hp <= 0) {
      // S'effondre sur la tuile vers laquelle il se dirigeait
      p.state = 'down';
      p.x = targetCell.x; p.y = targetCell.y; p.position = key(targetCell.x, targetCell.y);
      log(game, `⬇️ ${p.name} s'effondre en fuyant !`, 'bad');
      spendAP(game, costAP);
      checkEndConditions(game);
      return true;
    }
  }
  p.x = targetCell.x; p.y = targetCell.y; p.position = key(targetCell.x, targetCell.y);
  log(game, `🚶 ${p.name} se déplace vers (${targetCell.x},${targetCell.y}).`);
  spendAP(game, costAP);

  // Entrée sur Piège à pics : jet d'évitement
  if (targetCell.type === 'spikes' && !hasVigilance(p)) {
    const roll = rollDie();
    log(game, `🎲 Jet de piège : ${roll} (≥4 pour éviter).`);
    if (roll < 4) {
      triggerSpikes(game, targetCell);
    }
  }
  return true;
}

/* --- Explorer : révéler + entrer immédiatement --- */
export function performExplore(game, sourceCell, openDir, chosenRotation = null) {
  const result = performReveal(game, sourceCell, openDir, chosenRotation);
  // Si l'UI doit demander l'orientation, propager le signal
  if (result && result.needsRotationChoice) return result;
  if (!result) return false;
  const placed = result;
  const p = currentPlayer(game);
  // Doit y entrer immédiatement si possible
  if (!placed.rubble && !placed.flipped) {
    if (placed.type === 'bridge') {
      const occupant = game.explorers.some(e => isOnCell(e, placed) && e.state !== 'dead');
      if (occupant) {
        log(game, `${p.name} ne peut entrer sur le Pont occupé, reste sur place.`);
        return true;
      }
    }
    performMove(game, placed);
  } else {
    log(game, `${p.name} ne peut entrer sur la tuile révélée, reste sur place.`);
  }
  return true;
}

/* --- Soigner --- */
export function performHeal(game, targetExplorer) {
  const p = currentPlayer(game);
  const tgt = targetExplorer || p;
  if (tgt.hp >= tgt.maxHp) {
    log(game, `${tgt.name} a déjà ses PV maximum.`);
    return false;
  }
  tgt.hp = Math.min(tgt.maxHp, tgt.hp + 1);
  if (tgt.state === 'down') {
    tgt.state = 'active';
    log(game, `✚ ${tgt.name} est ranimé et redevient actif !`, 'good');
  } else {
    log(game, `✚ ${tgt.name} récupère 1 PV.`, 'good');
  }
  spendAP(game, 1);
  return true;
}

/* --- Manier un objet (ramasser/donner/déposer) --- */
export function performPickup(game) {
  const p = currentPlayer(game);
  const cell = explorerCell(game, p);
  if (cell.keyMarker) {
    if (p.item) { log(game, `${p.name} porte déjà un objet.`); return false; }
    cell.keyMarker = false;
    p.item = 'key';
    log(game, `🔑 ${p.name} ramasse une Clé.`, 'good');
    spendAP(game, 1);
    return true;
  }
  return false;
}

export function performDropItem(game) {
  const p = currentPlayer(game);
  if (!p.item) return false;
  const cell = explorerCell(game, p);
  if (p.item === 'key') cell.keyMarker = true;
  else if (p.item === 'artifact') cell.hasArtifact = true;
  log(game, `${p.name} dépose ${p.item === 'key' ? 'une Clé' : "l'Artefact"}.`);
  p.item = null;
  spendAP(game, 1);
  return true;
}

/* --- Attaquer --- */
export function performAttack(game) {
  const p = currentPlayer(game);
  const cell = explorerCell(game, p);
  if (cell.guardians.length === 0) return false;
  const roll = rollDie();
  log(game, `🎲 Attaque : ${roll}.`);
  if (roll >= 4) {
    removeGuardian(game.pool, cell);
    log(game, `⚔ ${p.name} élimine un Gardien !`, 'good');
  } else {
    log(game, `⚔ ${p.name} manque son attaque.`);
  }
  spendAP(game, 1);
  return true;
}

/* --- Courir : jusqu'à 3 déplacements --- */
export function performRunStep(game, targetCell) {
  // Un pas de course = un déplacement (géré par performMove qui coûte 1 AP,
  // mais Courir convertit 1 AP en jusqu'à 3 déplacements. On passe un flag.)
  // Simplification : Courir consomme 1 AP et fait un déplacement supplémentaire "gratuit".
  // Pour la clarté, on traite Courir comme 1 AP -> 1 déplacement, répétable.
  // (Voir note : la vraie règle = 1 AP => 3 déplacements. On l'implémente dans abilities.)
  return performMove(game, targetCell);
}

/* --- Creuser (2 PA selon le manuel p.11) --- */
export function performDig(game, targetCell) {
  if (!targetCell.rubble) return false;
  targetCell.rubble = false;
  log(game, `⛏ ${currentPlayer(game).name} dégage les Éboulis.`);
  spendAP(game, 2);
  return true;
}

/* --- Se dépasser : -1 PV +1 AP, 1×/tour --- */
export function performPush(game) {
  const p = currentPlayer(game);
  if (p.pushedThisTurn || p.hp <= 0) return false;
  if (p.shielded) {
    // Se dépasser nécessite toujours de dépenser 1 PV même avec Bouclier
  }
  p.hp = Math.max(0, p.hp - 1);
  game.ap += 1;
  p.pushedThisTurn = true;
  log(game, `💪 ${p.name} se dépasse : -1 PV, +1 PA.`, 'peril');
  if (p.hp <= 0) {
    p.state = 'down';
    log(game, `⬇️ ${p.name} s'effondre de l'effort !`, 'bad');
  }
  return true;
}

/* --- Ramper (à terre : 1 déplacement) --- */
export function performCrawl(game, targetCell) {
  const p = currentPlayer(game);
  const reachable = getMoveTargets(game, p, true);
  if (!reachable.find(r => r.cell.id === targetCell.id)) return false;
  p.x = targetCell.x; p.y = targetCell.y; p.position = key(targetCell.x, targetCell.y);
  log(game, `🦎 ${p.name} rampe vers une tuile adjacente.`);
  // À terre : son tour est ensuite terminé automatiquement
  return true;
}

/* --- Quitter le temple (sortie) --- */
export function performEscape(game) {
  const p = currentPlayer(game);
  if (!canEscape(game, p)) return false;
  if (p.item === 'artifact') {
    game.artifactEscaped = true;
    log(game, `🏆 ${p.name} s'échappe avec l'Artefact !`, 'good');
  } else {
    log(game, `🚪 ${p.name} quitte le temple (sauvé).`, 'good');
  }
  p.state = 'escaped';
  return true;
}

function canEscape(game, p) {
  const cell = explorerCell(game, p);
  return cell && cell.isEntry && cell.exitDir === 'N';
}

/* ============================================================
   CAPACITÉS SPÉCIALES
   ============================================================ */
export function canUseAbility(game, abilityId) {
  const p = currentPlayer(game);
  if (game.phase !== 'explorerTurn' || p.state !== 'active') return false;
  const ability = p.abilities.find(a => a.id === abilityId);
  if (!ability || ability.passive) return false;
  if (ability.uses !== null && ability.usesLeft <= 0) return false;
  if (p.abilityCooldown[abilityId]) return false;
  if (game.ap < ability.cost) return false;
  // Vérifier la faisabilité selon l'effet
  switch (ability.effect) {
    case 'dig':         return getDigTargets(game, p).length > 0;
    case 'reveal_twice':return hasOpenEdges(game, p);
    case 'move_twice':  return getMoveTargets(game, p).length > 0;
    case 'annihilate':  return explorerCell(game, p).guardians.length > 0;
    case 'prepare':     return !p.shielded;
    case 'grenade':     return getGrenadeTargets(game, p).length > 0;
    case 'snipe':       return getSnipeTargets(game, p).length > 0;
    case 'scope':       return getScopeTargets(game, p).length > 0;
    case 'order':       return game.explorers.some(e => e.state === 'active' && e.id !== p.id && getMoveTargets(game, e).length > 0);
    case 'heal':        return getHealTargets(game, p).length > 0;
    case 'revive':      return game.explorers.some(e => e.id !== p.id);
    case 'purify':      return [...game.board.cells.values()].some(c => c.guardians.length > 0 && !c.isSanctuary && c.id !== p.position);
    case 'consolidate': return explorerCell(game, p) && !explorerCell(game, p).consolidated;
    case 'demolish':    return getDemolishTargets(game, p).length > 0;
    case 'research':    return game.journalBag.length > 0;
    default:            return true;
  }
}

export function useAbility(game, abilityId, target) {
  const p = currentPlayer(game);
  const ability = p.abilities.find(a => a.id === abilityId);
  if (!canUseAbility(game, abilityId)) return false;
  game.ap -= ability.cost;
  if (ability.uses !== null) ability.usesLeft--;

  switch (ability.effect) {
    case 'dig':         performDig(game, target); break;
    case 'reveal_twice':
      // 2 révélations pour 1 PA (les révélations sont gratuites via costAP=0 côté UI)
      log(game, `🔦 ${p.name} illumine (2 révélations pour 1 PA).`, 'good'); break;
    case 'move_twice':
      // 2 déplacements pour 1 PA (les déplacements sont gratuits côté UI)
      log(game, `💨 ${p.name} sprinte (2 déplacements pour 1 PA).`, 'good'); break;
    case 'annihilate': {
      const cell = explorerCell(game, p);
      removeGuardian(game.pool, cell);
      log(game, `⚡ ${p.name} anéantit un Gardien !`, 'good');
      break;
    }
    case 'prepare':
      p.shielded = true;
      p.abilityCooldown[abilityId] = true;
      log(game, `🛡️ ${p.name} se prépare : immunisé aux PV jusqu'à son prochain tour.`, 'good');
      break;
    case 'grenade': {
      const cell = explorerCell(game, p);
      removeGuardian(game.pool, target);
      // Explorateurs sur la tuile perdent 1 PV
      for (const e of game.explorers) {
        if (isOnCell(e, target) && e.state === 'active' && !e.shielded) {
          e.hp = Math.max(0, e.hp - 1);
          if (e.hp <= 0) { e.state = 'down'; }
        }
      }
      log(game, `💣 ${p.name} lance une grenade : Gardiens éliminés, alliés blessés.`, 'bad');
      break;
    }
    case 'snipe':
      removeGuardian(game.pool, target);
      log(game, `🎯 ${p.name} abat un Gardien à distance !`, 'good');
      break;
    case 'scope':
      // Révéler une tuile visible en ligne droite
      // target = { cell, openDir }
      performReveal(game, target.cell, target.openDir);
      log(game, `🔭 ${p.name} révèle une tuile au loin.`, 'good');
      break;
    case 'order':
      // target = { explorer, cell } : l'explorateur se déplace
      target.explorer.x = target.cell.x;
      target.explorer.y = target.cell.y;
      target.explorer.position = key(target.cell.x, target.cell.y);
      log(game, `🎖️ ${p.name} ordonne à ${target.explorer.name} de se déplacer.`, 'good');
      break;
    case 'heal':
      target.hp = Math.min(target.maxHp, target.hp + 1);
      log(game, `✚ ${p.name} soigne ${target.name} à distance.`, 'good');
      break;
    case 'revive':
      if (target.state === 'down') {
        target.hp = Math.min(target.maxHp, target.hp + 2);
        target.state = 'active';
        log(game, `✚ ${p.name} ranime ${target.name} (+2 PV) !`, 'good');
      } else {
        target.hp = Math.min(target.maxHp, target.hp + 1);
        log(game, `✚ ${p.name} soigne ${target.name} (+1 PV).`, 'good');
      }
      break;
    case 'purify':
      removeAllGuardians(game.pool, target);
      log(game, `✨ ${p.name} purifie une tuile de tous ses Gardiens.`, 'good');
      break;
    case 'consolidate': {
      const cell = explorerCell(game, p);
      cell.consolidated = true;
      cell.rubble = false;
      cell.type = 'normal'; // devient tuile normale à vie
      log(game, `🧱 ${p.name} consolide la tuile (devenue normale).`, 'good');
      break;
    }
    case 'demolish': {
      // target = { cell, dir } : détruire le mur entre p et target.cell
      const cell = explorerCell(game, p);
      cell.walls[target.dir] = true;        // ouvrir
      target.cell.walls[OPP[target.dir]] = true;
      target.cell.demolished = target.cell.demolished || {};
      target.cell.demolished[OPP[target.dir]] = true;
      cell.demolished = cell.demolished || {};
      cell.demolished[target.dir] = true;
      log(game, `⛏ ${p.name} démolit un mur !`, 'good');
      break;
    }
    case 'research': {
      const tileDef = game.journalBag.shift();
      // target = { anchorCell, openDir }
      const placed = placeTile(game.board.cells, target.anchorCell, target.openDir, tileDef);
      if (placed) {
        log(game, `📖 ${p.name} place une tuile Journal.`, 'good');
      }
      break;
    }
  }
  return true;
}

/* ============================================================
   CIBLES POSSIBLES (pour l'UI)
   ============================================================ */
export function getMoveTargets(game, p, crawl = false) {
  const cell = explorerCell(game, p);
  if (!cell) return [];
  const opts = {
    ignoreRubble: hasAgile(p),
    bridgeOccupied: false,
  };
  // Pont : vérifier occupation
  const result = [];
  for (const { dir, cell: nb } of reachableNeighbors(game.board.cells, cell, opts)) {
    if (nb.type === 'bridge') {
      const occ = game.explorers.some(e => isOnCell(e, nb) && e.state !== 'dead' && e.state !== 'escaped');
      if (occ) continue;
    }
    result.push({ dir, cell: nb });
  }
  return result;
}

export function getExploreTargets(game, p) {
  // = arêtes ouvertes donnant sur une case vide
  return getOpenEdges(game, p);
}

export function getDigTargets(game, p) {
  // Règle (manuel p.11) : enlever l'Éboulis de sa tuile OU d'une tuile
  // adjacente connectée. L'Éboulis bloque l'entrée mais on PEUT creuser
  // pour dégager le passage : on vérifie donc la connectivité (arête ouverte)
  // sans exclure les tuiles à Éboulis.
  const cell = explorerCell(game, p);
  const cells = game.board.cells;
  const targets = [];
  if (cell.rubble) targets.push(cell);
  for (const dir of DIRS) {
    if (!cell.walls[dir]) continue;
    const [dx, dy] = DELTA[dir];
    const nb = cells.get(key(cell.x + dx, cell.y + dy));
    if (nb && !nb.flipped && nb.walls[OPP[dir]] && nb.rubble) {
      targets.push(nb);
    }
  }
  return targets;
}

export function getGrenadeTargets(game, p) {
  const cell = explorerCell(game, p);
  const targets = [];
  for (const { cell: nb } of reachableNeighbors(game.board.cells, cell, {})) {
    if (nb.guardians.length > 0) targets.push(nb);
  }
  return targets;
}

export function getSnipeTargets(game, p) {
  const cell = explorerCell(game, p);
  const targets = [];
  for (const c of game.board.cells.values()) {
    if (c.id === cell.id || c.guardians.length === 0) continue;
    if (lineOfSight(game.board.cells, cell, c, 3)) targets.push(c);
  }
  return targets;
}

export function getScopeTargets(game, p) {
  // Cibles = { cell, openDir } : cell visible en ligne droite ≤3, avec arête ouverte vers le vide
  const cell = explorerCell(game, p);
  const targets = [];
  for (const c of game.board.cells.values()) {
    if (c.id === cell.id) continue;
    if (!lineOfSight(game.board.cells, cell, c, 3)) continue;
    for (const dir of DIRS) {
      if (!c.walls[dir]) continue;
      const [dx, dy] = DELTA[dir];
      if (!game.board.cells.has(key(c.x + dx, c.y + dy))) {
        targets.push({ cell: c, openDir: dir });
      }
    }
  }
  return targets;
}

export function getDemolishTargets(game, p) {
  const cell = explorerCell(game, p);
  const targets = [];
  for (const dir of DIRS) {
    // Un mur adjacent = arête fermée sur cell, vers une case existante ou non
    if (cell.walls[dir]) continue; // déjà ouvert
    const [dx, dy] = DELTA[dir];
    const nb = game.board.cells.get(key(cell.x + dx, cell.y + dy));
    if (nb && !nb.flipped) {
      targets.push({ cell: nb, dir });
    }
  }
  return targets;
}

export function getHealTargets(game, p) {
  const cell = explorerCell(game, p);
  const targets = [];
  for (const e of game.explorers) {
    if (e.id === p.id) continue;
    if (e.state === 'dead' || e.state === 'escaped') continue;
    const ec = cellById(game, e.position);
    if (ec && lineOfSight(game.board.cells, cell, ec, 2) && e.hp < e.maxHp) {
      targets.push(e);
    }
  }
  return targets;
}

/* Arêtes ouvertes donnant sur une case vide (pour Révéler) */
export function getOpenEdges(game, p) {
  const cell = explorerCell(game, p);
  const edges = [];
  for (const dir of DIRS) {
    if (!cell.walls[dir]) continue;
    const [dx, dy] = DELTA[dir];
    const tk = key(cell.x + dx, cell.y + dy);
    if (!game.board.cells.has(tk)) {
      edges.push({ dir, targetKey: tk });
    }
  }
  return edges;
}

function hasOpenEdges(game, p) {
  return getOpenEdges(game, p).length > 0;
}

function hasAllyHere(game, p) {
  const cell = explorerCell(game, p);
  return game.explorers.some(e => e.id !== p.id && isOnCell(e, cell) && e.hp < e.maxHp);
}

function hasEnemyHere(game, p) {
  const cell = explorerCell(game, p);
  return cell && cell.guardians.length > 0;
}

function getItemHere(game, p) {
  const cell = explorerCell(game, p);
  return cell && cell.keyMarker && !p.item;
}

function hasVigilance(p) {
  return p.abilities.some(a => a.id === 'vigilance');
}
function hasAgile(p) {
  return p.abilities.some(a => a.id === 'agile');
}

/* ============================================================
   DÉ DE PÉRIL — résolution
   ============================================================ */
export function resolvePeril(game, faceId, actingExplorer) {
  const p = actingExplorer || currentPlayer(game);
  const cell = explorerCell(game, p);
  switch (faceId) {
    case 'stumble': {
      // Si dépassé ce tour : -1 PV (ou +1 si Survivante)
      const survivor = p.abilities.some(a => a.id === 'survivor');
      if (p.pushedThisTurn) {
        if (survivor) {
          p.hp = Math.min(p.maxHp, p.hp + 1);
          log(game, `🤕 Trébucher : ${p.name} (Survivante) regagne 1 PV !`, 'good');
        } else {
          damage(game, p, 1, 'trébucher');
          log(game, `🤕 Trébucher : ${p.name} perd 1 PV (s'est dépassé).`, 'bad');
        }
      } else {
        log(game, `🤕 Trébucher : pas d'effet (${p.name} ne s'est pas dépassé).`);
      }
      break;
    }
    case 'lava': {
      // TOUS les Explorateurs sur une tuile Lave perdent 1 PV
      const lavaCells = cellsOfType(game.board.cells, 'lava');
      for (const lc of lavaCells) {
        for (const e of game.explorers) {
          if (isOnCell(e, lc) && e.state === 'active') {
            damage(game, e, 1, 'lave');
          }
        }
      }
      log(game, `🌋 Lave : tous les Explorateurs sur tuile Lave perdent 1 PV.`, 'peril');
      // Vérifier l'éruption
      if (tryErupt(game.volcano)) {
        log(game, '🌋 LE VOLCAN ENTRE EN ÉRUPTION !', 'bad');
        triggerEruption(game);
      } else if (game.volcano.erupted) {
        // Propagation supplémentaire de lave
        const flipped = spreadLava(game.board.cells);
        killExplorersOnFlipped(game, flipped);
        if (flipped.length) log(game, `🌋 La lave engloutit ${flipped.length} tuile(s).`, 'bad');
      }
      break;
    }
    case 'collapse': {
      // Lance le dé. Si = numéro d'une Ruines sans Éboulis, effondrement
      const roll = rollDie();
      log(game, `💥 Effondrement : jet ${roll}.`);
      const ruinsCells = cellsOfType(game.board.cells, 'ruins').filter(c => !c.rubble);
      const hit = ruinsCells.find(c => c.ruinsNum === roll);
      if (hit) {
        hit.rubble = true;
        // Manuel p.14 : tous les Explorateurs sur la tuile perdent 2 PV (❤❤)
        for (const e of game.explorers) {
          if (isOnCell(e, hit) && e.state === 'active') damage(game, e, 2, 'effondrement');
        }
        const n = removeAllGuardians(game.pool, hit);
        log(game, `💥 Ruines n°${roll} effondrées : Éboulis posé, ${n} Gardien(s) éliminé(s).`, 'bad');
      } else {
        log(game, `💥 Aucune Ruines n°${roll} à effondrer.`);
      }
      break;
    }
    case 'trap': {
      // Piège à pics où l'on est ; Pièges à fléchettes où l'on est + adjacents
      if (cell.type === 'spikes') {
        triggerSpikes(game, cell);
      }
      // Fléchettes
      const dartTargets = [cell];
      for (const dir of DIRS) {
        const nb = neighbor(game.board.cells, cell, dir);
        if (nb && areConnected(game.board.cells, cell, nb)) dartTargets.push(nb);
      }
      for (const dt of dartTargets) {
        if (dt.type === 'darts') triggerDarts(game, dt);
      }
      break;
    }
    case 'wake': {
      const anchor = wakeNearestGuardian(game.board.cells, game.pool, cell);
      if (anchor) {
        log(game, `👁 Un Gardien se réveille sur la tuile Gardien/Latérale la plus proche.`, 'bad');
      } else {
        log(game, `👁 Tous les Gardiens sont déjà en jeu.`);
      }
      break;
    }
    case 'activate': {
      const events = activateAllGuardians(game);
      log(game, `🔃 Les Gardiens s'activent (${events.length} action(s)).`, 'peril');
      break;
    }
  }
  checkEndConditions(game);
}

function triggerSpikes(game, cell) {
  // Manuel p.16 : tous les Explorateurs sur la tuile perdent 2 PV (❤❤)
  for (const e of game.explorers) {
    if (isOnCell(e, cell) && e.state === 'active' && !hasVigilanceProt(e)) {
      damage(game, e, 2, 'piège à pics');
    }
  }
  log(game, `⚔ Piège à pics déclenché sur (${cell.x},${cell.y}).`, 'bad');
}

function triggerDarts(game, cell) {
  // Affecte la tuile + les tuiles adjacentes connectées (déjà résolu par l'appelant)
  for (const e of game.explorers) {
    if (isOnCell(e, cell) && e.state === 'active' && !hasVigilanceProt(e)) {
      damage(game, e, 1, 'piège à fléchettes');
    }
  }
  log(game, `🏹 Piège à fléchettes déclenché sur (${cell.x},${cell.y}).`, 'bad');
}

function hasVigilanceProt(explorer) {
  // Si un Vigile est sur la même tuile, protection
  // (simplifié : le Vigile protège sa propre tuile via sa capacité passive)
  return explorer.abilities.some(a => a.id === 'vigilance');
}

function damage(game, explorer, amount, source) {
  // Manuel p.27 (Se préparer) : impossible de perdre des PV jusqu'au début
  // du prochain tour, AUCUNE exception (ni lave, ni trébucher, ni pièges).
  // Seul « Se dépasser » contourne le Bouclier (et n'appelle pas damage()).
  if (explorer.shielded) return;
  explorer.hp = Math.max(0, explorer.hp - amount);
  if (explorer.hp <= 0 && explorer.state === 'active') {
    explorer.state = 'down';
    log(game, `⬇️ ${explorer.name} tombe à terre (${source}) !`, 'bad');
  }
}

/* ============================================================
   ÉRUPTION & LAVE
   ============================================================ */
function triggerEruption(game) {
  game.volcano.erupted = true;
  // Si l'artefact n'est pas sorti et le Sanctuaire posé : le retourner
  if (game.sanctuary && !game.artifactEscaped) {
    initialEruption(game.board.cells, game.sanctuary);
    log(game, '🌋 Le Sanctuaire est englouti par la lave !', 'bad');
    if (!game.artifactRetrieved) {
      // Artefact toujours dans le sanctuaire = défaite
      game.winner = 'game';
      log(game, '💀 L\'Artefact est perdu à jamais. Défaite.', 'bad');
    }
  }
  // Propagation initiale : retourner les tuiles de bord connectées au sanctuaire
  const flipped = spreadLava(game.board.cells);
  killExplorersOnFlipped(game, flipped);
}

function killExplorersOnFlipped(game, flippedCells) {
  for (const c of flippedCells) {
    for (const e of game.explorers) {
      if (isOnCell(e, c) && e.state !== 'escaped' && e.state !== 'dead') {
        e.hp = 0;
        e.state = 'dead';
        log(game, `☠ ${e.name} est englouti par la lave !`, 'bad');
      }
    }
  }
}

/* ============================================================
   FIN DE TOUR DE JOUEUR / TOUR DE JEU
   ============================================================ */

/* Termine le tour du joueur courant (après le dé de Péril). */
export function endExplorerTurn(game) {
  // Passer au joueur suivant (dans l'ordre, sauf échappés/morts)
  const p = currentPlayer(game);
  // Retirer le bouclier expiré / cooldowns
  if (p.shielded) p.shielded = false; // se retire au début du PROCHAIN tour (géré au start)
  // Trouver le prochain joueur actif ou à terre (échappés/morts sautés)
  let next = (game.currentExplorerIdx + 1) % game.explorers.length;
  let safety = 0;
  while (safety < game.explorers.length) {
    const cand = game.explorers[next];
    if (cand.state === 'escaped' || cand.state === 'dead') {
      next = (next + 1) % game.explorers.length;
      safety++;
      continue;
    }
    break;
  }
  game.currentExplorerIdx = next;

  // Si on a fait le tour complet -> fin de tour de jeu
  if (next <= game.currentExplorerIdx && game.explorers[next].orderIndex === 0) {
    endGameTurn(game);
  }
  startExplorerTurn(game);
}

function startExplorerTurn(game) {
  const p = currentPlayer(game);
  game.phase = 'explorerTurn';
  game.ap = 2;
  p.pushedThisTurn = false;
  // Gérer la fin du bouclier (Se préparer dure jusqu'au début du prochain tour)
  if (p.abilityCooldown.prepare) {
    p.shielded = false;
    delete p.abilityCooldown.prepare;
  }
  // Les cooldowns d'un tour se lèvent
  for (const k of Object.keys(p.abilityCooldown)) {
    if (k !== 'prepare') delete p.abilityCooldown[k];
  }
  log(game, `— Tour de ${p.name} —`, 'system');
  checkEndConditions(game);
}

function endGameTurn(game) {
  // 1. Gardiens s'activent 2 fois
  for (let i = 0; i < 2; i++) {
    const events = activateAllGuardians(game);
    if (events.length) log(game, `👁 Gardiens activation ${i+1}/2 (${events.length} action(s)).`, 'peril');
  }
  // 2. Le marqueur Éruption progresse
  const step = advanceEruption(game.volcano);
  log(game, `🌋 L'éruption approche (${game.volcano.position} restant, -${step}/tour).`, 'peril');
  if (game.volcano.erupted) {
    const flipped = spreadLava(game.board.cells);
    killExplorersOnFlipped(game, flipped);
    if (flipped.length) log(game, `🌋 La lave engloutit ${flipped.length} tuile(s).`, 'bad');
  }
  game.turn++;
  log(game, `═══ Tour ${game.turn} ═══`, 'system');
  checkEndConditions(game);
}

/* ============================================================
   ARTEFACT & MALÉDICTION
   ============================================================ */
export function retrieveArtifact(game) {
  const p = currentPlayer(game);
  const cell = explorerCell(game, p);
  if (!cell || !cell.isSanctuary || !cell.unlocked) return false;
  if (p.item) return false;
  if (game.keysPlacedOnSanctuary < 3) return false;
  p.item = 'artifact';
  game.artifactRetrieved = true;
  cell.hasArtifact = false;
  // Activer la malédiction
  game.curseActive = true;
  game.volcano.cursed = true;
  log(game, `🏆 ${p.name} s'empare de l'Artefact ! La MALÉDICTION s'abat !`, 'bad');
  log(game, `☠ Désormais : 2 dés de Péril/tour, éruption +2 cases/tour.`, 'bad');
  return true;
}

export function placeKeyOnSanctuary(game) {
  const p = currentPlayer(game);
  const cell = explorerCell(game, p);
  if (!cell || !cell.isSanctuary) return false;
  if (p.item !== 'key') return false;
  game.keysPlacedOnSanctuary++;
  p.item = null;
  log(game, `🔑 ${p.name} pose une Clé sur le Sanctuaire (${game.keysPlacedOnSanctuary}/3).`, 'good');
  if (game.keysPlacedOnSanctuary >= 3 && game.sanctuary) {
    game.sanctuary.unlocked = true;
    game.sanctuary.hasArtifact = true;
    log(game, `🔓 Le Sanctuaire est déverrouillé ! L'Artefact est révélé.`, 'good');
  }
  spendAP(game, 1);
  return true;
}

/* Tente de poser le Sanctuaire quand le sac est vide. */
export function tryPlaceSanctuary(game) {
  if (game.bag.length > 0 || game.sanctuary) return false;
  const sanc = placeSanctuary(game.board.cells);
  if (sanc) {
    game.sanctuary = sanc;
    log(game, '🗺️ Le Sanctuaire est découvert dans la colonne la plus profonde !', 'system');
    return true;
  }
  return false;
}

/* ============================================================
   FIN DE PARTIE
   ============================================================ */
function checkEndConditions(game) {
  if (game.winner) return;

  // Victoire : un Explorateur s'est échappé avec l'Artefact
  if (game.artifactEscaped) {
    game.winner = 'players';
    const survivors = game.explorers.filter(e => e.state !== 'dead').length;
    const total = game.explorers.length;
    const dead = total - survivors;
    if (dead === 0) game.medal = 'Légendaire';
    else if (dead === 1) game.medal = 'Or';
    else if (dead === 2) game.medal = 'Argent';
    else game.medal = 'Bronze';
    return;
  }
  // Défaite : plus aucun Explorateur actif/à terre (tous morts ou échappés sans artefact)
  const alive = game.explorers.filter(e => e.state === 'active' || e.state === 'down');
  if (alive.length === 0) {
    game.winner = 'game';
    game.medal = 'Oubliés à jamais';
    return;
  }
}

/* Dépense des PA */
function spendAP(game, n) {
  game.ap -= n;
  if (game.ap < 0) game.ap = 0;
}

/* ============================================================
   ACCESSEURS
   ============================================================ */
export { createVolcano, VOLCANO_MAX };
