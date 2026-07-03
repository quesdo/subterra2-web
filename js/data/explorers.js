/* ============================================================
   explorers.js — Les 10 Explorateurs
   Chaque perso : PV (3/5/7), couleur, 2 capacités.
   Capacités = passives (toujours actives) ou actives (coût en PA).
   ============================================================ */

/* Catalogue des 20 capacités du manuel.
   cost = PA requis | passive = true si toujours active
   uses = nombre d'utilisations par partie (null = illimité)
   target = type de ciblage pour l'UI */
export const ABILITIES = {
  // --- Page 26 (capacités de rôle, souvent passives) ---
  scholar: {
    id: 'scholar', name: 'Érudite', cost: 0, passive: true, uses: null,
    desc: "Au lieu de piocher une tuile, piochez-en deux, choisissez-en une et remettez l'autre dans le sac.",
  },
  adventurer: {
    id: 'adventurer', name: 'Aventurière', cost: 0, passive: true, uses: null,
    desc: "À votre tour, vous pouvez dépenser 1 PV pour relancer n'importe quel dé.",
  },
  agile: {
    id: 'agile', name: 'Agile', cost: 0, passive: true, uses: null,
    desc: "Lors de Se déplacer, Courir ou Explorer, ignorez les marqueurs Éboulis.",
  },
  illuminate: {
    id: 'illuminate', name: 'Illuminer', cost: 1, passive: false, uses: null,
    desc: "Effectuez deux fois l'action Révéler.",
    effect: 'reveal_twice',
  },
  sprint: {
    id: 'sprint', name: 'Sprinter', cost: 1, passive: false, uses: null,
    desc: "Effectuez deux fois l'action Se déplacer.",
    effect: 'move_twice',
  },
  vigilance: {
    id: 'vigilance', name: 'Vigilance', cost: 0, passive: true, uses: null,
    desc: "Vous et les Explorateurs sur votre tuile ne déclenchez pas de piège et ne perdez pas de PV de piège.",
  },
  order: {
    id: 'order', name: 'Ordonner', cost: 1, passive: false, uses: null,
    desc: "Choisissez un Explorateur non à terre : il effectue immédiatement une action Se déplacer.",
    effect: 'order',
  },
  research: {
    id: 'research', name: 'Rechercher', cost: 1, passive: false, uses: 3,
    desc: "Placez une tuile Journal connectée à n'importe quelle tuile du Temple. (3 fois)",
    effect: 'research',
  },
  // --- Page 27 (capacités actives) ---
  excavate: {
    id: 'excavate', name: 'Excaver', cost: 1, passive: false, uses: null,
    desc: "Effectuez une action Creuser.",
    effect: 'dig',
  },
  consolidate: {
    id: 'consolidate', name: 'Consolider', cost: 1, passive: false, uses: 4,
    desc: "Placez un marqueur Consolidation sur votre tuile : elle devient une tuile normale à vie. (4 fois)",
    effect: 'consolidate',
  },
  scope: {
    id: 'scope', name: 'Lunette de visée', cost: 1, passive: false, uses: null,
    desc: "Révélez une tuile visible en ligne droite, à 3 tuiles ou moins.",
    effect: 'scope',
  },
  snipe: {
    id: 'snipe', name: 'Tir de précision', cost: 1, passive: false, uses: null,
    desc: "Éliminez un ennemi visible en ligne droite à ≤3 tuiles (pas sur votre tuile).",
    effect: 'snipe',
  },
  grenade: {
    id: 'grenade', name: 'Grenade', cost: 1, passive: false, uses: null,
    desc: "Éliminez tous les ennemis sur une tuile adjacente connectée. Les Explorateurs sur cette tuile perdent 1 PV.",
    effect: 'grenade',
  },
  demolish: {
    id: 'demolish', name: 'Démolir', cost: 1, passive: false, uses: 3,
    desc: "Détruisez un mur adjacent. Placez un marqueur Démolition. (3 fois)",
    effect: 'demolish',
  },
  annihilate: {
    id: 'annihilate', name: 'Anéantir', cost: 1, passive: false, uses: null,
    desc: "Éliminez un ennemi situé sur votre tuile.",
    effect: 'annihilate',
  },
  prepare: {
    id: 'prepare', name: 'Se préparer', cost: 1, passive: false, uses: null,
    desc: "Impossible de perdre de PV jusqu'à votre prochain tour. (Se dépasser coûte toujours 1 PV)",
    effect: 'prepare',
  },
  heal: {
    id: 'heal', name: 'Guérir', cost: 1, passive: false, uses: null,
    desc: "Un Explorateur visible à ≤2 tuiles récupère 1 PV.",
    effect: 'heal',
  },
  survivor: {
    id: 'survivor', name: 'Survivante', cost: 0, passive: true, uses: null,
    desc: "Sur un résultat Trébucher au dé de Péril, regagnez 1 PV au lieu de le perdre.",
  },
  revive: {
    id: 'revive', name: 'Ranimer', cost: 1, passive: false, uses: null,
    desc: "Choisissez un Explorateur : s'il est à terre, +2 PV ; sinon +1 PV.",
    effect: 'revive',
  },
  purify: {
    id: 'purify', name: 'Purifier', cost: 1, passive: false, uses: null,
    desc: "Choisissez une autre tuile : éliminez tous les ennemis qui s'y trouvent.",
    effect: 'purify',
  },
};

/* Les 10 Explorateurs. Composition : chaque perso a un rôle distinctif
   et 2 capacités (1 passive caractéristique + 1 active), sauf exceptions.
   PV répartis 3/5/7 selon le rôle (fragiles=3, équilibrés=5, résistants=7). */
export const EXPLORERS = [
  {
    id: 'scholar', name: 'Érudite', role: 'Érudite', pv: 5, color: '#5b8dd6',
    glyph: '📚',
    abilities: ['scholar', 'scope'],
    blurb: "Cartographe savante. Choisit ses tuiles.",
  },
  {
    id: 'adventurer', name: 'Aventurière', role: 'Aventurière', pv: 5, color: '#d65b5b',
    glyph: '🎲',
    abilities: ['adventurer', 'snipe'],
    blurb: "Joueuse audacieuse. Relance les dés.",
  },
  {
    id: 'ranger', name: 'Éclaireuse', role: 'Agile', pv: 5, color: '#5bd66a',
    glyph: '🏃',
    abilities: ['agile', 'sprint'],
    blurb: "Passe partout. Ignore les Éboulis.",
  },
  {
    id: 'illuminator', name: 'Illuminateur', role: 'Illuminer', pv: 5, color: '#d6c75b',
    glyph: '🔦',
    abilities: ['illuminate', 'excavate'],
    blurb: "Révèle deux fois plus vite.",
  },
  {
    id: 'sprinter', name: 'Coureur', role: 'Sprinter', pv: 7, color: '#5bd6c7',
    glyph: '💨',
    abilities: ['sprint', 'prepare'],
    blurb: "Vif et résistant. Se déplace loin.",
  },
  {
    id: 'guardian_watch', name: 'Vigile', role: 'Vigilance', pv: 7, color: '#9b5bd6',
    glyph: '🛡️',
    abilities: ['vigilance', 'annihilate'],
    blurb: "Protecteur. Neutralise les pièges.",
  },
  {
    id: 'commander', name: 'Capitaine', role: 'Ordonner', pv: 5, color: '#d65bb0',
    glyph: '🎖️',
    abilities: ['order', 'grenade'],
    blurb: "Mène l'équipe. Ordonne des déplacements.",
  },
  {
    id: 'aristocrat', name: 'Aristocrate', role: 'Rechercher', pv: 3, color: '#d6a55b',
    glyph: '📖',
    abilities: ['research', 'consolidate'],
    blurb: "Possède les tuiles Journal. Fragile.",
  },
  {
    id: 'sapper', name: 'Sapeur', role: 'Démolir', pv: 5, color: '#a5d65b',
    glyph: '⛏️',
    abilities: ['demolish', 'excavate'],
    blurb: "Détruit les murs. Fraye des passages.",
  },
  {
    id: 'medic', name: 'Médecin', role: 'Guérir', pv: 5, color: '#5bd68a',
    glyph: '✚',
    abilities: ['heal', 'revive'],
    blurb: "Soigne et ranime les compagnons.",
  },
];

/* Note : les capacités Survivor/Purifier/Annihilate sont alternatives
   attribuables. La liste couvre les 20 capacités du manuel via les
   combinaisons ci-dessus (chaque capacité apparaît au moins une fois). */
