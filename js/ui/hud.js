/* ============================================================
   hud.js — Panneau Explorateur actif, liste d'équipe, piste Volcan
   ============================================================ */

import { VOLCANO_MAX } from '../engine/volcano.js';

/* Avatar SVG d'un Explorateur (cercle coloré + glyphe). */
export function avatarSVG(explorer, size = 48) {
  const s = size;
  return `<svg viewBox="0 0 48 48" width="${s}" height="${s}">
    <circle cx="24" cy="24" r="22" fill="${explorer.color}" stroke="#000" stroke-width="1.5"/>
    <text x="24" y="30" text-anchor="middle" font-size="20">${explorer.glyph}</text>
  </svg>`;
}

/* Rend le panneau de l'Explorateur actif. */
export function renderActiveExplorer(game, ui) {
  const p = game.explorers[game.currentExplorerIdx];
  const box = document.getElementById('active-explorer');
  const hpPips = Array.from({ length: p.maxHp }, (_, i) =>
    `<span class="hp-pip ${i >= p.hp ? 'empty' : ''}"></span>`
  ).join('');
  const apPips = Array.from({ length: 3 }, (_, i) =>
    `<span class="ap-pip ${i >= game.ap ? 'spent' : ''}"></span>`
  ).join('');

  const itemLine = p.item
    ? `<div class="ae-item">Porte : ${p.item === 'key' ? '🔑 Clé' : '🔮 Artefact'}</div>`
    : '';
  const shieldLine = p.shielded ? `<div class="ae-item" style="color:#5bd6c7">🛡 Protégé (Se préparer)</div>` : '';

  // Capacités
  const abilities = p.abilities.map(a => {
    if (a.passive) {
      return `<button class="ability-btn passive" title="${a.desc}">
        <span>${a.name} <em style="color:var(--c-text-mute)">(passive)</em></span>
      </button>`;
    }
    const uses = a.uses !== null ? `<span class="ab-uses">${a.usesLeft}/${a.uses}</span>` : '';
    return `<button class="ability-btn" data-ability="${a.id}" title="${a.desc}">
      <span>${a.name} ${uses}</span>
      <span class="ab-cost">${a.cost} PA</span>
    </button>`;
  }).join('');

  box.innerHTML = `
    <div class="ae-header">
      <div class="ae-avatar">${avatarSVG(p, 48)}</div>
      <div>
        <div class="ae-name">${p.name}</div>
        <div class="ae-role">${p.role}</div>
      </div>
    </div>
    <div class="ae-hp">${hpPips}</div>
    <div class="ae-ap">
      <span>PA :</span>
      <span class="ap-pips">${apPips}</span>
      ${p.pushedThisTurn ? '<span style="color:var(--c-lava);font-size:11px">(s\'est dépassé)</span>' : ''}
    </div>
    ${itemLine}
    ${shieldLine}
    <div class="abilities">${abilities}</div>
  `;

  // Activer les boutons de capacité
  box.querySelectorAll('.ability-btn[data-ability]').forEach(btn => {
    btn.addEventListener('click', () => ui.onAbility(btn.dataset.ability));
  });
}

/* Rend la liste de l'équipe (compact). */
export function renderTeamList(game) {
  const list = document.getElementById('team-list');
  list.innerHTML = game.explorers.map((e, i) => {
    const isCurrent = i === game.currentExplorerIdx;
    const hpPips = Array.from({ length: Math.min(e.maxHp, 7) }, (_, k) =>
      `<span class="hp-pip ${k >= e.hp ? 'empty' : ''}"></span>`
    ).join('');
    let stateBadge = '';
    if (e.state === 'down') stateBadge = '<span class="tm-state">À terre</span>';
    else if (e.state === 'escaped') stateBadge = '<span class="tm-state escaped">Sauvé</span>';
    else if (e.state === 'dead') stateBadge = '<span class="tm-state dead">†</span>';
    return `<div class="team-member ${isCurrent ? 'current' : ''} ${e.state === 'down' ? 'down' : ''}">
      <div class="tm-avatar">${avatarSVG(e, 24)}</div>
      <div class="tm-name">${e.name}</div>
      <div class="tm-hp">${hpPips}</div>
      ${stateBadge}
    </div>`;
  }).join('');
}

/* Rend la piste Volcan. */
export function renderVolcanoTrack(game) {
  const track = document.getElementById('volcano-track');
  const v = game.volcano;
  const pct = (v.position / v.max) * 100;
  const danger = v.erupting || v.erupted;
  const color = v.erupted ? '#e8552a' : v.erupting ? '#f5a623' : v.cursed ? '#c1272d' : '#5bd66a';
  track.innerHTML = `
    <div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:linear-gradient(90deg,${color},${color}aa);transition:width .4s;border-radius:13px;"></div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 2px #000;">
      ${v.erupted ? '🌋 EN ÉRUPTION' : v.erupting ? '⚠ PRÊT À ÉRUPTER' : `Éruption dans ${v.position}`}
      ${v.cursed ? ' ☠(maudit)' : ''}
    </div>
  `;
  // Médaille du Chef
  const med = document.getElementById('leader-medallion');
  med.classList.toggle('cursed', game.curseActive);
  med.title = game.curseActive ? 'Chef d\'Expédition (MAUDIT)' : 'Chef d\'Expédition';
  // Numéro de tour
  document.getElementById('turn-number').textContent = game.turn;
}

/* Met à jour tout le HUD. */
export function refreshHUD(game, ui) {
  renderActiveExplorer(game, ui);
  renderTeamList(game);
  renderVolcanoTrack(game);
}
