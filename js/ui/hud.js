/* ============================================================
   hud.js — Portrait actif (barre basse), liste d'équipe (panneau
   droit), bannière de progression (tour + éruption)
   ============================================================ */

import { VOLCANO_MAX } from '../engine/volcano.js';
import { avatarHTML, avatarSVG } from './avatar.js';
export { avatarSVG, avatarHTML } from './avatar.js';

/* Petit helper : cœur plein ou vide pour la jauge de vie. */
function heartSVG(filled) {
  return filled
    ? `<span class="hp-heart" title="Point de vie">❤️</span>`
    : `<span class="hp-heart empty" title="PV perdu">🤍</span>`;
}

/* Génère les graduations de la barre de progression (une fois). */
function ensureProgressTicks(max) {
  const ticks = document.getElementById('progress-ticks');
  if (!ticks) return;
  if (ticks.childElementCount === max) return;
  ticks.innerHTML = '';
  for (let i = 0; i < max; i++) {
    const t = document.createElement('div');
    t.className = 'tick';
    ticks.appendChild(t);
  }
}

/* Rend le portrait de l'Explorateur actif (colonne gauche, grand). */
export function renderActiveExplorer(game, ui) {
  const p = game.explorers[game.currentExplorerIdx];
  const box = document.getElementById('active-explorer');
  const hpPips = Array.from({ length: p.maxHp }, (_, i) => heartSVG(i < p.hp)).join('');
  const apPips = Array.from({ length: 3 }, (_, i) =>
    `<span class="ap-pip ${i >= game.ap ? 'spent' : ''}"></span>`
  ).join('');

  box.classList.toggle('down', p.state === 'down');
  box.innerHTML = `
    <div class="ae-portrait">${avatarHTML(p, 180, { rounded: false })}</div>
    <div class="ae-name" title="${p.name} — ${p.role}">${p.name}</div>
    <div class="ae-role">${p.role}</div>
    <div class="ae-hp">${hpPips}</div>
    <div class="ae-ap">
      <span class="ap-label">PA</span>
      <span class="ap-pips">${apPips}</span>
    </div>
    <div class="ae-tags">
      ${p.pushedThisTurn ? '<span class="ae-tag" style="color:var(--c-violet)" title="S\'est dépassé ce tour">💪 Dépassé</span>' : ''}
      ${p.item ? `<span class="ae-tag" title="${p.item === 'key' ? 'Porte une Clé' : 'Porte l\'Artefact'}">${p.item === 'key' ? '🔑 Clé' : '🔮 Artefact'}</span>` : ''}
      ${p.shielded ? '<span class="ae-tag" style="color:#5bd6c7" title="Protégé (Se préparer)">🛡 Protégé</span>' : ''}
    </div>
  `;
}

/* Rend la liste ordonnée de l'équipe (panneau droit). */
export function renderTeamList(game) {
  const list = document.getElementById('team-list');
  list.innerHTML = game.explorers.map((e, i) => {
    const isCurrent = i === game.currentExplorerIdx;
    const hpPips = Array.from({ length: Math.min(e.maxHp, 7) }, (_, k) => heartSVG(k < e.hp)).join('');
    let stateBadge = '';
    if (e.state === 'down') stateBadge = '<span class="tm-state">À terre</span>';
    else if (e.state === 'escaped') stateBadge = '<span class="tm-state escaped">Sauvé</span>';
    else if (e.state === 'dead') stateBadge = '<span class="tm-state dead">†</span>';
    const keyIcon = e.item === 'key' ? '<span class="tm-key" title="Porte une Clé">🔑</span>' : '';
    return `<div class="team-member ${isCurrent ? 'current' : ''} ${e.state === 'down' ? 'down' : ''}">
      <div class="tm-avatar">${avatarHTML(e, 38, { rounded: true })}</div>
      <div class="tm-info">
        <div class="tm-name">${e.name}</div>
        <div class="tm-role">${e.role}</div>
        <div class="tm-hp">${hpPips}${keyIcon}${stateBadge}</div>
      </div>
    </div>`;
  }).join('');
}

/* Rend la bannière de progression : tours restants avant éruption
   (badge qui glisse le long de la barre), compteur d'éruption à droite,
   médaille du Chef.
   v.position = nombre de "cases" restantes avant éruption (décompte
   de ~17-28 vers 0). On l'affiche comme "tours restants" et le badge
   glisse de la gauche (plein) vers la droite (éruption). */
export function renderVolcanoTrack(game) {
  const v = game.volcano;
  const remaining = v.position;
  const total = v.max;
  // Ratio "avancée vers l'éruption" : 0 au début, 1 à l'éruption.
  const advance = 1 - (remaining / total);

  // Badge "tours restants" — glisse le long de la barre
  const turnNum = document.getElementById('turn-number');
  const turnBadge = document.getElementById('turn-badge');
  if (turnNum) {
    turnNum.textContent = v.erupted ? '—' : (v.erupting ? '0' : remaining);
  }
  if (turnBadge) {
    turnBadge.classList.toggle('cursed', game.curseActive);
    // Le badge se déplace de gauche (5%) à droite (95%) selon l'avancée
    const leftPct = 5 + advance * 90;
    turnBadge.style.left = `${leftPct}%`;
    // Couleur progressive : vert -> orange -> rouge
    if (v.erupted || v.erupting) {
      turnBadge.style.background = 'linear-gradient(180deg, var(--c-blood), #6a1018)';
      turnBadge.style.borderColor = '#fff';
    } else if (advance > 0.66) {
      turnBadge.style.background = 'linear-gradient(180deg, var(--c-blood), #8a1a20)';
      turnBadge.style.borderColor = 'var(--c-blood)';
    } else if (advance > 0.33) {
      turnBadge.style.background = 'linear-gradient(180deg, var(--c-ember), var(--c-lava-dim))';
      turnBadge.style.borderColor = 'var(--c-ember)';
    } else {
      turnBadge.style.background = 'linear-gradient(180deg, #6ab46a, #3a8a4a)';
      turnBadge.style.borderColor = '#6ab46a';
    }
  }

  // Barre de progression graduée : remplie selon l'avancée vers l'éruption
  ensureProgressTicks(total);
  const fill = document.getElementById('progress-fill');
  if (fill) {
    fill.style.width = `${advance * 100}%`;
  }

  // Indicateur d'éruption (texte + icône)
  const ind = document.getElementById('eruption-indicator');
  const txt = document.getElementById('eruption-text');
  if (ind && txt) {
    ind.classList.toggle('erupting', !!v.erupting && !v.erupted);
    ind.classList.toggle('erupted', !!v.erupted);
    const icon = ind.querySelector('.eruption-icon');
    if (v.erupted) { txt.textContent = 'ÉRUPTION'; if (icon) icon.textContent = '🌋'; }
    else if (v.erupting) { txt.textContent = 'IMMINENTE'; if (icon) icon.textContent = '⚠️'; }
    else { txt.textContent = `${remaining} tour${remaining > 1 ? 's' : ''}`; if (icon) icon.textContent = '🔥'; }
    ind.title = v.cursed
      ? (v.erupted ? 'Éruption en cours (maudite)' : `Éruption dans ${remaining} — malédiction active (+2/tour)`)
      : (v.erupted ? 'Éruption en cours' : v.erupting ? 'Éruption imminente !' : `Éruption dans ${remaining} tour${remaining > 1 ? 's' : ''}`);
  }

  // Médaille du Chef
  const med = document.getElementById('leader-medallion');
  if (med) {
    med.classList.toggle('cursed', game.curseActive);
    med.title = game.curseActive ? "Chef d'Expédition (MAUDIT)" : "Chef d'Expédition";
  }

  // Piste Volcan originale (masquée mais conservée pour compat éventuelle)
  const track = document.getElementById('volcano-track');
  if (track) track.dataset.position = String(v.position);
}

/* Met à jour tout le HUD. */
export function refreshHUD(game, ui) {
  renderActiveExplorer(game, ui);
  renderTeamList(game);
  renderVolcanoTrack(game);
}
