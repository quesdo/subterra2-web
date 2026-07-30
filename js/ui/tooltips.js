/* ============================================================
   tooltips.js — Bulles d'aide au survol (hover)
   Affiche une carte riche (titre + coût + description) au survol
   de tout élément porteur d'un attribut data-tip au format JSON :
     data-tip='{"title":"Révéler","cost":"1 PA","desc":"..."}'
   La bulle suit la souris et se repositionne pour rester à l'écran.
   ============================================================ */

let tipEl = null;        // l'élément .tip-card injecté dans le DOM
let hideTimer = null;    // retard de disparition (évite le clignotement)
const SHOW_DELAY = 120;  // ms avant affichage
const HIDE_DELAY = 180;  // ms avant disparition
let showTimer = null;

/* Crée (une fois) l'élément tooltip dans le DOM. */
function ensureTipEl() {
  if (tipEl && document.body.contains(tipEl)) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'tip-card hidden';
  document.body.appendChild(tipEl);
  return tipEl;
}

/* Attache les écouteurs de survol sur tous les [data-tip] d'un conteneur.
   Sécurisé contre les double-câblages (flag dataset). */
export function attachTooltips(root = document) {
  const els = root.querySelectorAll('[data-tip]:not([data-tip-wired])');
  for (const el of els) {
    el.setAttribute('data-tip-wired', '1');
    el.addEventListener('mouseenter', () => scheduleShow(el));
    el.addEventListener('mousemove', positionNear);
    el.addEventListener('mouseleave', scheduleHide);
    el.addEventListener('mousedown', scheduleHide);
    // Désactive le tooltip natif pour ne pas avoir de double-bulle
    el.removeAttribute('title');
  }
}

/* Programme l'affichage (avec léger délai pour éviter le flash au passage). */
function scheduleShow(el) {
  clearTimeout(hideTimer);
  clearTimeout(showTimer);
  showTimer = setTimeout(() => show(el), SHOW_DELAY);
}

/* Affiche la bulle pour l'élément donné. */
function show(el) {
  const tip = ensureTipEl();
  let data;
  try { data = JSON.parse(el.getAttribute('data-tip') || '{}'); }
  catch { data = {}; }
  const title = data.title || '';
  const cost = data.cost || '';
  const desc = data.desc || '';
  tip.innerHTML = `
    <div class="tip-head">
      <span class="tip-title">${title}</span>
      ${cost ? `<span class="tip-cost">${cost}</span>` : ''}
    </div>
    ${desc ? `<div class="tip-desc">${desc}</div>` : ''}`;
  tip.classList.remove('hidden');
  positionNear(lastEvent);
}

/* Repositionne la bulle près du curseur, en restant dans la fenêtre. */
let lastEvent = { clientX: 0, clientY: 0 };
function positionNear(e) {
  if (!e) return;
  lastEvent = e;
  const tip = ensureTipEl();
  if (tip.classList.contains('hidden')) return;
  // Mesurer la bulle
  const rect = tip.getBoundingClientRect();
  const w = rect.width || 220;
  const h = rect.height || 60;
  const PAD = 14;
  let x = e.clientX + PAD;
  let y = e.clientY + PAD;
  // Rebond droit
  if (x + w > window.innerWidth - 8) x = e.clientX - w - PAD;
  // Rebond bas
  if (y + h > window.innerHeight - 8) y = e.clientY - h - PAD;
  // Bornes min
  x = Math.max(8, x);
  y = Math.max(8, y);
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}

/* Programme la disparition (avec délai pour tolérer les sauts de souris). */
function scheduleHide() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (tipEl) tipEl.classList.add('hidden');
  }, HIDE_DELAY);
}
