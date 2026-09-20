import { getActiveExplorer, getCell, log, damage, heal, spawnGuardian, removeGuardian } from './state.js';
import { placeTile, getValidRotations, areConnected, bfs, DIRS, OPP, DIR_DELTA } from './board.js';
import { TEMPLE_TILES, JOURNAL_TILES } from './tiles.js';
import { rollDie } from './perils.js';
import { EXPLORERS } from './explorers.js';

export function spendAP(state, cost) {
  if (state.ap < cost) throw new Error(`Insufficient AP: need ${cost}, have ${state.ap}`);
  state.ap -= cost;
}

export function canDoAction(state, actionId) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return false;
  if (state.phase !== 'explorerTurn') return false;

  if (explorer.state === 'down' && actionId !== 'crawl') return false;
  if (explorer.state !== 'active' && actionId !== 'crawl') return false;

  const costs = {
    reveal: 1, move: 1, explore: 1, heal: 1, attack: 1,
    dig: 2, run: 2, manage: 1, push: 0,
  };
  const cost = costs[actionId] || 0;
  if (cost > 0 && state.ap < cost) return false;

  return true;
}

export function getMoveTargets(state) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return [];
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell) return [];
  const targets = [];
  for (const dir of DIRS) {
    const [dx, dy] = DIR_DELTA[dir];
    const nx = explorer.x + dx;
    const ny = explorer.y + dy;
    const nb = getCell(state, nx, ny);
    if (!nb) continue;
    if (nb.flipped) continue;
    if (!areConnected(state.board, explorer.x, explorer.y, nx, ny)) continue;
    if (nb.rubble && !hasAgile(state)) continue;
    if (nb.type === 'pont') {
      const occupied = state.explorers.some(e =>
        e.x === nx && e.y === ny && e.state !== 'dead' && e.state !== 'escaped'
      );
      if (occupied) continue;
    }
    targets.push({ x: nx, y: ny });
  }
  return targets;
}

export function getRevealTargets(state) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return [];
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell) return [];
  const targets = [];
  for (const dir of DIRS) {
    if (cell.walls[dir]) {
      const [dx, dy] = DIR_DELTA[dir];
      const nx = explorer.x + dx;
      const ny = explorer.y + dy;
      const nb = getCell(state, nx, ny);
      if (!nb) targets.push(dir);
    }
  }
  return targets;
}

export function getDigTargets(state) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return [];
  const targets = [];
  const cell = getCell(state, explorer.x, explorer.y);
  if (cell && cell.rubble) targets.push({ x: explorer.x, y: explorer.y });
  for (const dir of DIRS) {
    const [dx, dy] = DIR_DELTA[dir];
    const nx = explorer.x + dx;
    const ny = explorer.y + dy;
    const nb = getCell(state, nx, ny);
    if (!nb || !areConnected(state.board, explorer.x, explorer.y, nx, ny)) continue;
    if (nb.rubble) targets.push({ x: nx, y: ny });
  }
  return targets;
}

export function hasAgile(state) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return false;
  const def = getExplorerDef(explorer);
  return def && def.abilities.includes('agile');
}

export function hasVigilanceOnTile(state, x, y) {
  return state.explorers.some(e => {
    if (e.x !== x || e.y !== y) return false;
    if (e.state === 'dead' || e.state === 'escaped') return false;
    const def = getExplorerDef(e);
    return def && def.abilities.includes('vigilance');
  });
}

export function hasScholar(state) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return false;
  const def = getExplorerDef(explorer);
  return def && def.abilities.includes('scholar');
}

export function hasSurvivor(explorer) {
  const def = getExplorerDef(explorer);
  return def && def.abilities.includes('survivor');
}

function getExplorerDef(explorer) {
  return EXPLORERS.find(e => e.id === explorer.id);
}

export function onTilePlaced(state, cell, tileDef) {
  switch (tileDef.type) {
    case 'cle':
      cell.keyMarker = true;
      log(state, `Clé placée sur la tuile (${cell.x}, ${cell.y})`);
      break;
    case 'ruines':
      cell.rubble = true;
      cell.ruinsNum = tileDef.ruinsNum;
      log(state, `Éboulis placé sur les Ruines (${cell.x}, ${cell.y})`);
      break;
    case 'gardien':
      spawnGuardian(state.guardians, cell);
      log(state, `Gardien placé sur (${cell.x}, ${cell.y})`);
      break;
  }
}

export function drawTileForReveal(state, dir) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return { ok: false };
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell || !cell.walls[dir]) return { ok: false };

  const [dx, dy] = DIR_DELTA[dir];
  const nx = explorer.x + dx;
  const ny = explorer.y + dy;
  const nb = getCell(state, nx, ny);
  if (nb) return { ok: false };

  const isScholar = hasScholar(state) && state.tileBag.length >= 2;
  let drawnTileIds = [];
  if (isScholar) {
    drawnTileIds = [state.tileBag.pop(), state.tileBag.pop()];
  } else if (state.tileBag.length > 0) {
    drawnTileIds = [state.tileBag.pop()];
  } else {
    return { ok: false, reason: 'empty_bag' };
  }

  const tiles = [];
  for (const tileId of drawnTileIds) {
    const tileDef = TEMPLE_TILES.find(t => t.id === tileId);
    if (!tileDef) continue;
    const rotations = getValidRotations(state.board, nx, ny, tileDef.walls);
    if (rotations.length > 0) {
      tiles.push({ tileDef, rotations, x: nx, y: ny, _drawnId: tileId });
    }
  }

  if (tiles.length === 0) {
    state.tileBag.push(...drawnTileIds);
    return { ok: false, reason: 'no_valid_rotation' };
  }

  return { ok: true, tiles, dir, isScholar, _drawnTileIds: drawnTileIds };
}

export function confirmTilePlacement(state, tileDef, rotation, x, y) {
  const placed = placeTile(state.board, x, y, tileDef, rotation);
  spendAP(state, 1);
  onTilePlaced(state, placed, tileDef);
  return { ok: true, cell: placed };
}

export function reveal(state, dir) {
  const draw = drawTileForReveal(state, dir);
  if (!draw.ok) return draw;
  const t = draw.tiles[0];
  return confirmTilePlacement(state, t.tileDef, t.rotations[0], t.x, t.y);
}

export function move(state, tx, ty) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return { ok: false };
  const result = moveExplorer(state, explorer, tx, ty);
  if (result.downed) {
    state.phase = 'perilPhase';
  }
  return result;
}

export function moveExplorer(state, explorer, tx, ty, opts = {}) {
  const sourceCell = getCell(state, explorer.x, explorer.y);
  const targetCell = getCell(state, tx, ty);
  if (!sourceCell || !targetCell) return { ok: false };
  if (!areConnected(state.board, explorer.x, explorer.y, tx, ty)) return { ok: false };
  if (targetCell.flipped) return { ok: false };
  const def = getExplorerDef(explorer);
  const agile = def && def.abilities.includes('agile');
  if (targetCell.rubble && !agile) return { ok: false };

  if (targetCell.type === 'pont') {
    const occupied = state.explorers.some(e =>
      e.x === tx && e.y === ty && e.state !== 'dead' && e.state !== 'escaped' && e.id !== explorer.id
    );
    if (occupied) return { ok: false, reason: 'bridge_occupied' };
  }

  const fleeingGuardians = (sourceCell.guardians || []).length;
  if (fleeingGuardians > 0) {
    for (let i = 0; i < fleeingGuardians; i++) {
      damage(state, explorer, 1, 'fleeing');
    }
    log(state, `${explorer.name} fuit (${fleeingGuardians} Gardien(s), -${fleeingGuardians} PV)`);
  }

  if (!opts.skipAP) {
    spendAP(state, 1);
  }

  explorer.x = tx;
  explorer.y = ty;

  if (explorer.hp === 0) {
    explorer.state = 'down';
    log(state, `${explorer.name} s'effondre en fuyant`);
    return { ok: true, downed: true };
  }

  if (targetCell.type === 'piege_pics' && !targetCell.consolidated) {
    if (!hasVigilanceOnTile(state, tx, ty)) {
      const roll = rollDie();
      if (roll < 4) {
        triggerSpikes(state, targetCell);
      }
    }
  }

  if (explorer.hp === 0) {
    explorer.state = 'down';
    return { ok: true, downed: true };
  }

  return { ok: true };
}

export function triggerSpikes(state, cell) {
  for (const e of state.explorers) {
    if (e.state === 'dead' || e.state === 'escaped') continue;
    if (e.x === cell.x && e.y === cell.y) {
      if (!hasVigilanceOnTile(state, cell.x, cell.y)) {
        damage(state, e, 3, 'spikes');
      }
    }
  }
  log(state, `Piège à pics déclenché en (${cell.x}, ${cell.y})`);
}

export function triggerDarts(state, cell) {
  const affected = [cell];
  for (const dir of DIRS) {
    const [dx, dy] = DIR_DELTA[dir];
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    const nb = getCell(state, nx, ny);
    if (nb && areConnected(state.board, cell.x, cell.y, nx, ny)) {
      affected.push(nb);
    }
  }
  for (const c of affected) {
    for (const e of state.explorers) {
      if (e.state === 'dead' || e.state === 'escaped') continue;
      if (e.x === c.x && e.y === c.y) {
        if (!hasVigilanceOnTile(state, c.x, c.y)) {
          damage(state, e, 1, 'darts');
        }
      }
    }
  }
  log(state, `Piège à fléchettes déclenché en (${cell.x}, ${cell.y}) et tuiles adjacentes`);
}

export function drawTileForExplore(state, dir) {
  return drawTileForReveal(state, dir);
}

export function confirmExplorePlacement(state, tileDef, rotation, x, y, dir) {
  const result = confirmTilePlacement(state, tileDef, rotation, x, y);
  if (!result.ok) return result;
  const explorer = getActiveExplorer(state);
  const [dx, dy] = DIR_DELTA[dir];
  const nx = explorer.x + dx;
  const ny = explorer.y + dy;
  const targetCell = getCell(state, nx, ny);
  if (!targetCell || targetCell.rubble || targetCell.flipped) {
    return { ok: true, cell: result.cell, entered: false };
  }
  if (targetCell.type === 'pont') {
    const occupied = state.explorers.some(e =>
      e.x === nx && e.y === ny && e.state !== 'dead' && e.state !== 'escaped' && e.id !== explorer.id
    );
    if (occupied) return { ok: true, cell: result.cell, entered: false };
  }
  explorer.x = nx;
  explorer.y = ny;
  if (targetCell.type === 'piege_pics' && !targetCell.consolidated) {
    if (!hasVigilanceOnTile(state, nx, ny)) {
      const roll = rollDie();
      if (roll < 4) triggerSpikes(state, targetCell);
    }
  }
  return { ok: true, cell: result.cell, entered: true };
}

export function explore(state, dir) {
  const draw = drawTileForExplore(state, dir);
  if (!draw.ok) return draw;
  const t = draw.tiles[0];
  return confirmExplorePlacement(state, t.tileDef, t.rotations[0], t.x, t.y, dir);
}

export function performHeal(state, targetExplorerId) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return { ok: false };
  let target = explorer;
  if (targetExplorerId && targetExplorerId !== explorer.id) {
    target = state.explorers.find(e => e.id === targetExplorerId);
    if (!target) return { ok: false };
    if (target.x !== explorer.x || target.y !== explorer.y) return { ok: false };
  }
  spendAP(state, 1);
  heal(state, target, 1);
  log(state, `${explorer.name} soigne ${target.name} (+1 PV)`);
  return { ok: true };
}

export function attack(state) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return { ok: false };
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell || !cell.guardians || cell.guardians.length === 0) return { ok: false };
  spendAP(state, 1);
  return performAttackWithRoll(state, rollDie());
}

export function performAttackWithRoll(state, roll) {
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell || !cell.guardians || cell.guardians.length === 0) return { ok: false, roll };
  if (roll >= 4) {
    removeGuardian(state.guardians, cell);
    log(state, `${explorer.name} élimine un Gardien (jet: ${roll})`);
    return { ok: true, eliminated: true, roll };
  }
  log(state, `${explorer.name} rate son attaque (jet: ${roll})`);
  return { ok: true, eliminated: false, roll };
}

export function dig(state, tx, ty) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return { ok: false };
  const cell = getCell(state, tx, ty);
  if (!cell || !cell.rubble) return { ok: false };
  if (tx === explorer.x && ty === explorer.y) {
    spendAP(state, 2);
    cell.rubble = false;
    log(state, `${explorer.name} creuse les éboulis`);
    return { ok: true };
  }
  if (!areConnected(state.board, explorer.x, explorer.y, tx, ty)) return { ok: false };
  spendAP(state, 2);
  cell.rubble = false;
  log(state, `${explorer.name} creuse les éboulis en (${tx}, ${ty})`);
  return { ok: true };
}

export function run(state, moves) {
  spendAP(state, 2);
  const results = [];
  for (const m of moves.slice(0, 3)) {
    results.push(move(state, m.x, m.y));
    if (results[results.length - 1].downed) break;
  }
  return { ok: true, results };
}

export function manageObject(state, action, targetExplorerId) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return { ok: false };
  const cell = getCell(state, explorer.x, explorer.y);

  switch (action) {
    case 'pickup': {
      if (explorer.item) return { ok: false, reason: 'already_holding' };
      if (cell && cell.keyMarker) {
        cell.keyMarker = false;
        explorer.item = 'key';
        spendAP(state, 1);
        log(state, `${explorer.name} ramasse une Clé`);
        return { ok: true };
      }
      if (state.artifactOnGround && state.artifactOnGround.x === explorer.x && state.artifactOnGround.y === explorer.y) {
        state.artifactOnGround = null;
        explorer.item = 'artifact';
        spendAP(state, 1);
        log(state, `${explorer.name} ramasse l'Artefact`);
        return { ok: true };
      }
      if (cell && cell.isSanctuary && state.artifactOnSanctuary) {
        state.artifactOnSanctuary = false;
        state.artifactRetrieved = true;
        state.curseActive = true;
        state.volcano.cursed = true;
        explorer.item = 'artifact';
        spendAP(state, 1);
        log(state, `${explorer.name} récupère l'Artefact ! La malédiction s'abat !`);
        return { ok: true };
      }
      return { ok: false, reason: 'nothing_to_pickup' };
    }
    case 'take': {
      if (explorer.item) return { ok: false, reason: 'already_holding' };
      const target = state.explorers.find(e => e.id === targetExplorerId);
      if (!target || !target.item) return { ok: false };
      if (target.x !== explorer.x || target.y !== explorer.y) return { ok: false };
      explorer.item = target.item;
      target.item = null;
      spendAP(state, 1);
      log(state, `${explorer.name} prend ${explorer.item} de ${target.name}`);
      return { ok: true };
    }
    case 'give': {
      if (!explorer.item) return { ok: false, reason: 'not_holding' };
      const target = state.explorers.find(e => e.id === targetExplorerId);
      if (!target || target.item) return { ok: false };
      if (target.x !== explorer.x || target.y !== explorer.y) return { ok: false };
      target.item = explorer.item;
      explorer.item = null;
      spendAP(state, 1);
      log(state, `${explorer.name} donne ${target.item} à ${target.name}`);
      return { ok: true };
    }
    case 'drop': {
      if (!explorer.item) return { ok: false, reason: 'not_holding' };
      if (explorer.item === 'key' && cell) {
        cell.keyMarker = true;
      } else if (explorer.item === 'artifact') {
        state.artifactOnGround = { x: explorer.x, y: explorer.y };
      }
      log(state, `${explorer.name} dépose ${explorer.item}`);
      explorer.item = null;
      spendAP(state, 1);
      return { ok: true };
    }
    case 'place_key_sanctuary': {
      if (!explorer.item || explorer.item !== 'key') return { ok: false };
      if (!cell || !cell.isSanctuary) return { ok: false };
      explorer.item = null;
      state.keysPlacedOnSanctuary++;
      spendAP(state, 1);
      log(state, `Clé placée sur le Sanctuaire (${state.keysPlacedOnSanctuary}/3)`);
      if (state.keysPlacedOnSanctuary >= 3) {
        state.artifactOnSanctuary = true;
        log(state, `Le Sanctuaire est déverrouillé ! L'Artefact apparaît !`);
      }
      return { ok: true };
    }
  }
  return { ok: false };
}

export function push(state) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return { ok: false };
  if (explorer.state !== 'active') return { ok: false };
  if (explorer.pushedThisTurn) return { ok: false, reason: 'already_pushed' };
  if (explorer.hp <= 0) return { ok: false };

  explorer.pushedThisTurn = true;
  explorer.hp = Math.max(0, explorer.hp - 1);
  state.ap += 1;

  log(state, `${explorer.name} se dépassse (-1 PV, +1 PA)`);

  if (explorer.hp === 0) {
    explorer.state = 'down';
    state.phase = 'perilPhase';
    log(state, `${explorer.name} s'effondre après s'être dépassé`);
  }

  return { ok: true };
}

export function crawl(state, tx, ty) {
  const explorer = getActiveExplorer(state);
  if (!explorer || explorer.state !== 'down') return { ok: false };
  if (!areConnected(state.board, explorer.x, explorer.y, tx, ty)) return { ok: false };
  const target = getCell(state, tx, ty);
  if (!target || target.flipped || (target.rubble && !hasAgile(state))) return { ok: false };
  explorer.x = tx;
  explorer.y = ty;
  return { ok: true };
}
