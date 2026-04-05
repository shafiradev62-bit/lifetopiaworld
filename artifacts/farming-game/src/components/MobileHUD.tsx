import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import type { GameState } from "../game/Game";
import { isCropPlantingUnlocked, seedUnlockLevel } from "../game/Game";
import {
  MOBILE_ACTION_ROW_PX,
  MOBILE_HOTBAR_HOME_PX,
  MOBILE_HOTBAR_OTHER_PX,
} from "../constants/mobileChrome";

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
  /** Small contextual buttons (SHOP, ACT, CAST, emotes…) — right side of action row; never overlaps MAP */
  mapActions?: ReactNode;
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

/** Reusable compact control for map-specific actions from parent */
export const mobileHudActionBtnStyle: CSSProperties = {
  fontFamily: "'Press Start 2P', monospace",
  fontSize: 4,
  padding: "3px 7px",
  minHeight: 26,
  maxHeight: 28,
  lineHeight: 1.2,
  borderRadius: 6,
  border: "2px solid #5C4033",
  background: "linear-gradient(180deg,#A07844 0%,#6B4520 100%)",
  color: "#FFF5E0",
  cursor: "pointer",
  touchAction: "manipulation",
  flexShrink: 0,
  boxShadow: "0 2px 0 #2a1808",
};

export const mobileHudAccentBtnStyle: CSSProperties = {
  ...mobileHudActionBtnStyle,
  background: "linear-gradient(180deg, #FFD700 0%, #C8A020 100%)",
  borderColor: "#8d6e15",
  color: "#3E2723",
};

function nonHomeHint(map: string): string {
  if (map === "city") return "CITY - MAP opens world · SHOP for seeds";
  if (map === "fishing") return "FISHING - CAST / PULL on the right";
  if (map === "garden") return "GARDEN - emotes on the right · MAP to travel";
  if (map === "suburban") return "SUBURBAN - walk to signs · MAP to travel";
  return "MAP opens world map";
}

export default function MobileHUD({
  ds, tools, onSelectTool, onOpenPanel, onOpenWorldMap, currentMap,
  gold, level, claimableCount, boostCharges = 0, onBoost, isGuest = false,
  mapActions,
}: Props) {
  const activeTool = ds.player.tool;
  const SLOT = 34;
  const SLOT_IMG = 22;
  const isHome = currentMap === "home";
  const hotbarH = isHome ? MOBILE_HOTBAR_HOME_PX : MOBILE_HOTBAR_OTHER_PX;

  return (
    <>
      <style>{`
        @keyframes mwPulse { 0%,100% { box-shadow: 0 2px 0 #2a1a08, 0 0 0 0 rgba(171,159,242,0.7); } 50% { box-shadow: 0 2px 0 #2a1a08, 0 0 0 4px rgba(171,159,242,0); } }
        .ms { width: ${SLOT}px; height: ${SLOT}px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative; transition: transform 0.08s; box-shadow: inset 0 0 6px rgba(0,0,0,0.7), 0 2px 3px rgba(0,0,0,0.3); touch-action: manipulation; border: 2px solid #4D2D18; background: linear-gradient(135deg, #8B5E3C 0%, #5E3A24 100%); flex-shrink: 0; }
        .ms:active { transform: scale(0.88) !important; }
        .msa { background: linear-gradient(135deg, #D4AF37 0%, #A07820 100%) !important; border-color: #FFD700 !important; box-shadow: 0 0 6px rgba(255,215,0,0.35), inset 0 0 5px rgba(0,0,0,0.3) !important; }
        .mb { font-family: 'Press Start 2P', monospace; background: linear-gradient(180deg,#CE9E64,#8D5A32); border: 2px solid #5C4033; border-radius: 999px; color: #FFF5E0; cursor: pointer; box-shadow: 0 2px 0 #3a2212; padding: 3px 6px; font-size: 4px; touch-action: manipulation; flex-shrink: 0; max-height: 26px; line-height: 1.2; }
      `}</style>

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "2px 4px",
        paddingTop: `max(2px, env(safe-area-inset-top))`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(180deg, rgba(20,10,3,0.95) 0%, transparent 100%)",
        zIndex: 1260,
        minHeight: 32,
        maxHeight: 34,
        touchAction: "manipulation",
      }}>
        <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0 }}>
          <div className="mb" style={{ cursor: "default", padding: "2px 6px" }}>LV{level}</div>
          <div className="mb" style={{ color: "#FFD700", cursor: "default", padding: "2px 6px" }}>G{gold}</div>
        </div>
        <div style={{ display: "flex", gap: 3, alignItems: "center", flexWrap: "nowrap", flexShrink: 1, justifyContent: "flex-end" }}>
          {isGuest && (
            <button
              type="button"
              className="mb"
              aria-label="Connect Solana wallet"
              style={{
                animation: "mwPulse 2s infinite",
                background: "linear-gradient(180deg,#ab9ff2,#512da8)",
                borderColor: "#ab9ff2",
                padding: "2px 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => onOpenPanel("wallet")}
            >
              CONNECT WALLET
            </button>
          )}
          {!isGuest && (
            <button
              type="button"
              className="mb"
              aria-label="Wallet"
              style={{ padding: "2px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => onOpenPanel("wallet")}
            >
              <img
                src={`${import.meta.env.BASE_URL}solana-icon.svg`}
                alt=""
                width={22}
                height={19}
                style={{ display: "block", objectFit: "contain" }}
              />
            </button>
          )}
          <button className="mb" style={{ position: "relative" }} onClick={() => onOpenPanel("quests")}>
            T{claimableCount > 0 ? claimableCount : ""}
          </button>
          <button className="mb" onClick={() => onOpenPanel("settings")}>SET</button>
        </div>
      </div>

      {/* Action row: MAP on every map + contextual buttons (no overlap) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: `calc(env(safe-area-inset-bottom, 0px) + ${hotbarH}px)`,
          height: MOBILE_ACTION_ROW_PX,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 5px",
          gap: 6,
          zIndex: 1270,
          pointerEvents: "auto",
          background: "linear-gradient(180deg, rgba(8,4,2,0.5) 0%, rgba(8,4,2,0.15) 100%)",
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          onClick={() => { onOpenWorldMap(); }}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            flexShrink: 0,
            background: "linear-gradient(180deg, #CE9E64 0%, #8D5A32 100%)",
            border: "2px solid #D4AF37",
            borderRadius: 6,
            color: "#FFF5E0",
            padding: "3px 8px",
            fontSize: 5,
            lineHeight: 1.2,
            boxShadow: "0 2px 0 #3a2212",
            touchAction: "manipulation",
            maxHeight: 28,
          }}
        >
          MAP
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 4,
            flex: 1,
            minWidth: 0,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            maxHeight: MOBILE_ACTION_ROW_PX,
          }}
        >
          {mapActions}
        </div>
      </div>

      {/* Bottom hotbar / hint */}
      <div style={{
        position: "absolute",
        bottom: `calc(env(safe-area-inset-bottom, 0px) + 2px)`,
        left: 0,
        right: 0,
        zIndex: 1260,
        display: "flex",
        alignItems: "center",
        gap: 3,
        background: "linear-gradient(180deg, #9A7040 0%, #7B502C 100%)",
        padding: isHome ? "4px 6px" : "6px 8px",
        borderTop: "2px solid #5C4033",
        boxShadow: "0 -3px 10px rgba(0,0,0,0.45), inset 0 1px 3px rgba(255,255,255,0.12)",
        pointerEvents: "auto",
        overflowX: isHome ? "auto" : "hidden",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        justifyContent: isHome ? "flex-start" : "center",
        minHeight: isHome ? MOBILE_HOTBAR_HOME_PX - 4 : MOBILE_HOTBAR_OTHER_PX - 4,
        maxHeight: isHome ? MOBILE_HOTBAR_HOME_PX : MOBILE_HOTBAR_OTHER_PX,
      }}>
        {!isHome && (
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 4,
              color: "#FFF5E0",
              textAlign: "center",
              lineHeight: 1.5,
              padding: "0 4px",
            }}
          >
            {nonHomeHint(currentMap)}
          </div>
        )}
        {isHome && tools.map((t, i) => {
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
              role="button"
              tabIndex={0}
              onPointerUp={(ev) => {
                ev.stopPropagation();
                onSelectTool(t.id);
              }}
              style={{ opacity: seedLocked ? 0.5 : 1 }}
            >
              <div style={{
                position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)",
                background: isActive ? "linear-gradient(180deg,#FFD700,#C8A020)" : "linear-gradient(180deg,#CE9E64,#8D5A32)",
                border: "1px solid #5C4033", borderRadius: "50%",
                width: 12, height: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 0 #3a2212", zIndex: 2,
              }}>
                <span style={{ fontSize: 3, color: isActive ? "#3E2723" : "#FFF", fontFamily: "'Press Start 2P', monospace" }}>{i + 1}</span>
              </div>
              <img
                src={TOOL_ICONS[t.id] || t.img}
                alt={t.label}
                style={{ width: SLOT_IMG, height: SLOT_IMG, objectFit: "contain", imageRendering: "pixelated", opacity: isActive ? 1 : 0.8 }}
              />
              {seedCount !== null && seedCount > 0 && (
                <div style={{
                  position: "absolute", bottom: -2, right: -2,
                  background: "#4CAF50",
                  border: "1px solid #5C4033", borderRadius: "50%",
                  width: 11, height: 11, fontSize: 5,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#FFF", fontWeight: "bold",
                  fontFamily: "'Press Start 2P', monospace",
                }}>{seedCount}</div>
              )}
              {cooldown > 0 && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#FFF",
                }}>{Math.ceil(cooldown / 1000)}</div>
              )}
              {seedLocked && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: "rgba(0,0,0,0.55)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  zIndex: 10,
                }}>
                  <span style={{ fontSize: 8, color: "#FFF" }}>[</span>
                  <span style={{ fontSize: 4, color: "#FF4444", fontFamily: "'Press Start 2P', monospace", marginTop: -1 }}>LV{neededLvl}</span>
                </div>
              )}
            </div>
          );
        })}
        {isHome && (
          <div
            className="ms"
            role="button"
            tabIndex={0}
            onPointerUp={(ev) => {
              ev.stopPropagation();
              onBoost?.();
            }}
            style={{
              background: boostCharges > 0 ? "linear-gradient(135deg,#FFE4B5,#C8A020)" : "linear-gradient(135deg,#4A3520,#2A1A10)",
              borderColor: boostCharges > 0 ? "#FFD700" : "#3D2510",
              opacity: boostCharges > 0 ? 1 : 0.5,
            }}
          >
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 3, color: boostCharges > 0 ? "#3E2723" : "#666",
              textAlign: "center", lineHeight: 1.4,
            }}>
              B<br/>{boostCharges}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
