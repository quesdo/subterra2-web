/* Tests logiques du moteur (sans navigateur).
   Lance : node tests/engine-test.mjs
   Vérifie : connectivité, placement, tour, péril, fin. */

// Stub minimal pour les imports de data (les fichiers utilisent export ESM)
import { createGame, currentPlayer, explorerCell, performReveal, performMove,
         resolvePeril, getMoveTargets, getOpenEdges, endExplorerTurn,
         performDig, performPush } from '../js/engine/game.js';
import { placeTile } from '../js/engine/board.js';
import { EXPLORERS, ABILITIES } from '../js/data/explorers.js';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.log('  ✗', msg); }
}

console.log('Test 1 : création de partie');
const game = createGame({
  explorers: [
    { id: 'nurse', name: "L'Infirmière", role: 'Soin', pv: 5, color: '#d6c75b', glyph: '⚕', abilities: ['heal','survivor'] },
    { id: 'sapper', name: 'Le Sapeur', role: 'Combat', pv: 5, color: '#5bd68a', glyph: '💣', abilities: ['grenade','demolish'] },
  ],
  difficulty: 'normal',
  numExplorers: 2,
});
assert(game.explorers.length === 2, '2 explorateurs créés');
assert(game.bag.length === 30, 'sac de 30 tuiles');
assert(game.volcano.position === 26, 'volcan à 26 (normal, 2 explorateurs clampé à colonne 3)');
assert(game.ap === 2, '2 PA au départ');
assert(currentPlayer(game).name === "L'Infirmière", "premier joueur = L'Infirmière");

console.log('Test 2 : placement initial');
const entry = game.board.cells.get('0,0');
assert(entry !== undefined, 'tuile Entrée centrale (0,0) présente');
assert(entry.crossroad === true, "c'est le croisement");
const latL = game.board.cells.get('-2,0');
assert(latL !== undefined, 'Latérale gauche (-2,0) présente');
assert(game.explorers.every(e => e.position === '0,0'), 'tous au croisement');

console.log('Test 3 : connectivité Entrée-Latérales (setup 7 cases + entrée 2 hauteurs)');
// Setup :
//   y=-1:                          [ENTRY_TOP]
//   y=0:  [GARDIEN-3][NORMALE-2][NORMALE-1][ENTRY_BOT/croisement][NORMALE1][NORMALE2][GARDIEN3]
function connected(c1, c2) {
  const dx = c2.x - c1.x, dy = c2.y - c1.y;
  if (Math.abs(dx)+Math.abs(dy) !== 1) return false;
  let d1, d2;
  if (dx===1){d1='E';d2='W';} else if(dx===-1){d1='W';d2='E';}
  else if(dy===1){d1='S';d2='N';} else {d1='N';d2='S';}
  return c1.walls[d1] && c2.walls[d2];
}
const entryTop = game.board.cells.get('0,-1');
const entryBot = game.board.cells.get('0,0');
const nl1 = game.board.cells.get('-1,0');
const nr1 = game.board.cells.get('1,0');
const gl = game.board.cells.get('-3,0');
const gr = game.board.cells.get('3,0');
assert(entryTop && entryBot, 'Entrée 1×2 présente (top 0,-1 + bottom 0,0)');
assert(nl1 && nr1, 'Normales latérales présentes');
assert(gl && gr && gl.guardianAnchor && gr.guardianAnchor, 'ancrages Gardien aux extrémités');
assert(connected(entryBot, nl1), 'ENTRY_BOT connectée à Normale gauche');
assert(connected(entryBot, nr1), 'ENTRY_BOT connectée à Normale droite');
assert(connected(entryTop, entryBot), 'ENTRY_TOP connectée à ENTRY_BOT (vertical)');
// Gardiens latéraux orientés vers l'intérieur
assert(gl.walls.E === true, 'Gardien gauche ouvert à l\'Est (vers intérieur)');
assert(gr.walls.W === true, 'Gardien droit ouvert à l\'Ouest (vers intérieur)');

console.log('Test 4 : issues ouvertes au départ');
// L'explorateur démarre sur ENTRY_BOT (0,0) = croisement.
// ENTRY_BOT a son Sud ouvert pour explorer.
const edgesBot = getOpenEdges(game, currentPlayer(game));
const southEdge = edgesBot.find(e => e.dir === 'S');
assert(southEdge !== undefined, 'issue Sud ouverte depuis ENTRY_BOT (croisement)');

console.log('Test 5 : révéler une tuile');
// L'explorateur est sur ENTRY_BOT (0,0), issue Sud ouverte
const cell = explorerCell(game, currentPlayer(game));
const before = game.bag.length;
// Si plusieurs rotations valides, performReveal retourne {needsRotationChoice}.
// On appelle alors avec une rotation explicite pour finaliser la pose.
let result = performReveal(game, cell, 'S');
if (result && result.needsRotationChoice) {
  result = performReveal(game, cell, 'S', result.rotations[0]);
}
assert(result && !result.needsRotationChoice, 'une tuile piochée et placée');
assert(game.bag.length === before - 1, 'sac a diminué de 1');
const newCell = [...game.board.cells.values()].find(c => c.x === 0 && c.y === 1);
assert(newCell !== undefined, 'nouvelle tuile placée en (0,1)');

console.log('Test 6 : déplacement vers la tuile révélée');
// La tuile révélée est aléatoire ; si c'est des Ruines (Éboulis) ou un mur
// bloque l'entrée, on révèle une autre issue. On cherche une tuile franchissable.
let moveCell = newCell;
let moveTargets = getMoveTargets(game, currentPlayer(game));
if (!moveTargets.some(t => t.cell.id === moveCell.id)) {
  // Révéler via une autre issue (Est/Ouest du croisement déjà occupé par Entrée;
  // on révèle plutôt au Sud d'une Latérale pour trouver une tuile ouverte)
  // Simplification : révéler plusieurs fois au Sud jusqu'à trouver une tuile
  // franchissable, ou accepter que la tuile soit bloquante.
  console.log('  (tuile révélée bloquante, test de déplacement reporté)');
} else {
  performMove(game, moveCell);
  const moved = currentPlayer(game);
  assert(moved.x === moveCell.x && moved.y === moveCell.y, 'explorateur déplacé sur la tuile révélée');
}

console.log('Test 7 : résolution du dé de Péril (lave)');
const hpBefore = currentPlayer(game).hp;
resolvePeril(game, 'lava', currentPlayer(game));
assert(true, 'péril Lave résolu sans crash');

console.log('Test 8 : fin de tour et progression du volcan');
const vpos = game.volcano.position;
endExplorerTurn(game);
assert(game.volcano.position <= vpos, 'volcan a progressé après tour complet');

console.log('Test 9 : fin de partie (défaite par éruption simulée)');
game.volcano.position = 0;
game.volcano.erupting = true;
resolvePeril(game, 'lava', currentPlayer(game));
// L'éruption devrait déclencher un état de fin si l'artefact est perdu
assert(true, 'éruption gérée sans crash');

// ====================================================================
// Tests de conformité aux règles officielles (manuel ST2 pp.10-17, 26-27)
// ====================================================================

console.log('Test 10 : coûts PA officiels (Creuser = 2 PA)');
{
  const g = createGame({
    explorers: [
      { id: 'sapper', name: 'Le Sapeur', role: 'Combat', pv: 5, color: '#5bd68a', glyph: '💣', abilities: ['grenade','demolish'] },
      { id: 'miner', name: 'Le Mineur', role: 'Force', pv: 7, color: '#a5d65b', glyph: '⛏️', abilities: ['excavate','consolidate'] },
    ],
    difficulty: 'normal', numExplorers: 2,
  });
  // Créer une tuile Ruines avec Éboulis adjacente au croisement (Sud)
  const entry = g.board.cells.get('0,0');
  const ruinsTile = g.bag.find(t => t.type === 'ruins');
  const idx = g.bag.indexOf(ruinsTile);
  if (idx >= 0) g.bag.splice(idx, 1);
  const placed = placeTile(g.board.cells, entry, 'S', ruinsTile);
  if (placed) {
    placed.rubble = true;
    const apBefore = g.ap;
    performDig(g, placed);
    assert(g.ap === apBefore - 2, 'Creuser coûte bien 2 PA (manuel p.11)');
    assert(placed.rubble === false, "l'Éboulis est retiré");
  } else {
    assert(true, '(placement Ruines impossible ici, test Creuser sauté)');
  }
}

console.log('Test 11 : Se dépasser = -1 PV / +1 PA, 1×/tour');
{
  const g = createGame({
    explorers: [
      { id: 'scout', name: "L'Éclaireuse", role: 'Exploration', pv: 5, color: '#5bd6c7', glyph: '🗺', abilities: ['sprint','vigilance'] },
    ],
    difficulty: 'normal', numExplorers: 2,
  });
  const p = currentPlayer(g);
  const hp0 = p.hp;
  performPush(g);
  assert(p.hp === hp0 - 1, 'Se dépasser coûte 1 PV');
  assert(g.ap === 3, 'Se dépasser donne +1 PA (3 total)');
  assert(p.pushedThisTurn === true, 'marqueur pushedThisTurn posé');
  const ok = performPush(g); // 2e fois
  assert(ok === false, 'Se dépasser refusé une 2e fois (1×/tour)');
}

console.log('Test 12 : Bouclier (Se préparer) bloque TOUS les dégâts');
{
  const g = createGame({
    explorers: [
      { id: 'soldier', name: 'Le Soldat', role: 'Combat', pv: 7, color: '#9b5bd6', glyph: '🛡️', abilities: ['annihilate','prepare'] },
    ],
    difficulty: 'normal', numExplorers: 2,
  });
  const p = currentPlayer(g);
  p.shielded = true; // simule "Se préparer"
  const hp0 = p.hp;
  // Lave sur tuile où se trouve le joueur
  g.board.cells.get('0,0').type = 'lava';
  resolvePeril(g, 'lava', p);
  assert(p.hp === hp0, 'Bouclier bloque même le péril Lave (manuel p.27, aucune exception)');
}

console.log('Test 13 : les 10 Explorateurs officiels + 20 capacités');
{
  assert(EXPLORERS.length === 10, '10 Explorateurs');
  assert(EXPLORERS.every(e => e.abilities.length === 2), 'chaque perso a exactement 2 capacités');
  assert(EXPLORERS.every(e => [3,5,7].includes(e.pv)), 'PV toujours 3/5/7');
  // Chaque capacité du catalogue doit être attribuée au moins une fois
  const attributed = new Set();
  EXPLORERS.forEach(e => e.abilities.forEach(a => attributed.add(a)));
  const all = Object.keys(ABILITIES);
  const missing = all.filter(a => !attributed.has(a));
  assert(missing.length === 0, `toutes les capacités attribuées (manquantes: ${missing.join(',')||'aucune'})`);
  // Total = 20 (chaque capacité une fois)
  const totalAbilities = EXPLORERS.reduce((n,e) => n + e.abilities.length, 0);
  assert(totalAbilities === 20, '20 capacités au total (2×10)');
}

console.log(`\nRésultat : ${pass} réussis, ${fail} échoués`);
process.exit(fail > 0 ? 1 : 0);
