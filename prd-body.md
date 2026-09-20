## Problem Statement

L'adaptation web actuelle de Sub Terra II contient **30 erreurs et 7 règles manquantes** par rapport au manuel officiel (PDF analysé page par page, icônes de PV incluses). Les bugs vont de montants de dégâts incorrects (Piège à pics = 2 PV au lieu de 3, Effondrement = 2 PV au lieu de 5) à des mécaniques structurelles cassées (endGameTurn ne se déclenche plus si le Chef d'Expédition meurt, double-activation des Gardiens, 2 capacités sur 20 totalement inimplémentées, table de difficulté permutée pour 4-5 joueurs). De plus, le multijoueur en ligne mentionné dans le README n'est pas implémenté.

## Solution

Réécriture complète from scratch du projet en vanilla JS (ES modules, pas de build, pas de framework). Architecture en 4 couches séparées : **Moteur pur** (logique de jeu testable sans UI) → **Couche réseau** (PeerJS, hôte-authoritaire) → **Couche UI** (rendu SVG, HUD, actions, dés, journal, modals Chef d'Expédition) → **Orchestrateur** (transitions d'écran, boucle de jeu). Les trois modes de jeu (solo multi-persos, hotseat, multijoueur en ligne) partagent le même moteur.

## User Stories

### Moteur de jeu (logique pure)
1. En tant que développeur, je veux un moteur de jeu pur (sans dépendance DOM/UI) afin de pouvoir le tester avec Node.js + assert
2. En tant que joueur, je veux que les 30 tuiles Temple (Normale x3, Pont x2, Clé x3, Lave x5, Pics x3, Fléchettes x4, Ruines x6, Gardien x4) + 3 tuiles Journal + tuiles spéciales (Entrée, Latérales, Sanctuaire) soient placées selon les règles officielles
3. En tant que joueur, je veux que chaque tuile ait son effet correct à la pose (Clé→marqueur Clé, Ruines→Éboulis, Gardien→Gardien placé)
4. En tant que joueur, je veux que la connectivité entre tuiles soit calculée par BFS (adjacent + pas de mur des deux côtés)
5. En tant que joueur, je veux que la ligne de vue fonctionne en ligne droite, bloquée par les murs et les Éboulis
6. En tant que joueur, je veux que le placement des tuiles soit interdit derrière ou au-delà des Latérales (règle explicite, pas seulement via les murs)
7. En tant que joueur, je veux que si aucune tuile ne peut être placée ("totalement bloqué"), le jeu défausse les tuiles impossibles et place le Sanctuaire
8. En tant que joueur, je veux pouvoir détruire des murs adjacents avec la capacité Démolir (place un marqueur Démolition, le mur n'existe plus)
9. En tant que joueur, je veux que chaque tour de joueur se déroule en 2 étapes : (A) actions avec 2 PA, (B) lancer 1 dé de Péril
10. En tant que joueur, je veux que la fin de tour de jeu active tous les Gardiens 2× puis avance le marqueur Éruption d'1 case
11. En tant que joueur, je veux pouvoir effectuer les 8 actions officielles : Révéler (1 PA), Se déplacer (1 PA), Explorer (1 PA), Soigner (1 PA), Attaquer (1 PA), Creuser (2 PA), Courir (2 PA), Manier un objet (1 PA)
12. En tant que joueur, je veux que "Manier un objet" inclue : ramasser, prendre d'un autre Explorateur (avec accord), donner à un autre Explorateur, déposer
13. En tant que joueur, je veux qu'un Explorateur ne puisse détenir qu'un seul objet à la fois
14. En tant que joueur, je veux pouvoir ramasser un Artefact déposé au sol (pas seulement au Sanctuaire)
15. En tant que joueur, je veux pouvoir "se dépasser" 1× par tour : -1 PV + 1 PA supplémentaire
16. En tant que joueur, je veux que si mon Explorateur tombe à terre (0 PV) pendant son tour, le tour se termine immédiatement
17. En tant que joueur, je veux qu'un Explorateur à terre ne puisse que Ramper (se déplacer d'1 tuile), pas se dépasser, mais garde ses capacités passives
18. En tant que joueur, je veux qu'un Explorateur à terre soigné par un allié redevienne actif
19. En tant que joueur, je veux que les dégâts de Péril affectent TOUS les Explorateurs (actifs ET à terre)
20. En tant que joueur, je veux que les Explorateurs évadés continuent de lancer le dé de Péril (s'ils obtiennent Réveiller/Activer Gardiens, traités comme à l'Entrée)
21. En tant que joueur, je veux que les Explorateurs morts continuent de lancer le dé de Péril (traités comme à l'Entrée pour Réveiller/Activer)
22. En tant que joueur, je veux que le dé de Péril ait 6 faces correctes : Trébucher, Lave, Effondrement, Déclencher un piège, Réveiller un Gardien, Activer les Gardiens
23. En tant que joueur, je veux que Trébucher inflige -1 PV supplémentaire si je me suis dépassé ce tour
24. En tant que joueur, je veux que Lave inflige -1 PV à TOUS les Explorateurs sur une tuile Lave (y compris à terre)
25. En tant que joueur, je veux que Effondrement lance le dé et fasse s'effondrer la tuile Ruines correspondante sans Éboulis (-5 PV aux Explorateurs, Gardiens éliminés, Éboulis placé)
26. En tant que joueur, je veux que Déclencher un piège active le Piège à pics de ma tuile (-3 PV) ET les Pièges à fléchettes de ma tuile + adjacentes connectées (-1 PV sur chaque tuile affectée)
27. En tant que joueur, je veux que Réveiller un Gardien place un Gardien sur la tuile Gardien la plus proche (max 5 Gardiens en jeu)
28. En tant que joueur, je veux que Activer les Gardiens active tous les Gardiens en jeu une fois
29. En tant que joueur, je veux que les Gardiens suivent la priorité officielle : 1. Attaquer (1 PV, cible active) → 2. Se déplacer (vers l'Explorateur actif le plus proche, bloqué par Éboulis) → 3. Creuser (retirer un Éboulis adjacent)
30. En tant que joueur, je veux qu'un Gardien éliminé par une tuile Volcan retourne dans la réserve (pas de fuite de ressources)
31. En tant que joueur, je veux qu'un Gardien ne soit activé qu'une seule fois par phase d'activation (pas de double activation s'il se déplace vers une tuile pas encore traitée)
32. En tant que joueur, je veux que fuir une tuile avec un Gardien coûte 1 PV par Gardien présent
33. En tant que joueur, je veux que les Gardiens soient immunisés aux pièges et à la lave (tuiles non retournées)
34. En tant que joueur, je veux que les Gardiens puissent entrer sur une tuile Pont même occupée par un Explorateur
35. En tant que joueur, je veux que le marqueur Éruption avance d'1 case par tour de jeu (2 avec la malédiction)
36. En tant que joueur, je veux que quand le marqueur atteint 0, le volcan est prêt à entrer en éruption au prochain symbole Lave du dé de Péril
37. En tant que joueur, je veux que l'éruption retourne le plateau Volcan : si le Sanctuaire n'est pas découvert ou l'Artefact n'est pas sorti → partie perdue
38. En tant que joueur, je veux que le Sanctuaire soit retourné face Volcan lors de l'éruption (même si l'Artefact a été évacué)
39. En tant que joueur, je veux que la lave se propage : retourne les tuiles Temple connectées et adjacentes aux tuiles déjà retournées
40. En tant que joueur, je veux que l'Entrée et les Latérales se retournent en groupe lors de la propagation de lave
41. En tant que joueur, je veux que la lave se propage 2× par tour de jeu avec la malédiction (pas 1×)
42. En tant que joueur, je veux que la malédiction (prise de l'Artefact) fasse lancer 2 dés de Péril par tour d'Explorateur
43. En tant que joueur, je veux que le Sanctuaire soit placé dans la colonne la plus éloignée de l'Entrée quand le sac est vide
44. En tant que joueur, je veux devoir apporter 3 Clés au Sanctuaire (1 action Manier un objet par Clé) pour le déverrouiller
45. En tant que joueur, je veux que l'Artefact apparaisse sur le Sanctuaire après les 3 Clés et puisse être ramassé comme un objet
46. En tant que joueur, je veux gagner si un Explorateur sort avec l'Artefact (médailles : Légendaire=0 mort, Or=1 mort, Argent=2 morts, Bronze=3+morts)
47. En tant que joueur, je veux perdre si tous les Explorateurs sont à terre/morts, ou si l'Artefact est englouti par la lave ("Oubliés à jamais")
48. En tant que joueur, je veux que la table de difficulté soit correcte : 3j={27,26,22,20}, 4j={22,19,16,14}, 5j={24,21,18,16}, 6j={20,17,14,12}
49. En tant que joueur, je veux que le solo permette de contrôler 3 à 6 Explorateurs
50. En tant que joueur, je veux que 2 joueurs contrôlent chacun 2 Explorateurs

### Capacités des Explorateurs (20 capacités)
51. En tant que joueur, je veux que les 10 Explorateurs aient leurs 2 capacités correctes
52. En tant que joueur, je veux que Érudite (passive) me laisse piocher 2 tuiles, en choisir 1, remettre l'autre
53. En tant que joueur, je veux que Aventurière (active, coûte 1 PV) me permette de relancer n'importe quel dé
54. En tant que joueur, je veux que Agile (passive) me laisse ignorer les Éboulis lors de Se déplacer/Courir/Explorer
55. En tant que joueur, je veux que Illuminer (1 PA) effectue 2× Révéler
56. En tant que joueur, je veux que Sprinter (1 PA) effectue 2× Se déplacer
57. En tant que joueur, je veux que Vigilance (passive) protège les autres Explorateurs sur ma tuile des pièges
58. En tant que joueur, je veux que Ordonner (1 PA) fasse qu'un Explorateur non à terre effectue une action Se déplacer (avec effets de déplacement : pièges, fuite)
59. En tant que joueur, je veux que Rechercher (1 PA, x3) place une tuile Journal connectée à n'importe quelle tuile
60. En tant que joueur, je veux que Excaver (1 PA) effectue une action Creuser sans coût supplémentaire
61. En tant que joueur, je veux que Consolider (1 PA, x4) rende ma tuile Normale à vie
62. En tant que joueur, je veux que Lunette de visée (1 PA) révèle une tuile en ligne de vue à ≤3 tuiles
63. En tant que joueur, je veux que Tir de précision (1 PA) élimine un ennemi en ligne de vue à ≤3 tuiles (pas sur ma tuile)
64. En tant que joueur, je veux que Grenade (1 PA) élimine TOUS les ennemis sur une tuile adjacente connectée (-1 PV aux Explorateurs sur cette tuile)
65. En tant que joueur, je veux que Démolir (1 PA, x3) détruise un mur adjacent (place un marqueur Démolition)
66. En tant que joueur, je veux que Anéantir (1 PA) élimine un ennemi sur ma tuile
67. En tant que joueur, je veux que Se préparer (1 PA) me rende incapable de perdre des PV jusqu'au début de mon prochain tour (se dépasser coûte toujours 1 PV, ne peut pas réutiliser le prochain tour)
68. En tant que joueur, je veux que Guérir (1 PA) soigne un Explorateur visible à ≤2 tuiles de 2 PV
69. En tant que joueur, je veux que Survivante (passive) me fasse regagner 1 PV sur Trébucher au lieu de l'effet normal (toujours, pas seulement si dépassé)
70. En tant que joueur, je veux que Ranimer (1 PA) soigne un autre Explorateur : 1 PV si à terre, 3 PV si actif
71. En tant que joueur, je veux que Purifier (1 PA) élimine tous les ennemis sur une autre tuile

### Décisions du Chef d'Expédition
72. En tant que Chef d'Expédition, je veux choisir quelle cible un Gardien attaque (si plusieurs Explorateurs sur la tuile)
73. En tant que Chef d'Expédition, je veux choisir la direction d'un Gardien si plusieurs cibles/chemins à égale distance
74. En tant que Chef d'Expédition, je veux choisir l'ordre d'activation des Gardiens
75. En tant que Chef d'Expédition, je veux choisir quelle tuile Gardien reçoit un Gardien en cas d'égalité de distance

### Mode hotseat
76. En tant que joueur en hotseat, je veux que les tours passent d'un joueur à l'autre sur le même écran
77. En tant que joueur en hotseat, je veux que le Chef d'Expédition soit désigné au départ et arbitre les décisions
78. En tant que joueur en hotseat, je veux que l'écran affiche le joueur actif, ses PV, ses PA, ses objets

### Multijoueur en ligne (PeerJS)
79. En tant que joueur en ligne, je veux créer ou rejoindre une partie via un code/lien PeerJS
80. En tant qu'hôte (Chef d'Expédition), je veux que mon client calcule l'état du jeu et le broadcast aux autres joueurs
81. En tant que client, je veux envoyer mes actions à l'hôte et recevoir l'état mis à jour
82. En tant que joueur en ligne, je veux voir le plateau, les autres Explorateurs et le journal en temps réel
83. En tant que joueur en ligne, je veux que les décisions du Chef d'Expédition apparaissent comme des modals interactives

### UI / Rendu
84. En tant que joueur, je veux un rendu SVG du plateau avec tuiles, murs, meeples, marqueurs, pan/zoom
85. En tant que joueur, je veux une barre d'actions contextuelle qui montre les actions disponibles selon mon état et mes PA
86. En tant que joueur, je veux voir la piste Volcan et le marqueur d'éruption
87. En tant que joueur, je veux un journal d'événements repliable
88. En tant que joueur, je veux des dés animés (Péril et combat)
89. En tant que joueur, je veux des écrans de transition : titre → règles → setup → jeu → fin
90. En tant que joueur sur mobile, je veux que l'interface s'adapte au tactile

## Implementation Decisions

### Architecture en 4 couches

**Couche 1 — Moteur de jeu (pur, sans DOM)**
```
src/engine/
  state.js        État immuable du jeu (createGameState, serialize, deserialize)
  actions.js      Les 8 actions + se dépasser (coûts PA, validation, exécution)
  abilities.js    Les 20 capacités (passives et actives)
  tiles.js        Données des 33 tuiles (30 Temple + 3 Journal) + tuiles spéciales
  explorers.js    Données des 10 Explorateurs + 20 capacités
  perils.js       6 faces du dé de Péril + résolution
  board.js        Grille, murs, connectivité BFS, ligne de vue, placement
  guardians.js    IA des Gardiens (priorité officielle, pool de 5, pas de double activation)
  volcano.js      Piste d'éruption, éruption, propagation de lave
  artefact.js     Sanctuaire, Clés, Artefact, malédiction
  turn.js         Structure du tour (joueur + jeu), endGameTurn robuste
  endgame.js      Conditions de victoire/défaite, médailles
  difficulty.js   Table de difficulté officielle (corrigée)
```

**Couche 2 — Réseau (PeerJS)**
```
src/net/
  host.js         Hôte-authoritaire : reçoit actions, calcule état, broadcast
  client.js       Client : envoie actions, reçoit état, affiche
  sync.js         Sérialisation/désérialisation de l'état du jeu
  signaling.js    Configuration PeerJS (serveur de signalisation)
```

**Couche 3 — UI (rendu SVG + DOM)**
```
src/ui/
  render.js       Plateau SVG (tuiles, murs, meeples, marqueurs, pan/zoom)
  hud.js          Panneau joueur actif + équipe + piste Volcan
  actions.js      Barre d'actions contextuelle
  dice.js         Dés animés (Péril + combat)
  log.js          Journal d'événements
  modals.js       Modals pour décisions du Chef d'Expédition
  screens.js      Écrans : titre → règles → setup → jeu → fin
```

**Couche 4 — Orchestrateur**
```
src/
  main.js         Orchestrateur (transitions, ciblages, boucle de jeu, mode hotseat/multi)
```

### Décisions clés

- **État du jeu sérialisable** : tout l'état est un objet JSON pur, sans références circulaires, pour permettre la sync PeerJS
- **Hôte-authoritaire** : seul l'hôte (Chef d'Expédition) exécute le moteur. Les clients envoient des actions (pick up, move, etc.) et reçoivent l'état complet
- **endGameTurn robuste** : détection de fin de tour par compteur de joueurs actifs traités, pas par index de tableau
- **Gardiens tracker** : chaque Gardien a un ID unique, tracker les Gardiens déjà activés pour éviter les doubles activations
- **Montants de dégâts exacts** : Piège à pics = 3 PV, Effondrement = 5 PV, Piège à fléchettes = 1 PV (tuile + adjacentes connectées), Guérir = 2 PV, Ranimer = 1 PV (à terre) / 3 PV (actif)
- **Pool de Gardiens** : 5 meeples, retournés au pool lors d'élimination (attaque, capacité, effondrement, tuile Volcan)
- **Dégâts de Péril** : affectent TOUS les Explorateurs (actifs ET à terre), sauf si protégés par Vigilance/Bouclier
- **Tuile Pont** : 1 Explorateur max, mais les Gardiens peuvent entrer même si occupée
- **Explorateurs évadés/morts** : continuent de lancer le dé de Péril, traités comme à l'Entrée pour Réveiller/Activer les Gardiens
- **Propagation de lave** : Entrée et Latérales se retournent en groupe ; 2× par tour avec malédiction

### Schema de l'état du jeu

```javascript
{
  turn: number,
  phase: 'setup' | 'explorerTurn' | 'perilPhase' | 'endGameTurn' | 'gameOver',
  currentExplorerIdx: number,
  explorers: [{
    id: string, name: string, roleId: string,
    hp: number, maxHp: number,
    state: 'active' | 'down' | 'dead' | 'escaped',
    x: number, y: number,
    item: 'key' | 'artifact' | null,
    pushedThisTurn: boolean,
    shielded: boolean,
    abilityCooldown: object,
    abilityUsesLeft: object,
  }],
  board: {
    cells: Map<string, Cell>,
    entry: Cell[],
    laterals: Cell[],
    sanctuary: Cell | null,
  },
  tileBag: string[],
  journalBag: string[],
  guardians: {
    pool: { available: number, inPlay: number },
    guardians: [{ id: string, x: number, y: number, activatedThisPhase: boolean }],
  },
  volcano: {
    position: number,
    cursed: boolean,
    erupting: boolean,
    erupted: boolean,
  },
  keysPlacedOnSanctuary: number,
  artifactRetrieved: boolean,
  artifactEscaped: boolean,
  curseActive: boolean,
  winner: 'players' | 'game' | null,
  medal: string | null,
  log: string[],
}
```

## Testing Decisions

**Critère de qualité** : chaque mécanique du moteur doit avoir un test qui couvre le cas nominal + les cas limites. Les tests tournent avec `node` pur, sans framework.

**Modules à tester en priorité** :
- `board.js` : connectivité BFS, placement de tuiles, ligne de vue, contrainte Latérales, "totalement bloqué"
- `actions.js` : chaque action (coût PA, validation, exécution), se dépasser, tour se termine si à terre
- `guardians.js` : priorité officielle, pool de 5, pas de double activation, fuite, immunité
- `volcano.js` : piste d'éruption, éruption, propagation de lave, Entrée/Latérales en groupe, 2× malédiction
- `perils.js` : 6 faces, montants de dégâts exacts, Explorateurs à terre inclus
- `abilities.js` : les 20 capacités, passives vs actives, usages limités, Vigilance protège les alliés
- `endgame.js` : victoire/défaite, médailles, "Oubliés à jamais"
- `difficulty.js` : table correcte pour 3-6 Explorateurs
- `turn.js` : endGameTurn robuste même si le Chef d'Expédition est mort/évadé

**Structure des tests** :
```
tests/
  engine/
    board.test.mjs
    actions.test.mjs
    guardians.test.mjs
    volcano.test.mjs
    perils.test.mjs
    abilities.test.mjs
    endgame.test.mjs
    difficulty.test.mjs
    turn.test.mjs
  run-all.mjs          Runner qui exécute tous les tests
```

**Commande** : `node tests/run-all.mjs` (aucune dépendance, aucun build)

## Out of Scope

- Application mobile native (le jeu est jouable dans un navigateur mobile via responsive design)
- IA pour le mode solo (le solo = contrôle manuel de plusieurs Explorateurs en hotseat)
- Statistiques, classements, sauvegarde de parties, comptes utilisateurs (partie éphémère, comme le jeu de plateau)

## Further Notes

### Montants de dégâts confirmés (analyse des icônes du PDF)
| Effet | Montant | Source PDF |
|-------|---------|-----------|
| Piège à pics | 3 PV | Pages 15, 16, 29 (3 icônes cœurs) |
| Effondrement (Ruines) | 5 PV | Pages 14, 17, 29 (5 icônes cœurs) |
| Piège à fléchettes | 1 PV par tuile (tuile + adjacentes connectées) | Pages 15, 17, 29 |
| Lave (dé de Péril) | 1 PV | Pages 14, 16, 29 |
| Trébucher (si dépassé) | 1 PV | Page 14 |
| Guérir (capacité) | 2 PV | Page 27 (2 icônes cœurs) |
| Ranimer (à terre) | 1 PV | Page 27 (1 icône cœur) |
| Ranimer (actif) | 3 PV | Page 27 (3 icônes cœurs) |
| Attaque Gardien | 1 PV | Page 21 |
| Fuite | 1 PV par Gardien | Page 21 |
| Grenade (allies on target) | 1 PV | Page 27 |

### Table de difficulté officielle (corrigée)
| Explorateurs | Débutant | Normal | Avancé | Expert |
|:---:|:---:|:---:|:---:|:---:|
| 3 | 27 | 26 | 22 | 20 |
| 4 | 22 | 19 | 16 | 14 |
| 5 | 24 | 21 | 18 | 16 |
| 6 | 20 | 17 | 14 | 12 |

### Bugs critiques du code actuel à ne pas reproduire
1. `endGameTurn` cassé si le Chef d'Expédition (orderIndex 0) est mort/évadé → utiliser un compteur de joueurs traités
2. Double-activation des Gardiens quand un Gardien se déplace vers une tuile pas encore traitée → tracker par ID
3. Gardiens non retournés au pool lors d'un retournement de tuile Volcan → mettre à jour pool.available/inPlay
4. Piège à fléchettes ne propage pas les dégâts aux tuiles adjacentes connectées → propager
5. Dégâts de Péril n'affectent que les Explorateurs actifs (pas les à terre) → inclure les à terre
6. Érudite et Aventurière totalement non implémentées → implémenter
7. Artefact déposé impossible à ramasser → permettre le ramassage
8. Explorateurs évadés/morts ne lancent pas le dé de Péril → implémenter
9. Bouclier (Se préparer) retiré trop tôt (fin du propre tour au lieu du début du prochain) → corriger
10. Ordonner contourne performMove (pas de pièges, pas de fuite) → utiliser performMove
