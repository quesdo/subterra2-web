/* ============================================================
   dice.js — Dés de Péril (animation + résolution)
   ============================================================ */

import { PERIL_FACES, rollPeril } from '../data/perils.js';

/* Affiche la zone de dé de Péril et le dé cliquable. */
export function showPerilZone(game, ui) {
  const zone = document.getElementById('peril-zone');
  zone.classList.remove('hidden');
  const numDice = game.curseActive ? 2 : 1;
  zone.innerHTML = `
    <div class="peril-label">Dé de Péril ${game.curseActive ? '×2 (malédiction)' : ''}</div>
    <div class="peril-dice" id="peril-dice"></div>
  `;
  const diceBox = document.getElementById('peril-dice');
  for (let i = 0; i < numDice; i++) {
    const die = makeDie();
    die.addEventListener('click', () => ui.onRollPeril(i));
    diceBox.appendChild(die);
  }
}

export function hidePerilZone() {
  const zone = document.getElementById('peril-zone');
  zone.classList.add('hidden');
}

function makeDie() {
  const d = document.createElement('div');
  d.className = 'die';
  d.innerHTML = '<span style="font-size:24px">?</span>';
  return d;
}

/* Anime un dé, puis affiche le résultat. callback(faceId) à la fin. */
export function rollAndShow(dieEl, callback) {
  dieEl.classList.add('rolling');
  // Remuer quelques faces au hasard
  let ticks = 0;
  const interval = setInterval(() => {
    const f = PERIL_FACES[Object.keys(PERIL_FACES)[Math.floor(Math.random()*6)]];
    dieEl.innerHTML = `<span class="die-icon" style="display:block;font-size:22px">${f.glyph}</span>`;
    ticks++;
    if (ticks > 6) {
      clearInterval(interval);
      dieEl.classList.remove('rolling');
      const faceId = rollPeril();
      const face = PERIL_FACES[faceId];
      dieEl.innerHTML = `<span class="die-icon" style="display:block;font-size:22px">${face.glyph}</span>`;
      dieEl.title = face.label;
      dieEl.style.borderColor = face.color;
      callback(faceId);
    }
  }, 70);
}

/* Affiche le résultat d'un dé à 6 faces numérique (combat/piège/effondrement). */
export function showNumericDie(value, label) {
  // Pour l'instant, juste un log. L'animation se fera dans le journal.
}
