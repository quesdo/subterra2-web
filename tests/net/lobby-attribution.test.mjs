/* Tests de validation de l'attribution des Explorateurs dans le lobby.
   Vérifie que :
   - Min 3 Explorateurs attribués
   - Max 6 Explorateurs attribués
   - Pas de doublons (un Explorateur attribué à un seul joueur)
   - Au moins 1 Explorateur par joueur connecté
   Lance : node tests/net/lobby-attribution.test.mjs */

import { validateAttribution, buildPlayerAssignments } from '../../js/net/lobby.js';
import { EXPLORERS } from '../../js/data/explorers.js';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  \u2713', msg); }
  else { fail++; console.log('  \u2717', msg); }
}

const explorerIds = EXPLORERS.map(e => e.id);

console.log('Test 1 : attribution valide avec 3 Explorateurs');
{
  const players = [
    { playerId: 'host', name: 'Hôte' },
    { playerId: 'peer-1', name: 'Alice' },
  ];
  const assignment = {
    'host': ['aristocrat', 'thief'],
    'peer-1': ['scout'],
  };
  const result = validateAttribution(assignment, players);
  assert(result.valid, '3 Explorateurs attribués = valide');
}

console.log('Test 2 : attribution invalide avec moins de 3 Explorateurs');
{
  const players = [
    { playerId: 'host', name: 'Hôte' },
    { playerId: 'peer-1', name: 'Alice' },
  ];
  const assignment = {
    'host': ['aristocrat'],
    'peer-1': [],
  };
  const result = validateAttribution(assignment, players);
  assert(!result.valid, '1 Explorateur attribué = invalide');
  assert(result.reason.includes('3') || result.reason.includes('minimum'), 'raison mentionne le minimum de 3');
}

console.log('Test 3 : attribution invalide avec plus de 6 Explorateurs');
{
  const players = [
    { playerId: 'host', name: 'Hôte' },
    { playerId: 'peer-1', name: 'Alice' },
  ];
  const assignment = {
    'host': ['aristocrat', 'thief', 'scout'],
    'peer-1': ['commander', 'miner', 'sniper', 'sapper'],
  };
  const result = validateAttribution(assignment, players);
  assert(!result.valid, '7 Explorateurs attribués = invalide');
}

console.log('Test 4 : doublon d\u00e9tect\u00e9');
{
  const players = [
    { playerId: 'host', name: 'Hôte' },
    { playerId: 'peer-1', name: 'Alice' },
  ];
  const assignment = {
    'host': ['aristocrat', 'aristocrat'],
    'peer-1': ['scout'],
  };
  const result = validateAttribution(assignment, players);
  assert(!result.valid, 'doublon = invalide');
  assert(result.reason.includes('doublon') || result.reason.includes('d\u00e9j\u00e0'), 'raison mentionne le doublon');
}

console.log('Test 5 : Explorateur attribu\u00e9 \u00e0 deux joueurs');
{
  const players = [
    { playerId: 'host', name: 'Hôte' },
    { playerId: 'peer-1', name: 'Alice' },
  ];
  const assignment = {
    'host': ['aristocrat', 'thief'],
    'peer-1': ['aristocrat'],
  };
  const result = validateAttribution(assignment, players);
  assert(!result.valid, 'm\u00eame Explorateur chez 2 joueurs = invalide');
}

console.log('Test 6 : joueur sans Explorateur');
{
  const players = [
    { playerId: 'host', name: 'H\u00f4te' },
    { playerId: 'peer-1', name: 'Alice' },
  ];
  const assignment = {
    'host': ['aristocrat', 'thief', 'scout'],
    'peer-1': [],
  };
  const result = validateAttribution(assignment, players);
  assert(!result.valid, 'joueur sans Explorateur = invalide');
}

console.log('Test 7 : 6 Explorateurs valides');
{
  const players = [
    { playerId: 'host', name: 'H\u00f4te' },
    { playerId: 'peer-1', name: 'Alice' },
  ];
  const assignment = {
    'host': ['aristocrat', 'thief', 'scout'],
    'peer-1': ['commander', 'miner', 'sniper'],
  };
  const result = validateAttribution(assignment, players);
  assert(result.valid, '6 Explorateurs = valide');
}

console.log('Test 8 : buildPlayerAssignments produit la bonne structure');
{
  const players = [
    { playerId: 'host', name: 'H\u00f4te' },
    { playerId: 'peer-1', name: 'Alice' },
  ];
  const assignment = {
    'host': ['aristocrat', 'thief'],
    'peer-1': ['scout'],
  };
  const assignments = buildPlayerAssignments(assignment, players);
  assert(Array.isArray(assignments), 'retourne un tableau');
  assert(assignments.length === 2, '2 entr\u00e9es (une par joueur)');
  assert(assignments[0].playerId === 'host', 'premi\u00e8re entr\u00e9e = host');
  assert(assignments[0].explorerIds.length === 2, 'host a 2 explorateurs');
  assert(assignments[1].playerId === 'peer-1', 'deuxi\u00e8me entr\u00e9e = peer-1');
  assert(assignments[1].explorerIds.length === 1, 'peer-1 a 1 explorateur');
}

console.log('Test 9 : Explorateur inexistant rejet\u00e9');
{
  const players = [
    { playerId: 'host', name: 'H\u00f4te' },
    { playerId: 'peer-1', name: 'Alice' },
  ];
  const assignment = {
    'host': ['aristocrat', 'fake_explorer'],
    'peer-1': ['scout'],
  };
  const result = validateAttribution(assignment, players);
  assert(!result.valid, 'Explorateur inexistant = invalide');
}

console.log(`\nRésultat : ${pass} réussis, ${fail} échoués`);
process.exit(fail > 0 ? 1 : 0);
