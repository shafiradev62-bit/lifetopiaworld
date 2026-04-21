import { readFileSync, writeFileSync } from 'fs';

let src = readFileSync('src/pages/FarmingGame.tsx', 'utf8');

// ── 1. Add devnet tx state + handlers after the activePanel sync line ──────────
const AFTER_ACTIVE_PANEL = `  useEffect(() => { stateRef.current.activePanel = activePanel; }, [activePanel]);`;

const DEVNET_STATE = `
  // ── Devnet TX state ──────────────────────────────────────────────────────────
  const [devnetTxBusy, setDevnetTxBusy] = useState<string | null>(null);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [showTxPopup, setShowTxPopup] = useState(false);
  const [devnetLFGBalance, setDevnetLFGBalance] = useState<number>(0);

  // Refresh devnet LFG balance every 15s
  useEffect(() => {
    if (!walletConnected || !walletAddress || walletAddress.startsWith('guest')) return;
    const refresh = () => fetchDevnetLFGBalance(walletAddress).then(setDevnetLFGBalance).catch(() => {});
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [walletConnected, walletAddress]);

  // ── Devnet TX: Airdrop 5 LFG (mint from treasury) ───────────────────────────
  const devnetAirdrop = async () => {
    if (!walletConnected || walletAddress.startsWith('guest')) {
      stateRef.current.notification = { text: 'CONNECT WALLET FIRST!', life: 100 };
      setDs({ ...stateRef.current }); return;
    }
    setDevnetTxBusy('airdrop');
    try {
      const { devnetMintToPlayer } = await import('../game/devnetTransactions');
      const res = await devnetMintToPlayer(walletAddress, 5, 'airdrop:manual');
      if (res.success && res.txid) {
        setLastTxId(res.txid);
        setShowTxPopup(true);
        fetchDevnetLFGBalance(walletAddress).then(setDevnetLFGBalance).catch(() => {});
        triggerPopup('AIRDROP +5 LFG ON DEVNET!');
      } else {
        stateRef.current.notification = { text: (res.error || 'AIRDROP FAILED').toUpperCase().slice(0,40), life: 120 };
        setDs({ ...stateRef.current });
      }
    } catch(e: any) {
      stateRef.current.notification = { text: (e.message || 'TX FAILED').toUpperCase().slice(0,40), life: 120 };
      setDs({ ...stateRef.current });
    } finally { setDevnetTxBusy(null); }
  };

  // ── Devnet TX: Harvest Claim — mint LFG for current ready crops ──────────────
  const devnetHarvestClaim = async () => {
    if (!walletConnected || walletAddress.startsWith('guest')) {
      stateRef.current.notification = { text: 'CONNECT WALLET FIRST!', life: 100 };
      setDs({ ...stateRef.current }); return;
    }
    const readyCrops = stateRef.current.farmPlots.filter(p => p.crop?.ready);
    if (readyCrops.length === 0) {
      stateRef.current.notification = { text: 'NO READY CROPS TO CLAIM!', life: 100 };
      setDs({ ...stateRef.current }); return;
    }
    setDevnetTxBusy('harvest');
    try {
      const { devnetMintToPlayer } = await import('../game/devnetTransactions');
      const amount = readyCrops.reduce((sum, p) => {
        const base: Record<string,number> = { wheat:1, tomato:2, carrot:3, pumpkin:5, corn:4 };
        return sum + (base[p.crop!.type] ?? 1) * (p.crop!.isRare ? 3 : 1);
      }, 0);
      const res = await devnetMintToPlayer(walletAddress, amount, \`harvest:\${readyCrops.length}crops\`);
      if (res.success && res.txid) {
        setLastTxId(res.txid);
        setShowTxPopup(true);
        fetchDevnetLFGBalance(walletAddress).then(setDevnetLFGBalance).catch(() => {});
        triggerPopup(\`HARVEST +\${amount} LFG ON DEVNET!\`);
      } else {
        stateRef.current.notification = { text: (res.error || 'CLAIM FAILED').toUpperCase().slice(0,40), life: 120 };
        setDs({ ...stateRef.current });
      }
    } catch(e: any) {
      stateRef.current.notification = { text: (e.message || 'TX FAILED').toUpperCase().slice(0,40), life: 120 };
      setDs({ ...stateRef.current });
    } finally { setDevnetTxBusy(null); }
  };

  // ── Devnet TX: View reference TX (the original devnet tx) ────────────────────
  const REFERENCE_TX = '5Yad6ss2HVzP25tUrbnRfw2rg22YebhuHnxbgzzf5VdHsMSWShvVvFoGSSN3RhBdtVm4ZeSFuQiJDg4Wr7PJSHzZ';
  const devnetViewRefTx = () => {
    setLastTxId(REFERENCE_TX);
    setShowTxPopup(true);
  };
`;

if (!src.includes('devnetTxBusy')) {
  src = src.replace(AFTER_ACTIVE_PANEL, AFTER_ACTIVE_PANEL + DEVNET_STATE);
  console.log('✅ Inserted devnet state + handlers');
} else {
  console.log('⚠️  devnetTxBusy already present, skipping state insert');
}

// ── 2. Replace the devnet panel content ──────────────────────────────────────
const OLD_DEVNET_PANEL = `              {/* ── DEVNET PANEL ── */}
              {activePanel === "devnet" && (
                <div style={{ background: "#1a0f08", padding: "2px 0", display: "flex", flexDirection: "column", gap: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 7, color: "#D4AF37", letterSpacing: 1, marginBottom: 4 }}>TOKEN MINT</div>
                  <div style={{ fontSize: isMobile ? 4 : 5, color: "#FFFFFF", wordBreak: "break-all", lineHeight: 1.8 }}>
                    {TOKEN_MINT}
                  </div>
                  <div style={{ fontSize: 7, color: "#D4AF37", letterSpacing: 1, marginTop: 6, marginBottom: 4 }}>NETWORK</div>
                  <div style={{ fontSize: isMobile ? 6 : 7, color: "#FFFFFF" }}>Solana Devnet</div>
                  <div style={{ fontSize: isMobile ? 4 : 5, color: "rgba(255,255,255,0.5)" }}>https://api.devnet.solana.com</div>
                  <div style={{ fontSize: 7, color: "#D4AF37", letterSpacing: 1, marginTop: 6, marginBottom: 4 }}>GOLD SYNC</div>
                  <div style={{ fontSize: isMobile ? 5 : 6, color: "#FFFFFF", lineHeight: 1.8 }}>
                    {walletConnected && !walletAddress.startsWith("guest") ? (
                      <>
                        <div>In-game gold syncs to blockchain</div>
                        <div style={{ marginTop: 4 }}>MINT on earn gold</div>
                        <div style={{ marginTop: 2 }}>BURN on spend gold</div>
                      </>
                    ) : (
                      <div style={{ color: "rgba(255,255,255,0.5)" }}>Connect wallet to enable sync</div>
                    )}
                  </div>
                  <div style={{ fontSize: 5, color: "rgba(0,0,0,0.4)", marginTop: 8 }}>LIFETOPIA WORLD | DEVNET BUILD</div>
                </div>
              )}`;

const NEW_DEVNET_PANEL = `              {/* ── DEVNET PANEL ── */}
              {activePanel === "devnet" && (
                <div style={{ background: "#1a0f08", padding: "4px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Header */}
                  <div className="gf" style={{ fontSize: 7, color: "#D4AF37", letterSpacing: 1, textAlign: "center", marginBottom: 2 }}>◎ SOLANA DEVNET</div>
                  <div className="gf" style={{ fontSize: isMobile ? 4 : 5, color: "rgba(255,255,255,0.5)", textAlign: "center", wordBreak: "break-all" }}>
                    {DEVNET_TOKEN_MINT}
                  </div>
                  {walletConnected && !walletAddress.startsWith("guest") && (
                    <div className="gf" style={{ fontSize: isMobile ? 5 : 6, color: "#9D7BFF", textAlign: "center" }}>
                      LFG BALANCE: {devnetLFGBalance.toFixed(2)}
                    </div>
                  )}
                  <div style={{ height: 1, background: "rgba(212,175,55,0.2)", margin: "2px 0" }} />

                  {/* TX Button 1: Airdrop */}
                  <button
                    className="wb gf"
                    disabled={!!devnetTxBusy}
                    onClick={devnetAirdrop}
                    style={{ fontSize: isMobile ? 6 : 7, padding: "10px 14px", opacity: devnetTxBusy === 'airdrop' ? 0.6 : 1 }}
                  >
                    {devnetTxBusy === 'airdrop' ? '⏳ SENDING...' : '◎ AIRDROP +5 LFG'}
                  </button>
                  <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                    Mint 5 LFG to your wallet on devnet
                  </div>

                  <div style={{ height: 1, background: "rgba(212,175,55,0.2)", margin: "2px 0" }} />

                  {/* TX Button 2: Harvest Claim */}
                  <button
                    className="wb gf"
                    disabled={!!devnetTxBusy}
                    onClick={devnetHarvestClaim}
                    style={{ fontSize: isMobile ? 6 : 7, padding: "10px 14px", opacity: devnetTxBusy === 'harvest' ? 0.6 : 1 }}
                  >
                    {devnetTxBusy === 'harvest' ? '⏳ SENDING...' : '🌾 CLAIM HARVEST LFG'}
                  </button>
                  <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                    Mint LFG for ready crops on devnet
                  </div>

                  <div style={{ height: 1, background: "rgba(212,175,55,0.2)", margin: "2px 0" }} />

                  {/* TX Button 3: View Reference TX */}
                  <button
                    className="wb gf"
                    onClick={devnetViewRefTx}
                    style={{ fontSize: isMobile ? 6 : 7, padding: "10px 14px", background: "linear-gradient(180deg,#2d1060,#1a0a3a)", border: "2px solid #9D7BFF", color: "#9D7BFF" }}
                  >
                    ◎ VIEW DEVNET TX
                  </button>
                  <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                    5Yad6ss2...PJSHzZ
                  </div>

                  {/* Last TX */}
                  {lastTxId && (
                    <>
                      <div style={{ height: 1, background: "rgba(212,175,55,0.2)", margin: "2px 0" }} />
                      <div className="gf" style={{ fontSize: 5, color: "#D4AF37", textAlign: "center" }}>LAST TX</div>
                      <button
                        className="wb gf"
                        onClick={() => setShowTxPopup(true)}
                        style={{ fontSize: 4, padding: "6px 10px", wordBreak: "break-all", background: "rgba(0,0,0,0.3)", border: "1px solid #D4AF37", color: "#D4AF37" }}
                      >
                        {lastTxId.slice(0,20)}...{lastTxId.slice(-8)}
                      </button>
                    </>
                  )}
                </div>
              )}`;

// Try exact match first
if (src.includes('LIFETOPIA WORLD | DEVNET BUILD')) {
  // Find the block boundaries
  const startMarker = `              {/* ── DEVNET PANEL ── */}`;
  const endMarker = `LIFETOPIA WORLD | DEVNET BUILD</div>\n                </div>\n              )}`;
  const startIdx = src.indexOf(startMarker);
  const endIdx = src.indexOf('LIFETOPIA WORLD | DEVNET BUILD') + 'LIFETOPIA WORLD | DEVNET BUILD</div>\n                </div>\n              )}'.length;
  if (startIdx !== -1) {
    src = src.slice(0, startIdx) + NEW_DEVNET_PANEL + src.slice(endIdx);
    console.log('✅ Replaced devnet panel');
  } else {
    console.log('❌ Could not find devnet panel start');
  }
} else {
  console.log('⚠️  Old devnet panel not found, may already be replaced');
}

// ── 3. Add in-app Solscan TX popup before the closing </div> of gameRootRef ──
const TX_POPUP = `
      {/* ── IN-APP SOLSCAN TX POPUP ── */}
      {showTxPopup && lastTxId && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setShowTxPopup(false)}
        >
          <div
            className="wb"
            style={{
              background: "linear-gradient(180deg,#2d1a08 0%,#1a0f04 100%)",
              border: "3px solid #D4AF37",
              borderRadius: 12,
              padding: "20px 24px",
              maxWidth: isMobile ? "90vw" : 480,
              width: "100%",
              display: "flex", flexDirection: "column", gap: 12,
              boxShadow: "0 8px 0 #3a2212, 0 0 40px rgba(212,175,55,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gf" style={{ fontSize: 9, color: "#D4AF37", textAlign: "center", letterSpacing: 1 }}>◎ DEVNET TX</div>
            <div style={{ height: 1, background: "rgba(212,175,55,0.3)" }} />
            <div className="gf" style={{ fontSize: isMobile ? 4 : 5, color: "#FFFFFF", wordBreak: "break-all", lineHeight: 2, textAlign: "center" }}>
              {lastTxId}
            </div>
            <div style={{ height: 1, background: "rgba(212,175,55,0.3)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <iframe
                src={\`https://solscan.io/tx/\${lastTxId}?cluster=devnet\`}
                style={{ width: "100%", height: isMobile ? 200 : 280, border: "2px solid #5C4033", borderRadius: 6, background: "#000" }}
                title="Solscan TX"
              />
              <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                solscan.io — devnet
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={\`https://solscan.io/tx/\${lastTxId}?cluster=devnet\`}
                target="_blank"
                rel="noopener noreferrer"
                className="wb gf"
                style={{ flex: 1, fontSize: isMobile ? 6 : 7, padding: "10px", textAlign: "center", textDecoration: "none", color: "#9D7BFF", background: "linear-gradient(180deg,#2d1060,#1a0a3a)", border: "2px solid #9D7BFF" }}
                onClick={(e) => e.stopPropagation()}
              >
                OPEN IN BROWSER
              </a>
              <button
                className="wb gf"
                onClick={() => setShowTxPopup(false)}
                style={{ flex: 1, fontSize: isMobile ? 6 : 7, padding: "10px" }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
`;

// Insert before the last closing </div> of gameRootRef (before LOGO section)
const LOGO_MARKER = `      {/* ── LOGO ── */}`;
const LOGO_MARKER2 = `      {/* â"€â"€ LOGO â"€â"€ */}`;
if (src.includes(LOGO_MARKER) && !src.includes('IN-APP SOLSCAN TX POPUP')) {
  src = src.replace(LOGO_MARKER, TX_POPUP + LOGO_MARKER);
  console.log('✅ Inserted TX popup (marker 1)');
} else if (src.includes(LOGO_MARKER2) && !src.includes('IN-APP SOLSCAN TX POPUP')) {
  src = src.replace(LOGO_MARKER2, TX_POPUP + LOGO_MARKER2);
  console.log('✅ Inserted TX popup (marker 2)');
} else {
  console.log('⚠️  TX popup already present or logo marker not found');
}

writeFileSync('src/pages/FarmingGame.tsx', src, 'utf8');
console.log('✅ Done patching FarmingGame.tsx');
