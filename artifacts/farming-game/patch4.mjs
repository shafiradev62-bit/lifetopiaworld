import { readFileSync, writeFileSync } from 'fs';

const lines = readFileSync('src/pages/FarmingGame.tsx', 'utf8').split('\n');

// Find devnet panel start and end by content
let startLine = -1, endLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('DEVNET PANEL') && lines[i].includes('{/*')) startLine = i;
  if (startLine !== -1 && i > startLine && lines[i].includes('LIFETOPIA WORLD | DEVNET BUILD')) {
    // end is the closing )} after this
    for (let j = i; j < i + 5; j++) {
      if (lines[j].trim() === ')}') { endLine = j; break; }
    }
    break;
  }
}

console.log('Panel start:', startLine + 1, '| end:', endLine + 1);
if (startLine === -1 || endLine === -1) { console.log('❌ Not found'); process.exit(1); }

const newPanel = [
  `              {/* DEVNET PANEL */}`,
  `              {activePanel === "devnet" && (`,
  `                <div style={{ background: "#1a0f08", padding: "4px 0", display: "flex", flexDirection: "column", gap: 8 }}>`,
  `                  <div className="gf" style={{ fontSize: 8, color: "#D4AF37", letterSpacing: 1, textAlign: "center" }}>&#9678; SOLANA DEVNET</div>`,
  `                  <div className="gf" style={{ fontSize: isMobile ? 4 : 5, color: "rgba(255,255,255,0.4)", textAlign: "center", wordBreak: "break-all" }}>`,
  `                    {DEVNET_TOKEN_MINT}`,
  `                  </div>`,
  `                  {walletConnected && !walletAddress.startsWith("guest") && (`,
  `                    <div className="gf" style={{ fontSize: isMobile ? 5 : 6, color: "#9D7BFF", textAlign: "center" }}>`,
  `                      LFG: {devnetLFGBalance.toFixed(2)}`,
  `                    </div>`,
  `                  )}`,
  `                  <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "2px 0" }} />`,
  ``,
  `                  {/* TX 1: Airdrop */}`,
  `                  <button`,
  `                    className="wb gf"`,
  `                    disabled={!!devnetTxBusy}`,
  `                    onClick={devnetAirdrop}`,
  `                    style={{ fontSize: isMobile ? 6 : 7, padding: "10px 14px", opacity: devnetTxBusy === "airdrop" ? 0.6 : 1 }}`,
  `                  >`,
  `                    {devnetTxBusy === "airdrop" ? "SENDING..." : "&#9678; AIRDROP +5 LFG"}`,
  `                  </button>`,
  `                  <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>mint 5 LFG to wallet on devnet</div>`,
  ``,
  `                  <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "2px 0" }} />`,
  ``,
  `                  {/* TX 2: Harvest Claim */}`,
  `                  <button`,
  `                    className="wb gf"`,
  `                    disabled={!!devnetTxBusy}`,
  `                    onClick={devnetHarvestClaim}`,
  `                    style={{ fontSize: isMobile ? 6 : 7, padding: "10px 14px", opacity: devnetTxBusy === "harvest" ? 0.6 : 1 }}`,
  `                  >`,
  `                    {devnetTxBusy === "harvest" ? "SENDING..." : "CLAIM HARVEST LFG"}`,
  `                  </button>`,
  `                  <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>mint LFG for ready crops on devnet</div>`,
  ``,
  `                  <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "2px 0" }} />`,
  ``,
  `                  {/* TX 3: View Reference TX */}`,
  `                  <button`,
  `                    className="wb gf"`,
  `                    onClick={devnetViewRefTx}`,
  `                    style={{ fontSize: isMobile ? 6 : 7, padding: "10px 14px", background: "linear-gradient(180deg,#2d1060,#1a0a3a)", border: "2px solid #9D7BFF", color: "#9D7BFF", boxShadow: "0 4px 0 #1a0a3a" }}`,
  `                  >`,
  `                    &#9678; VIEW DEVNET TX`,
  `                  </button>`,
  `                  <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>5Yad6ss2...PJSHzZ</div>`,
  ``,
  `                  {lastTxId && (`,
  `                    <>`,
  `                      <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "2px 0" }} />`,
  `                      <div className="gf" style={{ fontSize: 5, color: "#D4AF37", textAlign: "center" }}>LAST TX</div>`,
  `                      <button`,
  `                        className="wb gf"`,
  `                        onClick={() => setShowTxPopup(true)}`,
  `                        style={{ fontSize: 4, padding: "6px 10px", wordBreak: "break-all", background: "rgba(0,0,0,0.3)", border: "1px solid #D4AF37", color: "#D4AF37", boxShadow: "none" }}`,
  `                      >`,
  `                        {lastTxId.slice(0,18)}...{lastTxId.slice(-6)}`,
  `                      </button>`,
  `                    </>`,
  `                  )}`,
  `                </div>`,
  `              )}`,
];

lines.splice(startLine, endLine - startLine + 1, ...newPanel);
writeFileSync('src/pages/FarmingGame.tsx', lines.join('\n'), 'utf8');
console.log('✅ Devnet panel replaced. New lines:', lines.length);
