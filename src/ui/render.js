/* render.js — SVG board renderer with pan/zoom */
import { DIRS, DIR_DELTA, OPP } from '../engine/board.js';
import { EXPLORERS } from '../engine/explorers.js';

export const TILE_SIZE = 60;
export const WALL_THICKNESS = 4;

const TILE_COLORS = {
  normale:      '#8b7355',
  pont:         '#6b8b9b',
  cle:          '#d4af37',
  lave:         '#e8552a',
  piege_pics:   '#8b4c3c',
  piege_flechettes: '#7a5c3a',
  ruines:       '#9c8b6b',
  gardien:      '#4a3c2a',
  journal:      '#b8a088',
  entry:        '#5a8a5a',
  sanctuary:    '#d4af37',
};

const FLIPPED_COLOR = '#2a1a1a';

const TYPE_ICONS = {
  cle: '🔑',
  lave: '🔥',
  piege_pics: '⚠',
  piege_flechettes: '➤',
  ruines: '🗿',
  gardien: '👁',
  journal: '📜',
  sanctuary: '⛩',
};

const TILE_IMAGE_MAP = {
  normale: 'normal',
  pont: 'bridge',
  cle: 'key',
  lave: 'lava',
  piege_pics: 'spikes',
  piege_flechettes: 'darts',
  ruines: 'ruins',
  gardien: 'guardian',
  normal: 'normal',
  guardian: 'guardian',
  entry: 'entree',
};

const TILES_WITHOUT_IMAGES = new Set(['journal', 'sanctuary']);

function tileImageFile(cell) {
  return TILE_IMAGE_MAP[cell.type] || null;
}

let svgEl = null;
let transformGroup = null;
let pan = { x: 0, y: 0 };
let zoom = 1;
let isDragging = false;
let dragStart = null;
let targetCallback = null;
let highlightTargets = [];
let panZoomInitialized = false;

export function initBoard(svg) {
  svgEl = svg;
  svg.innerHTML = '';
  pan = { x: 0, y: 0 };
  zoom = 1;
  const ns = 'http://www.w3.org/2000/svg';

  transformGroup = document.createElementNS(ns, 'g');
  transformGroup.setAttribute('id', 'board-transform');
  svg.appendChild(transformGroup);

  const defs = document.createElementNS(ns, 'defs');
  defs.setAttribute('id', 'board-defs');
  transformGroup.appendChild(defs);

  const layers = ['tiles-layer', 'markers-layer', 'explorers-layer', 'guardians-layer', 'highlights-layer'];
  for (const id of layers) {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('id', id);
    transformGroup.appendChild(g);
  }

  if (!panZoomInitialized) {
    setupPanZoom();
    panZoomInitialized = true;
  }
}

function setupPanZoom() {
  svgEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.target-highlight') || e.target.closest('.edge-highlight')) return;
    isDragging = true;
    dragStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    svgEl.classList.add('dragging');
  });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    pan.x = e.clientX - dragStart.x;
    pan.y = e.clientY - dragStart.y;
    applyTransform();
  });
  window.addEventListener('mouseup', () => {
    isDragging = false;
    svgEl.classList.remove('dragging');
  });
  svgEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = svgEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const oldZoom = zoom;
    zoom *= e.deltaY < 0 ? 1.1 : 0.9;
    zoom = Math.max(0.2, Math.min(4, zoom));
    pan.x = mx - (mx - pan.x) * (zoom / oldZoom);
    pan.y = my - (my - pan.y) * (zoom / oldZoom);
    applyTransform();
  }, { passive: false });

  document.getElementById('zoom-in')?.addEventListener('click', () => { zoom *= 1.2; applyTransform(); });
  document.getElementById('zoom-out')?.addEventListener('click', () => { zoom *= 0.8; applyTransform(); });
  document.getElementById('zoom-fit')?.addEventListener('click', () => fitView());
}

function applyTransform() {
  if (!transformGroup) return;
  transformGroup.setAttribute('transform', `translate(${pan.x} ${pan.y}) scale(${zoom})`);
}

export function fitView() {
  const tilesLayer = transformGroup?.querySelector('#tiles-layer');
  if (!tilesLayer || !svgEl) return;
  const cells = tilesLayer.querySelectorAll('.tile-group');
  if (cells.length === 0) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  cells.forEach(c => {
    const x = parseFloat(c.dataset.x);
    const y = parseFloat(c.dataset.y);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });
  const padX = (maxX - minX + 1) * TILE_SIZE;
  const padY = (maxY - minY + 1) * TILE_SIZE;
  const rect = svgEl.getBoundingClientRect();
  zoom = Math.min(rect.width / padX, rect.height / padY) * 0.85;
  zoom = Math.max(0.2, Math.min(4, zoom));
  pan.x = rect.width / 2 - ((minX + maxX + 1) / 2) * TILE_SIZE * zoom;
  pan.y = rect.height / 2 - ((minY + maxY + 1) / 2) * TILE_SIZE * zoom;
  applyTransform();
}

function px(x) { return x * TILE_SIZE; }
function py(y) { return y * TILE_SIZE; }

export function renderBoard(state, ui) {
  const ns = 'http://www.w3.org/2000/svg';
  const tilesLayer = transformGroup.querySelector('#tiles-layer');
  const markersLayer = transformGroup.querySelector('#markers-layer');
  const explorersLayer = transformGroup.querySelector('#explorers-layer');
  const guardiansLayer = transformGroup.querySelector('#guardians-layer');
  const highlightsLayer = transformGroup.querySelector('#highlights-layer');

  tilesLayer.innerHTML = '';
  markersLayer.innerHTML = '';
  explorersLayer.innerHTML = '';
  guardiansLayer.innerHTML = '';
  highlightsLayer.innerHTML = '';

  const defs = transformGroup.querySelector('#board-defs');
  if (defs) defs.innerHTML = '';

  const sortedCells = [...state.board.cells.values()].sort((a, b) => {
    if (a.isEntry && !a.exitDir && b.isEntry && b.exitDir) return -1;
    if (b.isEntry && !b.exitDir && a.isEntry && a.exitDir) return 1;
    return 0;
  });

  for (const cell of sortedCells) {
    renderCell(tilesLayer, markersLayer, guardiansLayer, cell, state, ns);
  }

  for (const explorer of state.explorers) {
    if (explorer.state === 'dead' || explorer.state === 'escaped') continue;
    renderExplorer(explorersLayer, explorer, state, ns);
  }

  renderHighlights(highlightsLayer, ns);
}

function renderCell(tilesLayer, markersLayer, guardiansLayer, cell, state, ns) {
  const x = px(cell.x);
  const y = py(cell.y);
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', 'tile-group');
  g.dataset.x = cell.x;
  g.dataset.y = cell.y;

  const color = cell.flipped ? FLIPPED_COLOR : (TILE_COLORS[cell.type] || TILE_COLORS.normale);
  const imgFile = cell.flipped ? null : tileImageFile(cell);
  const hasImage = imgFile !== null;

  if (cell.flipped) {
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('class', 'tile-rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', TILE_SIZE);
    rect.setAttribute('height', TILE_SIZE);
    rect.setAttribute('fill', FLIPPED_COLOR);
    rect.setAttribute('rx', 3);
    rect.setAttribute('stroke', 'rgba(0,0,0,.4)');
    rect.setAttribute('stroke-width', 1);
    g.appendChild(rect);

    const volcano = document.createElementNS(ns, 'text');
    volcano.setAttribute('x', x + TILE_SIZE / 2);
    volcano.setAttribute('y', y + TILE_SIZE / 2 + 6);
    volcano.setAttribute('fill', '#e8552a');
    volcano.setAttribute('font-size', '20');
    volcano.setAttribute('text-anchor', 'middle');
    volcano.setAttribute('pointer-events', 'none');
    volcano.textContent = '🌋';
    g.appendChild(volcano);
  } else if (hasImage) {
    if (cell.type === 'entry' && cell.exitDir) {
      const img = document.createElementNS(ns, 'image');
      img.setAttribute('href', `assets/images/tiles/${imgFile}.png`);
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `assets/images/tiles/${imgFile}.png`);
      img.setAttribute('x', x);
      img.setAttribute('y', y);
      img.setAttribute('width', TILE_SIZE);
      img.setAttribute('height', TILE_SIZE * 2);
      img.setAttribute('preserveAspectRatio', 'none');
      g.appendChild(img);
    } else if (cell.type === 'entry' && !cell.exitDir) {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('class', 'tile-rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', TILE_SIZE);
      rect.setAttribute('height', TILE_SIZE);
      rect.setAttribute('fill', color);
      rect.setAttribute('fill-opacity', '0.7');
      rect.setAttribute('rx', 3);
      g.appendChild(rect);
    } else {
      const img = document.createElementNS(ns, 'image');
      img.setAttribute('href', `assets/images/tiles/${imgFile}.png`);
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `assets/images/tiles/${imgFile}.png`);
      img.setAttribute('x', x);
      img.setAttribute('y', y);
      img.setAttribute('width', TILE_SIZE);
      img.setAttribute('height', TILE_SIZE);
      img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      img.setAttribute('transform', `rotate(${cell.rotation || 0} ${x + TILE_SIZE / 2} ${y + TILE_SIZE / 2})`);
      g.appendChild(img);
    }
  } else {
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('class', 'tile-rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', TILE_SIZE);
    rect.setAttribute('height', TILE_SIZE);
    rect.setAttribute('fill', color);
    rect.setAttribute('fill-opacity', '0.7');
    rect.setAttribute('rx', 3);
    rect.setAttribute('stroke', 'rgba(0,0,0,.4)');
    rect.setAttribute('stroke-width', 1);
    g.appendChild(rect);

    for (const dir of DIRS) {
      if (!cell.walls[dir]) {
        drawWall(g, ns, x, y, dir);
      }
    }

    if (cell.isEntry) {
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('class', 'tile-label');
      label.setAttribute('x', x + TILE_SIZE / 2);
      label.setAttribute('y', y + TILE_SIZE / 2 + 4);
      label.setAttribute('fill', '#fff');
      label.setAttribute('font-size', '10');
      label.setAttribute('text-anchor', 'middle');
      label.textContent = cell.exitDir ? '↑' : 'E';
      g.appendChild(label);
    }

    if (cell.isSanctuary) {
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('class', 'tile-label');
      label.setAttribute('x', x + TILE_SIZE / 2);
      label.setAttribute('y', y + TILE_SIZE / 2 + 5);
      label.setAttribute('fill', '#fff');
      label.setAttribute('font-size', '20');
      label.setAttribute('text-anchor', 'middle');
      g.appendChild(label);
      label.textContent = '⛩';
    }

    if (TYPE_ICONS[cell.type] && !cell.isSanctuary && !cell.isEntry) {
      const icon = document.createElementNS(ns, 'text');
      icon.setAttribute('class', 'tile-icon');
      icon.setAttribute('x', x + TILE_SIZE / 2);
      icon.setAttribute('y', y + TILE_SIZE / 2 + 6);
      icon.setAttribute('fill', 'rgba(255,255,255,.6)');
      icon.setAttribute('font-size', '18');
      icon.setAttribute('text-anchor', 'middle');
      icon.setAttribute('pointer-events', 'none');
      icon.textContent = TYPE_ICONS[cell.type];
      g.appendChild(icon);
    }
  }

  if (!cell.flipped && cell.demolished) {
    for (const dir of Object.keys(cell.demolished)) {
      if (cell.demolished[dir]) {
        drawDemolishedPassage(g, ns, x, y, dir);
      }
    }
  }

  if (!cell.flipped && cell.ruinsNum != null) {
    const num = document.createElementNS(ns, 'text');
    num.setAttribute('x', x + TILE_SIZE - 10);
    num.setAttribute('y', y + 14);
    num.setAttribute('fill', '#fff');
    num.setAttribute('font-size', '10');
    num.setAttribute('font-weight', 'bold');
    num.setAttribute('text-anchor', 'middle');
    num.setAttribute('pointer-events', 'none');
    num.setAttribute('style', 'paint-order:stroke;stroke:#000;stroke-width:2px');
    num.textContent = cell.ruinsNum;
    g.appendChild(num);
  }

  tilesLayer.appendChild(g);

  if (cell.rubble && !cell.flipped) {
    drawMarker(markersLayer, ns, x + TILE_SIZE / 2, y + TILE_SIZE / 2, 'éb', '#a08060');
  }
  if (cell.keyMarker && !cell.flipped) {
    drawMarker(markersLayer, ns, x + TILE_SIZE / 2, y + 12, '🔑', '#d4af37');
  }
  if (cell.consolidated && !cell.flipped) {
    const c = document.createElementNS(ns, 'rect');
    c.setAttribute('x', x + 4);
    c.setAttribute('y', y + 4);
    c.setAttribute('width', TILE_SIZE - 8);
    c.setAttribute('height', TILE_SIZE - 8);
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', '#6ab46a');
    c.setAttribute('stroke-width', 2);
    c.setAttribute('stroke-dasharray', '4 3');
    c.setAttribute('pointer-events', 'none');
    markersLayer.appendChild(c);
  }

  if (cell.guardians && cell.guardians.length > 0 && !cell.flipped) {
    for (let i = 0; i < cell.guardians.length; i++) {
      drawGuardian(guardiansLayer, ns, x + TILE_SIZE / 2 + i * 12 - 6, y + TILE_SIZE / 2 + 5);
    }
  }

  if (state.artifactOnGround && state.artifactOnGround.x === cell.x && state.artifactOnGround.y === cell.y && !cell.flipped) {
    drawMarker(markersLayer, ns, x + TILE_SIZE / 2, y + TILE_SIZE - 12, '★', '#f5a623');
  }
  if (cell.isSanctuary && state.artifactOnSanctuary) {
    drawMarker(markersLayer, ns, x + TILE_SIZE / 2, y + TILE_SIZE - 12, '★', '#f5a623');
  }
}

function drawWall(g, ns, x, y, dir) {
  const line = document.createElementNS(ns, 'line');
  line.setAttribute('class', 'wall');
  line.setAttribute('stroke', '#1a0e08');
  line.setAttribute('stroke-width', WALL_THICKNESS);
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('opacity', '0.9');

  const half = TILE_SIZE;
  switch (dir) {
    case 'N': line.setAttribute('x1', x); line.setAttribute('y1', y); line.setAttribute('x2', x + half); line.setAttribute('y2', y); break;
    case 'S': line.setAttribute('x1', x); line.setAttribute('y1', y + half); line.setAttribute('x2', x + half); line.setAttribute('y2', y + half); break;
    case 'E': line.setAttribute('x1', x + half); line.setAttribute('y1', y); line.setAttribute('x2', x + half); line.setAttribute('y2', y + half); break;
    case 'W': line.setAttribute('x1', x); line.setAttribute('y1', y); line.setAttribute('x2', x); line.setAttribute('y2', y + half); break;
  }
  g.appendChild(line);
}

function drawDemolishedPassage(g, ns, x, y, dir) {
  const half = TILE_SIZE;
  const cx = x + half / 2;
  const cy = y + half / 2;
  let mx, my, isVertical;
  switch (dir) {
    case 'N': mx = cx; my = y; isVertical = false; break;
    case 'S': mx = cx; my = y + half; isVertical = false; break;
    case 'E': mx = x + half; my = cy; isVertical = true; break;
    case 'W': mx = x; my = cy; isVertical = true; break;
  }

  const line = document.createElementNS(ns, 'line');
  line.setAttribute('class', 'wall demolished');
  line.setAttribute('stroke', '#e8552a');
  line.setAttribute('stroke-width', 3);
  line.setAttribute('stroke-dasharray', '4 3');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('opacity', '0.7');
  if (isVertical) {
    line.setAttribute('x1', mx);
    line.setAttribute('y1', my - 14);
    line.setAttribute('x2', mx);
    line.setAttribute('y2', my + 14);
  } else {
    line.setAttribute('x1', mx - 14);
    line.setAttribute('y1', my);
    line.setAttribute('x2', mx + 14);
    line.setAttribute('y2', my);
  }
  g.appendChild(line);
}

function drawMarker(layer, ns, cx, cy, text, color) {
  const t = document.createElementNS(ns, 'text');
  t.setAttribute('x', cx);
  t.setAttribute('y', cy + 5);
  t.setAttribute('fill', color);
  t.setAttribute('font-size', '12');
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('pointer-events', 'none');
  t.textContent = text;
  layer.appendChild(t);
}

function drawGuardian(layer, ns, cx, cy) {
  const tri = document.createElementNS(ns, 'polygon');
  tri.setAttribute('points', `${cx},${cy - 10} ${cx - 8},${cy + 4} ${cx + 8},${cy + 4}`);
  tri.setAttribute('fill', '#c62828');
  tri.setAttribute('stroke', '#400');
  tri.setAttribute('stroke-width', 1);
  tri.setAttribute('pointer-events', 'none');
  layer.appendChild(tri);
}

function renderExplorer(layer, explorer, state, ns) {
  const x = px(explorer.x) + TILE_SIZE / 2;
  const y = py(explorer.y) + TILE_SIZE / 2;
  const isActive = state.explorers[state.currentExplorerIdx] === explorer;

  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', 'meeple' + (isActive ? ' current' : '') + (explorer.state === 'down' ? ' down' : ''));

  const def = getExplorerDef(explorer.id);
  const color = def ? def.color : '#999';
  const radius = 14;

  if (isActive) {
    const glow = document.createElementNS(ns, 'circle');
    glow.setAttribute('class', 'meeple-glow');
    glow.setAttribute('cx', x);
    glow.setAttribute('cy', y);
    glow.setAttribute('r', 18);
    glow.setAttribute('fill', 'none');
    glow.setAttribute('stroke', '#f5a623');
    glow.setAttribute('stroke-width', 2.5);
    glow.setAttribute('opacity', 0.8);
    g.appendChild(glow);
  }

  const body = document.createElementNS(ns, 'g');
  body.setAttribute('class', 'meeple-body');

  const explorerIdx = state.explorers.indexOf(explorer);
  const clipId = `clip-${explorer.id}-${explorerIdx}`;
  const defs = transformGroup.querySelector('#board-defs');
  if (defs) {
    const clipPath = document.createElementNS(ns, 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipCircle = document.createElementNS(ns, 'circle');
    clipCircle.setAttribute('cx', x);
    clipCircle.setAttribute('cy', y);
    clipCircle.setAttribute('r', radius);
    clipPath.appendChild(clipCircle);
    defs.appendChild(clipPath);
  }

  const bgCircle = document.createElementNS(ns, 'circle');
  bgCircle.setAttribute('cx', x);
  bgCircle.setAttribute('cy', y);
  bgCircle.setAttribute('r', radius);
  bgCircle.setAttribute('fill', color);
  body.appendChild(bgCircle);

  const img = document.createElementNS(ns, 'image');
  img.setAttribute('href', `assets/images/explorers/${explorer.id}.png`);
  img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `assets/images/explorers/${explorer.id}.png`);
  img.setAttribute('x', x - radius);
  img.setAttribute('y', y - radius);
  img.setAttribute('width', radius * 2);
  img.setAttribute('height', radius * 2);
  img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  img.setAttribute('clip-path', `url(#${clipId})`);
  body.appendChild(img);

  const ring = document.createElementNS(ns, 'circle');
  ring.setAttribute('cx', x);
  ring.setAttribute('cy', y);
  ring.setAttribute('r', radius);
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', color);
  ring.setAttribute('stroke-width', 2.5);
  body.appendChild(ring);

  if (explorer.state === 'down') {
    body.setAttribute('transform', `rotate(75 ${x} ${y})`);
    body.setAttribute('opacity', '0.6');
  }

  g.appendChild(body);

  if (explorer.item) {
    const itemText = document.createElementNS(ns, 'text');
    itemText.setAttribute('x', x + 14);
    itemText.setAttribute('y', y - 10);
    itemText.setAttribute('font-size', '12');
    itemText.setAttribute('pointer-events', 'none');
    itemText.textContent = explorer.item === 'key' ? '🔑' : '★';
    g.appendChild(itemText);
  }

  layer.appendChild(g);
}

function getExplorerDef(id) {
  return EXPLORERS.find(e => e.id === id) || null;
}

export function highlightMoveTargets(state, targets, callback) {
  clearHighlights();
  targetCallback = callback;
  highlightTargets = targets.map(t => ({ type: 'cell', x: t.x, y: t.y }));
  renderHighlights(transformGroup.querySelector('#highlights-layer'), 'http://www.w3.org/2000/svg');
}

export function highlightCellTargets(state, cells, callback) {
  clearHighlights();
  targetCallback = callback;
  highlightTargets = cells.map(c => ({ type: 'cell', x: c.x, y: c.y }));
  renderHighlights(transformGroup.querySelector('#highlights-layer'), 'http://www.w3.org/2000/svg');
}

export function highlightRevealEdges(state, cell, dirs, callback) {
  clearHighlights();
  targetCallback = (dir) => callback(dir);
  highlightTargets = dirs.map(dir => ({ type: 'edge', x: cell.x, y: cell.y, dir }));
  renderHighlights(transformGroup.querySelector('#highlights-layer'), 'http://www.w3.org/2000/svg');
}

export function highlightDigTargets(state, targets, callback) {
  clearHighlights();
  targetCallback = (t) => callback(t);
  highlightTargets = targets.map(t => ({ type: 'cell', x: t.x, y: t.y }));
  renderHighlights(transformGroup.querySelector('#highlights-layer'), 'http://www.w3.org/2000/svg');
}

export function clearHighlights() {
  targetCallback = null;
  highlightTargets = [];
  const hl = transformGroup?.querySelector('#highlights-layer');
  if (hl) hl.innerHTML = '';
}

function renderHighlights(layer, ns) {
  if (!layer) return;
  layer.innerHTML = '';
  for (const target of highlightTargets) {
    if (target.type === 'cell') {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('class', 'target-highlight');
      rect.setAttribute('x', px(target.x));
      rect.setAttribute('y', py(target.y));
      rect.setAttribute('width', TILE_SIZE);
      rect.setAttribute('height', TILE_SIZE);
      rect.setAttribute('rx', 4);
      rect.dataset.x = target.x;
      rect.dataset.y = target.y;
      rect.addEventListener('click', (e) => {
        e.stopPropagation();
        if (targetCallback) targetCallback({ x: parseInt(rect.dataset.x), y: parseInt(rect.dataset.y) });
      });
      layer.appendChild(rect);
    } else if (target.type === 'edge') {
      const x = px(target.x);
      const y = py(target.y);
      const [dx, dy] = DIR_DELTA[target.dir];
      let ex, ey, ew, eh;
      if (target.dir === 'N') { ex = x; ey = y - 6; ew = TILE_SIZE; eh = 12; }
      else if (target.dir === 'S') { ex = x; ey = y + TILE_SIZE - 6; ew = TILE_SIZE; eh = 12; }
      else if (target.dir === 'E') { ex = x + TILE_SIZE - 6; ey = y; ew = 12; eh = TILE_SIZE; }
      else { ex = x - 6; ey = y; ew = 12; eh = TILE_SIZE; }
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('class', 'edge-highlight available');
      rect.setAttribute('x', ex);
      rect.setAttribute('y', ey);
      rect.setAttribute('width', ew);
      rect.setAttribute('height', eh);
      rect.setAttribute('rx', 3);
      rect.dataset.dir = target.dir;
      rect.addEventListener('click', (e) => {
        e.stopPropagation();
        if (targetCallback) targetCallback(target.dir);
      });
      layer.appendChild(rect);
    }
  }
}
