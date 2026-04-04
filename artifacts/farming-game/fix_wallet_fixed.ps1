$filePath = "FarmingGame.tsx"
$content = Get-Content $filePath -Raw

# Add import after MobileController import
$importLine = 'import { solanaWallet } from "../game/Web3Config";'
$pattern = '(import \{\s+isMobilePlatform, openWalletDeepLink, detectWalletEnvironment, detectMobileWallets,\s+setupWalletDeepLinkHandler,\s+\} from "\.\./game/MobileController";)'
$replacement = "`$1`n$importLine"
$content = $content -replace $pattern, $replacement

# Replace connectWeb3 function
$oldFuncStart = '// ── Connect via Web3Modal — works in-app on mobile (DApp style) ─────────────'
$oldFuncEnd = '}, \[\]); // eslint-disable-line react-hooks/exhaustive-deps'
$startIndex = $content.IndexOf($oldFuncStart)
$endIndex = $content.IndexOf($oldFuncEnd) + $oldFuncEnd.Length

if ($startIndex -ge 0 -and $endIndex -gt $startIndex) {
    $newFunc = @"
// ── Connect to Solana Wallet (Phantom) - REAL CONNECTION, NO BLOCKING ─────────────
  const connectWeb3 = useCallback(async () => {
    try {
      setConnectingWallet("solana");
      
      // Connect to Phantom/Solana wallet - DIRECT connection, no blocking!
      const result = await solanaWallet.connect();
      
      if (result && result.publicKey) {
        _onWalletConnected(result.publicKey, "solana", null, 'PHANTOM');
      }
      
      setConnectingWallet(null);
    } catch (e) {
      console.error("[Solana Wallet]", e);
      stateRef.current.notification = { text: "WALLET CONNECT FAILED", life: 120 };
      setDs({ ...stateRef.current });
      setConnectingWallet(null);
    }
  }, [_onWalletConnected]); // eslint-disable-line react-hooks/exhaustive-deps
"@
    
    $content = $content.Remove($startIndex, $endIndex - $startIndex).Insert($startIndex, $newFunc)
}

$content | Set-Content $filePath -NoNewline
Write-Host "Success Wallet connection fixed!"

