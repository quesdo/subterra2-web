## Problem Statement

Le HUD en jeu utilise des images de portrait trop grandes (60px) et le panneau est trop large (232px). Sur un écran de PC portable (13-14", 1366×768 ou 1920×1080), le plateau de jeu est écrasé par le panneau de droite. Les images d'explorateurs (~300-550KB chacune) mettent du temps à charger et s'affichent floues à petite taille. L'ensemble n'est pas responsive — le layout ne s'adapte pas à la taille de l'écran. Les joueurs sur PC portable ont une expérience dégradée.

## Solution

Refonte responsive du layout de jeu : panneau HUD compact et dynamique à droite, plateau SVG qui occupe tout l'espace restant. Tailles proportionnelles (rem/vw) au lieu de pixels fixes. Portraits réduits (40px pour la carte active, 22px pour l'équipe). Images optimisées (CSS `object-fit: cover`, `background-image` au lieu de `<img>` si besoin). Points de rupture (breakpoints) pour portable / desktop / grand écran. Le panneau HUD reste lisible et fonctionnel à toutes les tailles.

## User Stories

### Layout responsive
1. En tant que joueur sur PC portable (1366×768), je veux que le plateau occupe au moins 70% de la largeur de l'écran
2. En tant que joueur sur PC portable, je veux que le panneau HUD fasse au maximum 200px de large pour ne pas écraser le plateau
3. En tant que joueur sur grand écran (1920×1080+), je veux que le HUD reste lisible et ne soit pas ridicule (tout petit dans un coin)
4. En tant que joueur, je veux que le HUD s'adapte dynamiquement à la hauteur de l'écran (scroll si nécessaire, mais sans couper le contenu)
5. En tant que joueur sur tablette (768px), je veux que le HUD passe en bas en barre horizontale compacte
6. En tant que joueur, je veux que la barre d'actions en bas reste visible et accessible à toutes les tailles d'écran
7. En tant que joueur, je veux que le journal d'événements se repositionne intelligemment selon la taille d'écran

### Carte personnage actif
8. En tant que joueur, je veux voir le portrait, nom, PV, PA et capacités du perso actif dans un espace compact
9. En tant que joueur, je veux que le portrait du perso actif soit 40px (pas 60px) pour laisser plus de place au plateau
10. En tant que joueur, je veux que les PV s'affichent en coeurs compacts (12px) sur une ligne
11. En tant que joueur, je veux que les PA s'affichent en gemmes compacts (10px) 
12. En tant que joueur, je veux que les capacités soient sur 2 mini-cartes empilées, chacune tenant sur 1-2 lignes
13. En tant que joueur, je veux voir l'objet porté et le bouclier sans qu'ils prennent une ligne entière

### Équipe
14. En tant que joueur, je veux que chaque membre de l'équipe tienne sur une ligne de 22px de haut (portrait mini + nom + mini PV)
15. En tant que joueur, je veux que les mini-PV de l'équipe soient des points (pas des coeurs complets) pour gagner de la place
16. En tant que joueur, je veux voir l'état de chaque membre (actif/à terre/mort/sorti) via un code couleur simple

### Piste du volcan
17. En tant que joueur, je veux que la piste du volcan soit compacte (40px de haut) avec juste une barre + numéro
18. En tant que joueur, je veux que le statut "PRÊT!" et la malédiction soient visibles sans texte superflu

### Plateau
19. En tant que joueur, je veux que le plateau SVG s'étende dynamiquement pour remplir tout l'espace non pris par le HUD
20. En tant que joueur, je veux que le pan/zoom du plateau reste fluide quelle que soit la taille de l'écran
21. En tant que joueur, je veux que les tuiles restent lisibles (minimum 40px par tuile) même sur petit écran

### Performance
22. En tant que joueur sur connexion lente, je veux que les portraits chargent progressivement (lazy load ou placeholder)
23. En tant que joueur, je veux que le re-render du HUD soit rapide (pas de rechargement d'images à chaque refresh)

## Implementation Decisions

### Layout CSS

```
#screen-game {
  display: flex;
  height: 100vh;
}

#game-board-area {
  flex: 1;                    /* prend tout l'espace restant */
  position: relative;
  min-width: 0;               /* permet le shrink */
}

#hud-panel {
  width: 200px;               /* réduit de 232 → 200 */
  flex-shrink: 0;
  height: 100vh;
  overflow-y: auto;
  /* responsive */
  @media (max-width: 900px) { width: 180px; }
  @media (max-width: 768px) { 
    width: 100%; height: auto; max-height: 200px;
    order: -1; /* en haut sur mobile */
  }
}
```

### Tailles proportionnelles

| Élément | Taille actuelle | Nouvelle taille | Unité |
|---------|----------------|----------------|-------|
| Portrait actif | 60px | 40px | px fixe |
| Portrait équipe | 28px | 22px | px fixe |
| Hearts HP | 15px | 12px | px fixe |
| Mini-hearts équipe | 9px | 7px (points) | px fixe |
| Gems PA | 12×14px | 10×12px | px fixe |
| Panel width | 232px | 200px | px fixe |
| Fonts nom | 16px | 14px | px fixe |
| Fonts rôle | 11px | 10px | px fixe |
| Fonts capacités | 11px | 10px | px fixe |

### Breakpoints

- **> 1200px** : HUD 200px à droite, plateau plein reste
- **900-1200px** : HUD 180px à droite
- **768-900px** : HUD 160px à droite, journal caché par défaut
- **< 768px** : HUD en bas en barre horizontale (200px max), plateau plein écran au-dessus

### Optimisation images

- Utiliser `loading="lazy"` sur les portraits d'équipe (pas le portrait actif)
- Précharger le portrait actif, lazy-charger les autres
- Cache navigateur : les images sont déjà mises en cache après le premier load

### Structure HTML du HUD (compact)

```html
<div id="hud-panel">
  <!-- Carte perso actif (compact) -->
  <div class="hud-active-card">
    <div class="hud-active-header">
      <img class="hud-active-portrait" src="..." /> <!-- 40px -->
      <div class="hud-active-info">
        <div class="hud-active-name">Nom</div>      <!-- 14px bold -->
        <div class="hud-active-role">Rôle</div>     <!-- 10px -->
      </div>
      <div class="hud-active-badges">🛡 🔑</div>     <!-- inline, pas une ligne -->
    </div>
    <div class="hud-active-stats">
      <span class="hud-hearts">❤❤❤♡♡</span>  <!-- 12px, inline -->
      <span class="hud-gems">◆◆◇</span>            <!-- 10px, inline -->
    </div>
  </div>

  <!-- Capacités (compact) -->
  <div class="hud-abilities">
    <div class="hud-ability-card">Érudite · Passif</div>
    <div class="hud-ability-card">Lunette · 1 PA</div>
  </div>

  <!-- Équipe (compact) -->
  <div class="hud-team">
    <div class="hud-team-row current">
      <img class="hud-team-avatar" /> <!-- 22px -->
      <span class="hud-team-name">Guide</span>
      <span class="hud-team-hp">●●●●●</span> <!-- 7px dots -->
    </div>
  </div>

  <!-- Volcan (compact) -->
  <div class="hud-volcano">
    <div class="hud-volcano-bar">...bar...marker...</div>
    🔥 15  <!-- juste le numéro -->
  </div>
</div>
```

### Modules touchés

**`src/ui/hud.js`** : Réécriture de `refreshHUD()` avec HTML plus compact
**`index.html`** : Refonte CSS du HUD (largeurs, tailles, breakpoints)
**`src/ui/render.js`** : Ajuster `TILE_SIZE` dynamiquement selon la largeur disponible (optionnel)
**`src/main.js`** : Aucun changement (le rendu est déjà déclenché par `fullRender()`)

## Testing Decisions

**Critère de qualité** : le HUD doit être lisible et fonctionnel à 1366×768, 1920×1080, et 768×1024 (tablette).

**Tests visuels** (manuels, pas automatisés) :
- Ouvrir le jeu à 1366×768 : vérifier que le plateau prend ~70% de la largeur
- Ouvrir à 1920×1080 : vérifier que le HUD n'est pas ridicule
- Ouvrir à 768px : vérifier que le HUD passe en bas
- Vérifier que les portraits chargent sans lag

**Tests moteur** : `node tests/run-all.mjs` — les 274 tests ne sont pas affectés (UI seulement).

## Out of Scope

- Refonte du plateau SVG lui-même (tuiles, murs, meeples) — seulement le HUD et le layout
- Nouvelles images d'explorateurs (on garde les PNG existants, juste plus petits)
- Mode portrait mobile (< 768px n'est pas un objectif prioritaire — tablette paysage minimum)
- Animations de transition entre les écrans
- Thème clair / mode sombre (le jeu est déjà en thème sombre volcano)
- Refonte de l'écran setup / title / end — seulement l'écran de jeu

## Further Notes

### Risques
1. **Images floues à petite taille** : les PNG d'explorateurs sont ~600×600px, réduits à 22px → peut paraître flou. Mitigation : `image-rendering: crisp-edges` ou laisser le navigateur downscale normalement.
2. **Scroll du HUD** : si le contenu dépasse la hauteur, le scroll doit être fluide et ne pas casser le plateau. Mitigation : `overflow-y: auto` sur le panel uniquement.
3. **Z-index conflicts** : le HUD, le journal, la barre d'actions et les modals doivent respecter un ordre strict. Ordre actuel : HUD=20, log=20, actions=25, modals=300. À conserver.
