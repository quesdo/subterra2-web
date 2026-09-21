## Bugs from first playtest

### Engine (logic)
1. **Key tiles accessible from all sides** — should have walls
2. **Guardians spawn wrong** — should appear on nearest guardian tile, not related to player
3. **Trap tiles = dead ends** — traps should be traversable
4. **Can't go beyond 3 tiles deep** — "no more exits" premature
5. **Triggering trap deals no damage** when explorer is on tile
6. **Can exit temple but can't return**
7. **Rubble blocks passage even without rubble marker** — "éb" always shows
8. **Guardian attacks random explorer** — no Chef d'Expédition choice
9. **Tile placement validation** — tiles greyed when placeable, can't place at corridor end, can place against wall when shouldn't

### UI / Rendering
10. **Multiple characters on same tile** — hard to see who's selected (reduce icons?)
11. **Rotation modal too opaque** — can't see board behind
12. **Peril die no undo** — miss-click = turn lost
13. **Dead explorer disappears** — should stay visible (translucent)
14. **Ordonner/Soigner: can't target specific explorer** when multiple on same tile
15. **Rubble shows "éb" text** instead of proper visual

### Data / Abilities
16. **Archéo has Aristocrate's abilities and vice versa** — verify mapping
17. **Guérisseuse doesn't have Revive** — Revive is on Prêtre (correct?), but Guérir can revive
18. **Guardians spawn nearest to triggering player** instead of nearest guardian tile
