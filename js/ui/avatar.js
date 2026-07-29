/* ============================================================
   avatar.js — Avatars d'Explorateurs (image si dispo, sinon vecteur)
   Convention : assets/images/explorers/<id>.svg (ou .png).
   Dépôt d'une image nommée <id>.svg dans ce dossier → prise en compte auto.
   ============================================================ */

import { EXPLORERS } from '../data/explorers.js';

/* Map id -> chemin d'image attendu. Pour l'instant, seuls les fichiers
   réellement présents sont listés ; la détection se fait au runtime via
   le fallback onerror. On liste ici les chemins "officiels" par id. */
const IMG_DIR = 'assets/images/explorers';

/* Chemin d'image attendu pour un id (toujours .svg par convention). */
export function avatarPath(id) {
  return `${IMG_DIR}/${id}.svg`;
}

/* --- Fallback vecteur (cercle coloré + glyphe) --- */

/* SVG vecteur d'un Explorateur (cercle coloré + glyphe). */
export function avatarSVG(explorer, size = 48) {
  const s = size;
  const color = explorer.color || '#888';
  const glyph = explorer.glyph || '●';
  return `<svg viewBox="0 0 48 48" width="${s}" height="${s}" class="avatar-svg-fallback">
    <circle cx="24" cy="24" r="22" fill="${color}" stroke="#000" stroke-width="1.5"/>
    <text x="24" y="30" text-anchor="middle" font-size="20">${glyph}</text>
  </svg>`;
}

/* --- Avatar HTML (image si dispo, fallback automatique) ---
   Retourne un <div> contenant un <img>. En cas d'erreur de chargement,
   l'img est masquée et le fallback SVG (cercle coloré + glyphe) prend
   le relais via la classe .avatar-fallback sur le conteneur.
   - opts.rounded : true = bord arrondi (cercle), false = carré
   - opts.bg : couleur de fond derrière l'image (par défaut = couleur perso)
   Note : en runtime, explorer.id = defId + '_' + idx (ex. "illuminator_0").
   On utilise donc defId (ou, à défaut pour la galerie, l'id brut de la déf). */
export function avatarHTML(explorer, size = 48, opts = {}) {
  const { rounded = true, bg } = opts;
  const defId = explorer.defId || explorer.id;
  const path = avatarPath(defId);
  const radiusStyle = rounded ? 'border-radius:50%' : 'border-radius:6px';
  // Pas de fond coloré par défaut : on veut le perso plein cadre.
  // Le fallback SVG (cercle coloré) reste pour les persos sans image.
  const bgStyle = bg ? `background:${bg};` : '';
  const w = typeof size === 'number' ? `${size}px` : size;
  // L'img tente le chargement ; si elle 404, le handler retire .avatar-img
  // et le conteneur affiche le fallback via CSS (.avatar-fallback .avatar-img-layer).
  return `<div class="avatar-wrap ${rounded ? 'rounded' : ''}" style="width:${w};height:${w};${bgStyle}${radiusStyle}" data-explorer="${defId}">
    <img class="avatar-img" src="${path}" alt="${explorer.name || ''}"
         onerror="this.classList.add('failed');this.parentElement.classList.add('avatar-fallback')" />
    <div class="avatar-fallback-layer">${avatarSVG(explorer, size)}</div>
  </div>`;
}
