/* difficulty.js — Table de difficulté officielle (corrigée) */
/* Valeurs de position de départ du marqueur Éruption selon le nb d'Explorateurs et la difficulté */

export const DIFFICULTY_TABLE = {
  3: { beginner: 27, normal: 26, advanced: 22, expert: 20 },
  4: { beginner: 22, normal: 19, advanced: 16, expert: 14 },
  5: { beginner: 24, normal: 21, advanced: 18, expert: 16 },
  6: { beginner: 20, normal: 17, advanced: 14, expert: 12 },
};

export function getEruptionStart(numExplorers, difficulty) {
  const row = DIFFICULTY_TABLE[numExplorers];
  if (!row) throw new Error(`Unsupported explorer count: ${numExplorers}`);
  const val = row[difficulty];
  if (val === undefined) throw new Error(`Unknown difficulty: ${difficulty}`);
  return val;
}
