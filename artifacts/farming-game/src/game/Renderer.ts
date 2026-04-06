import {
  GameState,
  MapType,
  FARM_GRID,
  CROP_STAGES_COLORS,
  MAP_SIZES,
  CROP_GROW_TIMES,
  CROP_GOLD_REWARDS,
  MAP_COLLISIONS,
  MAP_PLAYER_START,
  SHOP_ITEMS,
  CollisionRect,
  Tree,
  GARDEN_ROAD_Y,
  Footprint,
  applyFarmBalancePreset,
  FARM_BALANCE_PRESETS,
  FarmBalancePreset,
  farmPlotIsActionable,
} from "./Game";

const imgs: Record<string, HTMLImageElement> = {};

export function loadImg(src: string): Promise<HTMLImageElement> {
  if (imgs[src]) return Promise.resolve(imgs[src]);
  console.log(`[ImageLoader] Loading: ${src}`);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      console.log(`[ImageLoader] Loaded: ${src} (${img.naturalWidth}x${img.naturalHeight})`);
      imgs[src] = img;
      resolve(img);
    };
    img.onerror = (e) => {
      console.error(`[ImageLoader] FAILED: ${src}`, e);
      imgs[src] = img;
      resolve(img);
    };
    img.src = src;
  });
}
export function preloadAssets() {
  return Promise.all(
    [
      "/chibi_1774349990714.png",
      "/home_1774349990715.jpg",
      "/map_city_new.png",
      "/map_fishing_new.png",
      "/map_garden_new.png",
      "/celurit_1774349990712.png",
      "/kapak_1774349990716.png",
      "/kapak_1_1774349990715.png",
      "/karung_1774349990717.png",
      "/map_suburban_1774358176142.png",
      "/teko_siram.png",
      "/walk.png",
      "/work.png",
      "/happy.png",
      "/logo.png",
      "/carrot.png",
      "/pumpkin.png",
      "/tomato.png",
      "/wheat.png",
      "/frame_001.png",
      "/frame_002.png",
      "/frame_003.png",
      "/frame_004.png",
      "/frame_005.png",
      "/frame_006.png",
      "/frame_007.png",
      "/frame_008.png",
      "/frame_009.png",
      "/frame_010.png",
      "/frame_011.png",
      "/frame_012.png",
      "/frame_1_berdiri.png",
      "/frame_2_jalan.png",
      "/frame_3_lari.png",
      "/frame_4_melompat.png",
      "/frame_5_duduk.png",
      "/frame_6_membungkuk.png",
      "/frame_7_merayap.png",
      "/frame_8_mengambil.png",
      "/frame_9_melempar.png",
      "/frame_10_menangkap.png",
      "/frame_11_berdiri.png",
      "/frame_12_jalan.png",
      "/farm_till.png",
      "/farm_plant.png",
      "/farm_water.png",
      "/farm_fertilize.png",
      "/farm_harvest.png",
      "/farm_weed.png",
      "/farm_check.png",
      "/farm_carry.png",
      "/player_walk1.png",
      "/player_walk2.png",
      "/jalan_kaki_10_tengah_langkah.png",
      "/jalan_kaki_11_akhir_langkah.png",
      "/jalan_kaki_1_berdiri_awal.png",
      "/jalan_kaki_12_siap_berhenti.png",
      "/ikan.png",
      "/tangan.png",
      "/map_fishing_v2.png",
      "/map_suburban_v2.png",
      "/cloud_1.png",
      "/cloud_2.png",
      "/cloud_3.png",
      "/cloud_4.png",
      "/cloud_5.png",
    ].map(loadImg),
  );
}

const MAP_IMGS: Record<MapType, string> = {
  home: "/home_1774349990715.jpg",
  city: "/map_city_new.png",
  fishing: "/map_fishing_v2.png",
  garden: "/map_garden_new.png",
  suburban: "/map_suburban_v2.png",
};

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
) {
  const { zoom, cameraX, cameraY, shake } = state;
  const camX = cameraX;
  const camY = cameraY;
  const shakeAmt = (shake || 0);
  const sx = shakeAmt > 0.5 ? (Math.sin(state.time * 0.3) * shakeAmt * 0.5) : 0;
  const sy = shakeAmt > 0.5 ? (Math.cos(state.time * 0.4) * shakeAmt * 0.5) : 0;

  // Solid fallback fill
  const edgeColors: Record<MapType, string> = {
    home: "#4a7c59", city: "#5a5a5a", fishing: "#1a5a3a",
    garden: "#3a8a3a", suburban: "#90c090",
  };
  ctx.fillStyle = edgeColors[state.currentMap];
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(-camX + sx, -camY + sy);
  ctx.scale(zoom, zoom);

  // Draw background in world space (correct alignment with game objects)
  drawBackground(ctx, state);
  if (state.currentMap === "home") drawFarmPlots(ctx, state, "soil");
  if (state.currentMap === "home") drawTrees(ctx, state);
  if (state.currentMap === "home") drawFarmPlots(ctx, state, "crops");
  if (state.currentMap === "home") drawSuburbanGatewayTeaser(ctx, state);
  if (state.currentMap === "fishing") {
    drawWaterShimmer(ctx, state);
    drawFishingBobber(ctx, state);
  }
  if (state.currentMap === "garden") {
    drawGardenCritters(ctx, state);
    drawGardenFountain(ctx, state);
    drawGardenRemotePlayers(ctx, state);
    drawNPCs(ctx, state);
    drawGardenOverlay(ctx, state);
  }
  if (state.currentMap === "city") {
    drawShopZones(ctx, state);
    drawShopkeeperBubble(ctx, state);
  }
  if (state.currentMap === "suburban") {
    drawSuburbanSpots(ctx, state);
    drawClouds(ctx, state);
  }
  if (state.currentMap === "home" && state.time < 30000) {
    drawClouds(ctx, state);
  }
  drawFootprints(ctx, state);
  drawPlayer(ctx, state);
  if (state.currentMap === "fishing")
    drawFishingBiteAlert(ctx, state);
  drawVFX(ctx, state);
  drawDamageNumbers(ctx, state);
  if (!state.activePanel) drawMapLabels(ctx, state);

  if (state.currentMap === "home" && state.showFarmDebugOverlay) {
    drawFarmDebugOverlay(ctx, state);
  }

  ctx.restore();

  if (state.currentMap === "garden" && state.gardenActivePlayers >= 0) {
    drawGardenPlayersHud(ctx, state, W, H);
  }

// ═══════════════════════════════════════════════════════════════
  // ATMOSPHERE: Weather particles (drawn in screen space)
  // ═══════════════════════════════════════════════════════════════
  drawWeatherParticles(ctx, state, W, H);
  
  // ═══════════════════════════════════════════════════════════════
  // MAP TRANSITION: Iris reveal effect
  // ═══════════════════════════════════════════════════════════════
  drawMapTransition(ctx, state, W, H);
}

// ═══════════════════════════════════════════════════════════════
// MAP TRANSITION SYSTEM
// ═══════════════════════════════════════════════════════════════
let transitionProgress = 0;
let transitionType: "none" | "iris-out" | "iris-in" = "none";
let transitionCallback: (() => void) | null = null;

export function startMapTransition(callback: () => void) {
  transitionType = "iris-out";
  transitionProgress = 0;
  transitionCallback = callback;
}

export function isInTransition(): boolean {
  return transitionType !== "none";
}

function drawMapTransition(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  if (transitionType === "none") return;
  
  transitionProgress += 0.035;
  
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);
  
  ctx.save();
  ctx.fillStyle = "#000";
  
  if (transitionType === "iris-out") {
    const progress = Math.min(1, transitionProgress);
    const r = maxR * easeOutCubic(progress);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    
    if (progress >= 1) {
      transitionType = "iris-in";
      transitionProgress = 0;
      if (transitionCallback) transitionCallback();
    }
  } else if (transitionType === "iris-in") {
    const progress = Math.min(1, transitionProgress);
    const r = maxR * easeInCubic(progress);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    
    if (progress >= 1) {
      transitionType = "none";
      transitionCallback = null;
    }
  }
  
  ctx.restore();
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function drawWaterShimmer(ctx: CanvasRenderingContext2D, state: GameState) {
  const scrollOffset = Math.floor(state.time / 60) % 64;

  // ── Animated water shimmer ──
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#AADDFF";
  ctx.lineWidth = 1.5;
  for (let y = 30; y < 200; y += 28) {
    ctx.beginPath();
    for (let x = 60; x < 980; x += 64) {
      const ox = (x + scrollOffset) % 1040;
      const wave = Math.sin((ox + state.time / 300) * 0.05) * 3;
      ctx.moveTo(ox, y + wave);
      ctx.lineTo(ox + 18, y + wave + 2);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ── Dock / pier — hard visual boundary at y=210 ──
  ctx.save();

  // Dock planks (horizontal wooden boards)
  const dockY = 210;
  const dockH = 22;
  ctx.fillStyle = "#7B5230";
  ctx.fillRect(0, dockY, 1040, dockH);

  // Plank lines
  ctx.strokeStyle = "#5C3A1E";
  ctx.lineWidth = 2;
  for (let x = 0; x < 1040; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, dockY);
    ctx.lineTo(x, dockY + dockH);
    ctx.stroke();
  }

  // Top edge highlight
  ctx.strokeStyle = "#C8924A";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, dockY);
  ctx.lineTo(1040, dockY);
  ctx.stroke();

  // Bottom edge shadow
  ctx.strokeStyle = "#3E1F08";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, dockY + dockH);
  ctx.lineTo(1040, dockY + dockH);
  ctx.stroke();

  // Dock posts (vertical pillars into water)
  ctx.fillStyle = "#5C3A1E";
  for (let x = 80; x < 1040; x += 160) {
    ctx.fillRect(x - 6, dockY - 8, 12, dockH + 30);
    // Post cap
    ctx.fillStyle = "#8B5E3C";
    ctx.fillRect(x - 8, dockY - 12, 16, 8);
    ctx.fillStyle = "#5C3A1E";
  }

  // "CAST HERE" hint text at dock center
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,228,150,0.7)";
  ctx.fillText("[ CLICK TO CAST ]", 520, dockY + 15);

  ctx.restore();
}

/** World-space gate toward Suburban — fog clears as player approaches */
const SUBURBAN_GATE_X = 988;
const SUBURBAN_GATE_Y = 350;

function drawSuburbanGatewayTeaser(
  _ctx: CanvasRenderingContext2D,
  _state: GameState,
) {
  // Removed — blue glass tower overlay was bleeding into home map background
}

function drawGardenRemotePlayers(
  ctx: CanvasRenderingContext2D,
  state: GameState,
) {
  if (!state.gardenRemotePlayers?.length) return;
  for (const rp of state.gardenRemotePlayers) {
    ctx.save();
    ctx.translate(rp.x, rp.y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(100, 181, 246, 0.88)";
    ctx.fillRect(-11, -32, 22, 30);
    ctx.fillStyle = "rgba(227, 242, 253, 0.95)";
    ctx.fillRect(-9, -30, 18, 8);
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillStyle = "#E3F2FD";
    ctx.fillText("☆", 0, -38);
    ctx.restore();
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, state: GameState) {
  const isFarm = state.currentMap === "home";
  const numClouds = isFarm ? 2 : 5;
  const speed = isFarm ? 0.015 : 0.025;
  
  ctx.save();
  for (let i = 0; i < numClouds; i++) {
    const cloudImg = imgs[`/cloud_${(i % 5) + 1}.png`];
    if (!cloudImg || !cloudImg.complete) {
      // Fallback to programmatic if not loaded yet (prevents black boxes or empty sky)
      const scrollX = (state.time * speed * (1 + i * 0.2) + i * 400) % 1500;
      const cx = scrollX - 200, cy = 50 + i * 70;
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 60, 25, 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    // Cinematic scrolling with layered depth
    const layerSpeed = speed * (1 + i * 0.2);
    const scrollX = (state.time * layerSpeed + i * 400) % 1500;
    const cx = scrollX - 200, cy = 50 + i * 70;
    
    ctx.globalAlpha = isFarm ? 0.3 : 0.08;
    const cw = cloudImg.naturalWidth * 0.6, ch = cloudImg.naturalHeight * 0.6;
    ctx.drawImage(cloudImg, cx - cw/2, cy - ch/2, cw, ch);
    
    // Subtle shadow / depth (drawn slightly offset below)
    ctx.globalAlpha = 0.04;
    ctx.drawImage(cloudImg, cx - cw/2, cy - ch/2 + 6, cw, ch);
  }
  ctx.restore();
}

function drawSuburbanOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  // Atmospheric Fog (Scrolling Mist)
  const scroll = (state.time / 40) % 1280;
  ctx.save();
  ctx.globalAlpha = 0.15; // More subtle
  ctx.fillStyle = "#E0F7FA";
  // Draw two layers of fog for seamless scroll
  for (let i = 0; i < 2; i++) {
    const ox = i * 1280 - scroll;
    for (let j = 0; j < 6; j++) {
      ctx.beginPath();
      ctx.ellipse(ox + 200 + j * 200, 100 + j * 80, 400, 150, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawGardenCritters(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const c of state.gardenCritters) {
    ctx.save();
    // Sine-wave pathing for natural movement
    const ox = Math.sin(state.time / 800 + c.id.length) * 20;
    const oy = Math.cos(state.time / 1200 + c.id.length) * 10;
    ctx.translate(c.x + ox, c.y + oy);
    
    if (c.kind === "butterfly") {
      const flap = Math.abs(Math.sin(state.time / 160));
      // Unity-style pixel body
      ctx.fillStyle = "#3E2723";
      ctx.fillRect(-1, -2, 2, 4);
      // Vivid wings
      ctx.fillStyle = c.id.length % 2 === 0 ? "#FF5252" : "#FFD700";
      const ww = 6 * (0.5 + flap * 0.5);
      // Upper
      ctx.beginPath();
      ctx.ellipse(-1.5 - ww/2, -1, ww, 4, -0.3, 0, Math.PI * 2);
      ctx.ellipse(1.5 + ww/2, -1, ww, 4, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Lower
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(-1 - ww/3, 2, ww/1.5, 3, -0.1, 0, Math.PI * 2);
      ctx.ellipse(1 + ww/3, 2, ww/1.5, 3, 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Fireflies (glow points)
      const glow = Math.abs(Math.sin(state.time / 600 + c.id.length));
      ctx.globalAlpha = 0.4 + glow * 0.6;
      ctx.fillStyle = "#FFF9C4";
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      // Glow halo
      ctx.globalAlpha = 0.2 * glow;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawGardenFountain(ctx: CanvasRenderingContext2D, state: GameState) {
  const fx = 520, fy = 318;
  ctx.save();
  
  // Fountain Base Shadow/Glow
  const g = ctx.createRadialGradient(fx, fy, 5, fx, fy, 40);
  g.addColorStop(0, "rgba(100, 200, 255, 0.3)");
  g.addColorStop(1, "rgba(100, 200, 255, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(fx, fy, 35, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Water Plume (animated arcs)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 2;
  for(let i=0; i<4; i++) {
    const t = (state.time / 800 + i * 0.25) % 1;
    const h = 25 * Math.sin(t * Math.PI);
    const w = 15 * t;
    ctx.beginPath();
    ctx.arc(fx - w, fy - h, 2, 0, Math.PI * 2);
    ctx.arc(fx + w, fy - h, 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  ctx.restore();
}

const SHOPKEEPER_LINES = [
  "Good day, Farmer!",
  "Quality seeds here!",
  "Running low on Wheat?",
  "Fresh stock daily!",
];

function drawShopkeeperBubble(ctx: CanvasRenderingContext2D, state: GameState) {
  const px = state.player.x,
    py = state.player.y;
  const sx = 175,
    sy = 430;
  const dist = Math.hypot(sx - px, sy - py);
  if (dist > 130) return;

  const line =
    SHOPKEEPER_LINES[Math.floor(state.time / 3200) % SHOPKEEPER_LINES.length];
  ctx.save();
  ctx.font = '6px "Press Start 2P", monospace';
  const tw = ctx.measureText(line).width + 22;
  const th = 22;
  const bx = sx,
    by = sy - 100;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, bx - tw / 2 + 2, by - th / 2 + 3, tw, th, 8);
  ctx.fill();
  ctx.fillStyle = "#FFF8E8";
  ctx.strokeStyle = "#5C4033";
  ctx.lineWidth = 2;
  roundRect(ctx, bx - tw / 2, by - th / 2, tw, th, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4D2D18";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(line, bx, by);
  ctx.restore();
}

function drawFishingBiteAlert(ctx: CanvasRenderingContext2D, state: GameState) {
  const b = state.fishBobber;
  if (!b.active || !b.biting) return;
  const { x, y } = state.player;
  const bounce = Math.abs(Math.sin(state.time / 7)) * 8;
  ctx.save();
  ctx.translate(x, y - 72 - bounce);
  ctx.fillStyle = "#FFF";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.strokeText("!", 0, 0);
  ctx.fillText("!", 0, 0);
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState) {
  const { w, h } = MAP_SIZES[state.currentMap];
  const img = imgs[MAP_IMGS[state.currentMap]];
  const PAD = 600;

  // Debug: log image status
  const imgPath = MAP_IMGS[state.currentMap];
  const imgLoaded = img && img.complete && img.naturalWidth > 0;
  console.log(`[Background] map=${state.currentMap} img=${imgPath} loaded=${imgLoaded} zoom=${state.zoom}`);

  const edgeFill: Record<string, string> = {
    home: "#4a7c59", city: "#5a5a5a", fishing: "#1a5a3a",
    garden: "#3a8a3a", suburban: "#90c090",
  };
  // Fill padding with solid color
  ctx.fillStyle = edgeFill[state.currentMap] ?? "#4a7c59";
  ctx.fillRect(-PAD, -PAD, w + PAD * 2, h + PAD * 2);

  if (img && img.complete && img.naturalWidth > 0) {
    // Draw map at exact world size — no stretch
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    // DEBUG: show placeholder text if image not loaded
    ctx.save();
    ctx.fillStyle = "#FFF";
    ctx.font = '20px "Press Start 2P"';
    ctx.textAlign = "center";
    ctx.fillText(`LOADING: ${imgPath}`, w/2, h/2);
    ctx.restore();
  }
}

function drawGardenPlayersHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
) {
  ctx.save();
  ctx.font = 'bold 8px "Press Start 2P", monospace';
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  
  const text = `ACTIVE PLAYERS: ${state.gardenActivePlayers}`;
  const tx = W - 20;
  const ty = 108;

  // Outline
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  for(let ox=-1; ox<=1; ox++) {
    for(let oy=-1; oy<=1; oy++) {
       if(ox===0 && oy===0) continue;
       ctx.fillText(text, tx + ox, ty + oy);
    }
  }

  // Gold text
  ctx.fillStyle = "#FFD700";
  ctx.fillText(text, tx, ty);
  ctx.restore();
}

function drawFarmPlots(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layer: "soil" | "crops",
) {
  const { cellW, cellH } = FARM_GRID;
  const now = state.time;
  // Use real time for crop progress (plantedAt is set via getServerTime = Date.now())
  const realNow = Date.now();
  const px = state.player.x,
    py = state.player.y;

  let nearestPlotId: string | null = null;
  let minDist = 80;
  for (const plot of state.farmPlots) {
    const ncx = FARM_GRID.startX + plot.gridX * cellW + cellW / 2;
    const ncy = FARM_GRID.startY + plot.gridY * cellH + cellH / 2;
    if (Math.hypot(ncx - px, ncy - py) < minDist) {
      minDist = Math.hypot(ncx - px, ncy - py);
      nearestPlotId = plot.id;
    }
  }

  for (const plot of state.farmPlots) {
    const drawX = FARM_GRID.startX + plot.gridX * cellW;
    const drawY = FARM_GRID.startY + plot.gridY * cellH;
    const cx = drawX + cellW / 2;
    const isNearest = plot.id === nearestPlotId && !!state.player.tool;
    const tool = state.player.tool;
    const pointerHover =
      state.plotHoverFromPointer === plot.id &&
      farmPlotIsActionable(plot, state.player.tool);

    if (layer === "soil") {
    ctx.save();
    
    // 1. Extreme Realism Tilled Earth: Organic 'Multi-Clod' Mound
    if (plot.tilled) {
      const isW = plot.watered;
      const c1 = isW ? "#2D1B0D" : "#4A3326"; // Base
      const c2 = isW ? "#352212" : "#543C2E"; // Mid
      const c3 = isW ? "#3E2614" : "#5E4234"; // Highlight
      const c4 = isW ? "#4A301A" : "#6D4C3D"; // Top clod

      // Ambient Ground Shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(cx, drawY + cellH/2 + 2, cellW * 0.48, cellH * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      // Render 5 distinct 'Clods' of earth for hand-plowed look
      const clods = [
        { ox: -14, oy: 2, rx: 14, ry: 10, rot: -0.2, col: c1 },
        { ox: 14, oy: 4, rx: 16, ry: 9, rot: 0.15, col: c2 },
        { ox: 0, oy: -8, rx: 18, ry: 12, rot: 0, col: c3 },
        { ox: -6, oy: -4, rx: 12, ry: 8, rot: 0.1, col: c4 },
        { ox: 8, oy: -6, rx: 10, ry: 7, rot: -0.15, col: c2 },
      ];

      // High-Performance 'Clod' Earth Rendering
      clods.forEach(c => {
         ctx.fillStyle = c.col;
         ctx.save();
         ctx.translate(cx + c.ox, drawY + cellH/2 + c.oy);
         ctx.rotate(c.rot);
         ctx.beginPath();
         // Regular ellipses instead of calculated polygons for significant FPS boost
         ctx.ellipse(0, 0, c.rx, c.ry, 0, 0, Math.PI * 2);
         ctx.fill();
         ctx.restore();
      });

      // Granular Soil Texture & Micro-pebbles
      for(let i=0; i<15; i++) {
        const seed = (plot.gridX * 17 + plot.gridY * 23 + i * 37);
        const tx = cx + (Math.sin(seed) * cellW * 0.4);
        const ty = drawY + cellH/2 + (Math.cos(seed * 0.8) * cellH * 0.35);
        ctx.fillStyle = i % 4 === 0 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.22)";
        ctx.beginPath();
        const s = 0.5 + (seed % 1.2);
        if (i % 2 === 0) ctx.arc(tx, ty, s, 0, Math.PI * 2);
        else ctx.fillRect(tx, ty, s * 2, s);
        ctx.fill();
      }

      // Nutrient 'Infusion' Glow
      if (plot.fertilized) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(cx, drawY + cellH/2, 0, cx, drawY + cellH/2, cellW/2);
        g.addColorStop(0, "rgba(50, 255, 100, 0.08)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      }
    }

    if (pointerHover) {
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX + 1.5, drawY + 1.5, cellW - 3, cellH - 3);
    }

    // 2. Premium Selection Highlight: Bloom Halo
    if (isNearest) {
      const bloom = ctx.createRadialGradient(cx, drawY + cellH/2, 0, cx, drawY + cellH/2, cellW * 0.7);
      let c = "rgba(255, 255, 255, 0.2)";
      if (tool === "water") c = "rgba(0, 180, 255, 0.3)";
      else if (tool?.endsWith("-seed")) c = "rgba(100, 255, 100, 0.3)";
      else if (
        tool === "hoe" ||
        tool === "sickle" ||
        tool === "axe" ||
        tool === "axe-large"
      )
        c = "rgba(255, 220, 0, 0.3)";
      
      bloom.addColorStop(0, c);
      bloom.addColorStop(0.5, "rgba(0,0,0,0)");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(cx, drawY + cellH/2, cellW * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    continue;
  }

  if (!plot.crop) continue;

    ctx.save();
    const by = drawY + cellH - 12;
    
    // 3. NFT Boost Visual — Green Glow (GDD 5 Bonus)
    if (state.nftBoostActive) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(cx, by - 10, 0, cx, by - 10, cellW * 0.45);
      glow.addColorStop(0, "rgba(100, 255, 100, 0.2)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, by - 10, cellW * 0.45, 0, Math.PI * 2);
      ctx.fill();
      
      // Bonus: Micro green sparkles
      const t = state.time;
      for (let i = 0; i < 3; i++) {
        const offX = Math.sin(t / 400 + i * 2) * 12;
        const offY = Math.cos(t / 300 + i * 3) * 8 - 15;
        ctx.fillStyle = "#A2FF9E";
        ctx.globalAlpha = 0.5 + Math.sin(t / 200 + i) * 0.3;
        ctx.fillRect(cx + offX, by + offY, 1.5, 1.5);
      }
      ctx.restore();
    }

    // 4. Crop Rendering
      const cropColors: Record<string, string> = {
        wheat: "#FFD700", tomato: "#FF6347", carrot: "#FF8C00", pumpkin: "#FF4500"
      };
      const cropLabels: Record<string, string> = {
        wheat: "WHEAT", tomato: "TOMATO", carrot: "CARROT", pumpkin: "PUMPKIN"
      };
      const { crop } = plot;

      if (plot.watered && !plot.crop.ready) {
        const gt = Math.max(1, plot.crop.growTime || 20000);
        const elapsed = Math.max(0, realNow - plot.crop.plantedAt);
        const pct = Math.min(1, elapsed / gt);
        const barW = cellW - 16;
        const bx = cx - barW / 2;
        const byProg = drawY - 10;
        // Thin progress bar only
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(bx, byProg, barW, 4);
        ctx.fillStyle = pct > 0.7 ? "#FFD700" : "#4CAF50";
        ctx.fillRect(bx + 1, byProg + 1, Math.max(0, (barW - 2) * pct), 2);
      }

      // No crop name badge — let the plant speak for itself
      const imgId = `/${crop.type}.png`;
      const img = imgs[imgId];
      if (imgId && !imgs[imgId]) loadImg(imgId);

      const currentStage = Math.max(0, Math.min(4, crop.stage));
      const stageScales = [0.25, 0.55, 0.8, 1.0, 1.25];
      const stageYOffsets = [6, 4, 2, 0, -8];
      const stageImageSizes = [28, 40, 52, 60, 68];
      
      const baseScale = stageScales[currentStage];
      const baseYOffset = stageYOffsets[currentStage];
      const imageSize = stageImageSizes[currentStage];

      let scale = baseScale;
      // WIND SWAY: Organic movement for all living crops
      let tiltAngle = Math.sin(now / 1200 + plot.gridX * 0.5 + plot.gridY * 0.3) * 0.04;
      let shadowScaleX = 1;
      
      if (crop.ready) {
        // More active swaying for ready crops (Excitement!)
        tiltAngle = Math.sin(now / 600) * 0.12;
        scale = baseScale + Math.abs(Math.sin(now / 600 * 1.3)) * 0.06;
        shadowScaleX = 1 + Math.abs(Math.sin(now / 600)) * 0.15;
      }

      // Dynamic Soil-Crop Shadow
      ctx.save();
      ctx.globalAlpha = crop.ready ? 0.4 : 0.2;
      ctx.fillStyle = "#000";
      ctx.scale(shadowScaleX, 0.35);
      ctx.beginPath();
      ctx.ellipse(cx / shadowScaleX, (by + 4) / 0.35, (8 + currentStage * 3) * scale, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Plot Juice (Interaction Bounce)
      let jx = 1, jy = 1;
      if (state.plotJuice?.plotId === plot.id) {
        const u = state.plotJuice.until - now;
        const pulse = Math.sin(Math.max(0, Math.min(1, u / 380)) * Math.PI);
        jx = 1 + 0.18 * pulse;
        jy = 1 - 0.12 * pulse;
      }

      // PENDING ACTION INDICATOR: Pulse over targeted plot
      if (state.pendingPlotAction?.plotId === plot.id) {
         ctx.save();
         const pPulse = Math.abs(Math.sin(now / 350));
         ctx.strokeStyle = `rgba(255, 215, 0, ${0.4 + pPulse * 0.5})`;
         ctx.lineWidth = 2;
         ctx.setLineDash([4, 4]); // Dashed aesthetic
         ctx.beginPath();
         ctx.arc(cx, by - 15, 12 + pPulse * 4, 0, Math.PI * 2);
         ctx.stroke();
         
         // Little arrow or indicator pointing down
         ctx.fillStyle = `rgba(255, 215, 0, ${0.4 + pPulse * 0.5})`;
         ctx.beginPath();
         ctx.moveTo(cx - 3, by - 35 - pPulse * 5);
         ctx.lineTo(cx + 3, by - 35 - pPulse * 5);
         ctx.lineTo(cx, by - 28 - pPulse * 5);
         ctx.fill();
         ctx.restore();
      }

      ctx.save();
      ctx.translate(cx, by + baseYOffset);
      ctx.rotate(tiltAngle);
      ctx.scale(scale * jx, scale * jy);

      if (crop.isRare) {
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 12;
      } else if (crop.dead) {
        ctx.globalAlpha *= 0.7; 
      } else if (currentStage === 0 && !plot.watered) {
        ctx.globalAlpha *= 0.5;
      } else if (currentStage < 4 && plot.watered) {
        const pulse = 1 + Math.sin(now / 400) * 0.05;
        ctx.scale(pulse, pulse);
      }
      
      // Draw plant in clean isolated block
      ctx.save();
      ctx.translate(cx, by);
      if (currentStage === 0) {
        ctx.fillStyle = "#4E2B0E";
        ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#6B3A1F";
        ctx.beginPath(); ctx.ellipse(-3, -1, 4, 2, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(4, 1, 3, 1.5, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#C8A96E";
        ctx.beginPath(); ctx.ellipse(0, -3, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
      } else if (currentStage === 1) {
        const sway1 = Math.sin(now / 900 + plot.gridX * 1.3) * 0.035;
        ctx.fillStyle = "#4E2B0E";
        ctx.beginPath(); ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.rotate(sway1);
        ctx.strokeStyle = "#5D8A3C"; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(1, -10, 0, -18); ctx.stroke();
        ctx.fillStyle = "#7CB342";
        ctx.beginPath(); ctx.ellipse(-7, -14, 7, 4, -0.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(7, -16, 7, 4, 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8BC34A";
        ctx.beginPath(); ctx.ellipse(-7, -14, 5, 2.5, -0.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(7, -16, 5, 2.5, 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (currentStage === 2) {
        const sway2 = Math.sin(now / 750 + plot.gridX * 0.9) * 0.03;
        ctx.fillStyle = "#4E2B0E";
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.rotate(sway2);
        ctx.strokeStyle = "#4A7C2F"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(2, -16, 0, -32); ctx.stroke();
        ctx.strokeStyle = "#5D8A3C"; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(-8, -16, -14, -20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(8, -24, 14, -28); ctx.stroke();
        const drawLeaf2 = (lx: number, ly: number, rx: number, ry: number, ang: number, col: string) => {
          ctx.save(); ctx.translate(lx, ly); ctx.rotate(ang);
          ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(-rx*0.7,0); ctx.lineTo(rx*0.7,0); ctx.stroke();
          ctx.restore();
        };
        drawLeaf2(-14,-21,10,5,-0.5,"#558B2F"); drawLeaf2(-14,-21,8,3.5,-0.5,"#7CB342");
        drawLeaf2(14,-29,10,5,0.5,"#558B2F");   drawLeaf2(14,-29,8,3.5,0.5,"#7CB342");
        drawLeaf2(0,-32,8,4,0,"#66BB6A");
        const budCol = crop.type==="tomato"?"#EF9A9A":crop.type==="carrot"?"#FFAB91":crop.type==="pumpkin"?"#FFE082":"#F0F4C3";
        ctx.fillStyle = budCol; ctx.beginPath(); ctx.arc(0,-33,5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.beginPath(); ctx.arc(-1.5,-35,1.5,0,Math.PI*2); ctx.fill();
        ctx.restore();
      } else if (currentStage === 3) {
        const sway3 = Math.sin(now / 650 + plot.gridX) * 0.025;
        const img3 = imgs[`/${crop.type}.png`];
        ctx.save(); ctx.rotate(sway3);
        if (img3?.complete && img3.naturalWidth > 0) {
          const s3 = imageSize * 0.72;
          ctx.drawImage(img3, -s3/2, -s3, s3, s3);
          ctx.fillStyle = "rgba(102,187,106,0.45)";
          ctx.beginPath(); ctx.ellipse(-s3*0.5,-s3*0.4,8,4,-0.6,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(s3*0.5,-s3*0.6,8,4,0.6,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
      } else {
        const sway4 = Math.sin(now / 550 + plot.gridX) * 0.02;
        const img4 = imgs[`/${crop.type}.png`];
        ctx.save(); ctx.rotate(sway4);
        if (img4?.complete && img4.naturalWidth > 0) ctx.drawImage(img4, -imageSize/2, -imageSize, imageSize, imageSize);
        ctx.restore();
        for (let p = 0; p < 4; p++) {
          const ang4 = now/800 + p*Math.PI/2;
          ctx.globalAlpha = 0.4 + Math.sin(now/300+p)*0.3;
          ctx.fillStyle = "#FFD700";
          ctx.beginPath(); ctx.arc(Math.cos(ang4)*imageSize*0.45, Math.sin(ang4)*imageSize*0.45-imageSize*0.5, 2, 0, Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      ctx.restore(); // end plant block
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const bounce = Math.abs(Math.sin(now / 300)) * 4;
      ctx.globalAlpha = 0.9 + Math.sin(now / 200) * 0.1;
      ctx.fillStyle = "#000";
      ctx.fillText("READY!", cx + 1, drawY - 24 - bounce + 1);
      ctx.fillStyle = "#FFD700";
      ctx.fillText("READY!", cx, drawY - 24 - bounce);
    }

    ctx.restore();
  }
}

function drawMarketBulletin(ctx: CanvasRenderingContext2D, state: GameState) {
  const trend = state.marketTrendCrop;
  if (!trend) return;
  const label = trend.charAt(0).toUpperCase() + trend.slice(1);
  const bx = 415;
  const by = 135; // Moved slightly for better layout flow
  
  ctx.save();
  ctx.translate(bx, by);
  
  // High-End Wood Texture Shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, -120, -50 + 4, 240, 95, 12);
  ctx.fill();

  // Premium Sign Base
  const sig = ctx.createLinearGradient(0, -50, 0, 45);
  sig.addColorStop(0, "#5D4037");
  sig.addColorStop(1, "#3E2723");
  ctx.fillStyle = sig;
  roundRect(ctx, -120, -50, 240, 95, 12);
  ctx.fill();
  
  // Inner Inset for 'Bulletin' Feel
  ctx.strokeStyle = "#8D6E63";
  ctx.lineWidth = 2;
  roundRect(ctx, -114, -44, 228, 83, 8);
  ctx.stroke();

  // Header Bar
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  roundRect(ctx, -114, -44, 228, 25, 8);
  ctx.fill();
  
  ctx.fillStyle = "#FFD54F";
  ctx.font = 'bold 9px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillText("DAILY MARKET", 0, -28);

  ctx.fillStyle = "#FFFDE7";
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillText(`HOT DEMAND: ${label}`, 0, 10);
  
  // Bonus Tag (Pulsing)
  const pulse = 0.8 + Math.sin(state.time / 400) * 0.2;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#A5D6A7";
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.fillText("+20% GOLD BONUS", 0, 32);

  ctx.restore();
}

function drawTrees(ctx: CanvasRenderingContext2D, state: GameState) {
  if (!state.trees) return;
  const now = state.time;
  
  for (const tree of state.trees) {
    // Subtle wind sway for all world objects
    const wind = Math.sin(now / 1500 + tree.x * 0.05) * 0.025;
    
    ctx.save();
    ctx.translate(tree.x, tree.y);
    ctx.rotate(wind);

    // Shadow
    const shadowSize = 25 + Math.sin(now / 1000) * 2;
    const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, shadowSize);
    shadow.addColorStop(0, "rgba(0,0,0,0.3)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(0, 0, shadowSize, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (tree.type === "rock") {
      ctx.fillStyle = "#777";
      ctx.beginPath();
      ctx.ellipse(0, -10, 24, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#999";
      ctx.beginPath();
      ctx.ellipse(-8, -14, 10, 6, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (tree.type === "pine") {
      ctx.fillStyle = "#4A2C08";
      ctx.fillRect(-6, -15, 12, 15);
      ctx.fill();
    } else {
      // Oak
      ctx.fillStyle = "#5D3A1A";
      ctx.fillRect(-8, -20, 16, 20);
      ctx.fillStyle = "#2D5A27";
      ctx.beginPath();
      ctx.arc(0, -45, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-15, -30, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(15, -30, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    if (tree.hp < tree.maxHp) {
      ctx.fillStyle = "#333";
      ctx.fillRect(-20, -75, 40, 5);
      ctx.fillStyle = "#F44";
      ctx.fillRect(-20, -75, 40 * (tree.hp / tree.maxHp), 5);
    }
    ctx.restore();
  }
}

function drawFishingBobber(ctx: CanvasRenderingContext2D, state: GameState) {
  const fs = state.fishingSession;
  if (!fs) return;

  const bx = fs.bobberX;
  const rawY = fs.bobberY + Math.sin(state.time / 200) * 4;
  const by = fs.state === "bite" ? rawY + 12 : rawY;

  ctx.save();
  // Fishing Line
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(state.player.x, state.player.y - 18);
  ctx.lineTo(bx, by);
  ctx.stroke();

  // Water Ripple around Bobber
  ctx.beginPath();
  ctx.ellipse(bx, by + 4, 12, 6, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.stroke();

  // Bobber body
  ctx.fillStyle = fs.state === "bite" ? "#FF5252" : "#FFF5EE";
  ctx.beginPath();
  ctx.arc(bx, by, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5C4033";
  ctx.stroke();

  // Top tip
  ctx.fillStyle = "#FF0000";
  ctx.fillRect(bx - 1.5, by - 8, 3, 5);

  if (fs.state === "bite") {
    ctx.font = "bold 20px 'Press Start 2P'";
    ctx.fillStyle = "#FFFF00";
    ctx.textAlign = "center";
    ctx.shadowBlur = 4;
    ctx.shadowColor = "#000";
    ctx.fillText("!", bx, by - 30);
  }

  if (fs.state === "struggle") {
    drawFishingStruggleBar(ctx, bx, by - 60, fs.struggleProgress);
  }

  ctx.restore();
}

function drawFishingStruggleBar(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  const w = 90;
  const h = 14;
  const bx = x - w / 2;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.beginPath();
  ctx.roundRect(bx - 2, y - 2, w + 4, h + 4, 6);
  ctx.fill();

  // Background
  ctx.fillStyle = "#1A0A00";
  ctx.beginPath();
  ctx.roundRect(bx, y, w, h, 4);
  ctx.fill();

  // Fill
  const pw = (progress / 100) * w;
  const color = progress > 70 ? "#4CAF50" : progress > 35 ? "#FFC107" : "#FF5252";
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(bx, y, Math.max(4, pw), h, 4);
  ctx.fill();

  // Shine
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.roundRect(bx, y, Math.max(4, pw), h / 2, [4, 4, 0, 0]);
  ctx.fill();

  // Border
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx, y, w, h, 4);
  ctx.stroke();

  // Label
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFF";
  ctx.fillText("REEL!", x, y - 5);
}

function drawNPCs(ctx: CanvasRenderingContext2D, state: GameState) {
  for (let i = 0; i < state.npcs.length; i++) {
    const npc = state.npcs[i];
    const isMoving = Math.abs(npc.vx) > 0.1 || Math.abs(npc.vy) > 0.1;
    const facing = npc.vx > 0 ? "right" : "left";
    const walkCycle = Math.floor((state.time / 180 + i * 1.3) % 4);

    ctx.save();
    ctx.translate(npc.x, npc.y);

    // Shadow
    ctx.save();
    ctx.scale(1.3, 0.3);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const flip = facing === "left" ? -1 : 1;
    ctx.scale(flip, 1);

    // Draw NPC as simple chibi shape (not player sprite)
    const bob = isMoving ? Math.sin(state.time / 120 + i) * 2 : Math.sin(state.time / 600 + i) * 1;
    const legSwing = isMoving ? Math.sin(state.time / 120 + i) * 6 : 0;

    // Body color per NPC
    const bodyColors = ["#E57373","#64B5F6","#81C784","#FFD54F","#BA68C8"];
    const bodyCol = bodyColors[i % bodyColors.length];

    ctx.translate(0, bob);

    // Legs
    ctx.fillStyle = "#5D4037";
    ctx.fillRect(-6 + legSwing * 0.5, -10, 5, 10);
    ctx.fillRect(1 - legSwing * 0.5, -10, 5, 10);

    // Body
    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.roundRect(-9, -28, 18, 18, 3);
    ctx.fill();

    // Head
    ctx.fillStyle = "#FFCC80";
    ctx.beginPath(); ctx.arc(0, -34, 9, 0, Math.PI * 2); ctx.fill();

    // Eyes with blink animation
    const blinkCycle = (state.time / 4000 + i) % 1;
    const isBlinking = blinkCycle > 0.95;
    const lookOffset = Math.sin(state.time / 2000 + i * 2) * 1;
    
    if (isBlinking) {
      // Closed eyes (blink)
      ctx.strokeStyle = "#3E2723";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-5, -36); ctx.lineTo(-3, -36);
      ctx.moveTo(3, -36); ctx.lineTo(5, -36);
      ctx.stroke();
    } else {
      // Open eyes with look direction
      ctx.fillStyle = "#3E2723";
      ctx.fillRect(-4 + lookOffset * 0.3, -36, 2, 2);
      ctx.fillRect(2 + lookOffset * 0.3, -36, 2, 2);
      
      // Eye shine
      ctx.fillStyle = "#FFF";
      ctx.fillRect(-3 + lookOffset * 0.3, -36, 1, 1);
      ctx.fillRect(3 + lookOffset * 0.3, -36, 1, 1);
    }

    // Hat
    ctx.fillStyle = "#5D4037";
    ctx.fillRect(-8, -44, 16, 4);
    ctx.fillRect(-5, -52, 10, 10);

    ctx.scale(flip, 1); // unflip for text

    // Name tag
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillText(npc.name, 1, -57);
    ctx.fillStyle = "#FFD700";
    ctx.fillText(npc.name, 0, -58);

    ctx.restore();
  }
}

function drawShopZones(ctx: CanvasRenderingContext2D, state: GameState) {
  const shops = [
    { x: 200, y: 480, label: "SEEDS",  color: "#81C784" },
    { x: 520, y: 480, label: "SHOP",   color: "#FFD700" },
    { x: 840, y: 480, label: "MARKET", color: "#64B5F6" },
  ];
  const px = state.player.x,
    py = state.player.y;
  for (const shop of shops) {
    const dist = Math.hypot(shop.x - px, shop.y - py);
    const isNear = dist < 90;

    ctx.save();
    ctx.translate(shop.x, shop.y);

    // Sign post (tiang ke bawah)
    ctx.fillStyle = "#3A2010";
    ctx.fillRect(-3, 0, 6, 22);
    ctx.fillStyle = "#6B4020";
    ctx.fillRect(-1, 0, 2, 22);

    // Glow when near
    if (isNear) {
      ctx.shadowColor = "#D4A800";
      ctx.shadowBlur = 14;
    }

    // Drop shadow (bottom offset like .wb button)
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx, -50, -18 + 4, 100, 36, 18);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Dark border (outer) — like .wb border #5C4033
    ctx.fillStyle = "#3A2010";
    roundRect(ctx, -50, -18, 100, 36, 18);
    ctx.fill();

    // Brown gradient fill — like .wb background
    const grad = ctx.createLinearGradient(0, -18, 0, 18);
    if (isNear) {
      grad.addColorStop(0, "#D9B380");
      grad.addColorStop(1, "#AD7D54");
    } else {
      grad.addColorStop(0, "#CE9E64");
      grad.addColorStop(1, "#8D5A32");
    }
    roundRect(ctx, -47, -15, 94, 30, 15);
    ctx.fillStyle = grad;
    ctx.fill();

    // Inner top highlight
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, -44, -14, 88, 12, 10);
    ctx.fill();

    // Sign text — use shop's color
    ctx.fillStyle = (shop as any).color || "#FFD700";
    ctx.font = 'bold 9px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText(shop.label, 0, 1);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.restore();

    // Interaction prompt when near — no box, just clean outlined text
    if (isNear) {
      ctx.save();
      const tx = shop.x;
      const ty = shop.y - 52;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Outline pass
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.font = 'bold 8px "Press Start 2P", monospace';
      for (const [ox, oy] of [[-1,-1],[1,-1],[-1,1],[1,1],[0,-2],[0,2]]) {
        ctx.fillText(shop.label, tx + ox, ty - 8 + oy);
      }
      ctx.font = '7px "Press Start 2P", monospace';
      for (const [ox, oy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
        ctx.fillText("PRESS E", tx + ox, ty + 10 + oy);
      }
      // Colored text
      ctx.font = 'bold 8px "Press Start 2P", monospace';
      ctx.fillStyle = (shop as any).color || "#FFD700";
      ctx.fillText(shop.label, tx, ty - 8);
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillStyle = "#FFF5C0";
      ctx.fillText("PRESS E", tx, ty + 10);
      ctx.restore();
    }
  }
}

function drawFootprints(ctx: CanvasRenderingContext2D, state: GameState) {
  if (!state.footprints) return;
  for (const fp of state.footprints) {
    const alpha = (fp.life / fp.maxLife) * 0.55;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(fp.x, fp.y);

    // Rotate footprint based on facing direction
    const rot =
      fp.facing === "right"
        ? Math.PI / 2
        : fp.facing === "left"
          ? -Math.PI / 2
          : fp.facing === "up"
            ? Math.PI
            : 0;
    ctx.rotate(rot);

    // Mirror for left/right foot
    if (fp.foot === "right") ctx.scale(-1, 1);

    // Draw a simple shoe-sole shape
    ctx.fillStyle = "rgba(60,30,10,0.7)";
    ctx.beginPath();
    // Heel
    ctx.ellipse(0, 3, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Toe
    ctx.beginPath();
    ctx.ellipse(0, -4, 2.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState) {
  const {
    x,
    y,
    facing,
    moving,
    action,
    actionTimer,
    running,
    targetX,
    targetY,
    jumpY,
  } = state.player;

  const isWalking =
    (moving || targetX !== null) &&
    !state.notification?.text.includes("LEVEL UP");
  const isJumping = jumpY && jumpY < -5;
  const walkSpeed = running ? 80 : 130;
  const walkCycle = (state.time / walkSpeed) % 4;

  let sprite: HTMLImageElement | null = null;

  if (state.fishingCatchHold && state.time < state.fishingCatchHold.until) {
    sprite = imgs["/farm_carry.png"];
  } else if (
    state.currentMap === "garden" &&
    state.player.emote === "sit"
  ) {
    sprite = imgs["/frame_5_duduk.png"];
  } else if (
    state.currentMap === "garden" &&
    state.player.emote === "dance"
  ) {
    sprite = imgs["/frame_3_lari.png"];
  } else if (
    state.currentMap === "garden" &&
    state.player.emote === "laugh"
  ) {
    sprite = imgs["/frame_006.png"];
  } else if (
    state.currentMap === "garden" &&
    state.player.emote === "wave"
  ) {
    sprite = imgs["/happy.png"];
  } else if (state.notification?.text.includes("LEVEL UP")) {
    sprite =
      imgs[state.time % 1000 < 500 ? "/frame_011.png" : "/frame_012.png"];
  } else if (isJumping) {
    sprite = imgs["/frame_4_melompat.png"];
  } else if (action && actionTimer > 0) {
    if (state.currentMap === "home") {
      if (action === "hoe" || action === "sickle")
        sprite = imgs["/farm_till.png"];
      else if (action.includes("seed")) sprite = imgs["/farm_plant.png"];
      else if (action === "water") sprite = imgs["/farm_water.png"];
      else if (action === "fertilizer") sprite = imgs["/farm_fertilize.png"];
      else if (action === "axe" || action === "axe-large")
        sprite = imgs["/farm_weed.png"];
      else sprite = imgs["/farm_check.png"];
    } else {
      sprite = imgs["/frame_8_mengambil.png"];
    }
  } else if (state.fishingActive && state.fishBobber.biting) {
    sprite = imgs["/frame_10_menangkap.png"];
  } else if (isWalking) {
    if (running) {
      sprite = imgs["/frame_3_lari.png"];
    } else {
      const walkFrames = [
        "/player_walk1.png",
        "/jalan_kaki_10_tengah_langkah.png",
        "/player_walk2.png",
        "/jalan_kaki_11_akhir_langkah.png",
      ];
      sprite = imgs[walkFrames[Math.floor(walkCycle)]];
    }
  } else {
    const idleFeet =
      (state.time / 600) % 2 < 1
        ? "/jalan_kaki_1_berdiri_awal.png"
        : "/jalan_kaki_12_siap_berhenti.png";
    const cycle = Math.floor(state.time / 2000) % 12;
    const moodMap: Record<number, string> = {
      0: idleFeet,
      1: idleFeet,
      2: "/frame_004.png",
      3: idleFeet,
      4: "/frame_007.png",
      5: idleFeet,
      6: "/frame_006.png",
      7: idleFeet,
      8: idleFeet,
      9: idleFeet,
      10: idleFeet,
      11: "/frame_005.png",
    };
    sprite = imgs[moodMap[cycle]] || imgs[idleFeet];
  }

  if (!sprite || !sprite.complete)
    sprite =
      imgs["/jalan_kaki_1_berdiri_awal.png"] ||
      imgs["/chibi_1774349990714.png"];

  const walkBob = 0;
  const breathing = 0;
  
  // ═══════════════════════════════════════════════════════════════
  // SQUASH & STRETCH: Dynamic animation based on movement
  // ═══════════════════════════════════════════════════════════════
  let squashStretch = 1.0;
  const movePhase = (state.time / 100) % (Math.PI * 2);
  
  if (isWalking) {
    // Stretch in movement direction
    squashStretch = 1.0 + Math.sin(movePhase) * 0.08;
  } else if (actionTimer > 0) {
    // Boing effect when using tool
    squashStretch = 1.0 + Math.sin(actionTimer * 0.5) * 0.12;
  } else {
    // Subtle breathing when idle
    squashStretch = 1.0 + Math.sin(state.time / 800) * 0.02;
  }

  ctx.save();
  ctx.translate(x, y);

  // Shadow
  ctx.save();
  ctx.scale(1.4, 0.35);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const jF = state.player.jumpFlip || 0;
  ctx.translate(0, (jumpY || 0));
  ctx.rotate((jF * Math.PI) / 180);

  const flipX = facing === "left" ? -1 : 1;
  ctx.scale(flipX, 1);

  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    const targetH = 38;
    const ratio = sprite.naturalWidth / sprite.naturalHeight;
    // Apply squash/stretch effect
    const PLAYER_RENDER_SCALE = squashStretch;
    const drawW = targetH * ratio * PLAYER_RENDER_SCALE;
    const drawH = targetH;
    const ox = -drawW / 2;
    const oy = -drawH + 4;

    if (action && actionTimer > 0) {
      ctx.drawImage(sprite, ox, oy, drawW, drawH);

      const toolImg = getToolImg(action);
      if (toolImg && toolImg.complete) {
        ctx.save();
        const handX = drawW * 0.45;
        const handY = oy + drawH * 0.72;
        ctx.translate(handX, handY);
        ctx.rotate(0.3 * Math.PI);
        ctx.drawImage(toolImg, -9, -9, 18, 18);
        ctx.restore();
      }
    } else {
      ctx.drawImage(sprite, ox, oy, drawW, drawH);

      const selectedTool = state.player.tool;
      const heldToolImg = selectedTool ? getToolImg(selectedTool) : null;
      if (heldToolImg && heldToolImg.complete && state.currentMap === "home") {
        ctx.save();
        const handX = drawW * 0.48;
        const handY = oy + drawH * 0.75;
        ctx.translate(handX, handY);
        ctx.rotate(0.4 * Math.PI);
        ctx.drawImage(heldToolImg, -9, -9, 18, 18);
        ctx.restore();
      }
    }
  }

  if (
    state.fishingCatchHold &&
    state.time < state.fishingCatchHold.until &&
    state.fishingRareFlash
  ) {
    ctx.save();
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    const col =
      state.fishingCatchHold.tier === 2
        ? "#FFD700"
        : state.fishingCatchHold.tier === 1
          ? "#64B5F6"
          : "#FFF";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.strokeText(state.fishingRareFlash, x, y - 92);
    ctx.fillStyle = col;
    ctx.fillText(state.fishingRareFlash, x, y - 92);
    ctx.restore();
  }

  ctx.restore();

  // ── SOCIAL EMOTE BUBBLES ──
  if (state.player.emoteBubble && state.time < state.player.emoteBubbleUntil) {
    ctx.save();
    const bx = x, by = y - 55 + (state.player.jumpY || 0) + Math.sin(state.time / 200) * 4;
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#4D2D18";
    ctx.lineWidth = 2;
    // Bubble
    ctx.beginPath();
    ctx.roundRect(bx - 18, by - 24, 36, 30, 8);
    ctx.fill();
    ctx.stroke();
    // Anchor
    ctx.beginPath();
    ctx.moveTo(bx - 6, by + 6);
    ctx.lineTo(bx, by + 12);
    ctx.lineTo(bx + 6, by + 6);
    ctx.fill();
    ctx.stroke();
    // Emoji
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(state.player.emoteBubble, bx, by + 2);
    ctx.restore();
  }
}

function getToolImg(t: string | undefined): HTMLImageElement | null {
  if (!t) return null;
  if (t === "axe") return imgs["/kapak_1_1774349990715.png"];
  if (t === "axe-large") return imgs["/kapak_1774349990716.png"];
  if (t === "celurit" || t === "shovel" || t === "hoe" || t === "sickle")
    return imgs["/celurit_1774349990712.png"];
  if (t === "water") return imgs["/teko_siram.png"];
  if (t.includes("seed") || t === "fertilizer" || t === "karung")
    return imgs["/karung_1774349990717.png"];
  return null;
}

function drawVFX(ctx: CanvasRenderingContext2D, state: GameState) {
  // Hide canvas text overlays when any UI panel is open
  if (!state.activePanel) {
    drawInstructionBubble(ctx, state);
  }

  for (const p of state.vfxParticles) {
    const alpha = p.life / p.maxLife;
    const s = Math.max(1, p.size);
    ctx.save();
    
    // Additive blending for glowy "shader" feel if it's a light-based particle
    const isLight = p.type === "sparkle" || p.type === "flash" || p.type === "coin" || p.type === "slash";
    if (isLight) ctx.globalCompositeOperation = 'lighter';
    
    ctx.globalAlpha = alpha;

    if (p.type === "coin") {
      // Pixel coin: small filled square with intense highlight
      const ps = Math.max(2, Math.round(s * 0.8));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - ps, p.y - ps, ps * 2, ps * 2);
      ctx.fillStyle = "#FFF";
      ctx.fillRect(p.x - ps + 1, p.y - ps + 1, ps / 2, ps / 2);

    } else if (p.type === "sparkle") {
      // Bloom sparkle - Cross + Glow
      const ps = s * 1.2;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 0.5, p.y - ps, 1, ps * 2);
      ctx.fillRect(p.x - ps, p.y - 0.5, ps * 2, 1);
      // Outer glow
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, ps * 2.5);
      g.addColorStop(0, p.color);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ps * 2, 0, Math.PI * 2);
      ctx.fill();

    } else if (p.type === "flash") {
      // Unity-like Impact Flash (Expanding Ring + Star)
      const prog = 1 - alpha;
      const radius = s * (1 + prog * 4);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 * (1 - prog);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = "#FFF";
      ctx.beginPath();
      const stW = s * (1 - prog);
      ctx.moveTo(p.x - stW * 3, p.y);
      ctx.lineTo(p.x, p.y - stW * 0.5);
      ctx.lineTo(p.x + stW * 3, p.y);
      ctx.lineTo(p.x, p.y + stW * 0.5);
      ctx.fill();

    } else if (p.type === "slash") {
      // Arc / Sword Swing Effect — shoots OUT from player toward facing direction
      const prog = 1 - alpha;
      const facing = (p as any).facing as "left" | "right" | "up" | "down" | undefined;
      ctx.save();
      ctx.translate(p.x, p.y);
      // Rotate arc to face the player's facing direction (shoots outward)
      if (facing === "right") ctx.rotate(-Math.PI / 2);
      else if (facing === "left") ctx.rotate(Math.PI / 2);
      else if (facing === "up") ctx.rotate(Math.PI);
      else ctx.rotate(0); // down = no rotation
      ctx.strokeStyle = p.color;
      ctx.lineWidth = s * (1 - prog) * 1.8;
      ctx.lineCap = "round";
      // Draw arc sweeping away from player (shoots outward)
      ctx.beginPath();
      ctx.arc(0, 0, s * 2.8, -Math.PI / 2.2, Math.PI / 2.2);
      ctx.stroke();
      // Outer glow ring
      ctx.globalAlpha = alpha * 0.35;
      ctx.strokeStyle = "#FFF";
      ctx.lineWidth = s * 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, s * 2.8, -Math.PI / 2.2, Math.PI / 2.2);
      ctx.stroke();
      ctx.restore();

    } else if (p.type === "drop") {
      // More realistic water splash
      const ps = s * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ps, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.arc(p.x - ps * 0.3, p.y - ps * 0.3, ps * 0.3, 0, Math.PI * 2);
      ctx.fill();

    } else if (p.type === "dust") {
      // Soft dust cloud
      const ps = s * 1.5;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, ps);
      g.addColorStop(0, p.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ps, 0, Math.PI * 2);
      ctx.fill();

    } else if (p.type === "water") {
      // Fluid splash: expanding and fading blue circle with white center
      const prog = 1 - alpha;
      const sSize = s * (0.8 + prog * 1.5);
      ctx.fillStyle = "#A3E4F8";
      ctx.beginPath();
      ctx.arc(p.x, p.y, sSize, 0, Math.PI * 2);
      ctx.fill();
      // Highlight center
      ctx.fillStyle = "#FFF";
      ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sSize * 0.4, 0, Math.PI * 2);
      ctx.fill();

    } else if (p.type === "leaf" || p.type === "petal") {
      // Detailed organic particle with rotation and scale wave
      const ps = s * 0.8;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * (p.type === "leaf" ? 0.05 : 0.08));
      const sway = Math.sin(p.life * 0.1) * 0.2;
      ctx.scale(1 + sway, 1 - sway);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.type === "leaf") {
         ctx.ellipse(0, 0, ps, ps * 0.5, 0, 0, Math.PI * 2);
      } else {
         // Petal shape
         ctx.moveTo(0, -ps);
         ctx.quadraticCurveTo(ps, -ps, ps, 0);
         ctx.quadraticCurveTo(ps, ps, 0, ps);
         ctx.quadraticCurveTo(-ps, ps, -ps, 0);
         ctx.quadraticCurveTo(-ps, -ps, 0, -ps);
      }
      ctx.fill();
      // Detail vein
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-ps, 0);
      ctx.lineTo(ps, 0);
      ctx.stroke();
      ctx.restore();

    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }

    ctx.restore();

    ctx.restore();
  }
}

function drawDamageNumbers(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const d of state.damageNumbers) {
    const alpha = d.life / d.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    
    // Unity-style "pop" effect
    const scale = 1 + Math.sin((1 - alpha) * Math.PI) * 0.4;
    ctx.translate(d.x, d.y);
    ctx.scale(scale, scale);

    ctx.font = 'bold 9px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Strong Outline
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 3;
    ctx.strokeText(d.text, 0, 0);

    // Main text
    ctx.fillStyle = d.color;
    ctx.fillText(d.text, 0, 0);
    
    ctx.restore();
  }
}

function drawInstructionBubble(
  ctx: CanvasRenderingContext2D,
  state: GameState,
) {
  const { x, y } = state.player;
  const text = state.bubbleText || "";
  if (!text) return;

  ctx.save();
  ctx.font = 'bold 8px "Press Start 2P", monospace';
  const bx = x;
  const by = y - 72;

  // Text with strong pixel-style outline
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Outline
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  for(let ox=-1.5; ox<=1.5; ox+=1.5) {
    for(let oy=-1.5; oy<=1.5; oy+=1.5) {
       if(ox===0 && oy===0) continue;
       ctx.fillText(text, bx + ox, by + oy);
    }
  }

  // Gold text
  ctx.fillStyle = "#FFD700";
  ctx.fillText(text, bx, by);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawFarmDebugOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  const panelX = 14;
  const panelY = 14;
  const rowH = 16;
  const maxRows = 10;
  const rows = state.farmPlots.slice(0, maxRows);

  const panelW = 440;
  const panelH = 76 + rows.length * rowH;

  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = "rgba(24,18,14,0.92)";
  roundRect(ctx, panelX, panelY, panelW, panelH, 10);
  ctx.fill();

  ctx.strokeStyle = "#D4AF37";
  ctx.lineWidth = 2;
  roundRect(ctx, panelX, panelY, panelW, panelH, 10);
  ctx.stroke();

  ctx.font = 'bold 10px "Press Start 2P", monospace';
  ctx.fillStyle = "#FFD700";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("FARM DEBUG OVERLAY", panelX + 10, panelY + 8);

  // Camera/Zoom debug info
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = "#9CF0A9";
  const { w, h } = MAP_SIZES[state.currentMap];
  const debugInfo = `ZOOM:${state.zoom.toFixed(2)} VP:${state.viewportW}x${state.viewportH} MAP:${w}x${h}`;
  ctx.fillText(debugInfo, panelX + 10, panelY + 22);

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = "#EEE1C6";
  const hdr = "ID     T W F  CROP      STAGE READY  PROG";
  ctx.fillText(hdr, panelX + 10, panelY + 38);

  const now = state.time;
  rows.forEach((plot, i) => {
    const y = panelY + 52 + i * rowH;
    const crop = plot.crop;
    const cropType = crop
      ? crop.type.toUpperCase().padEnd(8, " ")
      : "-".padEnd(8, " ");
    const stage = crop ? String(crop.stage).padEnd(5, " ") : "-".padEnd(5, " ");
    const ready = crop ? (crop.ready ? "Y" : "N") : "-";
    const growTime = crop?.growTime || 1;
    const elapsed = crop ? Math.max(0, now - crop.plantedAt) : 0;
    const progNum = crop
      ? Math.min(100, Math.floor((elapsed / growTime) * 100))
      : 0;
    const prog = `${String(progNum).padStart(3, " ")}%`;

    const rowText =
      `${plot.id.padEnd(6, " ")} ` +
      `${plot.tilled ? "1" : "0"} ${plot.watered ? "1" : "0"} ${plot.fertilized ? "1" : "0"}  ` +
      `${cropType} ${stage}  ${ready}     ${prog}`;

    ctx.fillStyle = plot.id === state.hoveredPlotId ? "#9CF0A9" : "#EEE1C6";
    ctx.fillText(rowText, panelX + 10, y);
  });

  if (state.farmPlots.length > maxRows) {
    ctx.fillStyle = "#CDB892";
    ctx.fillText(
      `... +${state.farmPlots.length - maxRows} more plots`,
      panelX + 10,
      panelY + panelH - 12,
    );
  }

  ctx.restore();
}

function drawMapLabels(ctx: CanvasRenderingContext2D, state: GameState) {
  const { currentMap, player } = state;
  const labels: Record<string, { x: number; y: number; text: string }[]> = {
    city: [],
    garden: [],
    suburban: [
      { x: 300, y: 300, text: "COZY RESIDENCE" },
      { x: 700, y: 250, text: "NEIGHBORHOOD" },
      { x: 520, y: 150, text: "QUIET AREA" },
    ],
    fishing: [
      { x: 520, y: 240, text: "" },
      { x: 200, y: 240, text: "CAST HERE" },
      { x: 800, y: 240, text: "" },
    ],
  };

  const mapList = labels[currentMap] || [];
  for (const l of mapList) {
    const dist = Math.hypot(l.x - player.x, l.y - player.y);
    const alpha = Math.max(0.1, 1 - dist / 500);
    ctx.save();
    ctx.globalAlpha = alpha;
    drawHologram(ctx, l.x, l.y - 70, l.text, state.time);
    ctx.restore();
  }
}

function drawHologram(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
  gameTime?: number,
) {
  // No box — just clean pixel text with drop shadow
  const dy = gameTime !== undefined ? Math.floor(Math.sin(gameTime / 600) * 3) : 0;
  ctx.save();
  ctx.translate(Math.floor(cx), Math.floor(cy + dy));
  ctx.font = 'bold 9px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Dark outline
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  for (const [ox, oy] of [[-1,-1],[1,-1],[-1,1],[1,1],[0,-2],[0,2]]) {
    ctx.fillText(text, ox, oy);
  }
  // Gold text
  ctx.fillStyle = "#FFD700";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}


// ── CITY: Animated NPCs walking around ───────────────────────────────────────
const CITY_NPC_DATA = [
  { x: 200, y: 380, name: "MERCHANT", color: "#FF8A65", speed: 0.4 },
  { x: 700, y: 400, name: "TRADER",   color: "#81C784", speed: 0.3 },
  { x: 450, y: 360, name: "BUYER",    color: "#64B5F6", speed: 0.5 },
];

function drawCityNPCs(ctx: CanvasRenderingContext2D, state: GameState) {
  for (let i = 0; i < CITY_NPC_DATA.length; i++) {
    const npc = CITY_NPC_DATA[i];
    const ox = Math.sin(state.time / 1200 + i * 2.1) * 60;
    const nx = npc.x + ox;
    const ny = npc.y + Math.sin(state.time / 900 + i) * 12;
    const facing = ox > 0 ? 1 : -1;

    ctx.save();
    ctx.translate(nx, ny);

    // Shadow
    ctx.save();
    ctx.scale(1.3, 0.3);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body
    const walkCycle = Math.floor((state.time / 180 + i * 3) % 4);
    const walkFrames = ["/player_walk1.png", "/jalan_kaki_10_tengah_langkah.png", "/player_walk2.png", "/jalan_kaki_11_akhir_langkah.png"];
    const sprite = imgs[walkFrames[walkCycle]];
    ctx.scale(facing, 1);
    if (sprite?.complete && sprite.naturalWidth > 0) {
      const h = 36, w = h * (sprite.naturalWidth / sprite.naturalHeight);
      ctx.drawImage(sprite, -w / 2, -h + 4, w, h);
    }
    ctx.scale(facing, 1);

    // Name tag
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillText(npc.name, 1, -44);
    ctx.fillStyle = npc.color;
    ctx.fillText(npc.name, 0, -45);
    ctx.restore();
  }
}

// ── GARDEN: Overlay — floating hearts + welcome text ─────────────────────────
function drawGardenOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  // Floating hearts around fountain
  const fx = 520, fy = 318;
  for (let i = 0; i < 5; i++) {
    const t = (state.time / 1800 + i * 0.2) % 1;
    const angle = i * 1.26 + state.time / 3000;
    const r = 55 + Math.sin(state.time / 800 + i) * 10;
    const hx = fx + Math.cos(angle) * r;
    const hy = fy - t * 60 + Math.sin(state.time / 600 + i) * 8;
    const alpha = Math.sin(t * Math.PI) * 0.7;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("♥", hx, hy);
    ctx.restore();
  }

  // "SOCIAL HUB" label near fountain
  const pulse = 0.85 + Math.sin(state.time / 600) * 0.15;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText("SOCIAL HUB", fx + 1, fy - 55 + 1);
  ctx.fillStyle = "#FFD700";
  ctx.fillText("SOCIAL HUB", fx, fy - 55);
  ctx.restore();

  // Player count badge
  const count = Math.max(1, state.gardenActivePlayers || 1);
  ctx.save();
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillText(`${count} ONLINE`, fx + 1, fy - 44 + 1);
  ctx.fillStyle = "#6BFF8A";
  ctx.fillText(`${count} ONLINE`, fx, fy - 44);
  ctx.restore();
}

// ── SUBURBAN: Interactive spots ───────────────────────────────────────────────
const SUBURBAN_SPOTS = [
  { x: 200, y: 470, label: "PARK BENCH", hint: "REST AREA", color: "#A5D6A7" },
  { x: 500, y: 470, label: "NOTICE BOARD", hint: "COMING SOON", color: "#FFD700" },
  { x: 800, y: 470, label: "MAILBOX", hint: "NO MAIL YET", color: "#EF9A9A" },
];

function drawSuburbanSpots(ctx: CanvasRenderingContext2D, state: GameState) {
  const px = state.player.x, py = state.player.y;

  for (const spot of SUBURBAN_SPOTS) {
    const dist = Math.hypot(spot.x - px, spot.y - py);
    const isNear = dist < 80;
    const pulse = isNear ? 0.8 + Math.sin(state.time / 300) * 0.2 : 0.5;

    ctx.save();
    ctx.translate(spot.x, spot.y - 30);
    ctx.globalAlpha = pulse;

    // Glow ring when near
    if (isNear) {
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.strokeStyle = spot.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4 + Math.sin(state.time / 200) * 0.3;
      ctx.stroke();
      ctx.globalAlpha = pulse;
    }

    // Label pill
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    const tw = ctx.measureText(spot.label).width + 14;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(-tw / 2 + 1, -9 + 1, tw, 16, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(30,15,5,0.85)";
    ctx.beginPath();
    ctx.roundRect(-tw / 2, -9, tw, 16, 8);
    ctx.fill();

    ctx.fillStyle = spot.color;
    ctx.fillText(spot.label, 0, 2);

    // Hint when near
    if (isNear) {
      ctx.font = '4px "Press Start 2P", monospace';
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText(spot.hint, 1, 17);
      ctx.fillStyle = "#FFE4B5";
      ctx.fillText(spot.hint, 0, 16);
    }

    ctx.restore();
  }

  // "BETA AREA" watermark
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.font = '18px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFD700";
  ctx.fillText("BETA AREA", 520, 300);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// ATMOSPHERE WEATHER PARTICLES
// ═══════════════════════════════════════════════════════════════
const weatherParticles: Array<{x: number; y: number; vx: number; vy: number; size: number; alpha: number; type: string}> = [];

function drawWeatherParticles(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  const { cameraX, cameraY, currentMap } = state;
  const now = state.time;
  
  // Only show particles in garden/suburban/home
  if (currentMap !== "garden" && currentMap !== "home" && currentMap !== "suburban") return;
  
  // Spawn new particles occasionally
  if (weatherParticles.length < 40 && Math.random() < 0.1) {
    weatherParticles.push({
      x: Math.random() * W + cameraX,
      y: -10,
      vx: (Math.random() - 0.5) * 0.3,
      vy: 0.4 + Math.random() * 0.6,
      size: 2 + Math.random() * 2,
      alpha: 0.3 + Math.random() * 0.4,
      type: Math.random() > 0.7 ? "petal" : "dust"
    });
  }
  
  ctx.save();
  
  // Update and draw particles
  for (let i = weatherParticles.length - 1; i >= 0; i--) {
    const p = weatherParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    
    // Screen-relative position
    const sx = p.x - cameraX;
    const sy = p.y - cameraY;
    
    // Remove if off screen
    if (sy > H + 20 || sx < -20 || sx > W + 20) {
      weatherParticles.splice(i, 1);
      continue;
    }
    
    ctx.globalAlpha = p.alpha;
    
    if (p.type === "petal") {
      // Falling petal with rotation
      ctx.fillStyle = "#FFB6C1";
      ctx.beginPath();
      ctx.ellipse(sx, sy, p.size, p.size * 0.6, now / 500 + p.x * 0.01, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Dust mote
      ctx.fillStyle = "#FFF8DC";
      ctx.beginPath();
      ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}
