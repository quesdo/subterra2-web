/* perils.js — Les 6 faces du dé de Péril + lancés */
/* Lancé à la fin de chaque tour de joueur (2 dés après l'Artefact). */
/* Montants de dégâts confirmés par analyse PDF (pages 14-17, 27, 29). */

export const PERIL_FACES = {
  stumble: {
    id: 'stumble',
    label: 'Trébucher',
    glyph: '🤕',
    damage: 1,
    conditional: true,
    desc: "Si l'Explorateur s'est dépassé ce tour, perd 1 PV supplémentaire.",
  },
  lava: {
    id: 'lava',
    label: 'Lave',
    glyph: '🌋',
    damage: 1,
    desc: "TOUS les Explorateurs sur une tuile Lave perdent 1 PV (y compris les à terre).",
  },
  collapse: {
    id: 'collapse',
    label: 'Effondrement',
    glyph: '💥',
    damage: 5,
    desc: "Lancez le dé. Si le résultat correspond au numéro d'une tuile Ruines sans Éboulis, elle s'effondre : 5 PV aux Explorateurs sur la tuile, Gardiens éliminés, Éboulis posé.",
  },
  trap: {
    id: 'trap',
    label: 'Déclencher un piège',
    glyph: '⚔',
    damage: { spikes: 3, darts: 1 },
    desc: "Déclenchez le Piège à pics sur la tuile actuelle (3 PV) et les Pièges à fléchettes sur la tuile actuelle + adjacentes connectées (1 PV par tuile affectée).",
  },
  wake: {
    id: 'wake',
    label: 'Réveiller un Gardien',
    glyph: '👁',
    damage: 0,
    desc: "Placez un Gardien sur la tuile Gardien la plus proche (max 5 en jeu).",
  },
  activate: {
    id: 'activate',
    label: 'Activer les Gardiens',
    glyph: '🔃',
    damage: 0,
    desc: "Activez une fois tous les Gardiens en jeu.",
  },
};

/* Ordre du dé de Péril (6 faces, équiprobables) */
export const PERIL_DIE = ['stumble', 'lava', 'collapse', 'trap', 'wake', 'activate'];

/* Lance un dé de Péril — retourne un face ID aléatoire */
export function rollPeril() {
  return PERIL_DIE[Math.floor(Math.random() * 6)];
}

/* Lance le dé numérique (1-6) — pour Attaquer, Effondrement, Éviter un piège */
export function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}
