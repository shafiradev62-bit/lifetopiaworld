import { useEffect, useState, useRef, useCallback } from "react";
import { MapType } from "../game/Game";

interface SplashScreenProps {
  onSelectMap: (map: MapType) => void;
}

// ── Particle types ────────────────────────────────────────────────────────────
type ParticleKind = "leaf" | "sparkle" | "glow";

interface Particle {
  id: number;
  kind: ParticleKind;
  x: number; y: number;
  vx: number; vy: number;
  rot: number; vrot: number;
  scale: number; scaleV: number;
  alpha: number; alphaV: number;
  life: number; maxLife: number;
  color: string;
  // leaf specific
  leafW: number; leafH: number;
  veinAngle: number;
  // sparkle specific
  points: number;
  innerR: number; outerR: number;
}

const LEAF_COLORS = [
  "#4CAF50","#66BB6A","#81C784","#A5D6A7","#C8E6C9",
  "#8BC34A","#AED581","#DCEDC8","#F9A825","#FFD54F",
  "#FF8F00","#E65100",
];
const SPARKLE_COLORS = [
  "#FFD700","#FFF176","#FFEE58","#FFFDE7","#ffffff",
  "#B2FF59","#69F0AE","#E8F5E9",
];

let _pid = 0;

function spawnLeaf(cx: number, cy: number, W: number, H: number): Particle {
  // Burst from logo center area with spread
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.4 + Math.random() * 1.2;
  const size = 10 + Math.random() * 18;
  return {
    id: ++_pid, kind: "leaf",
    x: cx + (Math.random() - 0.5) * W * 0.5,
    y: cy + (Math.random() - 0.5) * H * 0.3,
    vx: Math.cos(angle) * speed * 0.6 + (Math.random() - 0.5) * 0.3,
    vy: -0.3 - Math.random() * 0.8,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.06,
    scale: 0.4 + Math.random() * 0.8,
    scaleV: 0,
    alpha: 0,
    alphaV: 0.025 + Math.random() * 0.02,
    life: 0, maxLife: 180 + Math.random() * 220,
    color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
    leafW: size, leafH: size * (0.55 + Math.random() * 0.3),
    veinAngle: (Math.random() - 0.5) * 0.3,
    points: 0, innerR: 0, outerR: 0,
  };
}

function spawnSparkle(cx: number, cy: number, W: number, H: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const dist = 20 + Math.random() * Math.min(W, H) * 0.35;
  const pts = Math.random() < 0.5 ? 4 : 6;
  const outer = 3 + Math.random() * 7;
  return {
    id: ++_pid, kind: "sparkle",
    x: cx + Math.cos(angle) * dist,
    y: cy + Math.sin(angle) * dist * 0.6,
    vx: (Math.random() - 0.5) * 0.4,
    vy: -0.15 - Math.random() * 0.5,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.08,
    scale: 0.5 + Math.random() * 1.0,
    scaleV: 0,
    alpha: 0,
    alphaV: 0.04 + Math.random() * 0.03,
    life: 0, maxLife: 60 + Math.random() * 100,
    color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
    leafW: 0, leafH: 0, veinAngle: 0,
    points: pts, innerR: outer * 0.35, outerR: outer,
  };
}

function spawnGlow(cx: number, cy: number, W: number, H: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const dist = 10 + Math.random() * Math.min(W, H) * 0.28;
  return {
    id: ++_pid, kind: "glow",
    x: cx + Math.cos(angle) * dist,
    y: cy + Math.sin(angle) * dist * 0.5,
    vx: (Math.random() - 0.5) * 0.25,
    vy: -0.1 - Math.random() * 0.3,
    rot: 0, vrot: 0,
    scale: 0.3 + Math.random() * 0.9,
    scaleV: 0.003,
    alpha: 0,
    alphaV: 0.03,
    life: 0, maxLife: 80 + Math.random() * 120,
    color: Math.random() < 0.6 ? "#B2FF59" : "#FFD700",
    leafW: 6 + Math.random() * 10, leafH: 0,
    veinAngle: 0, points: 0, innerR: 0, outerR: 0,
  };
}

function drawLeaf(ctx: CanvasRenderingContext2D, p: Particle) {
  const w = p.leafW, h = p.leafH;
  ctx.save();
  ctx.rotate(p.rot);

  // Leaf body — organic bezier shape
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.bezierCurveTo(w * 0.7, -h * 0.6, w * 0.8, h * 0.1, 0, h * 0.5);
  ctx.bezierCurveTo(-w * 0.8, h * 0.1, -w * 0.7, -h * 0.6, 0, -h);
  ctx.closePath();

  // Gradient fill — light center, darker edges
  const grad = ctx.createRadialGradient(0, -h * 0.2, 0, 0, 0, w * 0.9);
  grad.addColorStop(0, lighten(p.color, 40));
  grad.addColorStop(0.5, p.color);
  grad.addColorStop(1, darken(p.color, 30));
  ctx.fillStyle = grad;
  ctx.fill();

  // Leaf outline
  ctx.strokeStyle = darken(p.color, 40);
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Center vein
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.9);
  ctx.quadraticCurveTo(w * 0.1, 0, 0, h * 0.45);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Side veins
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 3; i++) {
    const t = -0.5 + i * 0.4;
    const bx = t * h * 0.15, by = t * h;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + w * 0.45, by - h * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - w * 0.45, by - h * 0.15);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSparkle(ctx: CanvasRenderingContext2D, p: Particle) {
  const { points, innerR, outerR } = p;
  ctx.save();
  ctx.rotate(p.rot);

  // Star/sparkle shape
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
            : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();

  // Glow fill
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, outerR);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.3, p.color);
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fill();

  // Outer glow halo
  ctx.save();
  ctx.globalAlpha *= 0.3;
  ctx.beginPath();
  ctx.arc(0, 0, outerR * 1.8, 0, Math.PI * 2);
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, outerR * 1.8);
  halo.addColorStop(0, p.color);
  halo.addColorStop(1, "transparent");
  ctx.fillStyle = halo;
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawGlow(ctx: CanvasRenderingContext2D, p: Particle) {
  const r = p.leafW * p.scale;
  ctx.save();
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.3, p.color + "cc");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}
function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff) - amt);
  return `rgb(${r},${g},${b})`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SplashScreen({ onSelectMap }: SplashScreenProps) {
  const [ready, setReady] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(t);
  }, []);

  const tick = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    // Logo center approx
    const cx = W * 0.5, cy = H * 0.44;

    ctx.clearRect(0, 0, W, H);
    frameRef.current++;

    // Spawn particles — reduced frequency
    if (frameRef.current % 12 === 0) particlesRef.current.push(spawnLeaf(cx, cy, W, H));
    if (frameRef.current % 16 === 0) particlesRef.current.push(spawnSparkle(cx, cy, W, H));
    if (frameRef.current % 24 === 0) particlesRef.current.push(spawnGlow(cx, cy, W, H));

    // Cap
    if (particlesRef.current.length > 180) particlesRef.current.splice(0, 10);

    // Update + draw
    particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife);

    for (const p of particlesRef.current) {
      p.life++;
      p.x += p.vx + Math.sin(p.life * 0.04 + p.id) * 0.18;
      p.y += p.vy;
      p.vy += 0.008; // gentle gravity
      p.vx *= 0.998;
      p.rot += p.vrot;
      p.scale += p.scaleV;

      // Fade in / fade out — max alpha 0.22 (almost transparent)
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio < 0.15) {
        p.alpha = Math.min(0.22, p.alpha + p.alphaV * 0.5);
      } else if (lifeRatio > 0.6) {
        p.alpha = Math.max(0, p.alpha - p.alphaV * 0.6);
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale, p.scale);
      ctx.globalAlpha = p.alpha;

      if (p.kind === "leaf") drawLeaf(ctx, p);
      else if (p.kind === "sparkle") drawSparkle(ctx, p);
      else drawGlow(ctx, p);

      ctx.restore();
    }

    animRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    // Resize canvas to window
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    animRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [tick]);

  const handleStart = () => {
    if (!ready || clicked) return;
    setClicked(true);
    setFadeOut(true);
    setTimeout(() => onSelectMap("home"), 700);
  };

  return (
    <div
      onClick={handleStart}
      style={{
        position: "fixed", inset: 0, overflow: "hidden",
        zIndex: 99999,
        cursor: ready ? "pointer" : "default",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.7s ease",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        @keyframes splashPanZoom {
          0% { transform: scale(1.04) translate(0,0); }
          50% { transform: scale(1.1) translate(1%,-1%); }
          100% { transform: scale(1.04) translate(0,0); }
        }
        @keyframes splashLogoFloat {
          0%,100% { transform: translate(-50%,-50%) translateY(0px); }
          50% { transform: translate(-50%,-50%) translateY(0px); }
        }
        @keyframes splashFadeUp {
          from { opacity:0; transform:translateX(-50%) translateY(0px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
        @keyframes splashBtnFadeUp {
          from { opacity:0; transform:translateX(-50%) translateY(0px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
        @keyframes splashBtnBob {
          0%,100% { transform:translateX(-50%) translateY(0); }
          50%     { transform:translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* BACKGROUND */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "url(/home_1774349990715.jpg)",
        backgroundSize: "cover", backgroundPosition: "center",
        willChange: "transform", zIndex: 1,
      }} />

      {/* GRADIENT OVERLAY */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.82) 100%)",
        zIndex: 2,
      }} />

      {/* PARTICLE VFX CANVAS */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute", inset: 0,
          pointerEvents: "none", zIndex: 9,
        }}
      />

      {/* LOGO */}
      <img
        src="/logo.png"
        alt="LIFETOPIA"
        style={{
          position: "absolute",
          top: "44%", left: "50%",
          height: "clamp(180px, 38vh, 420px)",
          objectFit: "contain",
          filter: "drop-shadow(0 16px 40px rgba(0,0,0,0.9))",
          zIndex: 10,
          pointerEvents: "none",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* SUBTITLE */}
      <div style={{
        position: "absolute", top: "67%", left: "50%",
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "clamp(7px, 1.5vw, 10px)",
        color: "#FFE4B5",
        textShadow: "2px 2px 0 #000",
        zIndex: 10, whiteSpace: "nowrap", letterSpacing: 2,
        animation: "splashFadeUp 0.8s ease forwards",
        opacity: 0, animationDelay: "0.6s",
        transform: "translateX(-50%)",
      }}>
        PUBLIC ALPHA — SOLANA DEVNET
      </div>

      {/* CLICK TO START */}
      {ready && (
        <div style={{
          position: "absolute", top: "77%", left: "50%",
          zIndex: 20,
          animation: clicked ? "none" : "splashBtnFadeUp 0.5s ease forwards, splashBtnBob 2s ease-in-out 0.5s infinite",
          opacity: 0, animationFillMode: "forwards",
        }}>
          <button style={{
            fontFamily: "'Press Start 2P', monospace",
            background: "linear-gradient(180deg, #CE9E64 0%, #8D5A32 100%)",
            border: "3px solid #5C4033", borderRadius: "999px",
            color: "#FFF5E0", cursor: "pointer",
            boxShadow: "0 6px 0 #3a2212, inset 0 1px 1px rgba(255,255,255,0.45)",
            padding: "14px 40px", fontSize: 11,
            textShadow: "1px 1px 1px #000", letterSpacing: 1,
            pointerEvents: "none",
          }}>
            ▶ CLICK TO START
          </button>
        </div>
      )}

      {/* BOTTOM INFO */}
      <div style={{
        position: "absolute", bottom: 28, left: "50%",
        fontFamily: "'Press Start 2P', monospace", fontSize: 6,
        color: "rgba(255,220,150,0.55)", zIndex: 10,
        textAlign: "center", whiteSpace: "nowrap",
        animation: "splashFadeUp 0.8s ease forwards",
        opacity: 0, animationDelay: "1s",
        transform: "translateX(-50%)",
      }}>
        CONNECT WALLET · FARM · EARN GOLD · CLAIM NFT · LIFETOPIA WORLD v0.9.7
      </div>
    </div>
  );
}
