## Problem Statement

Le moteur de jeu Sub Terra II est réécrit from scratch et fonctionne en hotseat (265 tests passent, frontend jouable). Cependant, le multijoueur en ligne n'est pas encore implémenté. Les joueurs ne peuvent pas jouer ensemble à distance — chacun doit être devant le même écran. Le code original avait une couche PeerJS (`js/net/peer.js`, `multiplayer.js`, `serialize.js`) et un lobby (`js/ui/lobby.js`), mais ces fichiers ne sont pas portés vers la nouvelle architecture `src/`.

## Solution

Implémenter la couche réseau PeerJS (P2P, hôte-authoritaire) dans la nouvelle architecture `src/`. L'hôte (Chef d'Expédition) calcule l'état du jeu et le broadcast aux clients après chaque action. Les clients envoient leurs actions à l'hôte et reçoivent l'état complet mis à jour. Un lobby avec setup intégré permet de créer/rejoindre une partie et d'attribuer les Explorateurs. En cas de déconnexion, l'Explorateur du joueur manquant passe en mode "auto" (actions basiques gérées par l'hôte).

## User Stories

### Lobby & Connexion
1. En tant que joueur, je veux un écran titre avec deux boutons : "Jouer en local (hotseat)" et "Jouer en ligne"
2. En tant que joueur en ligne, je veux créer un salon et obtenir un code partageable (ex: ST-AB7K)
3. En tant que joueur en ligne, je veux rejoindre un salon en saisissant le code + mon pseudo
4. En tant qu'hôte, je veux voir la liste des joueurs connectés en temps réel dans le lobby
5. En tant que joueur, je veux copier le code du salon d'un clic pour le partager
6. En tant qu'hôte, je veux choisir la difficulté (Débutant/Normal/Avancé/Expert) dans le lobby
7. En tant que joueur dans le lobby, je veux voir les Explorateurs disponibles et les sélectionner
8. En tant que joueur dans le lobby, je veux voir en temps réel quels Explorateurs sont choisis par les autres joueurs
9. En tant qu'hôte, je veux attribuer manuellement les Explorateurs aux joueurs (comme le jeu physique : 3-6 Explorateurs répartis entre les joueurs présents)
10. En tant qu'hôte, je veux un bouton "Lancer la partie" qui démarre le jeu pour tous les joueurs connectés
11. En tant que client, je veux être automatiquement redirigé vers l'écran de jeu quand l'hôte lance la partie

### Attribution des Explorateurs
12. En tant que joueur, je veux contrôler 1 ou plusieurs Explorateurs selon la répartition choisie par l'hôte
13. En tant que joueur, je veux que l'attribution Explorateur↔joueur soit visible dans le lobby avant le lancement
14. En tant que joueur, je veux que l'ordre de tour suive l'ordre des Explorateurs (comme en hotseat)
15. En tant que joueur avec plusieurs Explorateurs, je veux que mes Explorateurs jouent consécutivement (pas en intercalé avec les autres joueurs)

### Synchronisation de l'état
16. En tant qu'hôte, je veux que mon client calcule l'état du jeu avec le moteur pur et le broadcast après chaque action
17. En tant que client, je veux envoyer mes actions à l'hôte (déplacement, révélation, attaque, capacité, fin de tour, etc.)
18. En tant que client, je veux recevoir l'état complet du jeu après chaque action et le re-render intégralement
19. En tant que joueur, je veux voir le plateau, les Explorateurs, le HUD et le journal en temps réel
20. En tant que client, je veux que mon interface se mette à jour immédiatement après chaque action de n'importe quel joueur
21. En tant que joueur, je veux que seules les actions de mon Explorateur actif soient autorisées (les autres sont grisées)
22. En tant qu'hôte, je veux voir les actions des clients arrivées et les exécuter dans l'ordre

### Pioche de tuiles & aléatoire
23. En tant que joueur, je veux que la pioche de tuiles soit gérée côté hôte (le seul qui génère l'aléatoire)
24. En tant que joueur avec la capacité Érudite, je veux que l'hôte me montre 2 tuiles piochées et me laisse en choisir 1
25. En tant que joueur avec la capacité Aventurière, je veux pouvoir demander un reroll de dé à l'hôte (coûte 1 PV)
26. En tant que joueur, je veux que le dé de Péril soit lancé côté hôte et le résultat diffusé à tous

### Décisions du Chef d'Expédition
27. En tant qu'hôte (Chef d'Expédition), je veux recevoir une modal interactive quand une décision est requise (cible d'un Gardien, direction d'un Gardien, ordre d'activation, tuile Gardien pour Réveiller)
28. En tant que client, je veux voir les décisions du Chef d'Expédition en temps réel sur mon écran (sans pouvoir interagir)
29. En tant que joueur, je veux que les décisions du Chef soient appliquées et diffusées à tous les clients

### Déconnexion & Reconnexion
30. En tant que joueur, si un autre joueur se déconnecte, je veux que son Explorateur passe en mode "auto" (l'hôte gère des actions basiques : se déplacer vers la sortie, attaquer les Gardiens adjacents)
31. En tant que joueur, si je me déconnecte puis me reconnecte avec le même code salon, je veux reprendre le contrôle de mes Explorateurs
32. En tant que joueur, je veux voir un indicateur visuel sur les Explorateurs en mode "auto" (icône robot/🤖)
33. En tant qu'hôte, je veux voir un toast quand un joueur se déconnecte et quand un joueur se reconnecte

### Sécurité & Validation
34. En tant qu'hôte, je veux valider chaque action reçue d'un client (le client ne peut agir que si c'est le tour de son Explorateur, et l'action est légale)
35. En tant qu'hôte, je veux ignorer les actions illégales envoyées par un client (PA insuffisant, case invalide, etc.)
36. En tant que joueur, je ne peux pas modifier l'état du jeu directement côté client (toute modification passe par l'hôte)

### Fin de partie
37. En tant que joueur, je veux voir l'écran de fin (victoire/défaite + médaille) en même temps que tous les autres joueurs
38. En tant que joueur, je veux qu'après la fin de partie, le salon reste ouvert pour rejouer (retour au lobby)
39. En tant que joueur, je veux un bouton "Quitter" pour revenir à l'écran titre et fermer la connexion PeerJS

## Implementation Decisions

### Architecture réseau (couche 2)

```
src/net/
  peer.js         PeerJS wrapper : créer/rejoindre salon, envoyer/recevoir messages
  host.js         Hôte-authoritaire : reçoit actions, exécute le moteur, broadcast l'état
  client.js       Client : envoie actions, reçoit état, re-render
  sync.js         Sérialisation/désérialisation de l'état (Map → array → Map)
  lobby.js        Logique du lobby : liste joueurs, attribution Explorateurs, lancement
  auto-player.js  IA basique pour les Explorateurs de joueurs déconnectés
```

### Protocole de messages

```
Client → Hôte:
  { type: 'hello', name: string }
  { type: 'action', actionId: string, args: object }
  { type: 'ability', abilityId: string, args: object }
  { type: 'perilRoll' }
  { type: 'chefDecision', decisionId: string, choice: any }
  { type: 'rerollRequest', dieId: string }  // Aventurière
  { type: 'tileChoice', tileId: string }    // Érudite (choix parmi 2 tuiles)
  { type: 'reconnect', playerId: string }

Hôte → Client(s):
  { type: 'welcome', roomCode: string, playerId: string }
  { type: 'lobbyUpdate', players: [...], explorers: [...], difficulty: string }
  { type: 'gameStarting', config: object }
  { type: 'gameState', state: serializedGameState }
  { type: 'chefDecisionRequest', decisionId: string, prompt: string, options: [...] }
  { type: 'chefDecisionResult', decisionId: string, choice: any }
  { type: 'perilRollResult', face: string, effects: [...] }
  { type: 'tileChoiceRequest', tiles: [tileDef, tileDef] }  // Érudite
  { type: 'playerDisconnected', playerId: string }
  { type: 'playerReconnected', playerId: string }
  { type: 'gameOver', result: object }
```

### État sérialisable

Le `src/engine/state.js` produit déjà un état JSON pur (objet plat avec `board.cells` en Map). La sérialisation convertit la Map en array de paires `[key, cell]` pour le transfert réseau, puis la reconstruit à la réception. La taille estimée de l'état complet est ~50-100KB (30 tuiles + 10 explorateurs + guardians + log), ce que WebRTC DataChannel gère sans problème.

### Attribution Explorateur↔Joueur

```javascript
state.playerAssignments = [
  { playerId: 'host', explorerIds: ['aristocrat', 'sniper'] },
  { playerId: 'peer-abc123', explorerIds: ['sapper'] },
  { playerId: 'peer-def456', explorerIds: ['nurse', 'miner'] },
];
```

L'hôte définit cette attribution dans le lobby et l'envoie dans `gameStarting`. Chaque client sait quels Explorateurs il contrôle via `playerId`. L'ordre des tours suit l'ordre des Explorateurs dans `state.explorers` (inchangé par rapport au hotseat).

### Hôte-authoritaire

- L'hôte est le seul à exécuter `src/engine/*.js`
- Les clients envoient des demandes d'action, jamais d'état
- L'hôte valide : est-ce le tour de cet Explorateur ? Le joueur qui demande contrôle-t-il cet Explorateur ? L'action est-elle légale ?
- Si validation OK → exécute l'action → broadcast le nouvel état
- Si validation KO → ignore (optionnellement toast d'erreur côté client)

### IA basique (auto-player)

Quand un joueur se déconnecte, l'hôte active `auto-player.js` pour ses Explorateurs :
- Si un Gardien est adjacent → Attaquer
- Sinon → Se déplacer vers l'Entrée (BFS le plus court chemin)
- En fin de tour → lancer le dé de Péril (automatique)
- Pas d'utilisation de capacités actives (trop complexe pour l'auto)
- Les Explorateurs en mode auto sont marqués visuellement (🤖 sur le meeple)

### Reconnexion

- Le `playerId` est généré à la première connexion et stocké côté client (localStorage)
- Si un joueur se déconnecte puis revient avec le même code salon + même playerId, l'hôte restaure ses Explorateurs (retire le mode auto)
- Si le salon n'existe plus (hôte déconnecté), le client affiche "Salon introuvable"

### Serveur de signalisation PeerJS

Utilisation du broker public PeerJS (`0.peerjs.com`) par défaut. Aucun backend à maintenir. Si la disponibilité est un problème, un serveur de signalisation auto-hébergé peut être déployé plus tard (out of scope pour cette PRD).

### Lobby UI

Le lobby réutilise l'écran setup existant avec des ajouts :
- En haut : code du salon + bouton copier (hôte) / champ de connexion (client)
- Liste des joueurs connectés avec leurs avatars
- Grille des 10 Explorateurs : l'hôte clique pour attribuer un Explorateur à un joueur (menu déroulant ou drag&drop)
- Sélecteur de difficulté (hôte only)
- Bouton "Lancer la partie" (hôte only, désactivé si < 3 Explorateurs attribués)

## Testing Decisions

**Critère de qualité** : la couche réseau est testable sans PeerJS réel (mock des connexions).

**Modules à tester** :
- `sync.js` : sérialisation/désérialisation aller/her retour (état → JSON → état identique)
- `host.js` : validation des actions (action légale/illégale, tour correct, joueur autorisé)
- `auto-player.js` : décision basique (attaquer si Gardien adjacent, sinon déplacer vers Entrée)
- `lobby.js` : attribution Explorateurs (min 3, max 6, pas de doublons)

**Tests existants** : les 265 tests moteur ne sont pas affectés (le moteur est pur, sans dépendance réseau).

**Nouveaux tests** :
```
tests/net/
  sync.test.mjs
  host-validation.test.mjs
  auto-player.test.mjs
```

## Out of Scope

- Serveur de signalisation auto-hébergé (on utilise le broker public PeerJS)
- Chat textuel ou vocal entre joueurs
- Sauvegarde/reprise de partie hors-ligne (partie éphémère)
- Comptes utilisateurs, authentification, classements
- Spectateur (observer mode)
- Mode tournoi
- IA avancée pour les Explorateurs auto (seulement actions basiques : attaquer + déplacer vers sortie)
- Mode "pass-and-play" en ligne (tour par tour asynchrone) — le jeu est synchrone, temps réel

## Further Notes

### Dépendances
- `peerjs` (npm package, ~50KB minifié) — seule dépendance externe ajoutée
- Aucun build step requis (PeerJS fonctionne en ES module via CDN ou npm)

### Risques
1. **Broker PeerJS public** : peut être indisistant occasionnellement. Mitigation : message d'erreur clair + retry. Plus tard : serveur auto-hébergé.
2. **Latence** : l'état complet à chaque action peut être lent sur connexion mauvaise. Mitigation : compression optionnelle (JSON.stringify + gzip si DataChannel le supporte).
3. **Désync** : si l'hôte crash, la partie est perdue. Mitigation : pas de solution simple en P2P ; acceptable pour un jeu de plateau occasionnel.
4. **Triche** : un client malveillant pourrait essayer d'envoyer des actions illégales. Mitigation : l'hôte valide toutes les actions. Un client ne peut pas modifier l'état directement.

### Ordre d'implémentation suggéré
1. `src/net/sync.js` (sérialisation) + tests
2. `src/net/peer.js` (PeerJS wrapper, créer/rejoindre, messages)
3. `src/net/lobby.js` (lobby UI + attribution)
4. `src/net/host.js` (réception actions, exécution, broadcast)
5. `src/net/client.js` (envoi actions, réception état, re-render)
6. `src/net/auto-player.js` (IA basique déconnexion)
7. Intégration dans `src/main.js` (mode local vs online)
8. Tests d'intégration (mock PeerJS)
