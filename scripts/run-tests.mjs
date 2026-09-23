import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function testFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? testFiles(path) : path.endsWith('.test.ts') ? [path] : [];
  });
}

const files = ['src', 'api'].flatMap(testFiles).sort();
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=4', ...files], {
  stdio: 'inherit',
  // Unit tests must not initialize the default production database client.
  env: { ...process.env, VITE_USE_SUPABASE: 'false' },
});
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
