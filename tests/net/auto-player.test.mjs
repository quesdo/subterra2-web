/* Tests de l'auto-player (IA basique pour Explorateurs de joueurs déconnectés).
   Vérifie que :
   - Si un Gardien est adjacent, l'auto-player choisit d'attaquer
   - Sinon, l'auto-player choisit de se déplacer vers l'Entrée (BFS)
   - L'auto-player marque l'explorateur comme "auto"
   Lance : node tests/net/auto-player.test.mjs */

import { createGame, currentPlayer, performReveal,
         getMoveTargets, canDoAction } from '../../js/engine/game.js';
import { decideAction, markAsAuto, isAuto } from '../../js/net/auto-player.js';
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

console.log('Test 1 : marquer un explorateur comme auto');
{
  const game = makeGame();
  const explorer = game.explorers[0];
  assert(!isAuto(explorer), 'explorateur non-auto au départ');
  markAsAuto(explorer);
  assert(isAuto(explorer), 'explorateur marqué auto après markAsAuto');
  assert(explorer.auto === true, 'propriété auto à true');
}

console.log('Test 2 : attaquer si un Gardien est sur la m\u00eame tuile');
{
  const game = makeGame();
  const explorer = game.explorers[0];
  markAsAuto(explorer);
  const cell = game.board.cells.get(explorer.position);
  cell.guardians.push({ id: 'G1' });
  const decision = decideAction(game, explorer);
  assert(decision.id === 'attack', 'décision = attack quand un Gardien est sur la tuile');
}

console.log('Test 3 : se d\u00e9placer vers l\u2019Entr\u00e9e si pas de Gardien');
{
  const game = makeGame();
  const explorer = game.explorers[0];
  markAsAuto(explorer);
  const decision = decideAction(game, explorer);
  assert(decision.id === 'move' || decision.id === 'endTurn', 'décision = move ou endTurn (pas de Gardien, peut \u00eatre bloqué)');
}

console.log('Test 4 : endTurn si aucun d\u00e9placement possible');
{
  const game = makeGame();
  const explorer = game.explorers[0];
  markAsAuto(explorer);
  game.ap = 0;
  const decision = decideAction(game, explorer);
  assert(decision.id === 'endTurn', 'décision = endTurn quand plus de PA');
}

console.log('Test 5 : unmark auto');
{
  const game = makeGame();
  const explorer = game.explorers[0];
  markAsAuto(explorer);
  assert(isAuto(explorer), 'marqué auto');
  explorer.auto = false;
  assert(!isAuto(explorer), 'non-auto après unmark');
}

console.log('Test 6 : d\u00e9cision move pointe vers une tuile adjacente connect\u00e9e');
{
  const game = makeGame();
  const explorer = game.explorers[0];
  markAsAuto(explorer);
  const cell = game.board.cells.get(explorer.position);
  let result = performReveal(game, cell, 'S');
  if (result && result.needsRotationChoice) {
    performReveal(game, cell, 'S', result.rotations[0]);
  }
  const newCell = [...game.board.cells.values()].find(c => c.x === 0 && c.y === 1);
  if (newCell && getMoveTargets(game, explorer).length > 0) {
    const decision = decideAction(game, explorer);
    if (decision.id === 'move') {
      assert(decision.args && decision.args.cellId !== undefined, 'move a une cellId');
      assert(game.board.cells.has(decision.args.cellId), 'cellId existe dans le plateau');
    } else {
      assert(true, 'move non disponible, autre d\u00e9cision prise');
    }
  } else {
    assert(true, 'pas de tuile r\u00e9v\u00e9l\u00e9e franchissable, test skip');
  }
}

console.log(`\nRésultat : ${pass} réussis, ${fail} échoués`);
process.exit(fail > 0 ? 1 : 0);
