import { readFileSync, writeFileSync } from 'fs';
const lines = readFileSync('src/pages/FarmingGame.tsx', 'utf8').split('\n');

// 1. Fix &#9678; → ◎ (literal unicode) everywhere
let src = lines.join('\n');
src = src.replaceAll('&#9678;', '◎');
console.log('✅ Fixed ◎ symbols');

// 2. Find devnetAirdrop function and add fundTreasuryIfNeeded + playerProvider
// Find: const devnetAirdrop = async () => {
const airdropFnIdx = src.indexOf("const devnetAirdrop = async () => {");
if (airdropFnIdx !== -1) {
  // Find the devnetMintToPlayer call inside it and add playerProvider
  src = src.replace(
    "const res = await devnetMintToPlayer(walletAddress, 5, 'airdrop:manual');",
    `await fundTreasuryIfNeeded().catch(()=>{});
      const res = await devnetMintToPlayer(walletAddress, 5, 'airdrop:manual', walletProviderRef.current);`
  );
  src = src.replace(
    "const res = await devnetMintToPlayer(walletAddress, amount, `harvest:${readyCrops.length}crops`);",
    `await fundTreasuryIfNeeded().catch(()=>{});
      const res = await devnetMintToPlayer(walletAddress, amount, \`harvest:\${readyCrops.length}crops\`, walletProviderRef.current);`
  );
  console.log('✅ Added fundTreasuryIfNeeded + playerProvider to tx calls');
}

// 3. Add fundTreasuryIfNeeded to imports from devnetTransactions
src = src.replace(
  "fetchDevnetLFGBalance, DEVNET_TOKEN_MINT,",
  "fetchDevnetLFGBalance, DEVNET_TOKEN_MINT, fundTreasuryIfNeeded,"
);
console.log('✅ Added fundTreasuryIfNeeded to imports');

writeFileSync('src/pages/FarmingGame.tsx', src, 'utf8');
console.log('✅ patchPanel done');
