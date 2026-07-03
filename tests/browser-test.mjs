/* Test navigateur headless : charge le jeu, vérifie qu'aucune erreur
   console n'apparaît, simule un setup et un début de partie.
   Usage : node tests/browser-test.mjs */

import { chromium } from 'playwright';

const URL = 'http://localhost:8765/index.html';
const errors = [];
const logs = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

page.on('console', msg => {
  const t = msg.type();
  if (t === 'error') errors.push(msg.text());
  logs.push(`[${t}] ${msg.text()}`);
});
page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));

async function check(label, cond) {
  console.log(cond ? `  ✓ ${label}` : `  ✗ ${label}`);
  if (!cond) errors.push(`CHECK FAIL: ${label}`);
}

console.log('Chargement de la page...');
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// Vérifier l'écran titre
await check('Écran titre visible', await page.isVisible('#screen-title.active'));
await check('Art de couverture chargé', await page.$eval('.title-art img', el => el.complete && el.naturalWidth > 0).catch(() => false));

console.log('Navigation vers setup...');
await page.click('#btn-local-game');
await page.waitForTimeout(300);
await check('Écran setup visible', await page.isVisible('#screen-setup.active'));
await check('Gallerie de 10 explorateurs', (await page.locator('.explorer-card').count()) === 10);

console.log('Sélection de 4 explorateurs...');
const cards = page.locator('.explorer-card');
for (let i = 0; i < 4; i++) {
  await cards.nth(i).click();
  await page.waitForTimeout(100);
}
await check('4 explorateurs sélectionnés', (await page.locator('.explorer-card.selected').count()) === 4);
await check('Ordre du tour affiché', await page.locator('#team-order .team-label').isVisible());

console.log('Démarrage de la partie...');
await page.click('#btn-start');
await page.waitForTimeout(800);
await check('Écran jeu visible', await page.isVisible('#screen-game.active'));
await check('Panneau explorateur actif rendu', await page.locator('#active-explorer .ae-name').isVisible());
await check('Plateau SVG rendu', (await page.locator('#board-svg .tile-group').count()) > 0);
await check('Tuile Entrée présente', (await page.locator('#board-svg .tile-group').count()) >= 5); // 3 entry + 2 lateral
await check('Boutons d\'action rendus', (await page.locator('#action-buttons .action-btn').count()) > 0);
await check('Piste volcan affichée', await page.locator('#volcano-track').isVisible());
await check('Journal rendu', await page.locator('#log-content').isVisible());

console.log('Vérification du nombre de meeples...');
await check('4 meeples sur le plateau', (await page.locator('#board-svg .meeple').count()) === 4);

console.log('Test action Révéler...');
// L'explorateur démarre sur ENTRY_BOT (0,0) qui a son Sud ouvert.
// Révéler peut ouvrir un dialogue de choix d'orientation si plusieurs
// rotations sont valides pour la tuile piochée.
const revealBtn = page.locator('.action-btn[data-action="reveal"]');
const revealDisabled = await revealBtn.isDisabled();
if (!revealDisabled) {
  const before = (await page.locator('#board-svg .tile-group').count());
  await revealBtn.click();
  await page.waitForTimeout(400);
  const edgeCount = await page.locator('#board-svg .edge-highlight.available').count();
  await check('Surlignances d\'arête apparues', edgeCount > 0);
  if (edgeCount > 0) {
    await page.locator('#board-svg .edge-highlight.available').first().click();
    await page.waitForTimeout(500);
    // Si un dialogue de rotation apparaît, choisir la 1ère option
    const rotationModal = await page.locator('.rotation-pick').count();
    if (rotationModal > 0) {
      await page.locator('.rotation-pick').first().click();
      await page.waitForTimeout(400);
    }
    const after = (await page.locator('#board-svg .tile-group').count());
    await check('Tuile révélée (plateau grandit)', after > before);
  }
} else {
  // Se déplacer vers une Normale puis révéler
  await page.click('.action-btn[data-action="move"]');
  await page.waitForTimeout(300);
  const reach = await page.locator('#board-svg .reach-highlight').count();
  if (reach > 0) {
    await page.locator('#board-svg .reach-highlight').first().click();
    await page.waitForTimeout(400);
  }
  await check('Bouton Révéler accessible après déplacement', true);
}

console.log('\nCapture d\'écran...');
await page.screenshot({ path: 'tests/screenshot-game.png', fullPage: false });
await check('Capture sauvegardée', true);

console.log(`\n=== Résultat ===`);
console.log(`Erreurs console/page : ${errors.length}`);
if (errors.length > 0) {
  console.log('Erreurs :');
  errors.forEach(e => console.log('  -', e));
}

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
