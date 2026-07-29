/* ============================================================
   render.js — Rendu du plateau en SVG (tuiles, murs, meeples, marqueurs)
   ============================================================ */

import { TILE_TYPES, DIRS, DELTA } from '../data/tiles.js';
import { key as cellKey } from '../engine/board.js';
import { avatarPath } from './avatar.js';

const NS = 'http://www.w3.org/2000/svg';
export const TILE = 88;          // taille d'une tuile en px
export const HALF = TILE / 2;

/* État de vue (pan/zoom) */
const view = { scale: 1, tx: 0, ty: 0 };

/* Crée un élément SVG helper */
function el(tag, attrs = {}, children = []) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) { if (c) e.appendChild(c); }
  return e;
}

/* Point central d'une tuile en coordonnées monde */
export function cellCenter(x, y) {
  return { cx: x * TILE, cy: y * TILE };
}

/* Rendu complet du plateau. */
export function renderBoard(game, ui) {
  const svg = document.getElementById('board-svg');
  svg.innerHTML = '';

  // Couche racine (pour pan/zoom)
  const root = el('g', { id: 'board-root' });
  svg.appendChild(root);

  // Couche tuiles
  const tilesLayer = el('g', { id: 'tiles-layer' });
  root.appendChild(tilesLayer);

  // Couche marqueurs
  const markersLayer = el('g', { id: 'markers-layer' });
  root.appendChild(markersLayer);

  // Couche meeples
  const meeplesLayer = el('g', { id: 'meeples-layer' });
  root.appendChild(meeplesLayer);

  // Couche surbrillance (interactions)
  const highlightLayer = el('g', { id: 'highlight-layer' });
  root.appendChild(highlightLayer);

  // Calculer les bornes pour centrer
  const cells = [...game.board.cells.values()];
  const xs = cells.map(c => c.x), ys = cells.map(c => c.y);
  const minX = Math.min(...xs) - 1, maxX = Math.max(...xs) + 1;
  const minY = Math.min(...ys) - 1, maxY = Math.max(...ys) + 1;

  // Dessiner chaque tuile
  // Trier les cases : dessiner d'abord les cases "bottom" (entry bottom),
  // puis les autres, pour que l'image de l'entrée top déborde par-dessus.
  const sortedCells = [...cells].sort((a, b) => {
    if (a.entryPart === 'bottom' && b.entryPart !== 'bottom') return -1;
    if (b.entryPart === 'bottom' && a.entryPart !== 'bottom') return 1;
    return 0;
  });
  for (const cell of sortedCells) {
    drawCell(tilesLayer, markersLayer, meeplesLayer, cell, game, ui);
  }

  // Ajuster le viewBox au contenu
  const pad = TILE;
  const vbX = minX * TILE - pad;
  const vbY = minY * TILE - pad;
  const vbW = (maxX - minX) * TILE + pad * 2;
  const vbH = (maxY - minY) * TILE + pad * 2;
  svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  ui._viewBox = { x: vbX, y: vbY, w: vbW, h: vbH };
}

/* Types de tuiles ayant une vraie image officielle.
   Les murs sont figés dans l'image ; la rotation appliquée à l'image
   aligne automatiquement les murs avec la configuration calculée par le moteur. */
const TILE_IMAGES = ['normal','bridge','key','lava','spikes','darts','ruins','guardian','journal'];

/* Fichier image à utiliser pour chaque type de case (par défaut = nom du type).
   Cas particuliers : l'entrée utilise 'entree.png'. */
function tileImageFile(cell) {
  if (cell.type === 'entry') return 'entree';
  return cell.type;
}

/* Dessine une case (tuile) + ses murs + marqueurs + meeples. */
function drawCell(tilesLayer, markersLayer, meeplesLayer, cell, game, ui) {
  const { cx, cy } = cellCenter(cell.x, cell.y);
  const typeInfo = TILE_TYPES[cell.type] || { label: '', color: '#444', icon: '' };
  const g = el('g', { class: 'tile-group' + (cell.flipped ? ' volcano-face' : ''),
                       transform: `translate(${cx},${cy})` });
  g.dataset.cellId = cell.id;

  const hasImage = (TILE_IMAGES.includes(cell.type) || cell.type === 'entry') && !cell.flipped;

  if (cell.flipped) {
    // Face Volcan : tuile retournée par la lave
    g.appendChild(el('rect', {
      class: 'tile-rect', x: -HALF + 2, y: -HALF + 2,
      width: TILE - 4, height: TILE - 4, rx: 4,
      fill: '#e8552a', 'fill-opacity': 0.9,
    }));
    g.appendChild(el('text', { class: 'tile-label', y: 4, 'font-size': 20 }, [document.createTextNode('🌋')]));
  } else if (hasImage) {
    // VRAIE IMAGE officielle de la tuile, pivotée selon le placement.
    // Cas particulier : l'entrée = tuile 1×2 (verticale). On dessine l'image
    // d'entrée (portrait) couvrant la case du haut ET la case du bas.
    if (cell.type === 'entry' && cell.entryPart === 'top') {
      // Case du haut : image plein cadre, double hauteur, déborde vers le bas
      g.appendChild(el('image', {
        href: `assets/images/tiles/${tileImageFile(cell)}.png`,
        x: -HALF, y: -HALF, width: TILE, height: TILE * 2,
        preserveAspectRatio: 'none',  // étirer exactement (l'image est déjà 1:2)
      }));
    } else if (cell.type === 'entry' && cell.entryPart === 'bottom') {
      // Case du bas : on ne dessine PAS d'image ici (la case du haut déborde
      // déjà dessus). Mais on garde un fond au cas où.
      g.appendChild(el('rect', {
        x: -HALF, y: -HALF, width: TILE, height: TILE,
        fill: 'var(--t-entry)', 'fill-opacity': 0.7,
      }));
    } else {
      const img = el('image', {
        href: `assets/images/tiles/${tileImageFile(cell)}.png`,
        x: -HALF, y: -HALF, width: TILE, height: TILE,
        preserveAspectRatio: 'xMidYMid slice',
        transform: `rotate(${cell.rotation || 0})`,
      });
      g.appendChild(img);
    }
  } else {
    // Tuiles spéciales sans image (Entrée, Latérales, Sanctuaire) : rendu vectoriel
    g.appendChild(el('rect', {
      class: 'tile-rect', x: -HALF + 2, y: -HALF + 2,
      width: TILE - 4, height: TILE - 4, rx: 4,
      fill: typeInfo.color, 'fill-opacity': 0.7,
    }));
    if (cell.isEntry) {
      g.appendChild(el('text', { class: 'tile-label', y: 5, 'font-size': 10 },
        [document.createTextNode(cell.crossroad ? '⬛' : '🚪')]));
    } else if (cell.isSanctuary) {
      g.appendChild(el('text', { class: 'tile-label', y: 5, 'font-size': 18 },
        [document.createTextNode(cell.unlocked ? '🔮' : '🔒')]));
    }
    drawWalls(g, cell); // murs vectoriels pour les tuiles spéciales
  }

  // Passages ouverts par démolition (visibles par-dessus l'image)
  if (!cell.flipped) drawDemolishedPassages(g, cell);

  // Numéro des Ruines (par-dessus l'image)
  if (cell.ruinsNum != null && !cell.flipped) {
    const num = el('text', { x: HALF - 12, y: -HALF + 16, 'font-size': 14,
      fill: '#fff', 'font-weight': 'bold',
      style: 'paint-order:stroke;stroke:#000;stroke-width:2px' });
    num.textContent = cell.ruinsNum;
    g.appendChild(num);
  }

  // Consolidation marker (la tuile devient normale)
  if (cell.consolidated && !cell.flipped) {
    g.appendChild(el('text', { x: -HALF + 12, y: -HALF + 16, 'font-size': 14,
      style: 'paint-order:stroke;stroke:#000;stroke-width:2px' },
      [document.createTextNode('🧱')]));
  }

  tilesLayer.appendChild(g);

  // Marqueurs (Éboulis, Clé) sur la couche dédiée
  if (cell.rubble && !cell.flipped) {
    drawRubble(markersLayer, cx, cy);
  }
  if (cell.keyMarker) {
    drawKey(markersLayer, cx, cy);
  }
  if (cell.isSanctuary) {
    drawSanctuary(markersLayer, cx, cy, cell);
  }

  // Gardiens
  if (cell.guardians.length > 0 && !cell.flipped) {
    drawGuardians(markersLayer, cx, cy, cell.guardians.length);
  }

  // Meeples (Explorateurs) — comparaison par clé de coordonnées
  const cellKeyStr = cellKey(cell.x, cell.y);
  const explorersHere = game.explorers.filter(e => e.position === cellKeyStr && e.state !== 'escaped' && e.state !== 'dead');
  drawMeeples(meeplesLayer, cx, cy, explorersHere, game, ui);
}

/* Dessine les 4 murs d'une case. */
function drawWalls(g, cell) {
  // Pour chaque direction, si fermée (false), dessiner un trait épais
  const edgePoints = {
    N: [[-HALF + 2, -HALF + 2], [HALF - 2, -HALF + 2]],
    E: [[HALF - 2, -HALF + 2], [HALF - 2, HALF - 2]],
    S: [[-HALF + 2, HALF - 2], [HALF - 2, HALF - 2]],
    W: [[-HALF + 2, -HALF + 2], [-HALF + 2, HALF - 2]],
  };
  for (const dir of DIRS) {
    if (cell.walls[dir]) continue; // true = ouvert (pas de mur)
    const [p1, p2] = edgePoints[dir];
    const demolished = cell.demolished && cell.demolished[dir];
    g.appendChild(el('line', {
      class: 'wall' + (demolished ? ' demolished' : ''),
      x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
      'stroke-width': demolished ? 2 : 5,
    }));
  }
}

/* Dessine par-dessus l'image les passages ouverts par démolition.
   Utilisé pour les tuiles à image (les murs normaux sont intégrés à l'image,
   mais les brèches doivent être visibles). */
function drawDemolishedPassages(g, cell) {
  if (!cell.demolished) return;
  const edgeMid = {
    N: [0, -HALF + 2],
    E: [HALF - 2, 0],
    S: [0, HALF - 2],
    W: [-HALF + 2, 0],
  };
  for (const dir of DIRS) {
    if (!cell.demolished[dir]) continue;
    const [mx, my] = edgeMid[dir];
    // Marqueur de brèche : arcs/tirets dorés brillants
    g.appendChild(el('line', {
      x1: mx - 14, y1: my, x2: mx + 14, y2: my,
      stroke: '#f5a623', 'stroke-width': 3, 'stroke-dasharray': '5 3',
      'stroke-linecap': 'round', opacity: 0.95,
      transform: (dir === 'E' || dir === 'W') ? `rotate(90 ${mx} ${my})` : '',
    }));
    // Petits éclats de pierre de chaque côté
    for (const sgn of [-1, 1]) {
      g.appendChild(el('circle', {
        cx: mx + sgn * 16, cy: my, r: 2.5,
        fill: '#d4a13b', opacity: 0.8,
      }));
    }
  }
}

function drawRubble(layer, cx, cy) {
  const g = el('g', { class: 'marker', transform: `translate(${cx},${cy})` });
  // Tas de gravats : petits rectangles gris
  const stones = [[-12, 4], [-2, -4], [8, 6], [2, 8], [-8, -6]];
  for (const [sx, sy] of stones) {
    g.appendChild(el('rect', {
      x: sx - 5, y: sy - 3, width: 10, height: 6, rx: 2,
      fill: '#6b5d50', stroke: '#3a3025', 'stroke-width': 1,
    }));
  }
  layer.appendChild(g);
}

function drawKey(layer, cx, cy) {
  const g = el('g', { class: 'marker', transform: `translate(${cx + HALF - 16},${cy - HALF + 16})` });
  g.appendChild(el('circle', { r: 8, fill: '#c9a227', stroke: '#8a6f1a', 'stroke-width': 1.5 }));
  g.appendChild(el('text', { 'text-anchor': 'middle', y: 4, 'font-size': 10, fill: '#3a2f10', 'font-weight': 'bold' }, [document.createTextNode('K')]));
  layer.appendChild(g);
}

function drawSanctuary(layer, cx, cy, cell) {
  const g = el('g', { class: 'marker', transform: `translate(${cx},${cy - 8})` });
  if (cell.hasArtifact && cell.unlocked) {
    // Artefact brillant sur piédestal
    g.appendChild(el('text', { 'text-anchor': 'middle', y: 6, 'font-size': 28 }, [document.createTextNode('🔮')]));
  } else if (cell.unlocked) {
    g.appendChild(el('text', { 'text-anchor': 'middle', y: 6, 'font-size': 20 }, [document.createTextNode('🔓')]));
  } else {
    g.appendChild(el('text', { 'text-anchor': 'middle', y: 6, 'font-size': 20 }, [document.createTextNode('🔒')]));
    // Clés posées
    if (cell.keysPlaced) {
      g.appendChild(el('text', { x: 18, y: 10, 'font-size': 12 }, [document.createTextNode('🔑')]));
    }
  }
  layer.appendChild(g);
}

function drawGuardians(layer, cx, cy, count) {
  const g = el('g', { class: 'marker', transform: `translate(${cx - 16},${cy + HALF - 18})` });
  // Figure de Gardien : silhouette sombre avec lueur rouge
  g.appendChild(el('circle', { r: 9, fill: '#2a1f17', stroke: '#c1272d', 'stroke-width': 1.5 }));
  g.appendChild(el('text', { 'text-anchor': 'middle', y: 3, 'font-size': 12 }, [document.createTextNode('👁')]));
  if (count > 1) {
    const badge = el('g', { transform: 'translate(10,-8)' });
    badge.appendChild(el('circle', { r: 7, fill: '#c1272d' }));
    badge.appendChild(el('text', { 'text-anchor': 'middle', y: 3, 'font-size': 10, fill: '#fff', 'font-weight': 'bold' }, [document.createTextNode(String(count))]));
    g.appendChild(badge);
  }
  layer.appendChild(g);
}

function drawMeeples(layer, cx, cy, explorers, game, ui) {
  // Répartir les meeples sur la tuile (jusqu'à 4 positions)
  const positions = [
    [-14, -8], [10, -10], [-8, 12], [12, 10],
  ];
  explorers.forEach((e, i) => {
    const [ox, oy] = positions[i % positions.length];
    const mg = el('g', {
      class: 'meeple' + (e.state === 'down' ? ' down' : '') + (e.id === game.explorers[game.currentExplorerIdx].id ? ' current' : ''),
      transform: `translate(${cx + ox},${cy + oy})`,
    });
    mg.dataset.explorerId = e.id;
    // Glow si courant
    mg.appendChild(el('circle', { class: 'meeple-glow', r: 11 }));
    // Cercle coloré de fond (identification rapide même si image peu lisible)
    const body = el('g', { class: 'meeple-body' });
    body.appendChild(el('circle', { cx: 0, cy: 0, r: 9, fill: e.color, stroke: '#000', 'stroke-width': 1.2 }));
    // Image de l'avatar (SVG) si disponible — sinon le cercle coloré reste
    const imgEl = el('image', {
      x: -9, y: -9, width: 18, height: 18,
      preserveAspectRatio: 'xMidYMid slice',
    });
    imgEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', avatarPath(e.defId || e.id));
    imgEl.setAttribute('href', avatarPath(e.defId || e.id));
    // Si l'image 404, on la masque ET on ajoute l'initiale par-dessus le cercle
    imgEl.addEventListener('error', () => {
      imgEl.style.display = 'none';
      mg.appendChild(el('text', { 'text-anchor': 'middle', y: 3, 'font-size': 10, fill: '#fff', 'font-weight': 'bold', 'pointer-events': 'none' }, [document.createTextNode(e.name[0])]));
    });
    body.appendChild(imgEl);
    mg.appendChild(body);
    // Indicateur d'objet
    if (e.item === 'key') {
      mg.appendChild(el('text', { x: 6, y: -8, 'font-size': 9 }, [document.createTextNode('🔑')]));
    } else if (e.item === 'artifact') {
      mg.appendChild(el('text', { x: 6, y: -8, 'font-size': 9 }, [document.createTextNode('🔮')]));
    }
    layer.appendChild(mg);
  });
}

/* ============================================================
   SURBRILLANCES D'INTERACTION
   ============================================================ */

/* Affiche les arêtes où l'on peut révéler (pour action Révéler). */
export function highlightRevealEdges(game, ui, cell, callback) {
  const layer = document.getElementById('highlight-layer');
  clearHighlights();
  for (const dir of DIRS) {
    if (!cell.walls[dir]) continue;
    const [dx, dy] = DELTA[dir];
    const tk = `${cell.x + dx},${cell.y + dy}`;
    if (game.board.cells.has(tk)) continue;
    drawEdgeHighlight(layer, cell, dir, () => callback(dir));
  }
}

/* Affiche les cases atteignables (pour Se déplacer / Explorer / Courir). */
export function highlightMoveTargets(game, ui, targets, callback) {
  const layer = document.getElementById('highlight-layer');
  clearHighlights();
  for (const t of targets) {
    const { cx, cy } = cellCenter(t.cell.x, t.cell.y);
    const r = el('rect', {
      class: 'reach-highlight', x: cx - HALF + 6, y: cy - HALF + 6,
      width: TILE - 12, height: TILE - 12, rx: 6,
    });
    r.addEventListener('click', () => callback(t));
    layer.appendChild(r);
  }
}

export function highlightDigTargets(game, targets, callback) {
  const layer = document.getElementById('highlight-layer');
  clearHighlights();
  for (const c of targets) {
    const { cx, cy } = cellCenter(c.x, c.y);
    const r = el('rect', {
      class: 'reach-highlight', x: cx - HALF + 6, y: cy - HALF + 6,
      width: TILE - 12, height: TILE - 12, rx: 6, fill: '#d4a13b',
    });
    r.addEventListener('click', () => callback(c));
    layer.appendChild(r);
  }
}

export function highlightCellTargets(game, targets, callback) {
  const layer = document.getElementById('highlight-layer');
  clearHighlights();
  for (const c of targets) {
    const { cx, cy } = cellCenter(c.x, c.y);
    const r = el('rect', {
      class: 'reach-highlight', x: cx - HALF + 6, y: cy - HALF + 6,
      width: TILE - 12, height: TILE - 12, rx: 6, fill: '#c1272d',
    });
    r.addEventListener('click', () => callback(c));
    layer.appendChild(r);
  }
}

function drawEdgeHighlight(layer, cell, dir, onClick) {
  const { cx, cy } = cellCenter(cell.x, cell.y);
  const mid = {
    N: [cx, cy - HALF],
    E: [cx + HALF, cy],
    S: [cx, cy + HALF],
    W: [cx - HALF, cy],
  }[dir];
  const e = el('rect', {
    class: 'edge-highlight available',
    x: mid[0] - HALF / 2, y: mid[1] - 8,
    width: HALF, height: 16, rx: 4,
  });
  // Ajuster l'orientation selon la direction
  if (dir === 'N' || dir === 'S') {
    e.setAttribute('x', mid[0] - HALF / 2);
    e.setAttribute('y', mid[1] - 8);
  } else {
    e.setAttribute('x', mid[0] - 8);
    e.setAttribute('y', mid[1] - HALF / 2);
    e.setAttribute('width', 16);
    e.setAttribute('height', HALF);
  }
  e.addEventListener('click', onClick);
  layer.appendChild(e);
}

export function clearHighlights() {
  const layer = document.getElementById('highlight-layer');
  if (layer) layer.innerHTML = '';
}

/* ============================================================
   PAN/ZOOM
   ============================================================ */
export function setupPanZoom(ui) {
  const svg = document.getElementById('board-svg');
  let dragging = false, startX = 0, startY = 0;
  let vb = null;

  function getVB() {
    return ui._viewBox || { x: 0, y: 0, w: 1000, h: 800 };
  }

  svg.addEventListener('mousedown', (e) => {
    if (e.target.closest('.reach-highlight') || e.target.closest('.edge-highlight') ||
        e.target.closest('.meeple') || e.target.closest('.tile-group')) return;
    dragging = true;
    svg.classList.add('dragging');
    startX = e.clientX; startY = e.clientY;
    vb = { ...getVB() };
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = (e.clientX - startX) * (vb.w / svg.clientWidth);
    const dy = (e.clientY - startY) * (vb.h / svg.clientHeight);
    svg.setAttribute('viewBox', `${vb.x - dx} ${vb.y - dy} ${vb.w} ${vb.h}`);
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    svg.classList.remove('dragging');
  });

  // Molette = zoom
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom(ui, e.deltaY < 0 ? 0.9 : 1.1);
  }, { passive: false });

  document.getElementById('zoom-in').addEventListener('click', () => zoom(ui, 0.8));
  document.getElementById('zoom-out').addEventListener('click', () => zoom(ui, 1.25));
  document.getElementById('zoom-fit').addEventListener('click', () => fitView(ui));
}

function zoom(ui, factor) {
  const svg = document.getElementById('board-svg');
  const vb = { ...getVB(ui) };
  const newW = vb.w * factor, newH = vb.h * factor;
  const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
  ui._viewBox = { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
  svg.setAttribute('viewBox', `${ui._viewBox.x} ${ui._viewBox.y} ${newW} ${newH}`);
}

function getVB(ui) {
  return ui._viewBox || { x: 0, y: 0, w: 1000, h: 800 };
}

export function fitView(ui) {
  const svg = document.getElementById('board-svg');
  if (ui._viewBox) {
    svg.setAttribute('viewBox', `${ui._viewBox.x} ${ui._viewBox.y} ${ui._viewBox.w} ${ui._viewBox.h}`);
  }
}
