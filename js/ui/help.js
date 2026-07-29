/* ============================================================
   help.js — Overlay d'aide en jeu
   Explique : actions (coûts PA), capacités (par Explorateur),
   dé de Péril, tuiles du Temple, Gardiens, Volcan/Artefact.
   Le contenu est généré depuis les données du moteur pour rester
   toujours synchronisé avec les règles réellement codées.
   ============================================================ */

import { ABILITIES, EXPLORERS } from '../data/explorers.js';
import { PERIL_FACES, PERIL_DIE } from '../data/perils.js';
import { TILE_TYPES } from '../data/tiles.js';

/* Définition des actions de base (miroir de actions.js, coûts officiels). */
const BASE_ACTIONS = [
  { icon: '🗺', name: 'Révéler',     cost: 1, desc: "Piochez une tuile du Sac et placez-la connectée à votre tuile, dans l'orientation voulue." },
  { icon: '🚶', name: 'Se déplacer', cost: 1, desc: "Déplacez votre Explorateur sur une tuile adjacente et connectée." },
  { icon: '🔦', name: 'Explorer',    cost: 1, desc: "Révélez une tuile ET y entrez immédiatement (plus rapide, plus risqué)." },
  { icon: '✚', name: 'Soigner',     cost: 1, desc: "Récupérez 1 PV, ou soignez un Explorateur sur votre tuile (+1 PV)." },
  { icon: '✋', name: 'Manier un objet', cost: 1, desc: "Ramassez, prenez, donnez ou déposez un objet (Clé/Artefact). Un seul objet par Explorateur." },
  { icon: '⚔', name: 'Attaquer',    cost: 1, desc: "Lancez le dé : sur 4+, éliminez un Gardien sur votre tuile." },
  { icon: '🏃', name: 'Courir',     cost: 2, desc: "Réalisez jusqu'à 3 fois l'action Se déplacer." },
  { icon: '⛏', name: 'Creuser',     cost: 2, desc: "Enlevez un marqueur Éboulis de votre tuile ou d'une tuile adjacente connectée." },
];

/* Onglets de l'overlay. */
const TABS = [
  { id: 'actions',   label: 'Actions',    icon: '⚡' },
  { id: 'abilities', label: 'Capacités',  icon: '✨' },
  { id: 'perils',    label: 'Périls',     icon: '🎲' },
  { id: 'tiles',     label: 'Tuiles',     icon: '🧱' },
  { id: 'guardians', label: 'Gardiens',   icon: '👁' },
  { id: 'volcano',   label: 'Volcan',     icon: '🌋' },
];

let activeTab = 'actions';

/* Affiche l'overlay d'aide (plein écran, par-dessus le plateau). */
export function showHelp() {
  const overlay = document.getElementById('help-overlay');
  overlay.innerHTML = buildHelpHTML();
  overlay.classList.remove('hidden');
  wireHelpEvents();
}

export function hideHelp() {
  const overlay = document.getElementById('help-overlay');
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
}

/* Construit le HTML complet de l'overlay. */
function buildHelpHTML() {
  const tabs = TABS.map(t =>
    `<button class="help-tab ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">
       <span class="ht-icon">${t.icon}</span><span class="ht-label">${t.label}</span>
     </button>`
  ).join('');
  return `
    <div class="help-box" role="dialog" aria-modal="true" aria-label="Aide">
      <header class="help-header">
        <h3>📖 Aide de jeu</h3>
        <button class="help-close" id="help-close" title="Fermer (Échap)">✕</button>
      </header>
      <nav class="help-tabs">${tabs}</nav>
      <div class="help-body" id="help-body">${buildTabContent(activeTab)}</div>
    </div>`;
}

/* Bascule d'onglet sans tout reconstruire. */
function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.help-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tabId));
  document.getElementById('help-body').innerHTML = buildTabContent(tabId);
  document.getElementById('help-body').scrollTop = 0;
}

function wireHelpEvents() {
  document.getElementById('help-close').addEventListener('click', hideHelp);
  document.querySelectorAll('.help-tab').forEach(b =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)));
}

/* ============================================================
   Contenu de chaque onglet
   ============================================================ */

function buildTabContent(tabId) {
  switch (tabId) {
    case 'actions':   return tabActions();
    case 'abilities': return tabAbilities();
    case 'perils':    return tabPerils();
    case 'tiles':     return tabTiles();
    case 'guardians': return tabGuardians();
    case 'volcano':   return tabVolcano();
    default:          return '';
  }
}

/* --- Onglet ACTIONS --- */
function tabActions() {
  const rows = BASE_ACTIONS.map(a => `
    <div class="ref-row">
      <span class="ref-icon">${a.icon}</span>
      <div class="ref-main">
        <div class="ref-name">${a.name} <span class="ref-cost">${a.cost} PA</span></div>
        <div class="ref-desc">${a.desc}</div>
      </div>
    </div>`).join('');
  return `
    <p class="ref-intro">À son tour, un Explorateur dispose de <b>2 points d'action (PA)</b>. Une même action peut être répétée. Il n'est pas obligé de tout dépenser.</p>
    <div class="ref-list">${rows}</div>
    <div class="ref-note">
      <b>💪 Se dépasser</b> — 1× par tour : <b>−1 PV, +1 PA</b>.<br>
      <b>🦎 À terre (0 PV)</b> — ne peut que <b>Ramper</b> (1 déplacement). Cap. passives actives. Lance quand même le dé de Péril.
    </div>`;
}

/* --- Onglet CAPACITÉS (regroupées par Explorateur) --- */
function tabAbilities() {
  const cards = EXPLORERS.map(ex => {
    const abilities = ex.abilities.map(aid => ABILITIES[aid]).filter(Boolean);
    const abs = abilities.map(a => `
      <div class="ability-ref ${a.passive ? 'passive' : ''}">
        <div class="ar-top">
          <span class="ar-name">${a.name}</span>
          ${a.passive
            ? `<span class="ar-tag passive">passive</span>`
            : `<span class="ar-tag">${a.cost} PA</span>`}
          ${a.uses !== null ? `<span class="ar-uses">×${a.uses}</span>` : ''}
        </div>
        <div class="ar-desc">${a.desc}</div>
      </div>`).join('');
    return `
      <div class="explorer-ref" style="--ex-color:${ex.color}">
        <div class="er-head">
          <span class="er-glyph">${ex.glyph}</span>
          <span class="er-name">${ex.name}</span>
          <span class="er-role">${ex.role}</span>
          <span class="er-hp">${'❤'.repeat(ex.pv)} ${ex.pv} PV</span>
        </div>
        <div class="er-abilities">${abs}</div>
      </div>`;
  }).join('');
  return `
    <p class="ref-intro">Chaque Explorateur possède <b>2 capacités</b>. Les <b>passives</b> sont toujours actives ; les autres coûtent des PA.</p>
    <div class="explorer-ref-list">${cards}</div>`;
}

/* --- Onglet PÉRILS (dé de Péril) --- */
function tabPerils() {
  const rows = PERIL_DIE.map(faceId => {
    const f = PERIL_FACES[faceId];
    return `
      <div class="ref-row">
        <span class="ref-icon peril" style="background:${f.color}">${f.glyph}</span>
        <div class="ref-main">
          <div class="ref-name">${f.label}</div>
          <div class="ref-desc">${f.desc}</div>
        </div>
      </div>`;
  }).join('');
  return `
    <p class="ref-intro">À la fin de <b>chaque tour de joueur</b>, on lance le dé de Péril. <b>Après l'Artefact</b> (malédiction) : on lance <b>2 dés</b> résolus dans n'importe quel ordre.</p>
    <div class="ref-list">${rows}</div>`;
}

/* --- Onglet TUILES --- */
function tabTiles() {
  // Effets à la pose / déclencheurs (manuel pp.16-18)
  const effects = {
    normal:    "Aucune particularité.",
    bridge:    "1 seul Explorateur à la fois. Les Gardiens peuvent y entrer même si elle est occupée.",
    key:       "Pose : placez un marqueur Clé. Récupérable via Manier un objet (nécessaire pour le Sanctuaire).",
    lava:      "Tous les Explorateurs dessus perdent 1 PV à chaque 🌋 Lave au dé de Péril.",
    spikes:    "À l'entrée : jet de dé, 1-3 = piège déclenché. Effet : tous sur la tuile perdent 2 PV.",
    darts:     "Se déclenche via le dé de Péril (pas à l'entrée). Tuile + adjacentes connectées perdent 1 PV.",
    ruins:     "Pose : marqueur Éboulis (bloque l'entrée). Effondrement possible au dé = 2 PV + Gardiens éliminés.",
    guardian:  "Pose : un Gardien s'y matérialise. Réveiller un Gardien en place le plus proche ici.",
    journal:   "Tuile de l'Aristocrate (Rechercher). Se comporte comme une Normale.",
    entry:     "Entrée/sortie du Temple. Départ sur le croisement. La sortie = sauvé (mais sans action).",
    lateral:   "De part et d'autre de l'Entrée. Ancre des tuiles Gardien (aucun au départ).",
    sanctuary: "Découvert quand le sac est vide (colonne la plus profonde). 3 Clés pour le déverrouiller.",
  };
  const order = ['normal','bridge','key','lava','spikes','darts','ruins','guardian','journal','entry','lateral','sanctuary'];
  const rows = order.map(t => {
    const def = TILE_TYPES[t];
    if (!def) return '';
    return `
      <div class="ref-row">
        <span class="ref-icon" style="color:${def.color}">${def.icon || '▦'}</span>
        <div class="ref-main">
          <div class="ref-name">${def.label}</div>
          <div class="ref-desc">${effects[t] || ''}</div>
        </div>
      </div>`;
  }).join('');
  return `
    <p class="ref-intro"><b>9 types</b> de tuiles Temple + les tuiles spéciales (Entrée, Latérales, Sanctuaire, Journal).</p>
    <div class="ref-list">${rows}</div>`;
}

/* --- Onglet GARDIENS --- */
function tabGuardians() {
  return `
    <p class="ref-intro">La <b>Légion Cendrée</b> est l'IA du jeu. 5 Gardiens au total dans la réserve.</p>
    <div class="ref-block">
      <h4>Placement</h4>
      <ul>
        <li>Quand une tuile <b>Gardien</b> est posée → un Gardien s'y materialise.</li>
        <li>Péril <b>👁 Réveiller un Gardien</b> → tuile Gardien la plus proche (chemin le plus court).</li>
        <li>On peut empiler plusieurs Gardiens sur la même tuile.</li>
      </ul>
    </div>
    <div class="ref-block">
      <h4>Activation (2× fin de tour + péril Activer)</h4>
      <p>Chaque Gardien réalise la <b>première action possible</b> :</p>
      <ol>
        <li><b>Attaquer</b> — si un Explorateur <i>actif</i> est sur sa tuile : il perd 1 PV (le Chef d'Expédition choisit qui si plusieurs).</li>
        <li><b>Se déplacer</b> — d'une tuile vers l'Explorateur actif le plus proche (chemin non bloqué par un Éboulis).</li>
        <li><b>Creuser</b> — enlève un Éboulis adjacent (franchir le passage).</li>
      </ol>
    </div>
    <div class="ref-block">
      <h4>Fuir & Éliminer</h4>
      <ul>
        <li><b>Fuir</b> une tuile avec Gardien(s) = <b>−1 PV par Gardien</b>. Si dernier PV perdu → on s'effondre sur la tuile visée.</li>
        <li><b>Éliminer</b> : Attaquer (4+), capacité spéciale, Ruine qui s'effondre, tuile retournée face Volcan.</li>
        <li>Les Gardiens ignorent les pièges et la lave.</li>
      </ul>
    </div>`;
}

/* --- Onglet VOLCAN & ARTEFACT --- */
function tabVolcano() {
  return `
    <p class="ref-intro">Le <b>compte à rebours</b> de la partie. Le marqueur Éruption recule à chaque fin de tour.</p>
    <div class="ref-block">
      <h4>Éruption</h4>
      <ul>
        <li>Marqueur à 0 → le volcan est <b>prêt</b>.</li>
        <li>Au prochain 🌋 <b>Lave</b> au dé → <b>éruption</b> : retournez le plateau Volcan + effets normaux.</li>
        <li>Si l'Artefact n'est pas sorti du Sanctuaire → <b>défaite</b>.</li>
      </ul>
    </div>
    <div class="ref-block">
      <h4>Propagation de la lave</h4>
      <p>À chaque 🌋 <b>Lave</b> et à chaque déplacement du marqueur (après éruption), toutes les tuiles connectées aux tuiles déjà face Volcan sont <b>retournées</b>. Explorateurs tués, Gardiens éliminés. <b>Sortez vite !</b></p>
    </div>
    <div class="ref-block">
      <h4>Artefact & Malédiction</h4>
      <ol>
        <li>Sac vide → le <b>Sanctuaire</b> se place dans la colonne la plus profonde.</li>
        <li>Posez les <b>3 Clés</b> (action Manier un objet, 1 Clé/action).</li>
        <li>Récupérez l'<b>Artefact</b> → la <b>malédiction</b> s'active.</li>
      </ol>
      <p><b>☠ Malédiction</b> : 2 dés de Péril par tour + éruption +2 cases/tour.</p>
    </div>
    <div class="ref-block">
      <h4>Fin</h4>
      <p><b>Victoire</b> : un Explorateur ressort avec l'Artefact. Médaille selon les survivants (Légendaire / Or / Argent / Bronze).</p>
      <p><b>Défaite</b> : tous à terre/morts, ou Artefact englouti (« Oubliés à jamais »).</p>
    </div>`;
}
