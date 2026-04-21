import { readFileSync, writeFileSync } from 'fs';

const lines = readFileSync('src/pages/FarmingGame.tsx', 'utf8').split('\n');

// Find the second logo comment line (around line 2375)
let logoLine2 = -1;
let logoCount = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('LOGO') && lines[i].includes('{/*') && lines[i].includes('*/}')) {
    logoCount++;
    if (logoCount === 2) { logoLine2 = i; break; }
  }
}
console.log('Second logo line:', logoLine2 + 1, lines[logoLine2]);

if (logoLine2 === -1) { console.log('❌ Not found'); process.exit(1); }

// Check if already inserted
const src = lines.join('\n');
if (src.includes('IN-APP SOLSCAN TX POPUP')) {
  console.log('⚠️  Already inserted'); process.exit(0);
}

const popup = [
  `      {/* IN-APP SOLSCAN TX POPUP */}`,
  `      {showTxPopup && lastTxId && (`,
  `        <div`,
  `          style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}`,
  `          onClick={() => setShowTxPopup(false)}`,
  `        >`,
  `          <div`,
  `            className="wb"`,
  `            style={{ background: "linear-gradient(180deg,#2d1a08,#1a0f04)", border: "3px solid #D4AF37", borderRadius: 12, padding: "20px 24px", maxWidth: isMobile ? "92vw" : 500, width: "100%", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 8px 0 #3a2212, 0 0 40px rgba(212,175,55,0.3)" }}`,
  `            onClick={(e) => e.stopPropagation()}`,
  `          >`,
  `            <div className="gf" style={{ fontSize: 9, color: "#D4AF37", textAlign: "center", letterSpacing: 1 }}>&#9678; DEVNET TX</div>`,
  `            <div style={{ height: 1, background: "rgba(212,175,55,0.3)" }} />`,
  `            <div className="gf" style={{ fontSize: isMobile ? 4 : 5, color: "#FFFFFF", wordBreak: "break-all", lineHeight: 2, textAlign: "center" }}>`,
  `              {lastTxId}`,
  `            </div>`,
  `            <div style={{ height: 1, background: "rgba(212,175,55,0.3)" }} />`,
  `            <iframe`,
  `              src={\`https://solscan.io/tx/\${lastTxId}?cluster=devnet\`}`,
  `              style={{ width: "100%", height: isMobile ? 200 : 300, border: "2px solid #5C4033", borderRadius: 6, background: "#111" }}`,
  `              title="Solscan TX"`,
  `            />`,
  `            <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>solscan.io — devnet</div>`,
  `            <div style={{ display: "flex", gap: 8 }}>`,
  `              <a`,
  `                href={\`https://solscan.io/tx/\${lastTxId}?cluster=devnet\`}`,
  `                target="_blank"`,
  `                rel="noopener noreferrer"`,
  `                className="wb gf"`,
  `                style={{ flex: 1, fontSize: isMobile ? 6 : 7, padding: "10px", textAlign: "center", textDecoration: "none", color: "#9D7BFF", background: "linear-gradient(180deg,#2d1060,#1a0a3a)", border: "2px solid #9D7BFF", boxShadow: "0 4px 0 #1a0a3a", borderRadius: 6 }}`,
  `                onClick={(e) => e.stopPropagation()}`,
  `              >`,
  `                OPEN BROWSER`,
  `              </a>`,
  `              <button className="wb gf" onClick={() => setShowTxPopup(false)} style={{ flex: 1, fontSize: isMobile ? 6 : 7, padding: "10px" }}>`,
  `                CLOSE`,
  `              </button>`,
  `            </div>`,
  `          </div>`,
  `        </div>`,
  `      )}`,
  ``,
];

lines.splice(logoLine2, 0, ...popup);
writeFileSync('src/pages/FarmingGame.tsx', lines.join('\n'), 'utf8');
console.log('✅ TX popup inserted before line', logoLine2 + 1);
