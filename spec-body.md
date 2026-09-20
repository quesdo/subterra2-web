## Problem Statement

L'adaptation web actuelle de Sub Terra II contient 30 erreurs et 7 règles manquantes par rapport au manuel officiel. Les bugs vont de montants de dégâts incorrects (Piège à pics codé à 2 PV au lieu de 3, Effondrement codé à 2 PV au lieu de 5) à des mécaniques structurelles cassées (la fin de tour de jeu ne se déclenche plus si le Chef d'Expédition est mort, double-activation des Gardiens, 2 capacités sur 20 totalement inimplémentées, table de difficulté permutée pour 4-5 joueurs). De plus, le multijoueur en ligne mentionné dans le README n'existe pas. Les joueurs ne peuvent pas jouer une partie fidèle aux règles officielles.

## Solution

Réécriture complète from scratch du projet en vanilla JS (ES modules, pas de build, pas de framework). Architecture en 4 couches séparées : Moteur pur (logique de jeu testable sans UI) → Couche réseau (PeerJS, hôte-authoritaire) → Couche UI (rendu SVG, HUD, actions, dés, journal, modals Chef d'Expédition) → Orchestrateur (transitions d'écran, boucle de jeu). Les trois modes de jeu (solo multi-persos, hotseat, multijoueur en ligne) partagent le même moteur.

## User Stories

### Moteur de jeu (logique pure)
1. As a developer, I want a pure game engine (no DOM dependency) so that I can test it with Node.js + assert
2. As a player, I want the 30 Temple tiles (Normale x3, Pont x2, Clé x3, Lave x5, Pics x3, Fléchettes x4, Ruines x6, Gardien x4) + 3 Journal tiles + special tiles (Entrée, Latérales, Sanctuaire) to be placed according to the official rules
3. As a player, I want each tile to have its correct placement effect (Clé→Key marker, Ruines→Rubble marker, Gardien→Guardian placed)
4. As a player, I want tile connectivity to be calculated by BFS (adjacent + no wall on either side)
5. As a player, I want line of sight to work in straight lines, blocked by walls and rubble
6. As a player, I want tile placement to be forbidden behind or beyond the Latérales tiles (explicit rule, not just implicit via walls)
7. As a player, I want the "totally blocked" fallback to discard unplaceable tiles and place the Sanctuary
8. As a player, I want to destroy adjacent walls with the Démolir ability (places a Démolition marker, the wall no longer exists)
9. As a player, I want each player turn to have 2 steps: (A) actions with 2 AP, (B) roll 1 Peril die
10. As a player, I want the end of game turn to activate all Guardians 2× then advance the Eruption marker by 1 space
11. As a player, I want to perform the 8 official actions: Révéler (1 AP), Se déplacer (1 AP), Explorer (1 AP), Soigner (1 AP), Attaquer (1 AP), Creuser (2 AP), Courir (2 AP), Manier un objet (1 AP)
12. As a player, I want "Manier un objet" to include: pick up, take from another Explorer (with agreement), give to another Explorer, drop on tile
13. As a player, I want an Explorer to hold only one object at a time
14. As a player, I want to be able to pick up a dropped Artifact from the ground (not just from the Sanctuary)
15. As a player, I want to "se dépasser" once per turn: lose 1 HP, gain 1 extra AP
16. As a player, I want my turn to end immediately if my Explorer is downed (0 HP) mid-turn
17. As a player, I want a downed Explorer to only be able to Crawl (move 1 tile), not push beyond, but keep passive abilities
18. As a player, I want a downed Explorer healed by an ally to become active again
19. As a player, I want Peril damage to affect ALL Explorers (active AND downed)
20. As a player, I want escaped Explorers to continue rolling the Peril die (if they get Réveiller/Activer Gardiens, treated as at the Entrance)
21. As a player, I want dead Explorers to continue rolling the Peril die (treated as at the Entrance for Réveiller/Activer)
22. As a player, I want the Peril die to have 6 correct faces: Trébucher, Lave, Effondrement, Déclencher un piège, Réveiller un Gardien, Activer les Gardiens
23. As a player, I want Trébucher to deal 1 extra HP loss if I pushed beyond this turn
24. As a player, I want Lave to deal 1 HP damage to ALL Explorers on a Lava tile (including downed)
25. As a player, I want Effondrement to roll the die and collapse the matching Ruines tile without rubble (5 HP damage to Explorers, Guardians eliminated, rubble placed)
26. As a player, I want Déclencher un piège to trigger the Spike trap on my tile (3 HP) AND Dart traps on my tile + adjacent connected tiles (1 HP per affected tile)
27. As a player, I want Réveiller un Gardien to place a Guardian on the nearest Guardian tile (max 5 in play)
28. As a player, I want Activer les Gardiens to activate all Guardians in play once
29. As a player, I want Guardians to follow the official priority: 1. Attack (1 HP, active target) → 2. Move (toward nearest active Explorer, blocked by rubble) → 3. Dig (remove adjacent rubble)
30. As a player, I want a Guardian eliminated by a Volcan tile flip to return to the reserve (no resource leak)
31. As a player, I want a Guardian to be activated only once per activation phase (no double activation if it moves to an unprocessed tile)
32. As a player, I want fleeing a tile with Guardians to cost 1 HP per Guardian present
33. As a player, I want Guardians to be immune to traps and lava (non-flipped tiles)
34. As a player, I want Guardians to be able to enter a Pont tile even if occupied by an Explorer
35. As a player, I want the Eruption marker to advance 1 space per game turn (2 with the curse)
36. As a player, I want the volcano to be ready to erupt when the marker reaches 0, triggering on the next Lave symbol rolled
37. As a player, I want the eruption to flip the Volcan board: if the Sanctuary is undiscovered or the Artifact hasn't left, the game is lost
38. As a player, I want the Sanctuary to be flipped to its Volcan side during eruption (even if the Artifact has escaped)
39. As a player, I want lava to spread: flip connected and adjacent Temple tiles to Volcan side
40. As a player, I want the Entrance and Latérales to flip as a group during lava propagation
41. As a player, I want lava to spread 2× per game turn with the curse (not 1×)
42. As a player, I want the curse (taking the Artifact) to require rolling 2 Peril dice per Explorer turn
43. As a player, I want the Sanctuary to be placed in the farthest column from the Entrance when the bag is empty
44. As a player, I want to bring 3 Keys to the Sanctuary (1 Manier un objet action per Key) to unlock it
45. As a player, I want the Artifact to appear on the Sanctuary after 3 Keys and be pickable like any object
46. As a player, I want to win if an Explorer escapes with the Artifact (medals: Légendaire=0 dead, Or=1 dead, Argent=2 dead, Bronze=3+ dead)
47. As a player, I want to lose if all Explorers are downed/dead, or if the Artifact is swallowed by lava ("Oubliés à jamais")
48. As a player, I want the difficulty table to be correct: 3p={27,26,22,20}, 4p={22,19,16,14}, 5p={24,21,18,16}, 6p={20,17,14,12}
49. As a player, I want solo mode to allow controlling 3 to 6 Explorers
50. As a player, I want 2-player mode to have each player control 2 Explorers

### Explorer Abilities (20 abilities)
51. As a player, I want the 10 Explorers to have their 2 correct abilities each
52. As a player, I want Érudite (passive) to let me draw 2 tiles, choose 1, put the other back
53. As a player, I want Aventurière (active, costs 1 HP) to let me reroll any die
54. As a player, I want Agile (passive) to let me ignore rubble during Se déplacer/Courir/Explorer
55. As a player, I want Illuminer (1 AP) to perform 2× Révéler
56. As a player, I want Sprinter (1 AP) to perform 2× Se déplacer
57. As a player, I want Vigilance (passive) to protect other Explorers on my tile from traps
58. As a player, I want Ordonner (1 AP) to make a non-downed Explorer perform a Se déplacer action (with movement effects: traps, fleeing)
59. As a player, I want Rechercher (1 AP, x3 uses) to place a Journal tile connected to any Temple tile
60. As a player, I want Excaver (1 AP) to perform a Creuser action with no additional AP cost
61. As a player, I want Consolider (1 AP, x4 uses) to make my tile permanently Normal
62. As a player, I want Lunette de visée (1 AP) to reveal a tile in line of sight at ≤3 tiles
63. As a player, I want Tir de précision (1 AP) to eliminate an enemy in line of sight at ≤3 tiles (not on my tile)
64. As a player, I want Grenade (1 AP) to eliminate ALL enemies on an adjacent connected tile (1 HP damage to Explorers on that tile)
65. As a player, I want Démolir (1 AP, x3 uses) to destroy an adjacent wall (place a Démolition marker)
66. As a player, I want Anéantir (1 AP) to eliminate an enemy on my tile
67. As a player, I want Se préparer (1 AP) to make me immune to HP loss until the start of my next turn (pushing beyond still costs HP, can't reuse next turn)
68. As a player, I want Guérir (1 AP) to heal a visible Explorer at ≤2 tiles by 2 HP
69. As a player, I want Survivante (passive) to make me regain 1 HP on Trébucher instead of the normal effect (always, not just if pushed)
70. As a player, I want Ranimer (1 AP) to heal another Explorer: 1 HP if downed, 3 HP if active
71. As a player, I want Purifier (1 AP) to eliminate all enemies on another tile

### Expedition Leader Decisions
72. As an Expedition Leader, I want to choose which target a Guardian attacks (if multiple Explorers on the tile)
73. As an Expedition Leader, I want to choose a Guardian's direction if multiple targets/paths at equal distance
74. As an Expedition Leader, I want to choose the activation order of Guardians
75. As an Expedition Leader, I want to choose which Guardian tile receives a Guardian in case of a distance tie

### Hotseat Mode
76. As a hotseat player, I want turns to pass from player to player on the same screen
77. As a hotseat player, I want the Expedition Leader to be designated at setup and arbitrate decisions
78. As a hotseat player, I want the screen to display the active player, their HP, AP, and items

### Online Multiplayer (PeerJS)
79. As an online player, I want to create or join a game via a PeerJS code/link
80. As a host (Expedition Leader), I want my client to compute game state and broadcast to other players
81. As a client, I want to send my actions to the host and receive updated state
82. As an online player, I want to see the board, other Explorers, and event log in real time
83. As an online player, I want Expedition Leader decisions to appear as interactive modals

### UI / Rendering
84. As a player, I want an SVG board rendering with tiles, walls, meeples, markers, pan/zoom
85. As a player, I want a contextual action bar showing available actions based on my state and AP
86. As a player, I want to see the Volcano track and Eruption marker
87. As a player, I want a collapsible event log
88. As a player, I want animated dice (Peril and combat)
89. As a player, I want screen transitions: title → rules → setup → game → end
90. As a mobile player, I want the interface to adapt to touch

## Implementation Decisions

### Architecture: 4 separated layers

The rewrite separates concerns into four layers, each building on the one below:

**Layer 1 — Game Engine (pure, no DOM)**
The engine is a pure state machine. It takes a serializable game state and an action, returns a new state. No side effects, no DOM, no network. This is the single testing seam. Modules:
- `state.js` — Serializable game state (create, serialize, deserialize for PeerJS sync)
- `actions.js` — The 8 actions + se dépasser (AP costs, validation, execution)
- `abilities.js` — The 20 Explorer abilities (passive and active)
- `tiles.js` — Data for 33 tiles (30 Temple + 3 Journal) + special tiles (Entrée, Latérales, Sanctuaire)
- `explorers.js` — Data for 10 Explorers + 20 abilities
- `perils.js` — 6 Peril die faces + resolution with exact damage amounts
- `board.js` — Grid, walls, BFS connectivity, line of sight, tile placement, Latérales constraint, "totally blocked" fallback
- `guardians.js` — Guardian AI (official priority, pool of 5, no double activation, flee damage, immunity)
- `volcano.js` — Eruption track, eruption trigger, lava propagation (including Entrance/Latérales as group, 2× with curse)
- `artefact.js` — Sanctuary placement, 3 Keys, Artifact, curse activation
- `turn.js` — Turn structure (player + game turn), robust endGameTurn via processed-player counter
- `endgame.js` — Victory/defeat conditions, medals, "Oubliés à jamais"
- `difficulty.js` — Corrected difficulty table for 3-6 Explorers

**Layer 2 — Network (PeerJS)**
- `host.js` — Authoritative host: receives actions, computes state via engine, broadcasts
- `client.js` — Client: sends actions to host, receives state updates
- `sync.js` — Serialization/deserialization of game state for PeerJS transport
- `signaling.js` — PeerJS configuration (signaling server)

**Layer 3 — UI (SVG rendering + DOM)**
- `render.js` — SVG board (tiles, walls, meeples, markers, pan/zoom)
- `hud.js` — Active player panel + team + Volcano track
- `actions.js` — Contextual action bar
- `dice.js` — Animated dice (Peril + combat)
- `log.js` — Event log
- `modals.js` — Expedition Leader decision modals
- `screens.js` — Screen transitions: title → rules → setup → game → end

**Layer 4 — Orchestrator**
- `main.js` — Orchestrator: wires engine + UI + network, manages game loop and modes (hotseat/multi)

### Key design decisions

- **Serializable game state**: the entire state is a plain JSON object with no circular references, enabling PeerJS sync. The state schema (derived from prototyping the engine API):

```javascript
{
  turn: number,
  phase: 'setup' | 'explorerTurn' | 'perilPhase' | 'endGameTurn' | 'gameOver',
  currentExplorerIdx: number,
  explorers: [{
    id, name, roleId, hp, maxHp,
    state: 'active' | 'down' | 'dead' | 'escaped',
    x, y, item: 'key' | 'artifact' | null,
    pushedThisTurn, shielded,
    abilityCooldown: {}, abilityUsesLeft: {},
  }],
  board: { cells: Map<string, Cell>, entry: Cell[], laterals: Cell[], sanctuary: Cell | null },
  tileBag: string[], journalBag: string[],
  guardians: { pool: { available, inPlay }, guardians: [{ id, x, y, activatedThisPhase }] },
  volcano: { position, cursed, erupting, erupted },
  keysPlacedOnSanctuary, artifactRetrieved, artifactEscaped, curseActive,
  winner: 'players' | 'game' | null, medal: string | null,
  log: string[],
}
```

- **Host-authoritative multiplayer**: only the host (Expedition Leader) runs the engine. Clients send action intents, host validates and broadcasts the full state. Prevents desync and cheating.
- **Robust endGameTurn**: uses a counter of processed players, not array index comparison. Works even if the Expedition Leader (first in turn order) is dead or escaped.
- **Guardian activation tracking**: each Guardian has a unique ID and an `activatedThisPhase` flag, reset at the start of each activation phase. Prevents double activation when a Guardian moves to an unprocessed tile.
- **Guardian pool management**: eliminated Guardians (by attack, ability, collapse, or Volcan flip) always return to the pool. `pool.available` and `pool.inPlay` are updated on every elimination path.
- **Exact damage amounts** (confirmed from PDF icon analysis):
  - Spike trap: 3 HP
  - Collapse (Ruines): 5 HP
  - Dart trap: 1 HP per affected tile (tile + adjacent connected tiles)
  - Lava (Peril die): 1 HP to all on lava tiles (including downed)
  - Trébucher (if pushed): 1 HP
  - Guérir: 2 HP
  - Ranimer: 1 HP if downed, 3 HP if active
  - Guardian attack: 1 HP
  - Fleeing: 1 HP per Guardian on the tile
  - Grenade (allies on target tile): 1 HP
- **Peril damage scope**: all Peril effects (Lava, Collapse, Spike, Dart) affect ALL Explorers on the relevant tiles, including downed ones. Only Vigilance and Shield protect.
- **Escaped/dead Explorers**: still roll the Peril die each turn. If they roll Réveiller/Activer Gardiens, they are treated as if at the Entrance for Guardian placement/activation purposes.
- **Shield timing**: the Shield from Se préparer persists until the start of the Explorer's next turn, protecting through all other players' turns and their Peril rolls. It is NOT removed at the end of the Explorer's own turn.
- **Ordonner**: uses the same move function as Se déplacer, triggering spike traps on entry and fleeing damage from Guardians on the origin tile.
- **Excaver**: performs a Creuser action without charging additional AP beyond the ability's 1 AP cost.
- **Grenade**: uses removeAllGuardians (not removeGuardian) to eliminate all enemies on the target tile.
- **Difficulty table** (corrected):

| Explorers | Débutant | Normal | Avancé | Expert |
|:---:|:---:|:---:|:---:|:---:|
| 3 | 27 | 26 | 22 | 20 |
| 4 | 22 | 19 | 16 | 14 |
| 5 | 24 | 21 | 18 | 16 |
| 6 | 20 | 17 | 14 | 12 |

## Testing Decisions

### Testing seam: the engine API

The single testing seam is the engine's `(state, action) → newState` interface. All game logic is tested through this one seam. No UI or network testing in this phase.

A good test:
- Creates a known game state via `createGameState` with specific setup
- Applies an action (move, reveal, attack, ability, peril roll, etc.)
- Asserts the resulting state (HP, positions, tile placement, Guardian positions, volcano position, game phase, winner, etc.)
- Tests external behavior (what the state looks like after an action), not implementation details (which internal function was called)
- Covers the nominal case + edge cases (downed Explorer, dead Explorer, escaped Explorer, empty bag, full Guardian pool, curse active, volcano erupted, etc.)

### Modules to test (all via the engine seam)

- **Board**: tile placement, BFS connectivity, line of sight, Latérales constraint, "totally blocked" → Sanctuary placement, wall destruction
- **Actions**: each of the 8 actions (AP cost, validation, execution), se dépasser, turn ends immediately if downed mid-turn, object transfer between Explorers, artifact pickup from ground
- **Guardians**: official priority (attack > move > dig), pool of 5, no double activation, flee damage, immunity to traps/lava, Pont tile entry, eliminated Guardians return to pool (including via Volcan flip)
- **Volcano**: eruption track, eruption trigger on Lava symbol, Sanctuary flip, lava propagation (adjacent connected tiles, Entrance/Latérales as group), 2× propagation with curse
- **Perils**: all 6 faces with exact damage amounts, damage affects downed Explorers, escaped/dead Explorers roll Peril, Survivor heal on Trébucher
- **Abilities**: all 20 abilities (passive vs active, limited uses, exact effects), Vigilance protects allies on same tile, Shield timing, Excaver no double charge, Grenade removes all, Ranimer 1/3 HP, Guérir 2 HP, Ordonner triggers move effects
- **Endgame**: victory with Artifact escape + medal levels, defeat (all downed/dead, Artifact swallowed), "Oubliés à jamais"
- **Difficulty**: correct values for 3-6 Explorers at all 4 levels
- **Turn**: endGameTurn robustness when Expedition Leader is dead/escaped, Guardian activation 2× at end of turn, Eruption advance

### Prior art

The existing repo has `tests/engine-test.mjs` (Node.js tests using `assert`) and `tests/browser-test.mjs` (Playwright). The rewrite follows the same pattern: `.mjs` files with `import` and `node:assert`, run via `node tests/run-all.mjs`.

## Out of Scope

- Native mobile app (the game is playable in a mobile browser via responsive design)
- AI for solo mode (solo = manually controlling multiple Explorers in hotseat)
- Statistics, leaderboards, game saves, user accounts (ephemeral games, like the board game)

## Further Notes

### Damage amounts confirmed from PDF icon analysis

The PDF uses heart icons (9x8px) to indicate damage amounts. These are not extracted by text parsing. Pixel-position analysis of the icons on pages 14, 15, 16, 17, 27, and 29 confirmed:

| Effect | Amount | PDF source pages |
|--------|--------|-------------------|
| Spike trap (Piège à pics) | 3 HP | 15, 16, 29 (3 heart icons) |
| Collapse (Effondrement) | 5 HP | 14, 17, 29 (5 heart icons) |
| Dart trap (Piège à fléchettes) | 1 HP per tile | 15, 17, 29 |
| Lava (Peril die) | 1 HP | 14, 16, 29 |
| Trébucher (if pushed) | 1 HP | 14 |
| Guérir (ability) | 2 HP | 27 (2 heart icons) |
| Ranimer (downed) | 1 HP | 27 (1 heart icon) |
| Ranimer (active) | 3 HP | 27 (3 heart icons) |
| Guardian attack | 1 HP | 21 |
| Fleeing | 1 HP per Guardian | 21 |
| Grenade (allies on target) | 1 HP | 27 |

### Critical bugs from the current codebase to avoid

1. endGameTurn broken if Expedition Leader (orderIndex 0) is dead/escaped → use a processed-player counter
2. Double Guardian activation when a Guardian moves to an unprocessed tile → track by ID with activatedThisPhase flag
3. Guardians not returned to pool on Volcan tile flip → update pool on every elimination path
4. Dart trap doesn't propagate damage to adjacent connected tiles → propagate
5. Peril damage only affects active Explorers (not downed) → include downed
6. Érudite and Aventurière completely unimplemented → implement
7. Dropped Artifact cannot be picked up → allow pickup from ground
8. Escaped/dead Explorers don't roll Peril die → implement
9. Shield removed too early (end of own turn instead of start of next) → fix timing
10. Ordonner bypasses performMove (no traps, no fleeing) → use the same move function
