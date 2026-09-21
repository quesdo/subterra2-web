/* hud.js — Compact responsive HUD (volcano-organic theme) */
import { EXPLORERS, ABILITIES } from '../engine/explorers.js';
import { canUseAbility } from '../engine/abilities.js';

const HEART_SVG = `<svg viewBox="0 0 24 24" class="hud-heart-icon"><path d="M12 21s-6.5-4.3-9.5-8.2C.5 9.5 1.5 6 4.5 5c2-.7 4 .3 5 2 .8-.6 2.5-2 5-2 3 0 4.5 3 3.5 5.5C18 16.5 12 21 12 21z"/></svg>`;

export function refreshHUD(state) {
  const panel = document.getElementById('hud-panel');
  if (!panel) return;
  const active = state.explorers[state.currentExplorerIdx];
  if (!active) return;

  const def = EXPLORERS.find(e => e.id === active.id);
  if (!def) return;
  const color = def.color || '#999';

  const hearts = Array.from({ length: active.maxHp }, (_, i) =>
    `<span class="hud-heart ${i < active.hp ? 'filled' : 'empty'}">${HEART_SVG}</span>`
  ).join('');

  const maxAp = 3;
  const gems = Array.from({ length: maxAp }, (_, i) =>
    `<span class="hud-gem ${i < state.ap ? 'available' : 'spent'}"></span>`
  ).join('');

  let badges = '';
  if (active.state === 'down') badges += '<span class="hud-badge down" title="À terre">↓</span>';
  else if (active.state === 'dead') badges += '<span class="hud-badge dead" title="Mort">💀</span>';
  else if (active.state === 'escaped') badges += '<span class="hud-badge escaped" title="Sorti">↑</span>';
  if (active.shielded) badges += '<span class="hud-badge shield" title="Bouclier actif">🛡</span>';
  if (active.item === 'key') badges += '<span class="hud-badge item" title="Porte une Clé">🔑</span>';
  else if (active.item === 'artifact') badges += '<span class="hud-badge item" title="Porte l\'Artefact">★</span>';

  const abilityCards = def.abilities.map(abId => {
    const ab = ABILITIES[abId];
    if (!ab) return '';
    const usesLeft = active.abilityUsesLeft?.[abId];
    const usesTotal = ab.uses;
    const usesText = usesTotal != null ? ` <span class="hud-ab-uses">${usesLeft ?? 0}/${usesTotal}</span>` : '';
    const costLabel = ab.passive
      ? `<span class="hud-ab-cost passive">Passif</span>`
      : ab.costType === 'hp'
        ? `<span class="hud-ab-cost hp">${ab.cost}PV</span>`
        : `<span class="hud-ab-cost">${ab.cost}PA</span>`;
    if (ab.passive) {
      return `<div class="hud-ability-card passive" title="${ab.description}">
        <span class="hud-ab-name">${ab.name}</span>${costLabel}${usesText}
      </div>`;
    }
    const canUse = canUseAbility(state, abId);
    return `<div class="hud-ability-card ${canUse ? 'enabled' : 'disabled'}" data-ability="${abId}" title="${ab.description}">
      <span class="hud-ab-name">${ab.name}</span>${costLabel}${usesText}
    </div>`;
  }).join('');

  const teamHtml = state.explorers.map((e, i) => {
    const d = EXPLORERS.find(ex => ex.id === e.id);
    const isCurrent = i === state.currentExplorerIdx;
    const cls = ['hud-team-row', isCurrent ? 'current' : '',
      e.state === 'down' ? 'downed' : '', e.state === 'dead' ? 'dead' : '',
      e.state === 'escaped' ? 'escaped' : ''].filter(Boolean).join(' ');
    const dots = Array.from({ length: e.maxHp }, (_, j) =>
      `<span class="hud-team-dot ${j < e.hp ? 'filled' : 'empty'}"></span>`
    ).join('');
    let st = '';
    if (e.state === 'down') st = ' ↓';
    else if (e.state === 'dead') st = ' 💀';
    else if (e.state === 'escaped') st = ' ↑';
    return `<div class="${cls}">
      <img class="hud-team-avatar" src="assets/images/explorers/${e.id}.png" alt="" loading="lazy" style="border-color:${d?.color || '#999'}">
      <span class="hud-team-name">${d?.name || e.id}${st}</span>
      <span class="hud-team-dots">${dots}</span>
    </div>`;
  }).join('');

  const vp = state.volcano.position;
  const maxVolcano = 27;
  const trackPct = Math.max(0, Math.min(100, ((maxVolcano - vp) / maxVolcano) * 100));
  const volcanoStatus = vp === 0
    ? '<span class="hud-volcano-ready">PRÊT!</span>'
    : `<span class="hud-volcano-num">${vp}</span>`;
  const cursedHtml = state.volcano.cursed ? ' <span class="hud-volcano-cursed">☠</span>' : '';
  const volcanoClass = state.volcano.erupted ? 'erupted' : state.volcano.erupting ? 'erupting' : '';

  const keysHtml = state.keysPlacedOnSanctuary > 0
    ? `<div class="hud-keys">🔑 ${state.keysPlacedOnSanctuary}/3</div>`
    : '';

  panel.innerHTML = `
    <div class="hud-card hud-active-card" style="--explorer-color:${color};">
      <div class="hud-active-header">
        <img class="hud-active-portrait" src="assets/images/explorers/${active.id}.png" alt=""
             style="border-color:${color}; box-shadow:0 0 10px ${color}44;">
        <div class="hud-active-info">
          <div class="hud-active-name" style="color:${color}">${def.name || active.id}</div>
          <div class="hud-active-role">${def.role || ''}</div>
          <div class="hud-active-badges">${badges}</div>
        </div>
      </div>
      <div class="hud-stats">
        <span class="hud-hearts">${hearts}</span>
        <span class="hud-hearts-num">${active.hp}/${active.maxHp}PV</span>
      </div>
      <div class="hud-stats">
        <span class="hud-gems">${gems}</span>
        <span class="hud-gems-num">${state.ap}PA</span>
      </div>
    </div>
    <div class="hud-section-title">Capacités</div>
    <div class="hud-abilities">${abilityCards}</div>
    <div class="hud-section-title">Expédition</div>
    <div class="hud-team-list">${teamHtml}</div>
    <div class="hud-volcano-track ${volcanoClass}">
      <div class="hud-volcano-bar">
        <div class="hud-volcano-fill" style="width:${trackPct}%"></div>
        <div class="hud-volcano-marker" style="left:${trackPct}%"></div>
      </div>
      <div class="hud-volcano-label">🔥 ${volcanoStatus}${cursedHtml}</div>
    </div>
    ${keysHtml}
  `;

  panel.querySelectorAll('.hud-ability-card.enabled[data-ability]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.ui && typeof window.ui.onAbility === 'function') {
        window.ui.onAbility(btn.dataset.ability);
      }
    });
  });
}
