/* hud.js — HUD panel: active explorer, team, volcano track (volcano-organic theme) */
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

  /* ── HP hearts ── */
  const hearts = Array.from({ length: active.maxHp }, (_, i) =>
    `<span class="hud-heart ${i < active.hp ? 'filled' : 'empty'}">${HEART_SVG}</span>`
  ).join('');

  /* ── AP gems ── */
  const maxAp = 3;
  const gems = Array.from({ length: maxAp }, (_, i) =>
    `<span class="hud-gem ${i < state.ap ? 'available' : 'spent'}"></span>`
  ).join('');

  /* ── Item slot ── */
  const itemHtml = active.item
    ? `<div class="hud-item-slot" title="${active.item === 'key' ? 'Clé' : 'Artefact'}">
         ${active.item === 'key' ? '🔑' : '★'}
       </div>`
    : '';

  /* ── Shield ── */
  const shieldHtml = active.shielded
    ? `<div class="hud-shield" title="Bouclier actif">🛡</div>`
    : '';

  /* ── State badge ── */
  let stateBadge = '';
  if (active.state === 'down') {
    stateBadge = `<span class="hud-state-badge down">À terre</span>`;
  } else if (active.state === 'dead') {
    stateBadge = `<span class="hud-state-badge dead">Mort</span>`;
  } else if (active.state === 'escaped') {
    stateBadge = `<span class="hud-state-badge escaped">Sorti</span>`;
  }

  /* ── Abilities ── */
  const abilityCards = def.abilities.map(abId => {
    const ab = ABILITIES[abId];
    if (!ab) return '';
    const usesLeft = active.abilityUsesLeft?.[abId];
    const usesTotal = ab.uses;
    const usesText = usesTotal != null ? ` <span class="hud-ab-uses">${usesLeft ?? 0}/${usesTotal}</span>` : '';
    const costLabel = ab.passive
      ? `<span class="hud-ab-cost passive">Passif</span>`
      : ab.costType === 'hp'
        ? `<span class="hud-ab-cost hp">${ab.cost} PV</span>`
        : `<span class="hud-ab-cost">${ab.cost} PA</span>`;

    if (ab.passive) {
      return `
        <div class="hud-ability-card passive" title="${ab.description}">
          <div class="hud-ab-name">${ab.name}</div>
          <div class="hud-ab-row">${costLabel}${usesText}</div>
        </div>`;
    }

    const canUse = canUseAbility(state, abId);
    return `
      <div class="hud-ability-card ${canUse ? 'enabled' : 'disabled'}" data-ability="${abId}" title="${ab.description}">
        <div class="hud-ab-name">${ab.name}</div>
        <div class="hud-ab-row">${costLabel}${usesText}</div>
      </div>`;
  }).join('');

  /* ── Team list ── */
  const teamHtml = state.explorers.map((e, i) => {
    const d = EXPLORERS.find(ex => ex.id === e.id);
    const isCurrent = i === state.currentExplorerIdx;
    const rowClasses = [
      'hud-team-row',
      isCurrent ? 'current' : '',
      e.state === 'down' ? 'downed' : '',
      e.state === 'dead' ? 'dead' : '',
      e.state === 'escaped' ? 'escaped' : '',
    ].filter(Boolean).join(' ');

    const miniHearts = Array.from({ length: e.maxHp }, (_, j) =>
      `<span class="hud-mini-heart ${j < e.hp ? 'filled' : 'empty'}">${HEART_SVG}</span>`
    ).join('');

    let stateIcon = '';
    if (e.state === 'down') stateIcon = '<span class="hud-team-state">↓</span>';
    else if (e.state === 'dead') stateIcon = '<span class="hud-team-state">💀</span>';
    else if (e.state === 'escaped') stateIcon = '<span class="hud-team-state escaped">↑</span>';

    return `
      <div class="${rowClasses}">
        <img class="hud-team-avatar" src="assets/images/explorers/${e.id}.png" alt=""
             style="border-color:${d?.color || '#999'}">
        <span class="hud-team-name">${d?.name || e.id}</span>
        <div class="hud-team-hearts">${miniHearts}</div>
        ${stateIcon}
      </div>`;
  }).join('');

  /* ── Volcano track ── */
  const vp = state.volcano.position;
  const maxVolcano = 27;
  const trackPct = Math.max(0, Math.min(100, ((maxVolcano - vp) / maxVolcano) * 100));
  const volcanoStatus = vp === 0
    ? '<span class="hud-volcano-ready">PRÊT!</span>'
    : `<span class="hud-volcano-num">${vp}</span>`;
  const cursedHtml = state.volcano.cursed ? '<span class="hud-volcano-cursed">☠</span>' : '';

  /* ── Keys ── */
  const keysHtml = state.keysPlacedOnSanctuary > 0
    ? `<div class="hud-keys"><span class="hud-key-slot">🔑</span> ${state.keysPlacedOnSanctuary}/3</div>`
    : '';

  panel.innerHTML = `
    <div class="hud-card hud-active-card" style="--explorer-color:${color};">
      <div class="hud-portrait-row">
        <img class="hud-explorer-portrait" src="assets/images/explorers/${active.id}.png" alt=""
             style="border-color:${color}; box-shadow:0 0 14px ${color}55, inset 0 0 8px rgba(0,0,0,.3);">
        <div class="hud-portrait-info">
          <div class="hud-active-name" style="color:${color}">${def.name || active.id}</div>
          <div class="hud-active-role">${def.role || ''}</div>
          <div class="hud-badges">${stateBadge}${shieldHtml}${itemHtml}</div>
        </div>
      </div>
      <div class="hud-stat-row">
        <span class="hud-stat-label">PV:</span>
        <div class="hud-hp-hearts">${hearts}</div>
        <span class="hud-stat-num">${active.hp}/${active.maxHp}</span>
      </div>
      <div class="hud-stat-row">
        <span class="hud-stat-label">PA:</span>
        <div class="hud-ap-gems">${gems}</div>
        <span class="hud-stat-num">${state.ap}</span>
      </div>
    </div>

    <div class="hud-section-title">Capacités</div>
    <div class="hud-abilities">${abilityCards}</div>

    <div class="hud-section-title">Expédition</div>
    <div class="hud-team-list">${teamHtml}</div>

    <div class="hud-volcano-track ${state.volcano.erupted ? 'erupted' : state.volcano.erupting ? 'erupting' : ''}">
      <div class="hud-volcano-bar">
        <div class="hud-volcano-fill" style="width:${trackPct}%"></div>
        <div class="hud-volcano-marker" style="left:${trackPct}%"></div>
      </div>
      <div class="hud-volcano-label">
        🔥 Éruption: ${volcanoStatus} ${cursedHtml}
      </div>
    </div>

    ${keysHtml}
  `;

  /* ── Wire up ability buttons ── */
  panel.querySelectorAll('.hud-ability-card.enabled[data-ability]').forEach(btn => {
    btn.addEventListener('click', () => {
      const abId = btn.dataset.ability;
      if (window.ui && typeof window.ui.onAbility === 'function') {
        window.ui.onAbility(abId);
      }
    });
  });
}
