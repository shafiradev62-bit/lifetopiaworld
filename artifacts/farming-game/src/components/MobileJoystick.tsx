import { useRef, useEffect, useCallback } from "react";

interface Props {
  onDirChange: (keys: string[], active: boolean) => void;
  disabled?: boolean;
}

const OUTER_R = 60;   // outer ring radius px
const INNER_R = 26;   // thumb nub radius px
const DEAD_ZONE = 12; // px before registering direction

/**
 * Mobile Legend-style virtual analog joystick.
 * Touch anywhere in the left half of the screen to spawn the joystick there.
 * Drag in any direction — supports 8-way (diagonal) movement.
 * Release = stop all movement.
 */
export default function MobileJoystick({ onDirChange, disabled }: Props) {
  // Joystick origin (where finger first touched)
  const originRef = useRef<{ x: number; y: number } | null>(null);
  // Current thumb position relative to origin
  const thumbRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Active keys currently pressed
  const activeKeysRef = useRef<Set<string>>(new Set());
  // The overlay div ref
  const overlayRef = useRef<HTMLDivElement>(null);
  // Canvas for drawing the joystick
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Track touch id
  const touchIdRef = useRef<number | null>(null);
  // Visible state
  const visibleRef = useRef(false);

  const releaseAll = useCallback(() => {
    const keys = [...activeKeysRef.current];
    activeKeysRef.current.clear();
    if (keys.length > 0) onDirChange(keys, false);
    originRef.current = null;
    thumbRef.current = { x: 0, y: 0 };
    visibleRef.current = false;
    touchIdRef.current = null;
    draw();
  }, [onDirChange]);

  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  // Draw joystick on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!visibleRef.current || !originRef.current) return;

    const ox = originRef.current.x;
    const oy = originRef.current.y;
    const tx = ox + thumbRef.current.x;
    const ty = oy + thumbRef.current.y;

    // Outer ring
    ctx.beginPath();
    ctx.arc(ox, oy, OUTER_R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();

    // Direction indicator line
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = "rgba(255,228,150,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Thumb nub
    ctx.beginPath();
    ctx.arc(tx, ty, INNER_R, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,228,150,0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  // Compute which keys should be active from thumb offset
  const updateKeys = useCallback((dx: number, dy: number) => {
    const dist = Math.hypot(dx, dy);
    const newKeys = new Set<string>();

    if (dist >= DEAD_ZONE) {
      const angle = Math.atan2(dy, dx); // -PI to PI
      const deg = (angle * 180) / Math.PI; // -180 to 180

      // 8-way: each direction covers 67.5° sector
      // Right: -45 to 45
      // Down-right: 45 to 112.5
      // Down: 67.5 to 112.5 (center)
      // etc.
      if (deg > -67.5 && deg < 67.5)  newKeys.add("arrowright");
      if (deg > 112.5 || deg < -112.5) newKeys.add("arrowleft");
      if (deg > 22.5 && deg < 157.5)  newKeys.add("arrowdown");
      if (deg < -22.5 && deg > -157.5) newKeys.add("arrowup");
    }

    // Release keys no longer active
    const toRelease = [...activeKeysRef.current].filter(k => !newKeys.has(k));
    if (toRelease.length > 0) {
      toRelease.forEach(k => activeKeysRef.current.delete(k));
      onDirChange(toRelease, false);
    }

    // Press newly active keys
    const toPress = [...newKeys].filter(k => !activeKeysRef.current.has(k));
    if (toPress.length > 0) {
      toPress.forEach(k => activeKeysRef.current.add(k));
      onDirChange(toPress, true);
    }
  }, [onDirChange]);

  // Resize canvas to full screen
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      draw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;
    if (touchIdRef.current !== null) return; // already tracking one finger

    // Only respond to touches in the LEFT half of screen
    const touch = e.changedTouches[0];
    if (!touch) return;
    if (touch.clientX > window.innerWidth / 2) return;

    e.preventDefault();
    touchIdRef.current = touch.identifier;
    originRef.current = { x: touch.clientX, y: touch.clientY };
    thumbRef.current = { x: 0, y: 0 };
    visibleRef.current = true;
    draw();
  }, [disabled, draw]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchIdRef.current === null || !originRef.current) return;

    let touch: Touch | null = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touch = e.changedTouches[i];
        break;
      }
    }
    if (!touch) return;
    e.preventDefault();

    const dx = touch.clientX - originRef.current.x;
    const dy = touch.clientY - originRef.current.y;
    const dist = Math.hypot(dx, dy);

    // Clamp thumb to outer ring
    if (dist > OUTER_R) {
      const ratio = OUTER_R / dist;
      thumbRef.current = { x: dx * ratio, y: dy * ratio };
    } else {
      thumbRef.current = { x: dx, y: dy };
    }

    updateKeys(dx, dy);
    draw();
  }, [draw, updateKeys]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    let found = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        found = true;
        break;
      }
    }
    if (!found) return;
    e.preventDefault();
    releaseAll();
  }, [releaseAll]);

  // Attach native touch listeners (passive: false so we can preventDefault)
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.addEventListener("touchstart", handleTouchStart, { passive: false });
    overlay.addEventListener("touchmove", handleTouchMove, { passive: false });
    overlay.addEventListener("touchend", handleTouchEnd, { passive: false });
    overlay.addEventListener("touchcancel", handleTouchEnd, { passive: false });
    return () => {
      overlay.removeEventListener("touchstart", handleTouchStart);
      overlay.removeEventListener("touchmove", handleTouchMove);
      overlay.removeEventListener("touchend", handleTouchEnd);
      overlay.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <>
      {/* Transparent touch capture overlay — left half only */}
      <div
        ref={overlayRef}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          zIndex: 1250,
          touchAction: "none",
          pointerEvents: "auto",
        }}
      />
      {/* Canvas for drawing the joystick visuals */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          zIndex: 1251,
          pointerEvents: "none",
        }}
      />
    </>
  );
}
