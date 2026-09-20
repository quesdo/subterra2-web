/* tiles.js — Temple, Journal, and special tile definitions for Sub Terra II */

function walls(N, E, S, W) {
  return { N, E, S, W };
}

// ── Temple tiles (30 tiles, T01–T30) ────────────────────────────────

export const TEMPLE_TILES = [
  // Normale ×3 (T01–T03)
  { id: 'T01', type: 'normale', walls: walls(true, true, true, true) },
  { id: 'T02', type: 'normale', walls: walls(true, false, true, true) },
  { id: 'T03', type: 'normale', walls: walls(true, true, false, true) },

  // Pont ×2 (T04–T05)
  { id: 'T04', type: 'pont', walls: walls(false, true, false, true) },
  { id: 'T05', type: 'pont', walls: walls(false, true, false, true) },

  // Clé ×3 (T06–T08)
  { id: 'T06', type: 'cle', walls: walls(true, true, true, true) },
  { id: 'T07', type: 'cle', walls: walls(true, true, true, false) },
  { id: 'T08', type: 'cle', walls: walls(false, true, true, true) },

  // Lave ×5 (T09–T13)
  { id: 'T09', type: 'lave', walls: walls(true, true, true, true) },
  { id: 'T10', type: 'lave', walls: walls(true, true, false, true) },
  { id: 'T11', type: 'lave', walls: walls(false, true, true, true) },
  { id: 'T12', type: 'lave', walls: walls(true, false, true, true) },
  { id: 'T13', type: 'lave', walls: walls(true, true, true, false) },

  // Piège à pics ×3 (T14–T16)
  { id: 'T14', type: 'piege_pics', walls: walls(true, true, true, true) },
  { id: 'T15', type: 'piege_pics', walls: walls(true, true, false, true) },
  { id: 'T16', type: 'piege_pics', walls: walls(true, false, true, true) },

  // Piège à fléchettes ×4 (T17–T20)
  { id: 'T17', type: 'piege_flechettes', walls: walls(true, true, true, true) },
  { id: 'T18', type: 'piege_flechettes', walls: walls(true, true, true, false) },
  { id: 'T19', type: 'piege_flechettes', walls: walls(false, true, true, true) },
  { id: 'T20', type: 'piege_flechettes', walls: walls(true, false, true, true) },

  // Ruines ×6 (T21–T26) — each has a unique ruinsNum 1–6
  { id: 'T21', type: 'ruines', ruinsNum: 1, walls: walls(true, true, true, true) },
  { id: 'T22', type: 'ruines', ruinsNum: 2, walls: walls(true, true, false, true) },
  { id: 'T23', type: 'ruines', ruinsNum: 3, walls: walls(false, true, true, true) },
  { id: 'T24', type: 'ruines', ruinsNum: 4, walls: walls(true, false, true, true) },
  { id: 'T25', type: 'ruines', ruinsNum: 5, walls: walls(true, true, true, false) },
  { id: 'T26', type: 'ruines', ruinsNum: 6, walls: walls(true, true, false, false) },

  // Gardien ×4 (T27–T30)
  { id: 'T27', type: 'gardien', walls: walls(true, true, true, true) },
  { id: 'T28', type: 'gardien', walls: walls(true, true, true, false) },
  { id: 'T29', type: 'gardien', walls: walls(false, true, true, true) },
  { id: 'T30', type: 'gardien', walls: walls(true, false, true, true) },
];

// ── Journal tiles (3 tiles, J01–J03) — NOT in the main bag ──────────

export const JOURNAL_TILES = [
  { id: 'J01', type: 'journal', walls: walls(true, true, true, true) },
  { id: 'J02', type: 'journal', walls: walls(true, true, false, true) },
  { id: 'J03', type: 'journal', walls: walls(true, false, true, true) },
];

// ── Special tiles ───────────────────────────────────────────────────

export const ENTRY_TILE = {
  type: 'entry',
  cells: [
    { x: 0, y: 0, label: 'top' },
    { x: 0, y: 1, label: 'bottom' },
  ],
  walls: walls(true, true, true, true),
};

export const LATERAL_TILES = [
  {
    id: 'lateral-a',
    type: 'lateral',
    guardianAnchor: { x: 0, y: 0 },
    walls: walls(true, true, true, true),
  },
  {
    id: 'lateral-b',
    type: 'lateral',
    guardianAnchor: { x: 0, y: 0 },
    walls: walls(true, true, true, true),
  },
];

export const SANCTUARY_TILE = {
  type: 'sanctuary',
  walls: walls(true, true, true, true),
};
