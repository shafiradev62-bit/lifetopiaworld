import { readFileSync, writeFileSync } from 'fs';
const lines = readFileSync('src/pages/FarmingGame.tsx', 'utf8').split('\n');

// Remove all "let res: any;" lines that are immediately followed by "const res = await"
for (let i = 0; i < lines.length - 1; i++) {
  if (lines[i].trim() === 'let res: any;' && lines[i+1].trim().startsWith('const res = await')) {
    lines[i] = '';
  }
}

writeFileSync('src/pages/FarmingGame.tsx', lines.join('\n'), 'utf8');
console.log('✅ Removed duplicate let res declarations');
