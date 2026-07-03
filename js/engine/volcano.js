/* ============================================================
   volcano.js — Piste d'éruption, éruption, propagation de lave
   ============================================================ */

import { DIRS, OPP } from '../data/tiles.js';

/* Table de difficulté : case de départ du marqueur Éruption.
   Lignes = difficulté, colonnes = nb d'Explorateurs (1-6).
   Valeurs 3-6 du manuel p.4. Colonnes 1-2 interpolées
   (le manuel couvre 3-6 ; en dessous on utilise la colonne 3). */
export const DIFFICULTY_TABLE = {
  beginner:  { 1: 28, 2: 28, 3: 27, 4: 24, 5: 22, 6: 20 },
  normal:    { 1: 27, 2: 27, 3: 26, 4: 21, 5: 19, 6: 17 },
  advanced:  { 1: 23, 2: 23, 3: 22, 4: 18, 5: 16, 6: 14 },
  expert:    { 1: 21, 2: 21, 3: 20, 4: 16, 5: 14, 6: 12 },
};

export const VOLCANO_MAX = 30;

/* Crée la piste Volcan avec le marqueur à la bonne case. */
export function createVolcano(difficulty, numExplorers) {
  const row = DIFFICULTY_TABLE[difficulty] || DIFFICULTY_TABLE.normal;
  // Borner entre 1 et 6 ; pour <3 on utilise la valeur de 3
  const n = Math.max(3, Math.min(6, numExplorers));
  const start = row[n] || row[3];
  return {
    position: start,
    max: VOLCANO_MAX,
    erupting: false,    // volcan prêt à entrer en éruption (position <= 0)
    erupted: false,     // l'éruption a commencé (plateau retourné)
    cursed: false,      // malédiction active (après artefact)
  };
}

/* Avance le marqueur d'éruption en fin de tour. +1 normalement, +2 si maudit. */
export function advanceEruption(volcano) {
  const step = volcano.cursed ? 2 : 1;
  volcano.position = Math.max(0, volcano.position - step);
  if (volcano.position <= 0) {
    volcano.erupting = true;
  }
  return step;
}

/* Tente de déclencher l'éruption suite à un résultat Lave au dé de Péril.
   Retourne true si l'éruption se produit. */
export function tryErupt(volcano) {
  if (!volcano.erupting) return false;
  if (volcano.erupted) return false;
  volcano.erupted = true;
  volcano.erupting = false;
  return true;
}

/* Propagation de la lave : retourne (face Volcan) toutes les tuiles Temple
   connectées et adjacentes à des tuiles déjà face Volcan.
   Appelé après l'éruption, à chaque tour et à chaque Lave au dé. */
export function spreadLava(cells) {
  // Identifier les cases déjà retournées (face Volcan) qui ne sont pas l'Entrée/Latérales
  const flipped = [...cells.values()].filter(c => c.flipped);
  const toFlip = [];
  for (const fc of flipped) {
    for (const dir of DIRS) {
      const [dx, dy] = { N:[0,-1], E:[1,0], S:[0,1], W:[-1,0] }[dir];
      const nb = cells.get(`${fc.x+dx},${fc.y+dy}`);
      if (!nb || nb.flipped) continue;
      if (nb.isEntry || nb.isLateral) continue; // Entrée/Latérales gérées à part
      if (nb.isSanctuary) continue; // Sanctuaire géré séparément
      // Connectée ?
      if (fc.walls[dir] && nb.walls[OPP[dir]]) {
        toFlip.push(nb);
      }
    }
  }
  // Retourner les cases éligibles
  for (const c of new Set(toFlip)) {
    flipToVolcano(c);
  }
  return [...new Set(toFlip)];
}

/* Retourne une case face Volcan : supprime tout ce qui s'y trouve. */
export function flipToVolcano(cell) {
  if (cell.flipped) return;
  cell.flipped = true;
  cell.guardians = [];
  cell.rubble = false;
  cell.keyMarker = false;
  cell.consolidated = false;
  // Les meeples/markers sont gérés par game.js (mort des Explorateurs)
}

/* Retourne le plateau Volcan ET le Sanctuaire lors de l'éruption initiale. */
export function initialEruption(cells, sanctuary) {
  // Le plateau Volcan bascule : on marque une "source de lave" virtuelle.
  // Selon le manuel, après éruption la lave se propage depuis les bords.
  // On modélise : le Sanctuaire se retourne si l'artefact n'est pas sorti.
  if (sanctuary && !sanctuary.flipped) {
    flipToVolcano(sanctuary);
  }
}
