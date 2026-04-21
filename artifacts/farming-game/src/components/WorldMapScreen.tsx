import { useState, useEffect, useRef } from "react";
import type { MapType } from "../game/Game";
import { AudioManager } from "../game/AudioSystem";

interface Props {
  onSelectMap: (map: MapType) => void;
}

const MAP_W = 1600;
const MAP_H = 900;

// Positions on select_base.png where each building sits (% of image)
// cx/cy = center of building footprint on the base map
// bw/bh = building overlay size as % of map width/height
const HOTSPOTS = [
  { id: "home"     as MapType, cx: 15.0, cy: 68.0, label: "FARM",     icon: "/select_farm.png",     iconSize: 355, bw: 22, bh: 38 },
  { id: "suburban" as MapType, cx: 72.0, cy: 22.0, label: "SUBURBAN", icon: "/select_suburban.png", iconSize: 325, bw: 20, bh: 32 },
  { id: "city"     as MapType, cx: 22.0, cy: 28.0, label: "CITY",     icon: "/select_city.png",     iconSize: 400, bw: 26, bh: 40 },
  { id: "garden"   as MapType, cx: 56.0, cy: 58.0, label: "GARDEN",   icon: "/select_garden.png",   iconSize: 385, bw: 24, bh: 36 },
  { id: "fishing"  as MapType, cx: 72.0, cy: 80.0, label: "FISHING",  icon: "/select_fishing.png",  iconSize: 334, bw: 18, bh: 28 },
];

// Editor mode: add ?editor to URL
const IS_EDITOR = typeof window !== "undefined" && window.location.search.includes("editor");

interface CineState {
  id: MapType;
  cx: number; cy: number;
  icon: string;
  baseSize: number;
  scale: number;
  phase: "grow" | "flash";
}

export default function WorldMapScreen({ onSelectMap }: Props) {
  const [visible, setVisible] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const lastTouchDist = useRef<number | null>(null);
  const didDrag = useRef(false);
  const touchIdRef = useRef<number | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const [renderState, setRenderState] = useState({ ox: 0, oy: 0, sc: 1 });
  const [cine, setCine] = useState<CineState | null>(null);
  const rafRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [pressedId, setPressedId] = useState<MapType | null>(null);
  const [flashId, setFlashId] = useState<MapType | null>(null);
  const [hoveredId, setHoveredId] = useState<MapType | null>(null);

  // Editor state
  const [editorSpots, setEditorSpots] = useState(HOTSPOTS.map(h => ({ ...h })));
  const [selId, setSelId] = useState<MapType | null>(null);
  const draggingSpot = useRef<{ id: MapType; smx: number; smy: number; scx: number; scy: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40);
    return () => { clearTimeout(t); timersRef.current.forEach(clearTimeout); cancelAnimationFrame(rafRef.current); };
  }, []);

  const clamp = (ox: number, oy: number, sc: number) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    return {
      x: Math.max(Math.min(0, vw - MAP_W * sc), Math.min(0, ox)),
      y: Math.max(Math.min(0, vh - MAP_H * sc), Math.min(0, oy)),
    };
  };

  useEffect(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    // Calculate scale to fit the entire 1600x900 map within the viewport
    const sc = Math.min(vw / MAP_W, vh / MAP_H);
    const ox = (vw - MAP_W * sc) / 2;
    const oy = (vh - MAP_H * sc) / 2;
    const finalOffset = { x: ox, y: oy };
    setScale(sc); setOffset(finalOffset);
    setRenderState({ ox, oy, sc });
    offsetRef.current = finalOffset; scaleRef.current = sc;
  }, []);

  const spots = IS_EDITOR ? editorSpots : HOTSPOTS;

  const triggerCinematic = (spot: typeof HOTSPOTS[0]) => {
    if (cine || pressedId) return;
    AudioManager.playSFX("open", 0.28);
    setPressedId(spot.id);
    const t1 = setTimeout(() => setFlashId(spot.id), 900);
    const t2 = setTimeout(() => { onSelectMap(spot.id); setPressedId(null); setFlashId(null); }, 1500);
    timersRef.current.push(t1, t2);
  };

  const handleTap = (clientX: number, clientY: number) => {
    if (cine || pressedId) return;
    const px = ((clientX - offsetRef.current.x) / (MAP_W * scaleRef.current)) * 100;
    const py = ((clientY - offsetRef.current.y) / (MAP_H * scaleRef.current)) * 100;
    for (const spot of spots) {
      if (Math.abs(px - spot.cx) < 8 && Math.abs(py - spot.cy) < 8) {
        triggerCinematic(spot); return;
      }
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (cine || pressedId) return;
    if (!IS_EDITOR) handleTap(e.clientX, e.clientY);
  };
  const onMouseMove = (e: React.MouseEvent) => {};
  const onMouseUp = (e: React.MouseEvent) => {};
  const onWheel = (e: React.WheelEvent) => {};
  const onTouchStart = (e: React.TouchEvent) => {
    if (cine || pressedId) return;
    if (e.touches.length === 1) {
      handleTap(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {};
  const onTouchEnd = (e: React.TouchEvent) => {};

  const { ox: curOx, oy: curOy, sc: curSc } = renderState;

  const selSpot = IS_EDITOR && selId ? editorSpots.find(h => h.id === selId) : null;

  return (
    <div
      style={{
        position: "absolute", inset: 0, width: "100vw", height: "100vh",
        zIndex: 8000, opacity: visible ? 1 : 0, transition: "opacity 0.35s ease",
        overflow: "hidden", background: "#0a0806",
        cursor: "default",
        userSelect: "none", WebkitUserSelect: "none",
      }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
      onMouseLeave={() => { isDragging.current = false; draggingSpot.current = null; }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      {/* Base map — buildings already painted on it */}
      <div style={{
        position: "absolute", left: curOx, top: curOy,
        width: MAP_W * curSc, height: MAP_H * curSc,
        backgroundImage: "url('/select_base.png')",
        backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
      }}>
        {/* Permanent building overlays */}
        {spots.map((spot) => {
          const isPressed = pressedId === spot.id;
          const isFlash = flashId === spot.id;
          const isHovered = !IS_EDITOR && hoveredId === spot.id && !isPressed;
          return (
            <div
              key={spot.id + "_bld"}
              style={{
                position: "absolute",
                left: `${spot.cx - spot.bw / 2}%`,
                top: `${spot.cy - spot.bh / 2}%`,
                width: `${spot.bw}%`,
                height: `${spot.bh}%`,
                pointerEvents: "none",
                // 3D press effect: scale down + translate down + shrink shadow
                transform: isPressed
                   ? "scale(0.91) translateY(3%)"
                   : "scale(1) translateY(0%)",
                transition: isPressed
                   ? "transform 0.35s cubic-bezier(0.4,0,0.2,1), filter 0.35s ease"
                   : "transform 0.55s cubic-bezier(0.34,1.56,0.64,1), filter 0.55s ease",
                filter: isFlash
                   ? "brightness(3) drop-shadow(0 0 40px #fff)"
                   : isPressed
                   ? "drop-shadow(0 1px 3px rgba(0,0,0,0.9)) drop-shadow(0 1px 2px rgba(0,0,0,0.7)) brightness(0.8)"
                   : isHovered
                   ? "drop-shadow(0 10px 20px rgba(0,0,0,0.6)) drop-shadow(0 4px 8px rgba(0,0,0,0.4)) brightness(1.08)"
                   : "drop-shadow(0 10px 20px rgba(0,0,0,0.6)) drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
                transformOrigin: "center bottom",
              }}
            >
              <img
                src={spot.icon}
                alt=""
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            </div>
          );
        })}

        {/* Invisible hotspot hit areas + labels */}
        {spots.map((spot) => {
          const hitW = 120 * curSc, hitH = 120 * curSc;
          const isSel = IS_EDITOR && selId === spot.id;
          return (
            <div
              key={spot.id}
              onMouseEnter={() => {
                if (IS_EDITOR || cine || pressedId) return;
                setHoveredId(spot.id);
              }}
              onMouseLeave={() => {
                setHoveredId((h) => (h === spot.id ? null : h));
              }}
              onMouseDown={(e) => {
                if (!IS_EDITOR) return;
                e.stopPropagation(); setSelId(spot.id);
                draggingSpot.current = { id: spot.id, smx: e.clientX, smy: e.clientY, scx: spot.cx, scy: spot.cy };
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (IS_EDITOR) { setSelId(spot.id); return; }
                if (!cine) triggerCinematic(spot);
              }}
              style={{
                position: "absolute",
                left: `calc(${spot.cx}% - ${hitW / 2}px)`,
                top: `calc(${spot.cy}% - ${hitH / 2}px)`,
                width: hitW, height: hitH,
                cursor: IS_EDITOR ? "move" : "pointer",
                border: isSel ? "2px dashed #00FFFF" : IS_EDITOR ? "1px dashed rgba(255,215,0,0.4)" : "none",
                borderRadius: 8,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "flex-end",
                pointerEvents: cine ? "none" : "auto",
              }}
            >
              {/* Label below hotspot */}
              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: Math.max(7, 9 * Math.max(0.5, curSc * 0.5)),
                color: "#FFD700",
                textShadow: "1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000",
                whiteSpace: "nowrap",
                marginBottom: -Math.max(14, 18 * curSc),
                pointerEvents: "none",
              }}>{spot.label}</div>
            </div>
          );
        })}
      </div>

      {/* Hint */}
      {!cine && !IS_EDITOR && (
        <div style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          fontFamily: "'Press Start 2P', monospace", fontSize: 7,
          color: "#FFFFFF", fontWeight: "bold",
          textShadow: "1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000",
          pointerEvents: "none", whiteSpace: "nowrap",
          padding: "10px 20px", borderRadius: 999,
          background: "linear-gradient(180deg,#D4B896 0%,#B8895A 45%,#7A5234 100%)",
          border: "4px solid #F4D03F",
          boxShadow: "0 5px 0 #2f1f10, inset 0 2px 3px rgba(255,255,255,0.4)",
        }}>TAP A LOCATION TO TRAVEL</div>
      )}

      {/* Editor panel */}
      {IS_EDITOR && (
        <div style={{
          position: "absolute", top: 10, right: 10, zIndex: 9999,
          background: "rgba(10,8,4,0.95)", border: "2px solid #FFD700",
          borderRadius: 12, padding: 14, width: 220,
          fontFamily: "'Press Start 2P', monospace", color: "#FFD700",
        }} onMouseDown={e => e.stopPropagation()}>
          <div style={{ fontSize: 8, marginBottom: 8 }}>MAP EDITOR</div>
          <div style={{ fontSize: 5, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>Drag hotspot areas on map</div>
          {editorSpots.map(h => (
            <div key={h.id} onClick={() => setSelId(h.id)} style={{
              padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 6, marginBottom: 4,
              background: selId === h.id ? "#FFD700" : "rgba(255,255,255,0.08)",
              color: selId === h.id ? "#000" : "#FFD700",
              border: "1px solid " + (selId === h.id ? "#FFD700" : "rgba(255,215,0,0.2)"),
            }}>{h.label}</div>
          ))}
          {selSpot && (
            <div style={{ borderTop: "1px solid rgba(255,215,0,0.2)", paddingTop: 10, marginTop: 6 }}>
              <div style={{ fontSize: 6, color: "#fff", marginBottom: 8 }}>X: {selSpot.cx.toFixed(1)}%  Y: {selSpot.cy.toFixed(1)}%</div>
              <div style={{ fontSize: 5, color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>SIZE: {selSpot.iconSize}px</div>
              <input type="range" min={60} max={400} value={selSpot.iconSize}
                onChange={e => setEditorSpots(prev => prev.map(h => h.id === selId ? { ...h, iconSize: +e.target.value } : h))}
                style={{ width: "100%", accentColor: "#FFD700", marginBottom: 8 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {([["X-", -0.5, 0], ["X+", 0.5, 0], ["Y-", 0, -0.5], ["Y+", 0, 0.5]] as [string, number, number][]).map(([l, dx, dy]) => (
                  <button key={l} onClick={() => setEditorSpots(prev => prev.map(h => h.id === selId
                    ? { ...h, cx: Math.max(0, Math.min(100, h.cx + dx)), cy: Math.max(0, Math.min(100, h.cy + dy)) } : h))}
                    style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, background: "rgba(255,215,0,0.15)", border: "1px solid #FFD700", color: "#FFD700", borderRadius: 4, padding: "4px 2px", cursor: "pointer" }}>{l}</button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => {
            const out = JSON.stringify(editorSpots.map(h => ({ id: h.id, cx: +h.cx.toFixed(1), cy: +h.cy.toFixed(1), iconSize: h.iconSize })), null, 2);
            localStorage.setItem("map_hotspots_v2", out);
            alert("Saved!\n\n" + out);
          }} style={{
            marginTop: 12, width: "100%", fontFamily: "'Press Start 2P', monospace",
            fontSize: 7, padding: "8px 0", borderRadius: 8, cursor: "pointer",
            background: "linear-gradient(180deg,#FFD700,#C8A020)", color: "#000", border: "none",
          }}>SAVE & COPY</button>
        </div>
      )}

      {/* Flash */}
      <div style={{
        position: "absolute", inset: 0, background: "#fff",
        opacity: flashId ? 1 : 0,
        transition: flashId ? "opacity 0.2s ease-in" : "none",
        pointerEvents: "none", zIndex: 20,
      }} />
    </div>
  );
}
