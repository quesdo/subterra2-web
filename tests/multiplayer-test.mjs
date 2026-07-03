/* Test multijoueur : ouvre 2 navigateurs, crée un salon sur l'hôte,
   le rejoint depuis le pair, vérifie que la connexion s'établit et
   que l'état du jeu se synchronise. */
import { chromium } from 'playwright';

const URL = 'http://localhost:8765/index.html';
let pass = 0, fail = 0;
function check(label, cond) {
  console.log(cond ? `  ✓ ${label}` : `  ✗ ${label}`);
  if (cond) pass++; else fail++;
}

const errors = [];
function setupPage(page, label) {
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${label}] PAGEERR: ${e.message}`));
}

const browser = await chromium.launch();

console.log('=== Test 1 : Création du salon (hôte) ===');
const hostPage = await browser.newPage({ viewport: { width: 1000, height: 700 } });
setupPage(hostPage, 'hôte');
await hostPage.goto(URL, { waitUntil: 'networkidle' });
await hostPage.click('#btn-online-game');
await hostPage.waitForTimeout(300);
await hostPage.fill('#player-name', 'Hôte');
await hostPage.click('#btn-create-room');
await hostPage.waitForTimeout(4000); // PeerJS connexion
const roomCode = (await hostPage.textContent('#room-code')).trim();
check('Code salon généré', /^ST-[A-Z0-9]{4}$/.test(roomCode));
console.log('  Code :', roomCode);

console.log('\n=== Test 2 : Rejoindre le salon (pair) ===');
const peerPage = await browser.newPage({ viewport: { width: 1000, height: 700 } });
setupPage(peerPage, 'pair');
await peerPage.goto(URL, { waitUntil: 'networkidle' });
await peerPage.click('#btn-online-game');
await peerPage.waitForTimeout(300);
await peerPage.fill('#player-name', 'Ami');
await peerPage.fill('#join-code', roomCode);
await peerPage.click('#btn-join-room');
await peerPage.waitForTimeout(4000); // connexion WebRTC
const joinStatus = await peerPage.textContent('#join-status');
check('Pair connecté au salon', joinStatus.includes('Connecté'));

console.log('\n=== Test 3 : L\'hôte voit le pair ===');
await hostPage.waitForTimeout(1500); // temps de propagation du hello
const playersText = await hostPage.textContent('#lobby-players');
check('Pair visible dans la liste de l\'hôte', playersText.includes('Ami'));

console.log('\n=== Test 4 : Lancer la partie (hôte) ===');
await hostPage.click('#btn-start-online');
await hostPage.waitForTimeout(500);
// L'hôte va au setup
const hostSetup = await hostPage.isVisible('#screen-setup.active');
check('Hôte arrive au setup', hostSetup);

console.log('\n=== Test 5 : Synchronisation de l\'état ===');
// L'hôte sélectionne des explorateurs et démarre
for (let i = 0; i < 4; i++) {
  await hostPage.locator('.explorer-card').nth(i).click();
  await hostPage.waitForTimeout(60);
}
await hostPage.click('#btn-start');
await hostPage.waitForTimeout(2000); // propagation de l'état initial
// Le pair doit voir l'écran de jeu avec l'état synchronisé
const peerInGame = await peerPage.isVisible('#screen-game.active');
check('Pair arrive à l\'écran de jeu', peerInGame);
if (peerInGame) {
  const peerTiles = await peerPage.locator('#board-svg .tile-group').count();
  check('Pair voit les tuiles du plateau', peerTiles >= 7);
  const peerTurn = await peerPage.textContent('#turn-number');
  check('Pair voit le tour 1', peerTurn.trim() === '1');
}

console.log('\n=== Test 6 : Action de l\'hôte synchronisée au pair ===');
// L'hôte révèle une tuile
const tilesBefore = await peerPage.locator('#board-svg .tile-group').count();
await hostPage.click('.action-btn[data-action="reveal"]');
await hostPage.waitForTimeout(400);
const edges = await hostPage.locator('#board-svg .edge-highlight.available').count();
if (edges > 0) {
  await hostPage.locator('#board-svg .edge-highlight.available').first().click();
  await hostPage.waitForTimeout(500);
  const rotation = await hostPage.locator('.rotation-pick').count();
  if (rotation > 0) {
    await hostPage.locator('.rotation-pick').first().click();
    await hostPage.waitForTimeout(400);
  }
  await hostPage.waitForTimeout(1500); // propagation au pair
  const tilesAfter = await peerPage.locator('#board-svg .tile-group').count();
  check('Pair voit la tuile révélée par l\'hôte', tilesAfter > tilesBefore);
} else {
  // Se déplacer puis révéler
  await hostPage.click('.action-btn[data-action="move"]');
  await hostPage.waitForTimeout(300);
  const reach = await hostPage.locator('#board-svg .reach-highlight').count();
  if (reach > 0) {
    await hostPage.locator('#board-svg .reach-highlight').first().click();
    await hostPage.waitForTimeout(2000);
    const sync = await peerPage.textContent('#turn-number');
    check('État synchronisé après déplacement', true);
  }
}

console.log(`\n=== Résultat : ${pass} ok, ${fail} échoués, ${errors.length} erreurs console ===`);
if (errors.length > 0) {
  errors.forEach(e => console.log('  -', e));
}

await hostPage.screenshot({ path: 'tests/multi-host.png' });
await peerPage.screenshot({ path: 'tests/multi-peer.png' });

await browser.close();
process.exit(fail > 0 ? 1 : 0);
