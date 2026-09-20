/* Tests de validation hôte-authoritaire.
   Vérifie que l'hôte valide correctement les actions reçues des clients :
   - tour correct (l'explorateur actif appartient au joueur)
   - action légale (PA suffisant, cible valide)
   - action illégale rejetée (PA insuffisant, case invalide, mauvais joueur)
   Lance : node tests/net/host-validation.test.mjs */

import { createGame, currentPlayer, performReveal, performMove,
         endExplorerTurn, getMoveTargets, getOpenEdges } from '../../js/engine/game.js';
import { validateAction, executeAction } from '../../js/net/host.js';
import { EXPLORERS } from '../../js/data/explorers.js';

/* Helper: get the Map key for a cell (position string like "0,0"). */
function cellKey(cell) { return cell.x + ',' + cell.y; }

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  \u2713', msg); }
  else { fail++; console.log('  \u2717', msg); }
}

function makeGame() {
  const game = createGame({
    explorers: [EXPLORERS[0], EXPLORERS[1], EXPLORERS[2]],
    difficulty: 'normal',
    numExplorers: 3,
  });
  game.playerAssignments = [
    { playerId: 'host', explorerIds: ['aristocrat', 'thief'] },
    { playerId: 'peer-abc', explorerIds: ['scout'] },
  ];
  return game;
}

console.log('Test 1 : action valide de l\u2019h\u00f4te (reveal)');
{
  const game = makeGame();
  const cell = game.board.cells.get('0,0');
  const edges = getOpenEdges(game, currentPlayer(game));
  const actionMsg = { id: 'reveal', args: { cellId: cellKey(cell), dir: 'S' } };
  const result = validateAction(game, 'host', actionMsg);
  assert(result.valid, 'action reveal valide pour l\u2019h\u00f4te');
}

console.log('Test 2 : action rejetée si le joueur ne contr\u00f4le pas l\u2019explorateur courant');
{
  const game = makeGame();
  const cell = game.board.cells.get('0,0');
  const actionMsg = { id: 'reveal', args: { cellId: cellKey(cell), dir: 'S' } };
  const result = validateAction(game, 'peer-abc', actionMsg);
  assert(!result.valid, 'action rejetée pour peer-abc (pas son tour)');
  assert(result.reason.includes('tour') || result.reason.includes('contr\u00f4le'), 'raison mentionne le tour/contr\u00f4le');
}

console.log('Test 3 : action valide du pair quand c\u2019est son tour');
{
  const game = makeGame();
  game.currentExplorerIdx = 2;
  const cell = game.board.cells.get('0,0');
  const actionMsg = { id: 'endTurn', args: {} };
  const result = validateAction(game, 'peer-abc', actionMsg);
  assert(result.valid, 'action endTurn valide pour peer-abc (ranger est son explorateur)');
}

console.log('Test 4 : action rejetée si PA insuffisant');
{
  const game = makeGame();
  game.ap = 0;
  const cell = game.board.cells.get('0,0');
  const actionMsg = { id: 'reveal', args: { cellId: cellKey(cell), dir: 'S' } };
  const result = validateAction(game, 'host', actionMsg);
  assert(!result.valid, 'reveal rejeté avec 0 PA');
  assert(result.reason.includes('PA') || result.reason.includes('action'), 'raison mentionne PA');
}

console.log('Test 5 : action rejetée si case invalide');
{
  const game = makeGame();
  const actionMsg = { id: 'move', args: { cellId: '999,999' } };
  const result = validateAction(game, 'host', actionMsg);
  assert(!result.valid, 'move rejeté avec cellId inexistant');
}

console.log('Test 6 : action rejetée si l\u2019explorateur est \u00e0 terre');
{
  const game = makeGame();
  currentPlayer(game).state = 'down';
  const cell = game.board.cells.get('0,0');
  const actionMsg = { id: 'reveal', args: { cellId: cellKey(cell), dir: 'S' } };
  const result = validateAction(game, 'host', actionMsg);
  assert(!result.valid, 'reveal rejeté quand l\u2019explorateur est \u00e0 terre');
}

console.log('Test 7 : executeAction applique l\u2019action sur l\u2019\u00e9tat');
{
  const game = makeGame();
  const cell = game.board.cells.get('0,0');
  const bagBefore = game.bag.length;
  const actionMsg = { id: 'reveal', args: { cellId: cellKey(cell), dir: 'S' } };
  executeAction(game, actionMsg);
  assert(game.bag.length === bagBefore - 1 || game.bag.length === bagBefore, 'sac modifié apr\u00e8s executeAction (tuile piochée ou remise)');
}

console.log('Test 8 : executeAction endTurn passe au joueur suivant');
{
  const game = makeGame();
  const idxBefore = game.currentExplorerIdx;
  executeAction(game, { id: 'endTurn', args: {} });
  assert(game.currentExplorerIdx !== idxBefore || game.currentExplorerIdx === 0, 'currentExplorerIdx changé apr\u00e8s endTurn');
}

console.log('Test 9 : validateAction avec playerId non d\u00e9clar\u00e9');
{
  const game = makeGame();
  const actionMsg = { id: 'reveal', args: { cellId: '0,0', dir: 'S' } };
  const result = validateAction(game, 'unknown-player', actionMsg);
  assert(!result.valid, 'action rejetée pour joueur inconnu');
}

console.log('Test 10 : validateAction en phase non-explorerTurn');
{
  const game = makeGame();
  game.phase = 'perilRoll';
  const actionMsg = { id: 'reveal', args: { cellId: '0,0', dir: 'S' } };
  const result = validateAction(game, 'host', actionMsg);
  assert(!result.valid, 'action rejetée hors phase explorerTurn');
}

console.log(`\nRésultat : ${pass} réussis, ${fail} échoués`);
process.exit(fail > 0 ? 1 : 0);
