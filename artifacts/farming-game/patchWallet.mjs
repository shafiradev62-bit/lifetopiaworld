import { readFileSync, writeFileSync } from 'fs';
const lines = readFileSync('src/pages/FarmingGame.tsx', 'utf8').split('\n');

// Fix ALL onlyIfTrusted double-call patterns across connectPhantom, connectSolflare, connectBackpack, connectWeb3
// Pattern: try { res = await sol.connect({ onlyIfTrusted: true }); } catch { /* not trusted yet */ }
//          if (!res?.publicKey && !sol.publicKey) res = await sol.connect();
// Replace with: const res = await sol.connect();

let fixed = 0;
for (let i = 0; i < lines.length; i++) {
  // Find the onlyIfTrusted line
  if (lines[i].match(/try \{ res = await \w+\.connect\(\{ onlyIfTrusted: true \}\); \} catch \{/)) {
    const nextLine = lines[i + 1];
    // Check next line is the fallback
    if (nextLine && nextLine.match(/if \(!res\?\.publicKey && !\w+\.publicKey\) res = await \w+\.connect\(\)/)) {
      // Replace both lines with single direct connect
      // Extract the sol variable name from the onlyIfTrusted line
      const solVar = lines[i].match(/await (\w+)\.connect/)?.[1] || 'sol';
      lines[i] = `        const res = await ${solVar}.connect();`;
      lines[i + 1] = ''; // remove the fallback line
      fixed++;
    }
  }
  // Also fix the mobilePhantom variant in connectWeb3
  if (lines[i].match(/try \{ res = await mobilePhantom\.connect\(\{ onlyIfTrusted: true \}\); \} catch \{/)) {
    const nextLine = lines[i + 1];
    if (nextLine && nextLine.match(/if \(!res\?\.publicKey && !mobilePhantom\.publicKey\) res = await mobilePhantom\.connect\(\)/)) {
      lines[i] = `        const res = await mobilePhantom.connect();`;
      lines[i + 1] = '';
      fixed++;
    }
  }
}

writeFileSync('src/pages/FarmingGame.tsx', lines.join('\n'), 'utf8');
console.log(`✅ Fixed ${fixed} onlyIfTrusted patterns`);
