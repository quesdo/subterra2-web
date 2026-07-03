/* ============================================================
   board.js — Gestion de la grille, connectivité, placement
   Coordonnées : (x,y). Entrée en (0,0). Latérales en (-2,0)/(2,0).
   L'exploration se fait vers +y (le Sud des tuiles d'Entrée).
   ============================================================ */

import { DIRS, OPP, DELTA, TILE_TYPES } from '../data/tiles.js';

/* Crée un plateau vide avec l'Entrée et les Latérales pré-placées. */
export function createBoard() {
  // board.cells : map "x,y" -> instance de case placée
  const cells = new Map();

  // Entrée : 3 cases en rangée à y=0.
  // ENTRY_C au centre (0,0), ENTRY_L à gauche (-1,0), ENTRY_R à droite (1,0).
  // Le côté Sud (S) des cases L et C? -> l'exploration part du Sud de la centrale.
  // Selon le manuel, les Explorateurs commencent "à l'emplacement qui relie
  // l'Entrée aux Latérales" = le croisement central.
  placeEntry(cells);

  return { cells, nextId: 1, sanctuaryPlaced: false, sanctuaryPos: null };
}

function placeEntry(cells) {
  // CONVENTION : walls[dir] = true  => OUVERT (pas de mur)
  //              walls[dir] = false => MUR
  //
  // Setup initial officiel (voir manuel p.8 + photo utilisateur) :
  //
  //   y=-1:                                           [ENTRÉE-haut]
  //   y=0:  [GARDIEN][NORMALE][NORMALE][ENTRÉE-bas][NORMALE][NORMALE][GARDIEN]
  //
  // - L'Entrée = tuile 1×2 (verticale) : haut en (0,-1), bas en (0,0).
  //   • Entrée-haut (0,-1) : Nord = sortie de secours (quitter le temple),
  //     reliée S à Entrée-bas.
  //   • Entrée-bas (0,0) : reliée E/W aux Latérales, ouverte au Sud pour explorer.
  //   Les Explorateurs commencent sur l'Entrée-bas (croisement, aligné avec la rangée).
  // - 2 Normales de chaque côté (x=±1, ±2) : couloir E/W, ET ouvertes au Sud.
  // - 2 cases Gardien aux extrémités (x=±3) = Latérales = ancrages de Gardien.
  //   AUCUN gardien posé au départ. Leur image est orientée vers l'intérieur.

  // === Entrée (tuile 1×2 verticale) ===
  const entryTop = makeCell('ENTRY_TOP', 'entry', 0, -1,
    { N:false, E:false, S:true,  W:false },  // N=sortie, S vers entry-bas
    { isEntry: true, entryPart: 'top' });
  const entryBot = makeCell('ENTRY_BOT', 'entry', 0, 0,
    { N:true,  E:true,  S:true,  W:true },   // N vers entry-haut, E/W latérales, S explorer
    { isEntry: true, crossroad: true, exitDir: 'N', entryPart: 'bottom' });
  cells.set(key(0, -1), entryTop);
  cells.set(key(0, 0), entryBot);

  // === 2 Normales à gauche (x=-1, x=-2) ===
  const nl1 = makeCell('LAT_NL1', 'normal', -1, 0,
    { N:false, E:true,  S:true, W:true });
  const nl2 = makeCell('LAT_NL2', 'normal', -2, 0,
    { N:false, E:true,  S:true, W:true });
  cells.set(key(-1, 0), nl1);
  cells.set(key(-2, 0), nl2);

  // Case Gardien gauche (x=-3) : ouvert à l'EST (vers Normale -2).
  // L'image guardian.png a seul le SUD ouvert (rotation 0).
  // Pour ouvrir l'EST : rotation 270° (S->E sous rotation 90° horaire x3).
  const gl = makeCell('LAT_GL', 'guardian', -3, 0,
    { N:false, E:true,  S:false, W:false },
    { guardianAnchor: true, isLateral: true, noInitialGuardian: true, rotation: 270 });
  cells.set(key(-3, 0), gl);

  // === 2 Normales à droite (x=1, x=2) ===
  const nr1 = makeCell('LAT_NR1', 'normal', 1, 0,
    { N:false, E:true,  S:true, W:true });
  const nr2 = makeCell('LAT_NR2', 'normal', 2, 0,
    { N:false, E:true,  S:true, W:true });
  cells.set(key(1, 0), nr1);
  cells.set(key(2, 0), nr2);

  // Case Gardien droite (x=3) : ouvert à l'OUEST (vers Normale 2).
  // L'image guardian.png a seul le SUD ouvert. Pour ouvrir l'OUEST : rotation 90°.
  const gr = makeCell('LAT_GR', 'guardian', 3, 0,
    { N:false, E:false, S:false, W:true },
    { guardianAnchor: true, isLateral: true, noInitialGuardian: true, rotation: 90 });
  cells.set(key(3, 0), gr);
}

function makeCell(id, type, x, y, walls, extra = {}) {
  return {
    id, type, x, y,
    walls: { ...walls },      // {N,E,S,W} true=ouvert
    rotation: 0,              // rotation appliquée au placement
    rubble: false,            // marqueur Éboulis
    consolidated: false,      // marqueur Consolidation
    keyMarker: false,         // Clé présente sur la tuile
    guardians: [],            // Gardiens présents
    flipped: false,           // retournée face Volcan
    ruinsNum: null,           // numéro 1-6 pour effondrement
    ...extra,
  };
}

export function key(x, y) { return `${x},${y}`; }

/* Applique une rotation (0,90,180,270 degrés horaires) à une config de murs */
export function rotateWalls(walls, rotation) {
  const rots = Math.round(rotation / 90) % 4;
  if (rots === 0) return { ...walls };
  let result = { ...walls };
  // 90° horaire : N->E->S->W->N
  for (let i = 0; i < rots; i++) {
    result = {
      N: result.W,
      E: result.N,
      S: result.E,
      W: result.S,
    };
  }
  return result;
}

/* Deux cases adjacentes sont-elles connectées ? (arête partagée ouverte des 2 côtés) */
export function areConnected(cells, cellA, cellB) {
  if (!cellA || !cellB) return false;
  const dx = cellB.x - cellA.x;
  const dy = cellB.y - cellA.y;
  // Doivent être orthogonalement adjacentes (distance 1)
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
  let dirFromA, dirFromB;
  if (dx === 1) { dirFromA = 'E'; dirFromB = 'W'; }
  else if (dx === -1) { dirFromA = 'W'; dirFromB = 'E'; }
  else if (dy === 1) { dirFromA = 'S'; dirFromB = 'N'; }
  else { dirFromA = 'N'; dirFromB = 'S'; }
  return cellA.walls[dirFromA] && cellB.walls[dirFromB];
}

/* Récupère la case voisine dans une direction */
export function neighbor(cells, cell, dir) {
  const [dx, dy] = DELTA[dir];
  return cells.get(key(cell.x + dx, cell.y + dy)) || null;
}

/* Cases directement accessibles depuis une case (connectées + franchissables) */
export function reachableNeighbors(cells, cell, opts = {}) {
  const result = [];
  for (const dir of DIRS) {
    const nb = neighbor(cells, cell, dir);
    if (!nb || nb.flipped) continue;
    if (!areConnected(cells, cell, nb)) continue;
    // Éboulis bloque l'entrée (sauf si on ignore, ex. Agile)
    if (nb.rubble && !opts.ignoreRubble) continue;
    // Pont : une seule personne
    if (nb.type === 'bridge' && opts.bridgeOccupied) continue;
    result.push({ dir, cell: nb });
  }
  return result;
}

/* BFS : toutes les cases connectées à partir d'une case, avec distance.
   Respecte les murs et les Éboulis (sauf ignoreRubble). */
export function bfs(cells, start, opts = {}) {
  const visited = new Map(); // cellId -> {cell, dist}
  const queue = [{ cell: start, dist: 0 }];
  visited.set(start.id, { cell: start, dist: 0 });
  while (queue.length) {
    const { cell, dist } = queue.shift();
    for (const { cell: nb } of reachableNeighbors(cells, cell, opts)) {
      if (!visited.has(nb.id)) {
        visited.set(nb.id, { cell: nb, dist: dist + 1 });
        queue.push({ cell: nb, dist: dist + 1 });
      }
    }
  }
  return visited;
}

/* Chemin le plus court entre deux cases (BFS avec traceback).
   Retourne un tableau de cases ou null si pas de chemin. */
export function shortestPath(cells, from, to, opts = {}) {
  const prev = new Map();
  prev.set(from.id, null);
  const queue = [from];
  while (queue.length) {
    const cell = queue.shift();
    if (cell.id === to.id) {
      // reconstruire
      const path = [];
      let cur = cell;
      while (cur) { path.unshift(cur); cur = prev.get(cur.id); }
      return path;
    }
    for (const { cell: nb } of reachableNeighbors(cells, cell, opts)) {
      if (!prev.has(nb.id)) {
        prev.set(nb.id, cell);
        queue.push(nb);
      }
    }
  }
  return null;
}

/* Trouve la case la plus proche (par chemin) parmi un ensemble.
   Retourne { cell, dist } ou null. */
export function nearestCell(cells, from, candidates, opts = {}) {
  const dists = bfs(cells, from, opts);
  let best = null;
  for (const c of candidates) {
    const info = dists.get(c.id);
    if (info && (!best || info.dist < best.dist)) {
      best = { cell: c, dist: info.dist };
    }
  }
  return best;
}

/* Ligne de vue : peut-on voir en ligne droite de `from` à `to` ?
   - même ligne (x ou y constant)
   - toutes les cases intermédiaires franchissables en vision (pas d'Éboulis)
   - pas de mur traversé
   distance max optionnelle. */
export function lineOfSight(cells, from, to, maxDist = Infinity) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Doit être aligné (une seule direction)
  if (dx !== 0 && dy !== 0) return false;
  const steps = Math.abs(dx) + Math.abs(dy);
  if (steps === 0) return true;
  if (steps > maxDist) return false;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  let cur = from;
  for (let i = 0; i < steps; i++) {
    const dir = sx === 1 ? 'E' : sx === -1 ? 'W' : sy === 1 ? 'S' : 'N';
    const next = neighbor(cells, cur, dir);
    if (!next) return false;
    if (!areConnected(cells, cur, next)) return false;
    // Une case avec Éboulis n'est pas visible
    if (next.rubble) return false;
    if (next.flipped) return false;
    cur = next;
  }
  return cur.id === to.id;
}

/* Calcule la "colonne" (profondeur depuis l'Entrée) de chaque case.
   La profondeur = distance par chemin depuis le croisement d'Entrée. */
export function computeColumns(cells) {
  const entry = [...cells.values()].find(c => c.crossroad);
  if (!entry) return new Map();
  const dists = bfs(cells, entry);
  return dists;
}

/* Profondeur maximale atteignable (pour le placement du Sanctuaire). */
export function maxDepth(cells) {
  const cols = computeColumns(cells);
  let max = 0;
  for (const { dist } of cols.values()) max = Math.max(max, dist);
  return max;
}

/* Liste toutes les rotations valides pour placer tileDef via sourceCell->openDir.
   Une rotation est valide si l'arête partagée est ouverte des deux côtés.
   Retourne un tableau d'entiers (sous-ensemble de [0,90,180,270]). */
export function getValidRotations(sourceCell, openDir, tileDef) {
  const incomingDir = OPP[openDir];
  const valid = [];
  for (const rotation of [0, 90, 180, 270]) {
    const rotatedWalls = rotateWalls(tileDef.walls, rotation);
    if (rotatedWalls[incomingDir]) valid.push(rotation);
  }
  return valid;
}

/* Tente de placer une tuile piochée à côté d'une case source, via une arête ouverte.
   - Si `chosenRotation` est fourni, utilise cette rotation (doit être valide).
   - Sinon, choisit la 1ère rotation valide.
   Retourne la case placée ou null si impossible. */
export function placeTile(cells, sourceCell, openDir, tileDef, chosenRotation = null) {
  const [dx, dy] = DELTA[openDir];
  const tx = sourceCell.x + dx;
  const ty = sourceCell.y + dy;
  const targetKey = key(tx, ty);

  // Case déjà occupée ?
  if (cells.has(targetKey)) return null;

  // Déterminer les rotations valides
  const incomingDir = OPP[openDir];
  const validRotations = getValidRotations(sourceCell, openDir, tileDef);
  if (validRotations.length === 0) return null;

  // Choix de la rotation
  const rotation = (chosenRotation !== null && validRotations.includes(chosenRotation))
    ? chosenRotation
    : validRotations[0];
  const rotatedWalls = rotateWalls(tileDef.walls, rotation);
  const cell = makeCell(
    tileDef.id + '_' + (Date.now() + Math.random()).toString(36).slice(-4),
    tileDef.type, tx, ty, rotatedWalls,
    {
      rotation,
      ruinsNum: tileDef.ruinsNum || null,
      journalId: tileDef.journalId || null,
    }
  );
  cells.set(targetKey, cell);
  return cell;
}

/* Place le Sanctuaire dans la colonne la plus éloignée connectable.
   Retourne la case ou null. */
export function placeSanctuary(cells) {
  const cols = computeColumns(cells);
  const maxD = maxDepth(cells);
  // Cases à profondeur max, avec une arête ouverte où placer
  const candidates = [...cols.values()]
    .filter(c => c.dist === maxD)
    .map(c => c.cell);
  // Essayer de profondeur max -> décroissant
  for (let d = maxD; d >= 1; d--) {
    const atDepth = [...cols.values()].filter(c => c.dist === d).map(c => c.cell);
    for (const cell of atDepth) {
      // Cherche une arête ouverte de `cell` menant à une case vide
      for (const dir of DIRS) {
        if (!cell.walls[dir]) continue;
        const [dx, dy] = DELTA[dir];
        const tk = key(cell.x + dx, cell.y + dy);
        if (!cells.has(tk)) {
          // Placer le Sanctuaire ici, ouvert côté OPP[dir]
          const sanctuary = makeCell('SANCTUARY', 'sanctuary', cell.x + dx, cell.y + dy,
            { N:true, E:true, S:true, W:true },
            { isSanctuary: true });
          sanctuary.walls[OPP[dir]] = false; // ouvert vers la case source
          cells.set(tk, sanctuary);
          return sanctuary;
        }
      }
    }
  }
  return null;
}

/* Récupère toutes les cases d'un type donné (pour trouver les tuiles Gardien). */
export function cellsOfType(cells, type) {
  return [...cells.values()].filter(c => c.type === type && !c.flipped);
}

/* Vérifie qu'une case est franchissable pour s'y tenir. */
export function isEnterable(cell) {
  if (!cell || cell.flipped) return false;
  if (cell.rubble) return false;
  return true;
}
