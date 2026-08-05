import { execSync } from 'child_process';

try {
  console.log('--- Git Branch -r ---');
  console.log(execSync('git branch -r', { encoding: 'utf8' }));

  console.log('--- Git Branch -a ---');
  console.log(execSync('git branch -a', { encoding: 'utf8' }));
} catch (err) {
  console.error('Error executing git command:', err.message);
}
