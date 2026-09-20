/* ============================================================
   serialize.js — Sérialisation de l'état de partie (Game ↔ JSON)
   Le seul champ non-JSON-native est board.cells (une Map).
   On gère aussi la référence circulaire de game.sanctuary.
   ============================================================ */

/* Sérialise l'état du jeu en objet JSON-sérialisable. */
export function serializeGame(game) {
  return {
    ...game,
    board: {
      ...game.board,
      cells: [...game.board.cells.entries()].map(([k, cell]) => [k, { ...cell }]),
    },
    sanctuary: game.sanctuary ? `${game.sanctuary.x},${game.sanctuary.y}` : null,
    explorers: game.explorers.map(e => ({ ...e, abilities: e.abilities.map(a => ({ ...a })) })),
    bag: [...game.bag],
    journalBag: [...game.journalBag],
    playerAssignments: game.playerAssignments
      ? game.playerAssignments.map(a => ({ playerId: a.playerId, explorerIds: [...a.explorerIds] }))
      : null,
  };
}

/* Désérialise un objet JSON en état de jeu utilisable par le moteur. */
export function deserializeGame(data) {
  // Reconstruire la Map des cellules
  const cells = new Map(data.board.cells);
  // Re-lier sanctuary vers la vraie cellule dans la Map
  const sanctuary = data.sanctuary ? cells.get(data.sanctuary) : null;
  return {
    ...data,
    board: { ...data.board, cells },
    sanctuary,
    explorers: data.explorers.map(e => ({ ...e, abilities: e.abilities.map(a => ({ ...a })) })),
    bag: [...data.bag],
    journalBag: [...data.journalBag],
  };
}

/* Sérialise pour JSON.stringify (envoi réseau). */
export function encodeGameState(game) {
  return JSON.stringify(serializeGame(game));
}

/* Décode un message reçu en état de jeu. */
export function decodeGameState(jsonString) {
  return deserializeGame(JSON.parse(jsonString));
}
