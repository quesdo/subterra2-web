/* ============================================================
   tiles.js — Définition des tuiles du Temple
   Chaque tuile a 4 arêtes (N,E,S,W) = 'open' ou 'wall'
   Deux tuiles adjacentes sont connectées ssi l'arête partagée
   est ouverte des deux côtés.
   ============================================================ */

export const TILE_TYPES = {
  normal:     { label: 'Normale',     color: 'var(--t-normal)',   icon: '' },
  bridge:     { label: 'Pont',         color: 'var(--t-bridge)',   icon: 'P' },
  key:        { label: 'Clé',          color: 'var(--t-key)',      icon: 'K' },
  lava:       { label: 'Lave',         color: 'var(--t-lava)',     icon: 'L' },
  spikes:     { label: 'Piège à pics', color: 'var(--t-spikes)',   icon: 'S' },
  darts:      { label: 'Piège à fléchettes', color: 'var(--t-darts)', icon: 'D' },
  ruins:      { label: 'Ruines',       color: 'var(--t-ruins)',    icon: 'R' },
  guardian:   { label: 'Gardien',      color: 'var(--t-guardian)', icon: 'G' },
  journal:    { label: 'Journal',      color: 'var(--t-journal)',  icon: 'J' },
  entry:      { label: 'Entrée',       color: 'var(--t-entry)',    icon: '' },
  lateral:    { label: 'Latérale',     color: 'var(--t-entry)',    icon: '' },
  sanctuary:  { label: 'Sanctuaire',   color: 'var(--t-sanctum)',  icon: 'A' },
};

/* Directions : index = 0:N, 1:E, 2:S, 3:W
   Opposé d'une direction (pour l'arête partagée entre 2 tuiles) */
export const DIRS = ['N', 'E', 'S', 'W'];
export const OPP  = { N: 'S', E: 'W', S: 'N', W: 'E' };
export const DELTA = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

/* Fabrique une config de murs. true = OUVERT (passage), false = MUR.
   Ex: walls('N','E') = murs au Nord et à l'Est, ouvertures au Sud et à l'Ouest. */
function w(...closed) {
  return { N: !closed.includes('N'), E: !closed.includes('E'), S: !closed.includes('S'), W: !closed.includes('W') };
}

/* Configurations de murs détectées automatiquement depuis les vraies images
   des tuiles officielles (analyse des bords sombres = murs).
   Ces configs correspondent à l'image telle qu'affichée (rotation 0°). */
const REAL_WALLS = {
  normal:   { N:false, E:true,  S:true,  W:true  },  // 3 ouvertures (E,S,W)
  bridge:   { N:true,  E:false, S:true,  W:false },  // couloir N-S
  key:      { N:false, E:false, S:true,  W:false },  // impasse (S)
  lava:     { N:true,  E:true,  S:true,  W:true  },  // 4 ouvertures
  spikes:   { N:true,  E:true,  S:true,  W:true  },  // 4 ouvertures
  darts:    { N:false, E:true,  S:true,  W:false },  // 2 ouvertures (E,S)
  guardian: { N:false, E:false, S:true,  W:false },  // impasse (S)
  ruins:    { N:false, E:true,  S:true,  W:true  },  // 3 ouvertures (E,S,W)
  journal:  { N:true,  E:true,  S:true,  W:true  },  // comme normale
};

/* Les 30 tuiles Temple du sac.
   Chaque exemplaire utilise la config de murs de sa vraie image officielle.
   Au placement, le moteur pivote la tuile (et son image) pour établir
   une connexion. Comptage officiel : Normale×3, Pont×2, Clé×3, Lave×5,
   Pics×3, Fléchettes×4, Ruines×6, Gardien×4 = 30. */
export const TEMPLE_TILES = [
  // --- Normales (3) ---
  { id: 'T01', type: 'normal', walls: {...REAL_WALLS.normal} },
  { id: 'T02', type: 'normal', walls: {...REAL_WALLS.normal} },
  { id: 'T03', type: 'normal', walls: {...REAL_WALLS.normal} },

  // --- Ponts (2) ---
  { id: 'T04', type: 'bridge', walls: {...REAL_WALLS.bridge} },
  { id: 'T05', type: 'bridge', walls: {...REAL_WALLS.bridge} },

  // --- Clés (3) ---
  { id: 'T06', type: 'key', walls: {...REAL_WALLS.key} },
  { id: 'T07', type: 'key', walls: {...REAL_WALLS.key} },
  { id: 'T08', type: 'key', walls: {...REAL_WALLS.key} },

  // --- Lave (5) ---
  { id: 'T09', type: 'lava', walls: {...REAL_WALLS.lava} },
  { id: 'T10', type: 'lava', walls: {...REAL_WALLS.lava} },
  { id: 'T11', type: 'lava', walls: {...REAL_WALLS.lava} },
  { id: 'T12', type: 'lava', walls: {...REAL_WALLS.lava} },
  { id: 'T13', type: 'lava', walls: {...REAL_WALLS.lava} },

  // --- Pièges à pics (3) ---
  { id: 'T14', type: 'spikes', walls: {...REAL_WALLS.spikes} },
  { id: 'T15', type: 'spikes', walls: {...REAL_WALLS.spikes} },
  { id: 'T16', type: 'spikes', walls: {...REAL_WALLS.spikes} },

  // --- Pièges à fléchettes (4) ---
  { id: 'T17', type: 'darts', walls: {...REAL_WALLS.darts} },
  { id: 'T18', type: 'darts', walls: {...REAL_WALLS.darts} },
  { id: 'T19', type: 'darts', walls: {...REAL_WALLS.darts} },
  { id: 'T20', type: 'darts', walls: {...REAL_WALLS.darts} },

  // --- Ruines (6) — Éboulis posé dessus, numéro 1-6 pour effondrement ---
  { id: 'T21', type: 'ruins', walls: {...REAL_WALLS.ruins}, ruinsNum: 1 },
  { id: 'T22', type: 'ruins', walls: {...REAL_WALLS.ruins}, ruinsNum: 2 },
  { id: 'T23', type: 'ruins', walls: {...REAL_WALLS.ruins}, ruinsNum: 3 },
  { id: 'T24', type: 'ruins', walls: {...REAL_WALLS.ruins}, ruinsNum: 4 },
  { id: 'T25', type: 'ruins', walls: {...REAL_WALLS.ruins}, ruinsNum: 5 },
  { id: 'T26', type: 'ruins', walls: {...REAL_WALLS.ruins}, ruinsNum: 6 },

  // --- Gardiens (4) — un Gardien posé quand la tuile est révélée ---
  { id: 'T27', type: 'guardian', walls: {...REAL_WALLS.guardian} },
  { id: 'T28', type: 'guardian', walls: {...REAL_WALLS.guardian} },
  { id: 'T29', type: 'guardian', walls: {...REAL_WALLS.guardian} },
  { id: 'T30', type: 'guardian', walls: {...REAL_WALLS.guardian} },
];

/* Tuiles Journal (3) — appartiennent à l'Aristocrate (capacité Rechercher).
   Comportement = Normale une fois posée. Pas dans le sac initial. */
export const JOURNAL_TILES = [
  { id: 'J01', type: 'journal', walls: {...REAL_WALLS.journal}, journalId: 1 },
  { id: 'J02', type: 'journal', walls: {...REAL_WALLS.journal}, journalId: 2 },
  { id: 'J03', type: 'journal', walls: {...REAL_WALLS.journal}, journalId: 3 },
];

/* Tuiles multi-cases spéciales.
   Chaque « case » d'une tuile multiple est traitée comme une tuile
   indépendante mais placée/retournée en groupe. */

// Entrée : 3 cases en rangée. Case centrale = croisement (départ),
// cases gauche/droite = sorties reliées aux Latérales.
export const ENTRY_TILE = {
  id: 'ENTRY',
  multi: true,
  cells: [
    { id: 'ENTRY_L', type: 'entry', walls: { N:true, E:true, S:false, W:true }, exit: 'left' },
    { id: 'ENTRY_C', type: 'entry', walls: { N:true, E:true, S:true,  W:true }, crossroad: true },
    { id: 'ENTRY_R', type: 'entry', walls: { N:true, E:true, S:false, W:true }, exit: 'right' },
  ],
};

// Latérales : de part et d'autre de l'Entrée. Contiennent des tuiles Gardien
// (mais pas de gardien posé au début).
export const LATERAL_TILES = [
  { id: 'LAT_L', multi: true, side: 'left', cells: [
    { id: 'LAT_L_0', type: 'lateral', walls: { N:true, E:true, S:true, W:true }, guardianAnchor: true },
  ]},
  { id: 'LAT_R', multi: true, side: 'right', cells: [
    { id: 'LAT_R_0', type: 'lateral', walls: { N:true, E:true, S:true, W:true }, guardianAnchor: true },
  ]},
];

// Sanctuaire : posé quand le sac est vide, dans la colonne la plus éloignée.
// Nécessite les 3 Clés pour déverrouiller.
export const SANCTUARY_TILE = {
  id: 'SANC',
  multi: false,
  type: 'sanctuary',
  walls: { N:true, E:true, S:true, W:true }, // ouvertures déterminées au placement
};
