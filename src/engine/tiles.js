/* tiles.js — Temple, Journal, and special tile definitions for Sub Terra II */

/* walls(N, E, S, W) — true = open (passage), false = wall.
   Configs analyzed from the real official tile images (same as original code). */

function walls(N, E, S, W) {
  return { N, E, S, W };
}

/* Base wall configs per tile type (from real image analysis).
   All tiles of the same type share these; rotation aligns them at placement. */
const REAL_WALLS = {
  normale:           walls(false, true,  true,  true),   // 3 openings (E,S,W), wall N
  pont:              walls(true,  false, true,  false),  // corridor N-S
  cle:               walls(false, false, true,  false),  // dead-end (only S)
  lave:              walls(true,  true,  true,  true),   // 4 openings
  piege_pics:         walls(true,  true,  true,  true),   // 4 openings (traversable)
  piege_flechettes:   walls(false, true,  true,  false),  // 2 openings (E,S)
  ruines:            walls(false, true,  true,  true),   // 3 openings (E,S,W)
  gardien:           walls(false, false, true,  false),  // dead-end (only S)
  journal:           walls(true,  true,  true,  true),   // 4 openings (like normale)
};

// ── Temple tiles (30 tiles, T01–T30) ────────────────────────────────

export const TEMPLE_TILES = [
  // Normale ×3 (T01–T03)
  { id: 'T01', type: 'normale', walls: { ...REAL_WALLS.normale } },
  { id: 'T02', type: 'normale', walls: { ...REAL_WALLS.normale } },
  { id: 'T03', type: 'normale', walls: { ...REAL_WALLS.normale } },

  // Pont ×2 (T04–T05)
  { id: 'T04', type: 'pont', walls: { ...REAL_WALLS.pont } },
  { id: 'T05', type: 'pont', walls: { ...REAL_WALLS.pont } },

  // Clé ×3 (T06–T08) — dead-end tiles
  { id: 'T06', type: 'cle', walls: { ...REAL_WALLS.cle } },
  { id: 'T07', type: 'cle', walls: { ...REAL_WALLS.cle } },
  { id: 'T08', type: 'cle', walls: { ...REAL_WALLS.cle } },

  // Lave ×5 (T09–T13) — 4 openings
  { id: 'T09', type: 'lave', walls: { ...REAL_WALLS.lave } },
  { id: 'T10', type: 'lave', walls: { ...REAL_WALLS.lave } },
  { id: 'T11', type: 'lave', walls: { ...REAL_WALLS.lave } },
  { id: 'T12', type: 'lave', walls: { ...REAL_WALLS.lave } },
  { id: 'T13', type: 'lave', walls: { ...REAL_WALLS.lave } },

  // Piège à pics ×3 (T14–T16) — 4 openings, traversable
  { id: 'T14', type: 'piege_pics', walls: { ...REAL_WALLS.piege_pics } },
  { id: 'T15', type: 'piege_pics', walls: { ...REAL_WALLS.piege_pics } },
  { id: 'T16', type: 'piege_pics', walls: { ...REAL_WALLS.piege_pics } },

  // Piège à fléchettes ×4 (T17–T20) — 2 openings (E,S)
  { id: 'T17', type: 'piege_flechettes', walls: { ...REAL_WALLS.piege_flechettes } },
  { id: 'T18', type: 'piege_flechettes', walls: { ...REAL_WALLS.piege_flechettes } },
  { id: 'T19', type: 'piege_flechettes', walls: { ...REAL_WALLS.piege_flechettes } },
  { id: 'T20', type: 'piege_flechettes', walls: { ...REAL_WALLS.piege_flechettes } },

  // Ruines ×6 (T21–T26) — 3 openings, rubble on placement
  { id: 'T21', type: 'ruines', ruinsNum: 1, walls: { ...REAL_WALLS.ruines } },
  { id: 'T22', type: 'ruines', ruinsNum: 2, walls: { ...REAL_WALLS.ruines } },
  { id: 'T23', type: 'ruines', ruinsNum: 3, walls: { ...REAL_WALLS.ruines } },
  { id: 'T24', type: 'ruines', ruinsNum: 4, walls: { ...REAL_WALLS.ruines } },
  { id: 'T25', type: 'ruines', ruinsNum: 5, walls: { ...REAL_WALLS.ruines } },
  { id: 'T26', type: 'ruines', ruinsNum: 6, walls: { ...REAL_WALLS.ruines } },

  // Gardien ×4 (T27–T30) — dead-end tiles
  { id: 'T27', type: 'gardien', walls: { ...REAL_WALLS.gardien } },
  { id: 'T28', type: 'gardien', walls: { ...REAL_WALLS.gardien } },
  { id: 'T29', type: 'gardien', walls: { ...REAL_WALLS.gardien } },
  { id: 'T30', type: 'gardien', walls: { ...REAL_WALLS.gardien } },
];

// ── Journal tiles (3 tiles, J01–J03) — NOT in the main bag ──────────

export const JOURNAL_TILES = [
  { id: 'J01', type: 'journal', walls: { ...REAL_WALLS.journal } },
  { id: 'J02', type: 'journal', walls: { ...REAL_WALLS.journal } },
  { id: 'J03', type: 'journal', walls: { ...REAL_WALLS.journal } },
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
