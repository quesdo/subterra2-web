/* ============================================================
   perils.js — Les 6 faces du dé de Péril
   Lancé à la fin de chaque tour de joueur (2 dés après l'Artefact).
   ============================================================ */

export const PERIL_FACES = {
  stumble: {
    id: 'stumble', label: 'Trébucher', glyph: '🤕',
    color: '#8a6a45',
    desc: "Si vous vous êtes dépassé ce tour, vous perdez 1 PV supplémentaire.",
  },
  lava: {
    id: 'lava', label: 'Lave', glyph: '🌋',
    color: '#e8552a',
    desc: "TOUS les Explorateurs sur une tuile Lave perdent 1 PV.",
  },
  collapse: {
    id: 'collapse', label: 'Effondrement', glyph: '💥',
    color: '#7d4536',
    desc: "Lancez le dé. Si le résultat correspond au numéro d'une tuile Ruines sans Éboulis, elle s'effondre (Éboulis posé, Explorateurs sur la tuile perdent 2 PV, Gardiens éliminés).",
  },
  trap: {
    id: 'trap', label: 'Déclencher un piège', glyph: '⚔',
    color: '#b8401d',
    desc: "Déclenchez le Piège à pics où vous êtes (2 PV), et les Pièges à fléchettes où vous êtes + adjacents (1 PV).",
  },
  wake: {
    id: 'wake', label: 'Réveiller un Gardien', glyph: '👁',
    color: '#3d4a2a',
    desc: "Trouvez la tuile Gardien la plus proche et placez-y un Gardien.",
  },
  activate: {
    id: 'activate', label: 'Activer les Gardiens', glyph: '🔃',
    color: '#5a3d6b',
    desc: "Activez une fois tous les Gardiens en jeu.",
  },
};

/* Ordre du dé de Péril (6 faces, équiprobables) */
export const PERIL_DIE = ['stumble', 'lava', 'collapse', 'trap', 'wake', 'activate'];

/* Lance un dé de Péril */
export function rollPeril() {
  return PERIL_DIE[Math.floor(Math.random() * 6)];
}

/* Lance le dé numérique (1-6) — pour Attaquer, Éviter un piège, Effondrement */
export function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}
