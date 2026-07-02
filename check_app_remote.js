import { execSync } from 'child_process';

try {
  console.log('--- App.tsx in commit 2aa3c27 ---');
  console.log(execSync('git show 2aa3c27:src/app/App.tsx', { encoding: 'utf8' }));
} catch (err) {
  console.error('Error executing git command:', err.message);
}
