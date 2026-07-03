# Sub Terra II — Au bord de l'enfer (version web)

Adaptation web jouable du jeu de plateau coopératif **Sub Terra II** d'Inside the Box Board Games (version française Nuts! Publishing). Jouable en **hotseat** (écran partagé) de **1 à 6 joueurs**, avec les **règles officielles complètes**.

> ⚠️ Ce projet est une adaptation amateur pour jouer entre amis. Tout le matériel, les illustrations et les règles originales appartiennent à leurs auteurs (Tim Pinder, Inside the Box Board Games, Nuts! Publishing). Achetez le jeu de société pour soutenir les créateurs.

## 🎮 Jouer

Aucune installation, aucun build. Deux options :

**En local** — ouvrez simplement `index.html` dans un navigateur récent (Chrome, Firefox, Edge).
```bash
# Optionnel : servir via un petit serveur local
npx http-server -p 8000
# puis ouvrez http://localhost:8000
```

**En ligne** — déposez le dossier sur n'importe quel hébergeur statique (GitHub Pages, Netlify, Vercel…). Aucune configuration nécessaire.

## 📋 Règles implémentées (fidèles au manuel)

- **Coopératif 1-6** : équipe de 2 à 6 Explorateurs (en solo, vous contrôlez 3 à 6 Explorateurs ; à 2 joueurs, chacun en contrôle 2).
- **10 Explorateurs** avec leurs 2 capacités chacune (parmi les 20 capacités officielles : Érudite, Aventurière, Agile, Illuminer, Sprinter, Vigilance, Ordonner, Rechercher, Excaver, Consolider, Lunette de visée, Tir de précision, Grenade, Démolir, Anéantir, Se préparer, Guérir, Survivante, Ranimer, Purifier).
- **9 types de tuiles Temple** : Normale, Pont, Clé, Lave, Piège à pics, Piège à fléchettes, Ruines, Gardien, Journal — avec leurs effets à la pose et leurs déclencheurs.
- **Tour de joueur** : 2 Points d'Action (Révéler, Se déplacer, Explorer, Soigner, Manier un objet, Attaquer, Courir, Creuser, capacités spéciales) + « Se dépasser » (1×/tour : −1 PV, +1 PA) + lancer du dé de Péril.
- **Dé de Péril (6 faces)** : Trébucher, Lave, Effondrement, Déclencher un piège, Réveiller un Gardien, Activer les Gardiens.
- **PV et états** : actif → à terre (PV = 0, ne peut que Ramper) → mort (lave/éruption).
- **Gardiens (Légion Cendrée)** : IA officielle — 1. Attaquer → 2. Se déplacer vers le plus proche → 3. Creuser un Éboulis. Fuite d'une tuile avec Gardien = −1 PV par Gardien. Activés 2× en fin de tour de jeu.
- **Artefact & Malédiction** : sac vide → pose du Sanctuaire dans la colonne la plus profonde → 3 Clés pour déverrouiller → Artefact → la malédiction active (2 dés de Péril/tour, éruption +2 cases/tour).
- **Volcan** : piste d'éruption, déclenchement, propagation de la lave (retournement des tuiles).
- **4 niveaux de difficulté** (Débutant, Normal, Avancé, Expert) avec la table officielle de position de départ du marqueur Éruption selon le nombre d'Explorateurs.
- **Fin de partie** : victoire si un Explorateur ressort avec l'Artefact (médailles Légendaire / Or / Argent / Bronze selon les survivants) ; défaite si tous sont à terre/morts ou si l'Artefact est englouti (« Oubliés à jamais »).

## 🎨 Visuels

- **Tuiles officielles** : les 8 types de tuiles Temple (Normale, Pont, Clé, Lave, Pics, Fléchettes, Ruines, Gardien) utilisent les **vraies images du jeu**, fournies par l'utilisateur. Les murs sont figés dans chaque image ; le moteur détecte automatiquement la configuration des murs (analyse des bords sombres) et pivote la tuile au placement pour établir les connexions correctes.
- **Art officiel** : illustration de couverture du jeu (écran-titre).
- **Composants vectoriels (SVG)** : marqueurs (Éboulis, Clé, Consolidation, Démolition), dés (Péril + combat), meeples, plateau Volcan, et tuiles spéciales (Entrée, Latérales, Sanctuaire) qui n'ont pas encore d'image dédiée.

## 🕹️ Commandes

- **Clic sur une action** (barre du bas) → puis **clic sur une case/arête surlignée** pour cibler.
- **Glisser** le plateau pour le déplacer, **molette** ou boutons +/− pour zoomer.
- **Bouton « Lancer le dé de Péril »** pour terminer son tour.
- **Journal** (en bas à droite) : replie/déplie l'historique des événements.

## 🗂️ Structure

```
subterra/
  index.html              Écrans : titre → règles → setup → jeu → fin
  css/style.css           Thème volcanique (terre/lave/cendre/or)
  js/
    data/
      tiles.js            30 tuiles Temple + Entrée/Latérales/Sanctuaire/Journal
      explorers.js        10 Explorateurs + 20 capacités
      perils.js           6 faces du dé de Péril
    engine/
      board.js            Grille, murs, connectivité BFS, placement, ligne de vue
      game.js             État, tour, actions, PV, objets, artefact, fin
      guardians.js        IA des Gardiens
      volcano.js          Piste d'éruption + propagation de lave
    ui/
      render.js           Plateau SVG (tuiles, murs, meeples, marqueurs, pan/zoom)
      hud.js              Panneau joueur actif + équipe + piste Volcan
      actions.js          Barre d'actions contextuelle
      dice.js             Dés de Péril (animation)
      log.js              Journal + toasts + modales
    main.js               Orchestrateur (transitions, ciblages, boucle)
  assets/images/          Art officiel (couverture)
  tests/                  Tests moteur + navigateur headless
```

## 🧪 Tests

```bash
# Tests de logique du moteur (sans navigateur)
node tests/engine-test.mjs

# Tests navigateur headless (nécessite un serveur local + Playwright)
npx http-server -p 8765 &
node tests/browser-test.mjs
```

## 📝 Notes de conception

- **Connectivité** : deux tuiles adjacentes sont « connectées » ssi l'arête partagée est ouverte des deux côtés (pas de mur). Les BFS gèrent déplacement, IA des Gardiens et ligne de vue.
- **Convention des murs** : `walls[dir] = true` signifie « ouvert » (pas de mur), `false` signifie « mur ».
- **Tuiles multi-cases** (Entrée, Latérales, Sanctuaire) traitées comme cases indépendantes mais placées en groupe.
- **IA des Gardiens** : détermine la cible la plus proche par chemin le plus court (BFS), puis attaque / se déplace / creuse selon la priorité officielle.

## 🔧 Limitations connues

- Les portraits d'Explorateurs sont des avatars vectoriels colorés (glyphe + couleur), pas les illustrations originales (trop fragmentaires à extraire proprement du PDF).
- Le « Chef d'Expédition » arbitre certaines décisions (cible d'attaque, direction des Gardiens) ; ici résolu automatiquement de façon simple (aléatoire / plus proche), car il n'y a pas de vote entre joueurs humains en hotseat.
