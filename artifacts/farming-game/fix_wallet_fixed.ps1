$filePath = "FarmingGame.tsx"
$content  = Get-Content $filePath -Raw

$importLine = 'import { solanaWallet } from "../game/Web3Config";'

$mobileImportPattern = '(import \{\s+isMobilePlatform, openWalletDeepLink, detectWalletEnvironment, detectMobileWallets,\s+setupWalletDeepLinkHandler,\s+\} from "\.\./game/MobileController";)'

if ($content -notmatch [regex]::Escape($importLine)) {
    $content = $content -replace $mobileImportPattern, "`$1`n$importLine"
}

$startMarker = '// ── Connect via Web3Modal — works in-app on mobile (DApp style) ─────────────'
$endMarker   = '}, \[\]); // eslint-disable-line react-hooks/exhaustive-deps'

$startIndex = $content.IndexOf($startMarker)
$endIndex   = $content.IndexOf($endMarker)

if ($startIndex -ge 0 -and $endIndex -gt $startIndex) {

    $endIndex += $endMarker.Length

    $newFunction = @"
const connectWeb3 = useCallback(async () => {
  setConnectingWallet("solana");

  try {
    const provider =
      window?.phantom?.solana ||
      window?.solflare ||
      window?.backpack?.solana ||
      null;

    if (!provider) {
      throw new Error("NO_SOLANA_PROVIDER");
    }

    const resp = await provider.connect();

    const publicKey =
      resp?.publicKey?.toString?.() ||
      provider?.publicKey?.toString?.() ||
      null;

    if (!publicKey) {
      throw new Error("NO_PUBLIC_KEY");
    }

    const walletName =
      provider?.isPhantom ? "PHANTOM" :
      provider?.isSolflare ? "SOLFLARE" :
      provider?.isBackpack ? "BACKPACK" :
      "SOLANA";

    _onWalletConnected(publicKey, "solana", null, walletName);

  } catch (error) {
    console.error("[SOLANA_CONNECT]", error);

    stateRef.current.notification = {
      text: "WALLET CONNECT FAILED",
      life: 120,
    };

    setDs({ ...stateRef.current });

  } finally {
    setConnectingWallet(null);
  }
}, [_onWalletConnected]); // eslint-disable-line react-hooks/exhaustive-deps
"@

    $content = $content.Remove($startIndex, $endIndex - $startIndex)
    $content = $content.Insert($startIndex, $newFunction)
}

Set-Content -Path $filePath -Value $content -NoNewline

Write-Host "OK"