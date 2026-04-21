import { readFileSync, writeFileSync } from 'fs';

let src = readFileSync('src/pages/FarmingGame.tsx', 'utf8');

// ── Replace devnet panel ──────────────────────────────────────────────────────
const OLD = `              {/* \u2500\u2500 DEVNET PANEL \u2500\u2500 */}
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

const NEW_PANEL = `              {/* \u2500\u2500 DEVNET PANEL \u2500\u2500 */}
              {activePanel === "devnet" && (
                <div style={{ background: "#1a0f08", padding: "4px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="gf" style={{ fontSize: 8, color: "#D4AF37", letterSpacing: 1, textAlign: "center" }}>&#9678; SOLANA DEVNET</div>
                  <div className="gf" style={{ fontSize: isMobile ? 4 : 5, color: "rgba(255,255,255,0.4)", textAlign: "center", wordBreak: "break-all" }}>
                    {DEVNET_TOKEN_MINT}
                  </div>
                  {walletConnected && !walletAddress.startsWith("guest") && (
                    <div className="gf" style={{ fontSize: isMobile ? 5 : 6, color: "#9D7BFF", textAlign: "center" }}>
                      LFG: {devnetLFGBalance.toFixed(2)}
                    </div>
                  )}
                  <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "2px 0" }} />

                  {/* TX 1: Airdrop */}
                  <button
                    className="wb gf"
                    disabled={!!devnetTxBusy}
                    onClick={devnetAirdrop}
                    style={{ fontSize: isMobile ? 6 : 7, padding: "10px 14px", opacity: devnetTxBusy === "airdrop" ? 0.6 : 1 }}
                  >
                    {devnetTxBusy === "airdrop" ? "SENDING..." : "&#9678; AIRDROP +5 LFG"}
                  </button>
                  <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>mint 5 LFG to wallet on devnet</div>

                  <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "2px 0" }} />

                  {/* TX 2: Harvest Claim */}
                  <button
                    className="wb gf"
                    disabled={!!devnetTxBusy}
                    onClick={devnetHarvestClaim}
                    style={{ fontSize: isMobile ? 6 : 7, padding: "10px 14px", opacity: devnetTxBusy === "harvest" ? 0.6 : 1 }}
                  >
                    {devnetTxBusy === "harvest" ? "SENDING..." : "CLAIM HARVEST LFG"}
                  </button>
                  <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>mint LFG for ready crops on devnet</div>

                  <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "2px 0" }} />

                  {/* TX 3: View Reference TX */}
                  <button
                    className="wb gf"
                    onClick={devnetViewRefTx}
                    style={{ fontSize: isMobile ? 6 : 7, padding: "10px 14px", background: "linear-gradient(180deg,#2d1060,#1a0a3a)", border: "2px solid #9D7BFF", color: "#9D7BFF", boxShadow: "0 4px 0 #1a0a3a" }}
                  >
                    &#9678; VIEW DEVNET TX
                  </button>
                  <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>5Yad6ss2...PJSHzZ</div>

                  {lastTxId && (
                    <>
                      <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "2px 0" }} />
                      <div className="gf" style={{ fontSize: 5, color: "#D4AF37", textAlign: "center" }}>LAST TX</div>
                      <button
                        className="wb gf"
                        onClick={() => setShowTxPopup(true)}
                        style={{ fontSize: 4, padding: "6px 10px", wordBreak: "break-all", background: "rgba(0,0,0,0.3)", border: "1px solid #D4AF37", color: "#D4AF37", boxShadow: "none" }}
                      >
                        {lastTxId.slice(0,18)}...{lastTxId.slice(-6)}
                      </button>
                    </>
                  )}
                </div>
              )}`;

if (src.includes('LIFETOPIA WORLD | DEVNET BUILD')) {
  src = src.replace(OLD, NEW_PANEL);
  console.log(src.includes('AIRDROP +5 LFG') ? '✅ Devnet panel replaced' : '❌ Replace failed');
} else {
  console.log('⚠️  Old panel not found');
}

// ── Insert TX popup before the SECOND logo marker (line ~2375) ───────────────
const TX_POPUP = `
      {/* IN-APP SOLSCAN TX POPUP */}
      {showTxPopup && lastTxId && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowTxPopup(false)}
        >
          <div
            className="wb"
            style={{ background: "linear-gradient(180deg,#2d1a08,#1a0f04)", border: "3px solid #D4AF37", borderRadius: 12, padding: "20px 24px", maxWidth: isMobile ? "92vw" : 500, width: "100%", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 8px 0 #3a2212, 0 0 40px rgba(212,175,55,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gf" style={{ fontSize: 9, color: "#D4AF37", textAlign: "center", letterSpacing: 1 }}>&#9678; DEVNET TX</div>
            <div style={{ height: 1, background: "rgba(212,175,55,0.3)" }} />
            <div className="gf" style={{ fontSize: isMobile ? 4 : 5, color: "#FFFFFF", wordBreak: "break-all", lineHeight: 2, textAlign: "center" }}>
              {lastTxId}
            </div>
            <div style={{ height: 1, background: "rgba(212,175,55,0.3)" }} />
            <iframe
              src={\`https://solscan.io/tx/\${lastTxId}?cluster=devnet\`}
              style={{ width: "100%", height: isMobile ? 200 : 300, border: "2px solid #5C4033", borderRadius: 6, background: "#111" }}
              title="Solscan TX"
            />
            <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>solscan.io — devnet</div>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={\`https://solscan.io/tx/\${lastTxId}?cluster=devnet\`}
                target="_blank"
                rel="noopener noreferrer"
                className="wb gf"
                style={{ flex: 1, fontSize: isMobile ? 6 : 7, padding: "10px", textAlign: "center", textDecoration: "none", color: "#9D7BFF", background: "linear-gradient(180deg,#2d1060,#1a0a3a)", border: "2px solid #9D7BFF", boxShadow: "0 4px 0 #1a0a3a", borderRadius: 6 }}
                onClick={(e) => e.stopPropagation()}
              >
                OPEN BROWSER
              </a>
              <button className="wb gf" onClick={() => setShowTxPopup(false)} style={{ flex: 1, fontSize: isMobile ? 6 : 7, padding: "10px" }}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

`;

if (!src.includes('IN-APP SOLSCAN TX POPUP')) {
  // Find the second occurrence of the logo comment
  const logoMarker = '{/* \u2500\u2500 LOGO \u2500\u2500 */}';
  const firstIdx = src.indexOf(logoMarker);
  const secondIdx = src.indexOf(logoMarker, firstIdx + 1);
  const insertAt = secondIdx !== -1 ? secondIdx : firstIdx;
  if (insertAt !== -1) {
    src = src.slice(0, insertAt) + TX_POPUP + src.slice(insertAt);
    console.log('✅ TX popup inserted');
  } else {
    console.log('❌ Logo marker not found');
  }
} else {
  console.log('⚠️  TX popup already present');
}

writeFileSync('src/pages/FarmingGame.tsx', src, 'utf8');
console.log('✅ patch2 done');
