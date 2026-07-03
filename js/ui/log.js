/* ============================================================
   log.js — Journal d'événements + toasts
   ============================================================ */

let collapsed = false;

export function initLog() {
  const header = document.getElementById('log-header');
  header.addEventListener('click', () => {
    collapsed = !collapsed;
    document.getElementById('log-content').classList.toggle('collapsed', collapsed);
    header.querySelector('.log-toggle').textContent = collapsed ? '▸' : '▾';
  });
}

export function refreshLog(game) {
  const box = document.getElementById('log-content');
  // Afficher les 60 dernières entrées (les plus récentes en bas)
  const recent = game.logEntries.slice(-60);
  box.innerHTML = recent.map(e =>
    `<div class="log-entry ${e.type || ''}">
      <span class="le-turn">T${e.turn}</span> ${e.msg}
    </div>`
  ).join('');
  box.scrollTop = box.scrollHeight;
}

/* Toast éphémère. */
export function toast(msg, type = '') {
  const zone = document.getElementById('toast-zone');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  zone.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

/* Modale de confirmation. */
export function showModal(title, body, buttons) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.innerHTML = `
    <h3>${title}</h3>
    <div>${body}</div>
    <div class="modal-actions"></div>
  `;
  const actions = box.querySelector('.modal-actions');
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (b.style || 'btn-ghost');
    btn.textContent = b.label;
    btn.addEventListener('click', () => {
      hideModal();
      if (b.onClick) b.onClick();
    });
    actions.appendChild(btn);
  }
  overlay.classList.remove('hidden');
}

/* Marque une modale comme "latérale" (panneau à droite, plateau visible). */
export function showModalSide(title, body, buttons) {
  showModal(title, body, buttons);
  document.getElementById('modal-overlay').classList.add('side');
}

export function hideModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('side');
}
