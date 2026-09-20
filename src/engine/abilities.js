import { getActiveExplorer, getCell, log, damage, heal, spawnGuardian, removeGuardian, removeAllGuardians } from './state.js';
import { areConnected, lineOfSight, getAdjacentConnectedCells, getValidRotations, placeTile, DIRS, OPP, DIR_DELTA } from './board.js';
import { TEMPLE_TILES, JOURNAL_TILES } from './tiles.js';
import { rollDie } from './perils.js';
import { EXPLORERS, ABILITIES } from './explorers.js';

function getDef(explorer) {
  return EXPLORERS.find(e => e.id === explorer.id);
}

export function hasAbility(explorer, abilityId) {
  const def = getDef(explorer);
  return def && def.abilities.includes(abilityId);
}

export function hasScholar(state) {
  const e = getActiveExplorer(state);
  return e && hasAbility(e, 'scholar');
}

export function hasAgile(state) {
  const e = getActiveExplorer(state);
  return e && hasAbility(e, 'agile');
}

export function hasVigilanceOnTile(state, x, y) {
  return state.explorers.some(e => {
    if (e.x !== x || e.y !== y) return false;
    if (e.state === 'dead' || e.state === 'escaped') return false;
    return hasAbility(e, 'vigilance');
  });
}

export function hasSurvivor(explorer) {
  return hasAbility(explorer, 'survivor');
}

export function canUseAbility(state, abilityId) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return false;
  if (explorer.state !== 'active') return false;
  if (state.phase !== 'explorerTurn') return false;

  const ab = ABILITIES[abilityId];
  if (!ab) return false;

  if (ab.passive) return false;

  const cost = ab.costType === 'hp' ? 0 : ab.cost;
  if (cost > 0 && state.ap < cost) return false;

  if (explorer.abilityCooldown && explorer.abilityCooldown[abilityId] > 0) return false;

  if (ab.uses !== null && explorer.abilityUsesLeft[abilityId] <= 0) return false;

  return true;
}

export function removeShield(state, explorer) {
  explorer.shielded = false;
}

export function useIlluminate(state) {
  if (!canUseAbility(state, 'illuminate')) return { ok: false };
  state.ap -= 1;
  return { ok: true, reveals: 2 };
}

export function useSprint(state) {
  if (!canUseAbility(state, 'sprint')) return { ok: false };
  state.ap -= 1;
  return { ok: true, moves: 2 };
}

export function useOrder(state, targetExplorerId, tx, ty) {
  if (!canUseAbility(state, 'order')) return { ok: false };
  const target = state.explorers.find(e => e.id === targetExplorerId);
  if (!target || target.state !== 'active') return { ok: false };
  const sourceCell = getCell(state, target.x, target.y);
  if (!sourceCell) return { ok: false };

  const fleeingGuardians = (sourceCell.guardians || []).length;
  if (fleeingGuardians > 0) {
    for (let i = 0; i < fleeingGuardians; i++) {
      damage(state, target, 1, 'fleeing');
    }
  }

  target.x = tx;
  target.y = ty;

  const targetCell = getCell(state, tx, ty);
  if (targetCell && targetCell.type === 'spikes' && !targetCell.consolidated) {
    if (!hasVigilanceOnTile(state, tx, ty)) {
      const roll = rollDie();
      if (roll < 4) {
        for (const e of state.explorers) {
          if (e.state === 'dead' || e.state === 'escaped') continue;
          if (e.x === tx && e.y === ty && !hasVigilanceOnTile(state, tx, ty)) {
            damage(state, e, 3, 'spikes');
          }
        }
      }
    }
  }

  state.ap -= 1;
  log(state, `${getActiveExplorer(state).name} ordonne à ${target.name} de se déplacer`);
  return { ok: true };
}

export function useResearch(state, tx, ty, dir) {
  if (!canUseAbility(state, 'research')) return { ok: false };
  if (state.journalBag.length === 0) return { ok: false, reason: 'no_journal_tiles' };

  const tileId = state.journalBag.pop();
  const tileDef = JOURNAL_TILES.find(t => t.id === tileId);
  if (!tileDef) return { ok: false };

  const rotations = getValidRotations(state.board, tx, ty, tileDef.walls);
  if (rotations.length === 0) {
    state.journalBag.push(tileId);
    return { ok: false, reason: 'no_valid_rotation' };
  }

  placeTile(state.board, tx, ty, tileDef, rotations[0]);
  state.ap -= 1;
  getActiveExplorer(state).abilityUsesLeft.research--;
  log(state, `Tuile Journal placée en (${tx}, ${ty})`);
  return { ok: true };
}

export function useExcavate(state, tx, ty) {
  if (!canUseAbility(state, 'excavate')) return { ok: false };
  const cell = getCell(state, tx, ty);
  if (!cell || !cell.rubble) return { ok: false };
  const explorer = getActiveExplorer(state);
  if (tx !== explorer.x || ty !== explorer.y) {
    if (!areConnected(state.board, explorer.x, explorer.y, tx, ty)) return { ok: false };
  }
  cell.rubble = false;
  state.ap -= 1;
  log(state, `${explorer.name} excave les éboulis en (${tx}, ${ty})`);
  return { ok: true };
}

export function useConsolidate(state) {
  if (!canUseAbility(state, 'consolidate')) return { ok: false };
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell) return { ok: false };
  cell.type = 'normal';
  cell.rubble = false;
  cell.keyMarker = false;
  cell.consolidated = true;
  state.ap -= 1;
  explorer.abilityUsesLeft.consolidate--;
  log(state, `${explorer.name} consolide la tuile (${cell.x}, ${cell.y})`);
  return { ok: true };
}

export function useScope(state, tx, ty) {
  if (!canUseAbility(state, 'scope')) return { ok: false };
  const explorer = getActiveExplorer(state);
  if (!lineOfSight(state.board, explorer.x, explorer.y, tx, ty, 3)) return { ok: false };
  const existing = getCell(state, tx, ty);
  if (existing) return { ok: false };
  if (state.tileBag.length === 0) return { ok: false };

  const tileId = state.tileBag.pop();
  const tileDef = TEMPLE_TILES.find(t => t.id === tileId);
  if (!tileDef) return { ok: false };
  const rotations = getValidRotations(state.board, tx, ty, tileDef.walls);
  if (rotations.length === 0) {
    state.tileBag.push(tileId);
    return { ok: false };
  }
  placeTile(state.board, tx, ty, tileDef, rotations[0]);
  state.ap -= 1;
  log(state, `${explorer.name} révèle une tuile en (${tx}, ${ty})`);
  return { ok: true };
}

export function useSnipe(state, tx, ty) {
  if (!canUseAbility(state, 'snipe')) return { ok: false };
  const explorer = getActiveExplorer(state);
  if (explorer.x === tx && explorer.y === ty) return { ok: false };
  if (!lineOfSight(state.board, explorer.x, explorer.y, tx, ty, 3)) return { ok: false };
  const cell = getCell(state, tx, ty);
  if (!cell || !cell.guardians || cell.guardians.length === 0) return { ok: false };
  removeGuardian(state.guardians, cell);
  state.ap -= 1;
  log(state, `${explorer.name} abat un Gardien en (${tx}, ${ty})`);
  return { ok: true };
}

export function useGrenade(state, tx, ty) {
  if (!canUseAbility(state, 'grenade')) return { ok: false };
  const explorer = getActiveExplorer(state);
  if (explorer.x === tx && explorer.y === ty) return { ok: false };
  if (!areConnected(state.board, explorer.x, explorer.y, tx, ty)) return { ok: false };
  const cell = getCell(state, tx, ty);
  if (!cell) return { ok: false };

  removeAllGuardians(state.guardians, cell);

  for (const e of state.explorers) {
    if (e.state === 'dead' || e.state === 'escaped') continue;
    if (e.x === tx && e.y === ty) {
      damage(state, e, 1, 'grenade');
    }
  }

  state.ap -= 1;
  log(state, `${explorer.name} lance une grenade sur (${tx}, ${ty})`);
  return { ok: true };
}

export function useDemolish(state, dir) {
  if (!canUseAbility(state, 'demolish')) return { ok: false };
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell || cell.walls[dir]) return { ok: false };

  const [dx, dy] = DIR_DELTA[dir];
  const nx = explorer.x + dx;
  const ny = explorer.y + dy;
  const nb = getCell(state, nx, ny);
  if (!nb) return { ok: false };

  cell.walls[dir] = true;
  nb.walls[OPP[dir]] = true;
  if (!cell.demolished) cell.demolished = {};
  cell.demolished[dir] = true;
  if (!nb.demolished) nb.demolished = {};
  nb.demolished[OPP[dir]] = true;

  state.ap -= 1;
  explorer.abilityUsesLeft.demolish--;
  log(state, `${explorer.name} démolit un mur vers ${dir}`);
  return { ok: true };
}

export function useAnnihilate(state) {
  if (!canUseAbility(state, 'annihilate')) return { ok: false };
  const explorer = getActiveExplorer(state);
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell || !cell.guardians || cell.guardians.length === 0) return { ok: false };
  removeGuardian(state.guardians, cell);
  state.ap -= 1;
  log(state, `${explorer.name} anéantit un Gardien`);
  return { ok: true };
}

export function usePrepare(state) {
  if (!canUseAbility(state, 'prepare')) return { ok: false };
  const explorer = getActiveExplorer(state);
  explorer.shielded = true;
  if (!explorer.abilityCooldown) explorer.abilityCooldown = {};
  explorer.abilityCooldown.prepare = 1;
  state.ap -= 1;
  log(state, `${explorer.name} se prépare (Bouclier)`);
  return { ok: true };
}

export function useHeal(state, targetExplorerId) {
  if (!canUseAbility(state, 'heal')) return { ok: false };
  const explorer = getActiveExplorer(state);
  const target = state.explorers.find(e => e.id === targetExplorerId);
  if (!target || target.id === explorer.id) return { ok: false };
  if (!lineOfSight(state.board, explorer.x, explorer.y, target.x, target.y, 2)) return { ok: false };

  heal(state, target, 2);
  state.ap -= 1;
  log(state, `${explorer.name} soigne ${target.name} (+2 PV)`);
  return { ok: true };
}

export function useRevive(state, targetExplorerId) {
  if (!canUseAbility(state, 'revive')) return { ok: false };
  const explorer = getActiveExplorer(state);
  const target = state.explorers.find(e => e.id === targetExplorerId);
  if (!target || target.id === explorer.id) return { ok: false };

  if (target.state === 'down') {
    heal(state, target, 1);
    log(state, `${explorer.name} ranime ${target.name} (+1 PV)`);
  } else {
    heal(state, target, 3);
    log(state, `${explorer.name} soigne ${target.name} (+3 PV)`);
  }

  state.ap -= 1;
  return { ok: true };
}

export function usePurify(state, tx, ty) {
  if (!canUseAbility(state, 'purify')) return { ok: false };
  const explorer = getActiveExplorer(state);
  if (explorer.x === tx && explorer.y === ty) return { ok: false };
  const cell = getCell(state, tx, ty);
  if (!cell) return { ok: false };

  removeAllGuardians(state.guardians, cell);
  state.ap -= 1;
  log(state, `${explorer.name} purifie la tuile (${tx}, ${ty})`);
  return { ok: true };
}

export function useAdventurer(state) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return { ok: false };
  if (!hasAbility(explorer, 'adventurer')) return { ok: false };
  if (explorer.hp <= 1) return { ok: false, reason: 'not_enough_hp' };

  explorer.hp -= 1;
  log(state, `${explorer.name} dépense 1 PV pour relancer un dé`);
  return { ok: true, reroll: true };
}
