import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDir = join(__dirname, 'engine');
const files = readdirSync(testDir).filter(f => f.endsWith('.test.mjs'));

let totalPass = 0;
let totalFail = 0;

for (const file of files) {
  const result = spawnSync('node', ['--test', join(testDir, file)], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  
  const output = result.stdout || '';
  const passMatch = output.match(/# pass (\d+)/);
  const failMatch = output.match(/# fail (\d+)/);
  
  const pass = passMatch ? parseInt(passMatch[1]) : 0;
  const fail = failMatch ? parseInt(failMatch[1]) : 0;
  
  totalPass += pass;
  totalFail += fail;
  
  const status = fail === 0 ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${file}: ${pass} passed, ${fail} failed`);
  
  if (fail > 0) {
    const lines = output.split('\n').filter(l => l.startsWith('not ok'));
    for (const line of lines) {
      console.log(`  ${line}`);
    }
  }
}

console.log(`\nTotal: ${totalPass} passed, ${totalFail} failed`);
process.exit(totalFail > 0 ? 1 : 0);
