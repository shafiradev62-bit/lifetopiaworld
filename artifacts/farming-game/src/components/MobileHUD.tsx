import type { GameState } from "../game/Game";
import { isCropPlantingUnlocked, seedUnlockLevel } from "../game/Game";

interface ToolDef { id: string; label: string; img: string; }
interface Props {
  ds: GameState;
  tools: readonly ToolDef[];
  onSelectTool: (id: string) => void;
  onOpenPanel: (panel: string) => void;
  onOpenWorldMap: () => void;
  currentMap: string;
  gold: number;
  level: number;
  claimableCount: number;
  boostCharges?: number;
  onBoost?: () => void;
  isGuest?: boolean;
}

const TOOL_ICONS: Record<string, string> = {
  sickle: "/celurit_1774349990712.png",
  axe: "/kapak_1_1774349990715.png",
  "axe-large": "/kapak_1774349990716.png",
  water: "/teko_siram.png",
  "wheat-seed": "/wheat.png",
  "tomato-seed": "/tomato.png",
  "carrot-seed": "/carrot.png",
  "pumpkin-seed": "/pumpkin.png",
};

export default function MobileHUD({
  ds, tools, onSelectTool, onOpenPanel, onOpenWorldMap, currentMap,
  gold, level, claimableCount, boostCharges = 0, onBoost, isGuest = false,
}: Props) {
  const activeTool = ds.player.tool;
  const SLOT = 38; // compact slot size
  const SLOT_IMG = 26;

  return (
    <>
      <style>{`
        @keyframes mwPulse { 0%,100% { box-shadow: 0 2px 0 #2a1a08, 0 0 0 0 rgba(171,159,242,0.7); } 50% { box-shadow: 0 2px 0 #2a1a08, 0 0 0 4px rgba(171,159,242,0); } }
        .ms { width: ${SLOT}px; height: ${SLOT}px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative; transition: transform 0.08s; box-shadow: inset 0 0 6px rgba(0,0,0,0.7), 0 2px 3px rgba(0,0,0,0.3); touch-action: manipulation; border: 2.5px solid #4D2D18; background: linear-gradient(135deg, #8B5E3C 0%, #5E3A24 100%); flex-shrink: 0; }
        .ms:active { transform: scale(0.88) !important; }
        .msa { background: linear-gradient(135deg, #D4AF37 0%, #A07820 100%) !important; border-color: #FFD700 !important; box-shadow: 0 0 8px rgba(255,215,0,0.4), inset 0 0 5px rgba(0,0,0,0.3) !important; }
        .mb { font-family: 'Press Start 2P', monospace; background: linear-gradient(180deg,#CE9E64,#8D5A32); border: 2px solid #5C4033; border-radius: 999px; color: #FFF5E0; cursor: pointer; box-shadow: 0 2px 0 #3a2212; padding: 4px 8px; font-size: 6px; touch-action: manipulation; flex-shrink: 0; }
        .mba { background: linear-gradient(180deg,#FFD700,#C8A020) !important; color: #3E2723 !important; border-color: #FFD700 !important; }
      `}</style>

      {/* ── TOP BAR — ultra compact, ALL buttons clickable ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: `3px ${/* safe area */ 4}px`,
        paddingTop: `max(3px, env(safe-area-inset-top))`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(180deg, rgba(20,10,3,0.95) 0%, transparent 100%)",
        zIndex: 1200,
        height: 34,
        touchAction: "manipulation",
      }}>
        {/* Left: stats (non-interactive display) */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div className="mb" style={{ fontSize: 6, padding: "3px 7px", cursor: "default" }}>
            LV{level}
          </div>
          <div className="mb" style={{ fontSize: 6, padding: "3px 7px", color: "#FFD700", cursor: "default" }}>
            G{gold}
          </div>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {isGuest && (
            <button className="mb" style={{ animation: "mwPulse 2s infinite", fontSize: 4, padding: "3px 6px", background: "linear-gradient(180deg,#ab9ff2,#512da8)", borderColor: "#ab9ff2", color: "#FFF" }}
              onClick={() => onOpenPanel("wallet")}>
              +WALLET
            </button>
          )}
          {!isGuest && (
            <button className="mb" style={{ fontSize: 4, padding: "3px 6px" }}
              onClick={() => onOpenPanel("wallet")}>
              WALLET
            </button>
          )}
          <button className="mb" style={{ fontSize: 4, padding: "3px 6px", position: "relative" }}
            onClick={() => onOpenPanel("quests")}>
            TASKS{claimableCount > 0 ? ` ${claimableCount}` : ""}
          </button>
          <button className="mb" style={{ fontSize: 4, padding: "3px 6px" }}
            onClick={() => onOpenPanel("settings")}>SET</button>
        </div>
      </div>

      {/* ── HOME BUTTON — wood panel style, opens WorldMapScreen, bottom-right ── */}
      <div style={{
        position: "absolute",
        bottom: `calc(env(safe-area-inset-bottom, 0px) + ${SLOT + 14}px)`,
        right: 10,
        zIndex: 1200,
        pointerEvents: "auto",
        touchAction: "manipulation",
      }}>
        <button
          onClick={() => onOpenWorldMap()}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            background: "linear-gradient(180deg, #CE9E64 0%, #8D5A32 100%)",
            border: "3px solid #D4AF37",
            borderRadius: 999,
            color: "#FFF5E0",
            cursor: "pointer",
            boxShadow: "0 4px 0 #3a2212, 0 0 8px rgba(212,175,55,0.3)",
            padding: "7px 14px",
            fontSize: 7,
            letterSpacing: 1,
            textShadow: "1px 1px 1px #000",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          HOME
        </button>
      </div>

      {/* ── BOTTOM TOOL TRAY — scrollable on narrow screens ── */}
      <div style={{
        position: "absolute",
        bottom: `calc(env(safe-area-inset-bottom, 0px) + 4px)`,
        left: 0,
        right: 0,
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "linear-gradient(180deg, #9A7040 0%, #7B502C 100%)",
        padding: "5px 8px",
        borderRadius: 0,
        borderTop: "2.5px solid #5C4033",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.5), inset 0 1px 4px rgba(255,255,255,0.15)",
        pointerEvents: "auto",
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
      }}>
        {tools.map((t, i) => {
          const isActive = activeTool === t.id;
          const seedCount = t.id.endsWith("-seed") ? (ds.player.inventory[t.id] ?? 0) : null;
          const cooldown = ds.seedCooldowns?.[t.id] ?? 0;
          const cropGate = t.id.endsWith("-seed") ? (t.id.replace("-seed", "") as any) : null;
          const seedLocked = cropGate && !isCropPlantingUnlocked(cropGate, ds.player.level, ds.farmBalancePreset);
          const neededLvl = cropGate ? seedUnlockLevel(cropGate, ds.farmBalancePreset) : 0;
          return (
            <div
              key={t.id}
              className={`ms${isActive ? " msa" : ""}`}
              onClick={() => onSelectTool(t.id)}
              style={{ opacity: seedLocked ? 0.5 : 1 }}
            >
              {/* Slot number */}
              <div style={{
                position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
                background: isActive ? "linear-gradient(180deg,#FFD700,#C8A020)" : "linear-gradient(180deg,#CE9E64,#8D5A32)",
                border: "1.5px solid #5C4033", borderRadius: "50%",
                width: 14, height: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 0 #3a2212", zIndex: 2,
              }}>
                <span style={{ fontSize: 4, color: isActive ? "#3E2723" : "#FFF", fontFamily: "'Press Start 2P', monospace" }}>{i + 1}</span>
              </div>

              <img
                src={TOOL_ICONS[t.id] || t.img}
                alt={t.label}
                style={{ width: SLOT_IMG, height: SLOT_IMG, objectFit: "contain", imageRendering: "pixelated", opacity: isActive ? 1 : 0.8 }}
              />

              {/* Seed count */}
              {seedCount !== null && seedCount > 0 && (
                <div style={{
                  position: "absolute", bottom: -3, right: -3,
                  background: seedCount > 0 ? "#4CAF50" : "#F44336",
                  border: "1.5px solid #5C4033", borderRadius: "50%",
                  width: 13, height: 13, fontSize: 6,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#FFF", fontWeight: "bold",
                  fontFamily: "'Press Start 2P', monospace",
                }}>{seedCount}</div>
              )}

              {/* Cooldown */}
              {cooldown > 0 && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#FFF",
                }}>{Math.ceil(cooldown / 1000)}</div>
              )}

              {/* Level lock overlay */}
              {seedLocked && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: "rgba(0,0,0,0.55)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  zIndex: 10,
                }}>
                  <span style={{ fontSize: 10, color: "#FFF" }}>[</span>
                  <span style={{ fontSize: 5, color: "#FF4444", fontFamily: "'Press Start 2P', monospace", marginTop: -1 }}>LV{neededLvl}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* BOOST */}
        <div
          className="ms"
          onClick={onBoost}
          style={{
            background: boostCharges > 0 ? "linear-gradient(135deg,#FFE4B5,#C8A020)" : "linear-gradient(135deg,#4A3520,#2A1A10)",
            borderColor: boostCharges > 0 ? "#FFD700" : "#3D2510",
            opacity: boostCharges > 0 ? 1 : 0.5,
          }}
        >
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 4, color: boostCharges > 0 ? "#3E2723" : "#666",
            textAlign: "center", lineHeight: 1.5,
          }}>
            B<br/>{boostCharges}
          </div>
        </div>
      </div>
    </>
  );
}
