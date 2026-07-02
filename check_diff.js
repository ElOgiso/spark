import { execSync } from 'child_process';

try {
  console.log('--- Git Diff with origin/main ---');
  console.log(execSync('git diff origin/main', { encoding: 'utf8' }));
} catch (err) {
  console.error('Error executing git command:', err.message);
}
