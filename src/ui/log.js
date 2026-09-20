/* log.js — Event log + toast notifications */
export function refreshLog(state) {
  const el = document.getElementById('log-content');
  if (!el) return;
  const entries = state.log.slice(-50);
  el.innerHTML = entries.map(msg => {
    let cls = 'log-entry';
    if (msg.includes('Victoire') || msg.includes('Artefact')) cls += ' good';
    if (msg.includes('Défaite') || msg.includes('englouti') || msg.includes('mort')) cls += ' bad';
    if (msg.includes('Péril') || msg.includes('Gardien') || msg.includes('éruption') || msg.includes('lave')) cls += ' peril';
    return `<div class="${cls}">${msg}</div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

export function toast(msg, type = '') {
  const zone = document.getElementById('toast-zone');
  if (!zone) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  zone.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
