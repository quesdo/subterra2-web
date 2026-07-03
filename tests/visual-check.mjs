/* Test visuel : joue quelques tours et capture l'état final. */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('console', msg => { if (msg.type() === 'error') console.log('ERR:', msg.text()); });
page.on('pageerror', err => console.log('PAGEERR:', err.message));

await page.goto('http://localhost:8765/index.html', { waitUntil: 'networkidle' });
await page.click('#btn-new-game');
await page.waitForTimeout(300);
// 4 explorateurs
for (let i = 0; i < 4; i++) {
  await page.locator('.explorer-card').nth(i).click();
  await page.waitForTimeout(80);
}
await page.click('#btn-start');
await page.waitForTimeout(600);

// Révéler au Sud plusieurs fois pour étendre le temple
for (let i = 0; i < 4; i++) {
  const revealBtn = page.locator('.action-btn[data-action="reveal"]');
  if (await revealBtn.isDisabled()) break;
  await revealBtn.click();
  await page.waitForTimeout(300);
  const edges = page.locator('#board-svg .edge-highlight.available');
  if (await edges.count() === 0) break;
  await edges.first().click();
  await page.waitForTimeout(300);
}

await page.screenshot({ path: 'tests/screenshot-expanded.png' });
console.log('Capture étendue sauvegardée');

// Capturer le journal pour valider la logique
const logText = await page.locator('#log-content').innerText();
console.log('--- Journal ---');
console.log(logText.split('\n').slice(0, 15).join('\n'));

await browser.close();
