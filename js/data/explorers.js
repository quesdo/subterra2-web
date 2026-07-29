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
    desc: "Choisissez un autre Explorateur : s'il est à terre, +2 PV ; sinon +1 PV.",
    effect: 'revive',
  },
  purify: {
    id: 'purify', name: 'Purifier', cost: 1, passive: false, uses: null,
    desc: "Choisissez une autre tuile : éliminez tous les ennemis qui s'y trouvent.",
    effect: 'purify',
  },
};

/* Les 10 Explorateurs officiels (manuel pp.26-27). Chaque perso a un
   domaine, des PV (3/5/7) et 2 capacités. L'affectation capacité→perso
   suit fidèlement la notice. */
export const EXPLORERS = [
  {
    id: 'aristocrat', name: "L'Aristocrate", role: 'Exploration', pv: 3, color: '#d6a55b',
    glyph: '🎓',
    abilities: ['scholar', 'adventurer'],
    blurb: "Domaine Exploration (3 PV). Choisit ses tuiles et relance les dés.",
  },
  {
    id: 'thief', name: 'La Voleuse', role: 'Exploration', pv: 3, color: '#5bd66a',
    glyph: '🏃',
    abilities: ['agile', 'illuminate'],
    blurb: "Domaine Exploration (3 PV). Ignore les Éboulis, illumine deux fois.",
  },
  {
    id: 'scout', name: "L'Éclaireuse", role: 'Exploration', pv: 5, color: '#5bd6c7',
    glyph: '🗺',
    abilities: ['sprint', 'vigilance'],
    blurb: "Domaine Exploration (5 PV). Sprinte et neutralise les pièges.",
  },
  {
    id: 'commander', name: 'Le Capitaine', role: 'Commandement', pv: 5, color: '#d65bb0',
    glyph: '🎖️',
    abilities: ['order', 'research'],
    blurb: "Domaine Commandement (5 PV). Ordonne des déplacements, place des tuiles Journal.",
  },
  {
    id: 'miner', name: 'Le Mineur', role: 'Force', pv: 7, color: '#a5d65b',
    glyph: '⛏️',
    abilities: ['excavate', 'consolidate'],
    blurb: "Domaine Force (7 PV). Excave et consolide les tuiles.",
  },
  {
    id: 'sniper', name: 'La Tireuse d\'Élite', role: 'Combat', pv: 5, color: '#d65b5b',
    glyph: '🎯',
    abilities: ['scope', 'snipe'],
    blurb: "Domaine Combat (5 PV). Repère et abat les Gardiens à distance.",
  },
  {
    id: 'sapper', name: 'Le Sapeur', role: 'Combat', pv: 5, color: '#5bd68a',
    glyph: '💣',
    abilities: ['grenade', 'demolish'],
    blurb: "Domaine Combat (5 PV). Grenade les ennemis et démolit les murs.",
  },
  {
    id: 'soldier', name: 'Le Soldat', role: 'Combat', pv: 7, color: '#9b5bd6',
    glyph: '🛡️',
    abilities: ['annihilate', 'prepare'],
    blurb: "Domaine Combat (7 PV). Anéantit et se prépare (Bouclier).",
  },
  {
    id: 'nurse', name: "L'Infirmière", role: 'Soin', pv: 5, color: '#d6c75b',
    glyph: '⚕',
    abilities: ['heal', 'survivor'],
    blurb: "Domaine Soin (5 PV). Soigne à distance et encaisse le Trébucher.",
  },
  {
    id: 'priestess', name: 'La Prêtresse', role: 'Soin', pv: 3, color: '#5b8dd6',
    glyph: '🕯',
    abilities: ['revive', 'purify'],
    blurb: "Domaine Soin (3 PV). Ranime et purifie les tuiles des Gardiens.",
  },
];

/* Note : les 20 capacités du manuel sont toutes attribuées, chacune
   exactement une fois (2 capacités × 10 Explorateurs = 20). */
