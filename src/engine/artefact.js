import { getActiveExplorer, getCell, log } from './state.js';
import { placeTile, getValidRotations } from './board.js';
import { SANCTUARY_TILE } from './tiles.js';

export function tryPlaceSanctuary(state) {
  if (state.tileBag.length > 0) return false;
  if (state.sanctuary) return false;

  let bestCell = null;
  let bestDist = -1;

  for (const cell of state.board.cells.values()) {
    if (cell.flipped || cell.isEntry || cell.isLateral) continue;
    const dist = cell.x * cell.x + cell.y * cell.y;
    if (dist > bestDist) {
      for (const dir of Object.keys(cell.walls)) {
        if (cell.walls[dir]) {
          bestDist = dist;
          bestCell = cell;
          break;
        }
      }
    }
  }

  if (!bestCell) return false;

  const sanctuaryDef = { id: 'sanctuary', type: 'sanctuary', walls: { N: true, E: true, S: true, W: true } };
  const rotations = getValidRotations(state.board, bestCell.x, bestCell.y, sanctuaryDef.walls);
  if (rotations.length === 0) return false;

  const placed = placeTile(state.board, bestCell.x, bestCell.y, sanctuaryDef, rotations[0]);
  placed.isSanctuary = true;
  state.sanctuary = { x: placed.x, y: placed.y };
  log(state, `Le Sanctuaire est découvert en (${placed.x}, ${placed.y})`);
  return true;
}

export function placeKeyOnSanctuary(state) {
  const explorer = getActiveExplorer(state);
  if (!explorer || explorer.item !== 'key') return { ok: false };
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell || !cell.isSanctuary) return { ok: false };

  explorer.item = null;
  state.keysPlacedOnSanctuary++;
  state.ap -= 1;
  log(state, `Clé placée sur le Sanctuaire (${state.keysPlacedOnSanctuary}/3)`);

  if (state.keysPlacedOnSanctuary >= 3) {
    state.artifactOnSanctuary = true;
    log(state, `Le Sanctuaire est déverrouillé ! L'Artefact apparaît !`);
  }

  return { ok: true };
}

export function retrieveArtifact(state) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return { ok: false };
  if (explorer.item) return { ok: false };
  const cell = getCell(state, explorer.x, explorer.y);
  if (!cell || !cell.isSanctuary || !state.artifactOnSanctuary) return { ok: false };

  state.artifactOnSanctuary = false;
  state.artifactRetrieved = true;
  state.curseActive = true;
  state.volcano.cursed = true;
  explorer.item = 'artifact';
  log(state, `${explorer.name} récupère l'Artefact ! La malédiction s'abat !`);

  return { ok: true };
}

export function isSanctuaryUnlocked(state) {
  return state.keysPlacedOnSanctuary >= 3;
}
