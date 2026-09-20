/* hud.js — HUD panel: active explorer, team, volcano track */
import { EXPLORERS } from '../engine/explorers.js';

export function refreshHUD(state) {
  const panel = document.getElementById('hud-panel');
  if (!panel) return;
  const active = state.explorers[state.currentExplorerIdx];
  if (!active) return;

  const def = EXPLORERS.find(e => e.id === active.id);

  const hpPips = Array.from({ length: active.maxHp }, (_, i) =>
    `<span class="hp-pip ${i >= active.hp ? 'empty' : ''}"></span>`
  ).join('');

  const apPips = Array.from({ length: 3 }, (_, i) =>
    `<span class="ap-pip ${i >= state.ap ? 'spent' : ''}"></span>`
  ).join('');

  const stateTag = active.state === 'active' ? '' :
    `<span class="hud-state-tag ${active.state}">${active.state === 'down' ? 'À terre' : active.state === 'dead' ? 'Mort' : 'Sorti'}</span>`;

  const itemTag = active.item ? ` <span style="font-size:14px">${active.item === 'key' ? '🔑' : '★'}</span>` : '';

  const shieldTag = active.shielded ? ' 🛡' : '';

  const teamHtml = state.explorers.map((e, i) => {
    const d = EXPLORERS.find(ex => ex.id === e.id);
    const isCurrent = i === state.currentExplorerIdx;
    const stateLabel = e.state === 'down' ? ' ↓' : e.state === 'dead' ? ' ✕' : e.state === 'escaped' ? ' ↑' : '';
    return `
      <div class="hud-team-member ${isCurrent ? 'current' : ''}">
        <img class="hud-team-avatar" src="assets/images/explorers/${e.id}.png" alt="" style="border-color:${d?.color || '#999'}">
        <span class="tm-name">${d?.name || e.id}${stateLabel}</span>
        <span class="tm-hp">${e.hp}/${e.maxHp}</span>
      </div>
    `;
  }).join('');

  const volcanoClass = state.volcano.erupted ? 'erupted' : state.volcano.erupting ? 'erupting' : '';
  const keysText = state.keysPlacedOnSanctuary > 0
    ? `<div class="hud-keys">🔑 Clés: ${state.keysPlacedOnSanctuary}/3</div>`
    : '';

  panel.innerHTML = `
    <div class="hud-active">
      <img class="hud-active-avatar" src="assets/images/explorers/${active.id}.png" alt="" style="border-color:${def?.color || '#999'}">
      <div class="hud-active-name" style="color:${def?.color || '#fff'}">${def?.name || active.id}${shieldTag}${itemTag}</div>
      <div class="hud-active-role">${def?.role || ''}</div>
      <div class="hud-hp">${hpPips}</div>
      <div class="hud-ap">PA: ${apPips} (${state.ap})</div>
      ${stateTag}
    </div>
    <h3>Expédition</h3>
    <div class="hud-team-list">${teamHtml}</div>
    <div class="hud-volcano ${volcanoClass}">
      <span class="vlabel">🔥 Éruption: </span><span class="vpos">${state.volcano.position}</span>
      ${state.volcano.cursed ? ' ☠' : ''}
    </div>
    ${keysText}
  `;
}
