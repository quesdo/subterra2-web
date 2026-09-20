/* Tests de sérialisation/désérialisation de l'état de jeu.
   Vérifie que serialize → deserialize produit un état équivalent.
   Lance : node tests/net/serialize.test.mjs */

import { createGame, currentPlayer, performReveal, performMove,
         endExplorerTurn, resolvePeril } from '../../js/engine/game.js';
import { serializeGame, deserializeGame, encodeGameState, decodeGameState } from '../../js/net/serialize.js';
import { EXPLORERS } from '../../js/data/explorers.js';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  \u2713', msg); }
  else { fail++; console.log('  \u2717', msg); }
}

function makeGame() {
  return createGame({
    explorers: [EXPLORERS[0], EXPLORERS[1], EXPLORERS[2]],
    difficulty: 'normal',
    numExplorers: 3,
  });
}

console.log('Test 1 : round-trip sur état initial');
{
  const game = makeGame();
  const restored = deserializeGame(serializeGame(game));
  assert(restored.explorers.length === 3, '3 explorateurs restaurés');
  assert(restored.bag.length === game.bag.length, 'sac restauré avec m\u00eame taille');
  assert(restored.board.cells instanceof Map, 'board.cells est une Map');
  assert(restored.board.cells.size === game.board.cells.size, 'm\u00eame nombre de cellules');
  assert(restored.volcano.position === game.volcano.position, 'volcan restauré');
  assert(restored.turn === 1, 'tour 1 restauré');
  assert(restored.ap === 2, '2 PA restaurés');
  assert(restored.currentExplorerIdx === 0, 'explorateur courant restauré');
  assert(restored.difficulty === 'normal', 'difficulté restaurée');
}

console.log('Test 2 : round-trip apr\u00e8s révélation d\u2019une tuile');
{
  const game = makeGame();
  const cell = game.board.cells.get('0,0');
  let result = performReveal(game, cell, 'S');
  if (result && result.needsRotationChoice) {
    performReveal(game, cell, 'S', result.rotations[0]);
  }
  const tilesBefore = game.board.cells.size;
  const restored = deserializeGame(serializeGame(game));
  assert(restored.board.cells.size === tilesBefore, 'm\u00eame nombre de tuiles apr\u00e8s révélation');
  const newCell = [...restored.board.cells.values()].find(c => c.x === 0 && c.y === 1);
  assert(newCell !== undefined, 'tuile révélée présente dans l\u2019état restauré');
  assert(newCell.walls !== undefined, 'murs de la tuile présents');
  assert(newCell.guardians !== undefined, 'gardiens de la tuile présents (tableau)');
}

console.log('Test 3 : round-trip apr\u00e8s déplacement');
{
  const game = makeGame();
  const cell = game.board.cells.get('0,0');
  let result = performReveal(game, cell, 'S');
  if (result && result.needsRotationChoice) {
    performReveal(game, cell, 'S', result.rotations[0]);
  }
  const newCell = [...game.board.cells.values()].find(c => c.x === 0 && c.y === 1);
  if (newCell) {
    performMove(game, newCell);
  }
  const p = currentPlayer(game);
  const restored = deserializeGame(serializeGame(game));
  const rp = restored.explorers[restored.currentExplorerIdx];
  assert(rp.x === p.x && rp.y === p.y, 'position de l\u2019explorateur restaurée');
  assert(rp.position === p.position, 'clé de position restaurée');
}

console.log('Test 4 : round-trip encode/decode (JSON string)');
{
  const game = makeGame();
  const json = encodeGameState(game);
  assert(typeof json === 'string', 'encodeGameState retourne une string');
  const restored = decodeGameState(json);
  assert(restored.explorers.length === 3, '3 explorateurs apr\u00e8s decode');
  assert(restored.board.cells instanceof Map, 'board.cells est une Map apr\u00e8s decode');
}

console.log('Test 5 : sanctuary re-lié apr\u00e8s désérialisation');
{
  const game = makeGame();
  game.sanctuary = game.board.cells.get('0,0');
  const restored = deserializeGame(serializeGame(game));
  assert(restored.sanctuary !== null, 'sanctuary non-null apr\u00e8s restauration');
  assert(restored.sanctuary.x === 0 && restored.sanctuary.y === 0, 'sanctuary pointe vers la bonne cellule');
  assert(restored.sanctuary === restored.board.cells.get('0,0'), 'sanctuary est la m\u00eame référence que dans la Map');
}

console.log('Test 6 : sanctuary null reste null');
{
  const game = makeGame();
  assert(game.sanctuary === null, 'sanctuary null au départ');
  const restored = deserializeGame(serializeGame(game));
  assert(restored.sanctuary === null, 'sanctuary null apr\u00e8s restauration');
}

console.log('Test 7 : les objets sérialisés ne partagent pas de références');
{
  const game = makeGame();
  const restored = deserializeGame(serializeGame(game));
  restored.explorers[0].hp = 1;
  assert(game.explorers[0].hp !== 1, 'modifier l\u2019état restauré n\u2019affecte pas l\u2019original');
  restored.bag.push('fake');
  assert(game.bag.length !== restored.bag.length, 'sacs indépendants');
}

console.log('Test 8 : explorers ont leurs abilities copiées profondément');
{
  const game = makeGame();
  const restored = deserializeGame(serializeGame(game));
  assert(restored.explorers[0].abilities.length === game.explorers[0].abilities.length, 'capacités copiées');
  restored.explorers[0].abilities[0].usesLeft = 999;
  assert(game.explorers[0].abilities[0].usesLeft !== 999, 'capacités indépendantes');
}

console.log('Test 9 : playerAssignments sérialisé et désérialisé');
{
  const game = makeGame();
  game.playerAssignments = [
    { playerId: 'host', explorerIds: ['scholar', 'adventurer'] },
    { playerId: 'peer-1', explorerIds: ['ranger'] },
  ];
  const restored = deserializeGame(serializeGame(game));
  assert(restored.playerAssignments !== null, 'playerAssignments sérialisé');
  assert(restored.playerAssignments.length === 2, '2 entrées d\'attribution');
  assert(restored.playerAssignments[0].explorerIds.length === 2, 'host a 2 explorateurs');
  restored.playerAssignments[0].explorerIds.push('fake');
  assert(game.playerAssignments[0].explorerIds.length === 2, 'attribution indépendante');
}

console.log('Test 10 : playerAssignments null reste null');
{
  const game = makeGame();
  const restored = deserializeGame(serializeGame(game));
  assert(restored.playerAssignments === null || restored.playerAssignments === undefined, 'playerAssignments null préservé');
}

console.log(`\nRésultat : ${pass} réussis, ${fail} échoués`);
process.exit(fail > 0 ? 1 : 0);
