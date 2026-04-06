import type { MutableRefObject } from 'react';
import {
  GameState,
  FarmPlot,
  Crop,
  VFXParticle,
  DamageNumber,
  NPC,
  CROP_GROW_TIMES,
  CROP_GOLD_REWARDS,
  CROP_HARVEST_XP,
  CropType,
  MAP_COLLISIONS,
  MAP_WALKABLE_ZONES,
  MAP_PLAYER_START,
  MAP_SIZES,
  MapType,
  FARM_GRID,
  SHOP_ITEMS,
  CollisionRect,
  Tree,
  GARDEN_ROAD_Y,
  Footprint,
  applyFarmBalancePreset,
  FARM_BALANCE_PRESETS,
  FarmBalancePreset,
  GardenCritter,
  SUBURBAN_HOUSE_ZONES,
  isCropPlantingUnlocked,
  toolIdToCrop,
  seedUnlockLevel,
  stressWiltThresholdMs,
} from "./Game";
import { supabase } from "./supabase";

let serverTimeOffset = 0;

/** Fetch server time from Supabase to prevent client-side cheating (GDD Requirement) */
export async function syncServerTime() {
  try {
    const start = Date.now();
    // Use select now() to get DB time
    const { data } = await supabase.rpc('get_server_time');
    const dbTime = data ? new Date(data).getTime() : Date.now();
    const end = Date.now();
    const latency = (end - start) / 2;
    serverTimeOffset = (dbTime + latency) - end;
  } catch {
    // Fallback if RPC doesnt exist — use a dummy select
    try {
      const { data } = await supabase.from('players').select('created_at').limit(1).maybeSingle();
      // Not ideal but better than nothing
    } catch {}
  }
}

export function getServerTime(): number {
  return Date.now() + serverTimeOffset;
}
import { AudioManager } from "./AudioSystem";
import {
  bumpQuestProgress,
  addEarnQuestProgress,
} from "./questManager";
import {
  validateFarmAction,
  FARM_ACTION_RADIUS_PX,
} from "./farmingValidation";
import {
  farmingEngineBeginWork,
  farmingEngineRelease,
} from "./farmingEngine";

/** @deprecated use FARM_ACTION_RADIUS_PX — kept for imports */
export const PLOT_ACTION_MAX_DIST = FARM_ACTION_RADIUS_PX;

function attachFarmingEngine(
  s: GameState,
  plot: FarmPlot,
  toolKey: string,
): void {
  s.farmingEngine = farmingEngineBeginWork(plot.id, plot.plotUuid, toolKey);
}

function isFarmMovementLocked(player: GameState["player"]): boolean {
  if (player.actionTimer <= 0 || !player.action) return false;
  const a = player.action as string;
  const lockedActions = ["hoe", "sickle", "water", "fertilizer", "axe", "axe-large", "shovel", "sickle-gold"];
  if (lockedActions.includes(a)) return true;
  if (a.includes("seed")) return true;
  return false;
}

function plotCenter(plot: FarmPlot): { cx: number; cy: number } {
  const { cellW, cellH } = FARM_GRID;
  return {
    cx: FARM_GRID.startX + plot.gridX * cellW + cellW / 2,
    cy: FARM_GRID.startY + plot.gridY * cellH + cellH / 2,
  };
}

function distanceToPlot(s: GameState, plotId: string): number {
  const p = s.farmPlots.find((x) => x.id === plotId);
  if (!p) return 9999;
  const { cx, cy } = plotCenter(p);
  return Math.hypot(s.player.x - cx, s.player.y - cy);
}

export function rollMarketTrend(s: GameState) {
  const crops: CropType[] = ["wheat", "tomato", "carrot", "pumpkin"];
  s.marketTrendCrop = crops[Math.floor(Math.random() * crops.length)];
  s.marketTrendUntil = s.time + 300000;
}

function updateMarketTrend(s: GameState) {
  if (!s.marketTrendCrop || s.time >= s.marketTrendUntil) rollMarketTrend(s);
}

export function createInitialState(): GameState {
  const s: GameState = {
    player: {
      x: MAP_PLAYER_START.home.x,
      y: MAP_PLAYER_START.home.y,
      hp: 23,
      maxHp: 25,
      level: 1,
      exp: 0,
      maxExp: 100,
      gold: 0,
      facing: "down",
      moving: false,
      running: false,
      speed: 2.5,
      tool: null,
      inventory: {
        "wheat-seed": 10,
        "tomato-seed": 10,
        "carrot-seed": 10,
        "pumpkin-seed": 10,
        wheat: 0,
        tomato: 0,
        carrot: 0,
        seeds: 0,
      },
      animFrame: 0,
      animTimer: 0,
      action: null,
      actionTimer: 0,
      targetX: null,
      targetY: null,
      tutorialStep: 0,
      harvestCount: 0, // Added to track 1st harvest unlock
      lifetopiaGold: 0,
      walletAddress: "",
      jumpY: 0,
      jumpFlip: 0,
      jumpCount: 0,
      emote: null,
      emoteUntil: 0,
      emoteBubble: null,
      emoteBubbleUntil: 0,
      nftEligibility: false,
    },
    currentMap: "home",
    seedCooldowns: {},
    fishingSession: null,
    farmPlots: createFarmPlots(),
    vfxParticles: [],
    damageNumbers: [],
    quests: [
      {
        id: "q1",
        title: "Harvest 5 Crops",
        description: "Harvest 5 crops",
        type: "harvest",
        target: 5,
        current: 0,
        reward: 30,
        completed: false,
        claimed: false,
      },
      {
        id: "q2",
        title: "Plant 10 Seeds",
        description: "Plant 10 seeds",
        type: "plant",
        target: 10,
        current: 0,
        reward: 20,
        completed: false,
        claimed: false,
      },
      {
        id: "q3",
        title: "Earn 20 GOLD",
        description: "Earn 20 GOLD from farming & fishing",
        type: "earn",
        target: 20,
        current: 0,
        reward: 50,
        completed: false,
        claimed: false,
      },
    ],
    npcs: createNPCs(),
    fishBobber: {
      active: false,
      x: 0,
      y: 0,
      bobTimer: 0,
      biting: false,
      biteTimer: 0,
    },
    zoom: 1.5,
    targetZoom: 1.5,
    cameraX: 0,
    cameraY: 0,
    keys: new Set(),
    time: 0,
    notification: null,
    bubbleText: "WELCOME TO LIFETOPIA!",
    shopOpen: false,
    shopItems: SHOP_ITEMS,
    fishingActive: false,
    activePanel: null,
    particleId: 0,
    damageId: 0,
    trees: createHomeTrees(),
    footprints: [],
    hoveredPlotId: null,
    harvestLocked: false,
    pendingPlotAction: null,
    demoMode: false,
    demoTimer: 0,
    tutorialActive: false,
    showFarmDebugOverlay: false,
    farmBalancePreset: "easy",
    shake: 0,
    pointerCanvas: null,
    plotHoverFromPointer: null,
    plotJuice: null,
    farmingSpeedMultiplier: 1,
    nftBoostActive: false,
    fishingCatchHold: null,
    fishingRareFlash: null,
    gardenCritters: [],
    gardenActivePlayers: 0,
    marketTrendCrop: null,
    marketTrendUntil: 0,
    levelUpPopup: null,
    pendingCloudSave: false,
    viewportW: typeof window !== "undefined" ? window.innerWidth : 1280,
    viewportH: typeof window !== "undefined" ? window.innerHeight : 720,
    farmingEngine: farmingEngineRelease(),
    gardenRemotePlayers: [],
  };

  applyFarmBalancePreset(s.farmBalancePreset);
  rollMarketTrend(s);

  // Start clean: player must actually farm from scratch on home map

  return s;
}

function createHomeTrees(): Tree[] {
  return [
    { id: "tree1", x: 100, y: 350, hp: 5, maxHp: 5, type: "oak" },
    { id: "tree2", x: 80, y: 500, hp: 10, maxHp: 10, type: "pine" },
    { id: "tree3", x: 920, y: 300, hp: 6, maxHp: 6, type: "oak" },
    { id: "rock1", x: 850, y: 450, hp: 4, maxHp: 4, type: "rock" },
    { id: "rock2", x: 200, y: 150, hp: 8, maxHp: 8, type: "rock" },
  ];
}

function newPlotUuid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `plot-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
  );
}

function createFarmPlots(): FarmPlot[] {
  const plots: FarmPlot[] = [];
  const { cols, rows, cellW, cellH, startX, startY } = FARM_GRID;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const uid = newPlotUuid();
      plots.push({
        id: `plot-${row}-${col}`,
        plotUuid: uid,
        gridX: col,
        gridY: row,
        worldX: startX + col * cellW,
        worldY: startY + row * cellH,
        tilled: false,
        watered: false,
        fertilized: false,
        crop: null,
        stressDrySince: null,
      });
    }
  }
  return plots;
}

function createNPCs(): NPC[] {
  return [
    { id: "npc1", x: 280, y: 430, name: "LUNA",   color: "#FF8A80", vx: 0, vy: 0, moveTimer: 0 },
    { id: "npc2", x: 680, y: 400, name: "RIKO",   color: "#82B1FF", vx: 0, vy: 0, moveTimer: 60 },
    { id: "npc3", x: 480, y: 460, name: "MIKA",   color: "#B9F6CA", vx: 0, vy: 0, moveTimer: 30 },
    { id: "npc4", x: 820, y: 450, name: "TARO",   color: "#FFD180", vx: 0, vy: 0, moveTimer: 45 },
    { id: "npc5", x: 160, y: 445, name: "SARI",   color: "#EA80FC", vx: 0, vy: 0, moveTimer: 20 },
  ];
}

function updatePlotPointerHover(s: GameState) {
  s.plotHoverFromPointer = null;
  if (s.currentMap !== "home" || !s.pointerCanvas) return;
  const wx = (s.pointerCanvas.x + s.cameraX) / s.zoom;
  const wy = (s.pointerCanvas.y + s.cameraY) / s.zoom;
  const hit = s.farmPlots.find((p) => {
    const x0 = FARM_GRID.startX + p.gridX * FARM_GRID.cellW;
    const y0 = FARM_GRID.startY + p.gridY * FARM_GRID.cellH;
    return (
      wx >= x0 &&
      wx <= x0 + FARM_GRID.cellW &&
      wy >= y0 &&
      wy <= y0 + FARM_GRID.cellH
    );
  });
  s.plotHoverFromPointer = hit?.id ?? null;
}

function ensureGardenCritters(s: GameState) {
  if (s.currentMap !== "garden") return;
  while (s.gardenCritters.length < 6) {
    const c: GardenCritter = {
      id: `gc${s.particleId++}`,
      kind: Math.random() > 0.4 ? "butterfly" : "bird",
      x: 100 + Math.random() * 840,
      y: 190 + Math.random() * 160,
      tx: 100 + Math.random() * 840,
      ty: 190 + Math.random() * 160,
      speed: 0.45 + Math.random() * 0.55,
    };
    s.gardenCritters.push(c);
  }
}

function updateGardenCritters(s: GameState, _dt: number) {
  // Purged: No ugly critters or fountain mist in Garden
  s.gardenCritters = [];
}

function resolveFishingSession(s: GameState, dt: number) {
  const fs = s.fishingSession;
  if (!fs) return;

  if (fs.state === "casting") {
    fs.timer -= dt;
    if (fs.timer <= 0) {
      fs.state = "waiting";
      fs.timer = 1500 + Math.random() * 4000;
    }
  } else if (fs.state === "waiting") {
    fs.timer -= dt;
    if (fs.timer <= 0) {
      fs.state = "bite";
      fs.timer = 1800; // 1.8s to react — more forgiving
      AudioManager.playSFX("harvest");
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(120);
    }
  } else if (fs.state === "bite") {
    fs.timer -= dt;
    if (fs.timer <= 0) {
      fs.state = "failed";
      fs.timer = 1200;
      s.notification = { text: "FISH ESCAPED!", life: 80 };
    }
  } else if (fs.state === "struggle") {
    fs.struggleProgress -= 0.025 * dt; // Slower decay — more mindful
    if (fs.struggleProgress <= 0) {
      fs.state = "failed";
      fs.timer = 1000;
      s.notification = { text: "FISH GOT AWAY...", life: 80 };
    } else if (fs.struggleProgress >= 100) {
      fs.state = "success";
      completeFishing(s);
    }
  } else if (fs.state === "failed" || fs.state === "success") {
    fs.timer -= dt;
    if (fs.timer <= 0) s.fishingSession = null;
  }
}

function completeFishing(s: GameState) {
  const fs = s.fishingSession;
  if (!fs) return;
  
  const roll = Math.random();
  let gold = 8;
  let type: "common" | "rare" | "exotic" = "common";
  let color = "#FFFFFF";

  if (roll > 0.88) {
    gold = 40; type = "exotic"; color = "#FFD700";
    s.shake = 12; AudioManager.playSFX("level-up");
    s.notification = { text: "EXOTIC FISH CAUGHT!", life: 100 };
  } else if (roll > 0.65) {
    gold = 22; type = "rare"; color = "#64B5F6";
    s.notification = { text: "RARE FISH CAUGHT!", life: 90 };
  } else {
    gold = 8;
    s.notification = { text: "Common Fish Caught! +8 GOLD", life: 80 };
  }

  s.player.gold += gold;
  addEarnQuestProgress(s, gold);
  spawnText(s, s.player.x, s.player.y - 50, `+${gold} GOLD`, color, -2.5);
  spawnVFX(s, fs.bobberX, fs.bobberY, "harvest");
  // Minimal sparkle for rare catches only
  if (type === "exotic") spawnVFX(s, fs.bobberX, fs.bobberY, "sparkle");
  
  s.pendingCloudSave = true;
  fs.timer = 2000; // Finish linger
}

export function updateGame(state: GameState, dt: number, stateRef?: MutableRefObject<GameState>): GameState {
  const s = {
    ...state,
    player: { ...state.player },
    vfxParticles: [...state.vfxParticles],
    damageNumbers: [...state.damageNumbers],
  };
  // [DEBUG] Log player state at frame start — critical for tracking character disappear
  if (s.player.actionTimer > 0) {
    console.log(`[updateGame] IN action=${s.player.action} timer=${Math.round(s.player.actionTimer)} player.x=${Math.round(s.player.x)} player.y=${Math.round(s.player.y)}`);
  }
  s.time += dt;
  s.shake = Math.max(0, (s.shake || 0) * 0.78);
  if (s.plotJuice && s.time > s.plotJuice.until) s.plotJuice = null;
  if (s.player.emote && s.time >= s.player.emoteUntil)
    s.player.emote = null;
  if (s.demoMode && !s.tutorialActive) updateDemoLogic(s, dt);
  handleMovement(s, dt, stateRef);
  updateCamera(s);
  updateZoom(s);
  updatePlotPointerHover(s);
  updateGardenCritters(s, dt);
  resolveFishingSession(s, dt);
  updateMarketTrend(s);
  if (s.player.emoteBubble && s.time >= s.player.emoteBubbleUntil)
    s.player.emoteBubble = null;
  
  // Suburban: interactive spots + ambient hints
  if (s.currentMap === "suburban") {
    const px = s.player.x, py = s.player.y;
    const spots = [
      { x: 200, y: 470, msg: "PARK BENCH — TAKE A BREAK! (BETA)" },
      { x: 500, y: 470, msg: "NOTICE BOARD — UPDATES COMING SOON!" },
      { x: 800, y: 470, msg: "MAILBOX — NO MAIL YET. CHECK BACK!" },
    ];
    for (const spot of spots) {
      if (Math.hypot(spot.x - px, spot.y - py) < 70) {
        if (!s.notification || !s.notification.text.includes(spot.msg.slice(0, 10)))
          s.notification = { text: spot.msg, life: 120 };
        break;
      }
    }
  }
  if (s.levelUpPopup && s.time >= s.levelUpPopup.until)
    s.levelUpPopup = null;

  // FISHING MAP: player can never reach water (collision wall at y=210)
  // No drowning logic needed — hard wall prevents it entirely
  
  // Cleanup/Update cooldowns
  for(const k in s.seedCooldowns) {
    if(s.seedCooldowns[k] > 0) s.seedCooldowns[k] = Math.max(0, s.seedCooldowns[k] - dt);
  }

  updateCrops(s);
  updateVFX(s);
  updateDamageNumbers(s);
  updatePlayerAnim(s, dt);
  if (s.fishingCatchHold && s.time < s.fishingCatchHold.until) {
    s.player.action = "sickle";
    s.player.actionTimer = Math.max(s.player.actionTimer, 18);
  }
  updatePlayerAction(s, dt);
  updateNotification(s, dt);

  // ACROBATIC JUMP & FLIP PHYSICS (SPACE BAR)
  const p = s.player;
  if (s.keys.has(" ") && p.jumpCount < 2 && p.jumpY > -20) {
    p.jumpCount++;
    p.jumpY = -35; // Initial burst
    p.jumpFlip = 0;
  }

  if (p.jumpCount > 0 || p.jumpY < 0) {
    p.jumpY += 2; // Gravity
    p.jumpFlip += 15; // Rotate 360 over the jump duration
    if (p.jumpY >= 0) {
      p.jumpY = 0;
      p.jumpCount = 0;
      p.jumpFlip = 0;
    }
  }

  if (s.currentMap === "garden") updateNPCs(s, dt);
  if (s.currentMap === "fishing" && s.fishBobber.active) updateFishing(s, dt);
  if (s.player.action === "water" && s.player.actionTimer > 0) {
    // REMOVED ALL WATER VFX - No more water drop particles!
    // Clean visual, better performance
  }
  if (s.player.action === "fertilizer" && s.player.actionTimer > 0) {
    // REMOVED ALL FERTILIZER VFX - No more sparkle particles!
    // Clean visual only
  }

  // REMOVED ALL AMBIENT VFX - No more leaves/petals floating around!
  // Cleaner performance, no distractions

  // Update hovered plot (nearest plot to player)
  {
    const { cellW, cellH } = FARM_GRID;
    let nearId: string | null = null;
    let nearDist = 90;
    for (const plot of s.farmPlots) {
      const cx = FARM_GRID.startX + plot.gridX * cellW + cellW / 2;
      const cy = FARM_GRID.startY + plot.gridY * cellH + cellH / 2;
      const d = Math.hypot(cx - s.player.x, cy - s.player.y);
      if (d < nearDist) {
        nearDist = d;
        nearId = plot.id;
      }
    }
    s.hoveredPlotId = nearId;

    // Dynamic bubble text based on tool + hovered    // ── TUTORIAL BUBBLES ──
    const tool = s.player.tool;
    const plot = s.hoveredPlotId ? s.farmPlots.find((p) => p.id === s.hoveredPlotId) : null;

    if (s.player.actionTimer > 0) {
      // Show action-feedback if animation is playing
      if (s.player.action === "hoe" || s.player.action === "shovel" || s.player.action === "sickle") s.bubbleText = "Soil prepared!";
      else if ((s.player.action as string)?.includes("seed")) s.bubbleText = "Planted!";
      else if (s.player.action === "fertilizer") s.bubbleText = "Growth boosted!";
      else if (s.player.action === "axe") s.bubbleText = "Timber!";
      else if (s.player.action === "water") s.bubbleText = "Watered!";
    } else if (s.currentMap === "home") {
      const tStr = (tool || "") as string;
      if (tStr && plot) {
        if (tStr === "hoe" || tStr === "shovel" || tStr === "sickle") {
          s.bubbleText = plot.tilled ? "Soil ready!" : "Till the bare soil!";
        } else if (tStr === "water") {
          s.bubbleText = plot.watered ? "Already wet." : (plot.crop ? "Water the plant!" : "Water the soil!");
        } else if (tStr === "fertilizer") {
          s.bubbleText = plot.fertilized ? "Already boosted!" : "Fertilize for speed!";
        } else if (tStr.endsWith("-seed")) {
          if (!plot.tilled) s.bubbleText = "Till the soil first!";
          else if (plot.crop) s.bubbleText = "Plot occupied!";
          else s.bubbleText = `Plant ${tStr.split("-")[0]}!`;
        }
      } else if (tStr) {
        if (tStr === "hoe" || tStr === "shovel" || tStr === "sickle") s.bubbleText = "Find bare soil!";
        else if (tStr === "water") s.bubbleText = "Water your crops!";
        else if (tStr === "axe") s.bubbleText = "Chop trees!";
        else if (tStr.endsWith("-seed")) s.bubbleText = `Choose a plot to plant!`;
      } else {
        s.bubbleText = "Select a tool to farm!";
      }
    } else {
      // Non-Farm Maps
      if (s.currentMap === "city") s.bubbleText = "Walk to SHOP sign!";
      else if (s.currentMap === "fishing") s.bubbleText = s.fishingSession ? "Tap to REEL!" : "Tap CAST button!";
      else if (s.currentMap === "garden") {
        // Show NPC name when nearby
        const nearNPC = s.npcs.find(n => Math.hypot(n.x - s.player.x, n.y - s.player.y) < 80);
        if (nearNPC) {
          const lines = ["Hey farmer!", "Nice crops!", "How's the farm?", "Good weather!", "Stay a while!"];
          const line = lines[Math.floor(s.time / 3000) % lines.length];
          s.bubbleText = `${nearNPC.name}: ${line}`;
        } else {
          s.bubbleText = "Walk near a friend!";
        }
      }
      else if (s.currentMap === "suburban") s.bubbleText = "Explore the area!";
      else s.bubbleText = "";
    }
  }

  // Footprints — spawn when moving, alternate left/right foot
  s.footprints = [...(state.footprints || [])];
  const fp = s.player;
  if (fp.moving && Math.floor(s.time / 18) !== Math.floor((s.time - dt) / 18)) {
    const foot: "left" | "right" =
      Math.floor(s.time / 18) % 2 === 0 ? "left" : "right";
    const offset = foot === "left" ? -5 : 5;
    const perpX = fp.facing === "up" || fp.facing === "down" ? offset : 0;
    const perpY = fp.facing === "left" || fp.facing === "right" ? offset : 0;
    s.footprints.push({
      x: fp.x + perpX,
      y: fp.y + 8 + perpY,
      facing: fp.facing,
      life: 180,
      maxLife: 180,
      foot,
    });
  }
  // Fade and remove old footprints
  s.footprints = s.footprints
    .map((f) => ({ ...f, life: f.life - dt }))
    .filter((f) => f.life > 0)
    .slice(-40); // max 40 footprints at once

  return s;
}

function executePlotAction(s: GameState, plotId: string, tool: string) {
  // [DEBUG] Log every plot action execution for Capacitor Inspect
  console.log(`[executePlotAction] plotId=${plotId} tool=${tool} player.x=${Math.round(s.player.x)} player.y=${Math.round(s.player.y)}`);
  const plotIdx = s.farmPlots.findIndex((p) => p.id === plotId);
  if (plotIdx === -1) {
    console.warn(`[executePlotAction] plot not found: ${plotId}`);
    return s;
  }

  const gate = validateFarmAction(s, plotId, tool);
  if (!gate.ok) {
    // If validation failed due to distance, try snapping to plot center temporarily
    if (gate.reason === "Too far!") {
      const plot = s.farmPlots[plotIdx];
      const { cellW, cellH } = FARM_GRID;
      const cx = FARM_GRID.startX + plot.gridX * cellW + cellW / 2;
      const cy = FARM_GRID.startY + plot.gridY * cellH + cellH / 2;
      const origX = s.player.x, origY = s.player.y;
      s.player.x = cx; s.player.y = cy;
      const gate2 = validateFarmAction(s, plotId, tool);
      if (gate2.ok) {
        // Valid after snap - proceed but restore position after action
        s.farmPlots[plotIdx] = { ...plot };
        const result = performPlotAction(s, plotIdx, tool, cx, cy);
        s.player.x = origX; s.player.y = origY;
        return result;
      }
      s.player.x = origX; s.player.y = origY;
    }
    s.bubbleText = gate.reason;
    s.notification = {
      text: gate.reason.toUpperCase().slice(0, 40),
      life: 75,
    };
    return s;
  }

  const plot = { ...s.farmPlots[plotIdx] };
  const { cellW, cellH } = FARM_GRID;
  const cx = FARM_GRID.startX + plot.gridX * cellW + cellW / 2;
  const cy = FARM_GRID.startY + plot.gridY * cellH + cellH / 2;

  return performPlotAction(s, plotIdx, tool, cx, cy);
}

function performPlotAction(s: GameState, plotIdx: number, tool: string, cx: number, cy: number): GameState {
  const plot = s.farmPlots[plotIdx];

  // [DEBUG] Plant/Wallet flow: log every step for Capacitor Inspect
  console.log(`[performPlotAction] START tool=${tool} plotIdx=${plotIdx} player.x=${Math.round(s.player.x)} player.y=${Math.round(s.player.y)} actionTimer=${s.player.actionTimer} wallet=${s.player.walletAddress?.slice(0,8) ?? "none"}`);

  // Subtle character feedback VFX — small sparkle burst on player when farming
  for (let i = 0; i < 4; i++) {
    spawnVFX(s, s.player.x + (Math.random() - 0.5) * 16, s.player.y - 14 + (Math.random() - 0.5) * 10, "sparkle");
  }

  // AXE: Clear crops (dead or alive) OR untill/reset the soil
  if (tool === "axe" || tool === "axe-large") {
    if (plot.crop) {
      // Clear crop
      plot.crop = null;
      plot.watered = false;
      plot.fertilized = false;
      plot.stressDrySince = null;
      s.notification = { text: "CROP CLEARED!", life: 85 };
    } else if (plot.tilled) {
      // Untill soil
      plot.tilled = false;
      plot.watered = false;
      plot.fertilized = false;
      s.notification = { text: "SOIL RESET!", life: 85 };
    }

    s.player.action = tool as any;
    s.player.actionTimer = 25;
    attachFarmingEngine(s, plot, tool);
    spawnVFX(s, cx, cy, "dust");
    AudioManager.playSFX("axe");
    console.log(`[performPlotAction] AXE done action=${s.player.action} actionTimer=${s.player.actionTimer}`);
    s.farmPlots[plotIdx] = plot;
    return s;
  }

  // SOIL TOOLS (Hoe, Sickle, Shovel): Till the earth OR harvest ready crops
  const isSoilTool = tool === "hoe" || tool === "shovel" || tool === "sickle";
  if (isSoilTool) {
    if (plot.crop?.ready) {
      const ct = plot.crop.type;
      const preset = FARM_BALANCE_PRESETS[s.farmBalancePreset];
      const baseGold = CROP_GOLD_REWARDS[ct] || preset.goldRewardMultiplier * 5;
      let gold = plot.crop.isRare ? baseGold * 3 : baseGold;
      if (s.marketTrendCrop === ct) gold = Math.floor(gold * 1.2);
      
      const baseXp = CROP_HARVEST_XP[ct] || 10;
      const exp = Math.floor(baseXp * preset.expMultiplier * (plot.crop.isRare ? 2 : 1));
      
      s.player.gold += gold;
      s.player.exp += exp;
      s.player.action = tool as any;
      s.player.actionTimer = 35;
      attachFarmingEngine(s, plot, tool);
      
      const nextInventory = {
        ...s.player.inventory,
        [ct]: (s.player.inventory[ct] || 0) + 1,
      };
      s.player.inventory = nextInventory;

      const wallet = s.player.walletAddress;
      if (wallet) {
        // [DEBUG] Non-blocking wallet sync — wrapped in try-catch to never crash game loop
        import("./questManager").then(qm => {
          qm.updateSupabaseGold(wallet, s.player.gold);
          qm.updateInventory(wallet, nextInventory);
          console.log(`[performPlotAction] questManager sync OK gold=${s.player.gold}`);
        }).catch(err => {
          console.warn(`[performPlotAction] questManager sync FAILED:`, err?.message);
        });
      }

      // Unity-style harvest burst
      for (let i = 0; i < 10; i++) spawnVFX(s, cx + (Math.random()-0.5)*45, cy - 10 + (Math.random()-0.5)*30, "harvest");
      for (let i = 0; i < 6; i++) spawnVFX(s, cx + (Math.random()-0.5)*30, cy - 20 + (Math.random()-0.5)*20, "sparkle");
      spawnVFX(s, cx, cy - 20, "coin");
      spawnVFX(s, cx, cy, "flash");
      spawnText(s, cx, cy - 56, `+${gold} GOLD`, "#FFD700", -2.4);

      bumpQuestProgress(s, "harvest");
      addEarnQuestProgress(s, gold);
      if (wallet) {
        // [DEBUG] Non-blocking quest check — safe fire-and-forget
        import("./questManager").then(qm => {
          qm.checkQuestEligibility(s, wallet);
          console.log(`[performPlotAction] checkQuestEligibility OK`);
        }).catch(err => {
          console.warn(`[performPlotAction] checkQuestEligibility FAILED:`, err?.message);
        });
      }
      console.log(`[performPlotAction] HARVEST done action=${s.player.action} actionTimer=${s.player.actionTimer}`);

      s.plotJuice = { plotId: plot.id, until: s.time + 380 };
      AudioManager.playSFX("harvest");
      
      s.player.harvestCount++;
      if (s.player.tutorialStep < 10) s.player.tutorialStep = 10;
      
      plot.crop = null;
      plot.watered = false;
      plot.fertilized = false;
      plot.stressDrySince = null;
      s.notification = { text: `+${gold}G`, life: 100 };
      s.pendingCloudSave = true;
      handleLevelUp(s, s.player.x, s.player.y);
    } else if (!plot.tilled) {
      plot.tilled = true;
      plot.stressDrySince = null;
      s.player.action = tool as any;
      s.player.actionTimer = 35;
      attachFarmingEngine(s, plot, tool);
      s.shake = 10;
      AudioManager.playSFX("hoe");
      // Unity-style burst VFX on till
      for (let i = 0; i < 12; i++) spawnVFX(s, cx + (Math.random()-0.5)*50, cy + (Math.random()-0.5)*40, "dust");
      for (let i = 0; i < 6; i++) spawnVFX(s, cx + (Math.random()-0.5)*30, cy + (Math.random()-0.5)*20, "sparkle");
      spawnVFX(s, cx, cy, "flash");
      s.notification = { text: "SOIL TILLED!", life: 80 };
    } else if (plot.crop) {
      if (plot.crop.dead) {
        s.notification = { text: "WITHERED! USE AXE TO CLEAR", life: 100 };
      } else if (!plot.watered) {
        s.notification = { text: `${plot.crop.type.toUpperCase()} NEEDS WATER!`, life: 100 };
      } else {
        const gtBase = CROP_GROW_TIMES[plot.crop.type] || plot.crop.growTime || 20000;
        const mult = s.farmingSpeedMultiplier || 1;
        const gt = (plot.fertilized ? Math.max(3000, gtBase / 2) : gtBase) * mult;
        const elapsed = Math.max(0, s.time - plot.crop.plantedAt);
        const remaining = Math.max(0, gt - elapsed);
        const remSec = Math.ceil(remaining / 1000);
        const remStr = remSec >= 60 ? `${Math.floor(remSec/60)}m ${remSec%60}s` : `${remSec}s`;
        const pct = Math.round(Math.min(100, (elapsed / gt) * 100));
        s.notification = { text: `${plot.crop.type.toUpperCase()}: ${pct}% — READY IN ${remStr}`, life: 120 };
      }
    } else {
      s.notification = { text: "READY FOR SEEDS!", life: 90 };
    }
  } 
  
  // WATERING CAN: Works on any tilled plot
  else if (tool === "water") {
    if (!plot.tilled) {
      s.notification = { text: "TILL SOIL FIRST!", life: 80 };
      console.log(`[performPlotAction] WATER blocked — soil not tilled`);
    } else if (plot.watered) {
      s.notification = { text: "ALREADY WATERED!", life: 70 };
    } else {
      plot.watered = true;
      plot.stressDrySince = null;
      s.player.action = "water" as any;
      s.player.actionTimer = 35;
      attachFarmingEngine(s, plot, "water");
      AudioManager.playSFX("water");
      for (let i = 0; i < 15; i++)
        spawnVFX(s, cx + (Math.random() - 0.5) * 45, cy + (Math.random() - 0.5) * 35, "water");
      s.notification = { text: "WATERED!", life: 80 };
      console.log(`[performPlotAction] WATER done action=${s.player.action} actionTimer=${s.player.actionTimer} crop=${plot.crop?.type ?? "none"}`);
    }
  }

  // FERTILIZER: Works on any tilled plot
  else if (tool === "fertilizer") {
    if (!plot.tilled) {
      s.notification = { text: "TILL SOIL FIRST!", life: 70 };
    } else if (plot.fertilized) {
      s.notification = { text: "ALREADY FERTILIZED!", life: 60 };
    } else {
      plot.fertilized = true;
      s.player.action = "fertilizer" as any;
      s.player.actionTimer = 30;
      attachFarmingEngine(s, plot, "fertilizer");
      for (let i = 0; i < 10; i++) spawnVFX(s, cx + (Math.random()-0.5)*40, cy + (Math.random()-0.5)*30, "sparkle");
      spawnVFX(s, cx, cy, "flash");
      AudioManager.playSFX("fertilize");
      s.shake = 5;
      s.notification = { text: "GROWTH BOOSTED!", life: 80 };
      console.log(`[performPlotAction] FERTILIZER done action=${s.player.action} actionTimer=${s.player.actionTimer}`);
    }
  }

  // SEEDS: Plant on empty tilled soil
  else if (tool.endsWith("-seed")) {
    let cropType: CropType = "wheat";
    if (tool.includes("tomato")) cropType = "tomato";
    else if (tool.includes("carrot")) cropType = "carrot";
    else if (tool.includes("pumpkin")) cropType = "pumpkin";

    const cd = s.seedCooldowns[tool] || 0;
    if (cd > 0) {
      const wait = Math.ceil(cd / 1000);
      s.notification = { text: `REFILLING SEEDS... ${wait}s`, life: 75 };
      console.log(`[performPlotAction] SEED blocked — cooldown ${wait}s`);
      return s;
    }

    const count = s.player.inventory[tool] || 0;

    if (!plot.tilled) {
      s.notification = { text: "TILL SOIL FIRST! SELECT HOE [1] THEN CLICK PLOT", life: 160 };
      s.farmPlots[plotIdx] = plot;
      console.log(`[performPlotAction] SEED blocked — soil not tilled`);
      return s;
    } else if (plot.crop) {
      if (plot.crop.dead) s.notification = { text: "CLEAR DEAD CROP FIRST!", life: 90 };
      else if (plot.crop.ready) s.notification = { text: "HARVEST FIRST!", life: 90 };
      else s.notification = { text: "PLOT OCCUPIED!", life: 90 };
      s.farmPlots[plotIdx] = plot;
      console.log(`[performPlotAction] SEED blocked — plot occupied/dead/ready`);
      return s;
    } else if (count <= 0) {
      s.notification = { text: `NO ${cropType.toUpperCase()} SEEDS!`, life: 90 };
      s.farmPlots[plotIdx] = plot;
      console.log(`[performPlotAction] SEED blocked — no seeds (${tool})`);
      return s;
    } else if (!isCropPlantingUnlocked(cropType, s.player.level, s.farmBalancePreset)) {
      const need = seedUnlockLevel(cropType, s.farmBalancePreset);
      s.notification = { text: `LOCKED — LEVEL ${need}+`, life: 90 };
      s.farmPlots[plotIdx] = plot;
      console.log(`[performPlotAction] SEED blocked — level too low (need ${need})`);
      return s;
    } else {
      const nowMs = getServerTime();
      plot.crop = makeCrop(cropType, nowMs, s.farmBalancePreset);
      plot.fertilized = false;
      plot.stressDrySince = plot.watered ? null : nowMs;
      s.player.action = "seed" as any;
      s.player.actionTimer = 30;
      attachFarmingEngine(s, plot, tool);
      AudioManager.playSFX("plant");
      s.player.inventory = { ...s.player.inventory, [tool]: count - 1 };

      const cdMap: Record<string, number> = { "wheat-seed": 50, "tomato-seed": 50, "carrot-seed": 50, "pumpkin-seed": 50 };
      s.seedCooldowns[tool] = cdMap[tool] || 50;

      // Unity-style plant burst
      for (let i = 0; i < 8; i++) spawnVFX(s, cx + (Math.random()-0.5)*35, cy + (Math.random()-0.5)*25, "plant");
      for (let i = 0; i < 4; i++) spawnVFX(s, cx + (Math.random()-0.5)*20, cy + (Math.random()-0.5)*15, "sparkle");
      spawnVFX(s, cx, cx, "flash");
      s.notification = { text: `PLANTED ${cropType.toUpperCase()}!`, life: 90 };
      bumpQuestProgress(s, "plant");
      s.plotJuice = { plotId: plot.id, until: s.time + 360 };
      console.log(`[performPlotAction] PLANT ${cropType} done action=${s.player.action} actionTimer=${s.player.actionTimer} plotId=${plot.id}`);
    }
  }

  s.farmPlots[plotIdx] = plot;
  return s;
}

function collides(px: number, py: number, rects: CollisionRect[]): boolean {
  // Player hitbox (smaller for better precision)
  const pw = 12,
    ph = 10;
  for (const r of rects) {
    if (
      px - pw < r.x + r.w &&
      px + pw > r.x &&
      py - ph < r.y + r.h &&
      py + ph > r.y
    )
      return true;
  }
  return false;
}

/**
 * Check if a world coordinate is within the allowed walkable zones for the current map.
 * null walkable zones = all ground is walkable (just use collision obstacles).
 */
function isInWalkableZone(tx: number, ty: number, map: MapType): boolean {
  const zones = MAP_WALKABLE_ZONES[map];
  if (!zones) return true; // No restriction — all ground is walkable

  const pw = 12, ph = 10;
  for (const r of zones) {
    if (
      tx - pw < r.x + r.w &&
      tx + pw > r.x &&
      ty - ph < r.y + r.h &&
      ty + ph > r.y
    ) return true;
  }
  return false;
}

/**
 * Snap a click target to the nearest walkable zone.
 * Makes movement feel smooth on mobile — clicking anywhere routes to a valid spot.
 */
function snapToWalkableZone(tx: number, ty: number, map: MapType): { tx: number; ty: number } {
  if (isInWalkableZone(tx, ty, map)) return { tx, ty };
  const zones = MAP_WALKABLE_ZONES[map];
  if (!zones || zones.length === 0) return { tx, ty };

  let bestTx = tx, bestTy = ty, bestDist = Infinity;
  for (const r of zones) {
    // Clamp click to the nearest point inside this zone
    const cx = Math.max(r.x, Math.min(r.x + r.w, tx));
    const cy = Math.max(r.y, Math.min(r.y + r.h, ty));
    const d = Math.hypot(cx - tx, cy - ty);
    if (d < bestDist) {
      bestDist = d;
      bestTx = cx;
      bestTy = cy;
    }
  }
  return { tx: bestTx, ty: bestTy };
}

function handleMovement(s: GameState, _dt: number, stateRef?: MutableRefObject<GameState>) {
  const p = s.player;
  if (isFarmMovementLocked(p)) {
    p.moving = false;
    p.targetX = null;
    p.targetY = null;
    return;
  }

  // Virtual joystick and on-screen controls write arrow keys into the same Set as WASD.
  // Never clear keys here on mobile — that made the joystick dead every frame.

  const diff = FARM_BALANCE_PRESETS[s.farmBalancePreset];
  const baseSpeed = p.speed + diff.playerSpeedBonus;
  const speedMultiplier = s.zoom > 2.0 ? 3.5 : (p.running ? 1.9 : 1.0);
  const speed = (p.running ? baseSpeed * 1.9 : baseSpeed) * speedMultiplier;
  let dx = 0, dy = 0;
  let usingKeyboard = false;

  // ── POINT-AND-CLICK / TAP-TO-MOVE ──
  if (p.targetX !== null && p.targetY !== null) {
    const dist = Math.hypot(p.targetX - p.x, p.targetY - p.y);

    if (dist <= 5) {
      // Arrived
      p.targetX = null;
      p.targetY = null;
      dx = 0; dy = 0;
      if (s.pendingPlotAction && s.currentMap === "home") {
        const pending = s.pendingPlotAction;
        s.pendingPlotAction = null;
        if (stateRef) stateRef.current.pendingPlotAction = null;
        // Execute action at current player position (where they actually clicked)
        executePlotAction(s, pending.plotId, pending.tool);
      }
    } else {
      // Move smoothly toward target
      const step = Math.min(speed, dist);
      dx = ((p.targetX - p.x) / dist) * step;
      dy = ((p.targetY - p.y) / dist) * step;
      p.facing =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0 ? "right" : "left"
          : dy > 0 ? "down" : "up";

      if (s.pendingPlotAction && s.currentMap === "home") {
        // Check distance to actual target position (clicked point), not plot center
        // This ensures action fires when player reaches where they clicked
        const dTarget = p.targetX !== null && p.targetY !== null
          ? Math.hypot(p.targetX - p.x, p.targetY - p.y)
          : 9999;
        if (dTarget <= 60) {
          const pending = s.pendingPlotAction;
          s.pendingPlotAction = null;
          if (stateRef) stateRef.current.pendingPlotAction = null;
          p.targetX = null;
          p.targetY = null;
          executePlotAction(s, pending.plotId, pending.tool);
          return;
        }
      }
    }
  }

  // ── KEYBOARD (desktop only) ──
  const hasKeys =
    s.keys.has("w") || s.keys.has("a") || s.keys.has("s") || s.keys.has("d") ||
    s.keys.has("arrowup") || s.keys.has("arrowdown") || s.keys.has("arrowleft") || s.keys.has("arrowright");
  if (hasKeys) {
    p.targetX = null;
    p.targetY = null;
    usingKeyboard = true;
    if (s.keys.has("w") || s.keys.has("arrowup"))    { dy -= speed; p.facing = "up"; }
    if (s.keys.has("s") || s.keys.has("arrowdown"))  { dy += speed; p.facing = "down"; }
    if (s.keys.has("a") || s.keys.has("arrowleft"))  { dx -= speed; p.facing = "left"; }
    if (s.keys.has("d") || s.keys.has("arrowright")) { dx += speed; p.facing = "right"; }
  }

  // Normalize diagonal speed
  if (usingKeyboard && dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }

  p.moving = dx !== 0 || dy !== 0;
  if (p.moving && p.tutorialStep === 0) p.tutorialStep = 1;

  // Footstep dust
  if (p.moving && s.time % 20 < 1) {
    spawnVFX(s, p.x, p.y + 10, "dust");
  }

  const collisions = MAP_COLLISIONS[s.currentMap];
  const { w, h } = MAP_SIZES[s.currentMap];
  let newX = p.x + dx;
  let newY = p.y + dy;

  // ── RESTRICTED MAPS: keep player within walkable zone (soft boundary) ──
  const walkableZones = MAP_WALKABLE_ZONES[s.currentMap];
  if (walkableZones && isInWalkableZone(p.x, p.y, s.currentMap)) {
    if (!isInWalkableZone(newX, newY, s.currentMap)) {
      // Try sliding along zone boundary instead of hard stop
      if (isInWalkableZone(newX, p.y, s.currentMap)) {
        newY = p.y;
      } else if (isInWalkableZone(p.x, newY, s.currentMap)) {
        newX = p.x;
      } else {
        // Fully blocked — cancel click target and stop
        newX = p.x;
        newY = p.y;
        p.targetX = null;
        p.targetY = null;
      }
    }
  }

  // ── COLLISION with world obstacles ──
  if (!collides(newX, newY, collisions)) {
    p.x = Math.max(16, Math.min(w - 16, newX));
    p.y = Math.max(16, Math.min(h - 16, newY));
  } else {
    if (!collides(newX, p.y, collisions)) {
      p.x = Math.max(16, Math.min(w - 16, newX));
    }
    if (!collides(p.x, newY, collisions)) {
      p.y = Math.max(16, Math.min(w - 16, newY));
    }
    // Nudge escape from corners
    if (collides(p.x, p.y, collisions)) {
      const nudge = 1.5;
      if      (!collides(p.x + nudge, p.y, collisions)) p.x += nudge;
      else if (!collides(p.x - nudge, p.y, collisions)) p.x -= nudge;
      else if (!collides(p.x, p.y + nudge, collisions)) p.y += nudge;
      else if (!collides(p.x, p.y - nudge, collisions)) p.y -= nudge;
    }
  }

  // ── FISHING MAP: DROWNING ──
  if (s.currentMap === "fishing") {
    const WATER_EDGE_Y = 305;
    if (p.y < WATER_EDGE_Y) {
      p.y = Math.min(p.y + 2.5, WATER_EDGE_Y - 2);
      p.x += (Math.random() - 0.5) * 0.8;
      p.moving = false;
      p.targetX = null;
      p.targetY = null;
      if (s.time % 10 < 1) spawnVFX(s, p.x + (Math.random() - 0.5) * 14, p.y, "bubble");
      if (!s._fishingDrownStart) s._fishingDrownStart = s.time;
      if (s.time - (s._fishingDrownStart || 0) > 2000) {
        p.x = 280;
        p.y = 490;
        s._fishingDrownStart = undefined;
        s.notification = { text: "YOU DROWNED! BACK TO DOCK...", life: 100 };
        s.fishBobber = { active: false, x: 0, y: 0, bobTimer: 0, biting: false, biteTimer: 0 };
        s.fishingSession = null;
      }
    } else {
      s._fishingDrownStart = undefined;
    }
  }
}

function updateCamera(s: GameState) {
  const cw = s.viewportW || 1280;
  const ch = s.viewportH || 720;
  const { w, h } = MAP_SIZES[s.currentMap];
  const coverZoom = Math.max(cw / w, ch / h);
  const lockedZoom = Math.max(coverZoom, 1.0);
  s.zoom = lockedZoom;
  s.targetZoom = lockedZoom;

  // Debug: log zoom issues
  if (lockedZoom > 2.0) {
    console.warn(`[Camera] High zoom detected: ${lockedZoom.toFixed(2)} viewport=${cw}x${ch} map=${w}x${h}`);
  }

  // Camera follows player position with smooth lerp
  let px = s.player.x;
  let py = s.player.y;

  // Calculate target camera position
  let targetX = px * s.zoom - cw / 2;
  let targetY = py * s.zoom - ch / 2;
  
  // Clamp to map bounds
  const maxCX = Math.max(0, w * s.zoom - cw);
  const maxCY = Math.max(0, h * s.zoom - ch);
  targetX = Math.max(0, Math.min(maxCX, targetX));
  targetY = Math.max(0, Math.min(maxCY, targetY));
  
  // Smooth follow with lerp
  s.cameraX = s.cameraX + (targetX - s.cameraX) * 0.25;
  s.cameraY = s.cameraY + (targetY - s.cameraY) * 0.25;
}

function updateZoom(s: GameState) {
  // Zoom is set dynamically in updateCamera to cover the viewport
  // No manual zoom changes allowed - game always fills screen
}

function updateCrops(s: GameState) {
  const now = getServerTime();
  const wiltMs = stressWiltThresholdMs(s.farmBalancePreset);
  s.farmPlots = s.farmPlots.map((plot) => {
    if (!plot.crop) {
      return plot.stressDrySince == null ? plot : { ...plot, stressDrySince: null };
    }

    let stressDrySince = plot.stressDrySince;

    if (!plot.watered) {
      if (stressDrySince == null) stressDrySince = now;
      const dryFor = now - stressDrySince;
      if (
        !plot.crop.ready &&
        !plot.crop.dead &&
        dryFor >= wiltMs
      ) {
        return {
          ...plot,
          stressDrySince,
          crop: { ...plot.crop, dead: true },
        };
      }
      return { ...plot, stressDrySince };
    }

    stressDrySince = null;

    const gtBase =
      CROP_GROW_TIMES[plot.crop.type] || plot.crop.growTime || 20000;
    const mult = s.farmingSpeedMultiplier || 1;
    const gt =
      (plot.fertilized ? Math.max(3000, gtBase / 2) : gtBase) * mult;
    const elapsed = Math.max(0, now - plot.crop.plantedAt);
    const prog = Math.min(elapsed / gt, 1);

    let stage: 0 | 1 | 2 | 3 | 4 = 0;
    if (prog >= 0.2) stage = 1;
    if (prog >= 0.45) stage = 2;
    if (prog >= 0.75) stage = 3;
    if (prog >= 1.0) stage = 4;

    if (stage > plot.crop.stage) {
      const cellW = FARM_GRID.cellW;
      const cellH = FARM_GRID.cellH;
      const cx = FARM_GRID.startX + plot.gridX * cellW + cellW / 2;
      const cy = FARM_GRID.startY + plot.gridY * cellH + cellH / 2;
      spawnVFX(s, cx, cy - 20, "plant");
    }

    return {
      ...plot,
      stressDrySince,
      crop: {
        ...plot.crop,
        growTime: gt,
        stage,
        ready: prog >= 1,
      },
    };
  });
}

function updateVFX(s: GameState) {
  s.vfxParticles = s.vfxParticles
    .map((p) => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vy: p.vy + 0.04,
      vx: p.vx * 0.985,
      life: p.life - 1,
      size: p.size * 0.99,
    }))
    .filter((p) => p.life > 0);
}

function updateDamageNumbers(s: GameState) {
  s.damageNumbers = s.damageNumbers
    .map((d) => ({
      ...d,
      y: d.y + (d.vy ?? -0.85),
      vy: (d.vy ?? -0.85) * 0.985,
      life: d.life - 1,
    }))
    .filter((d) => d.life > 0);
}
function updatePlayerAnim(s: GameState, dt: number) {
  const p = s.player;
  p.animTimer += dt;
  const frameTime = p.running ? 6 : 10;
  if (p.animTimer >= frameTime) {
    p.animTimer = 0;
    if (p.moving || p.targetX !== null) {
      const oldFrame = p.animFrame;
      p.animFrame = (p.animFrame + 1) % 4;
      
      // STEP SOUND & DUST TRAIL: Trigger on specific weight-down frames (1 and 3)
      if (p.animFrame !== oldFrame && (p.animFrame === 1 || p.animFrame === 3)) {
         if (s.currentMap !== "fishing") {
           AudioManager.playSFX("step", 0.28);
           spawnVFX(s, p.x, p.y, "dust"); // Soft dust puff
         }
      }
    } else {
      p.animFrame = 0;
    }
  }
}

function updateNotification(s: GameState, dt: number) {
  if (s.notification) {
    s.notification = { ...s.notification, life: s.notification.life - dt };
    if (s.notification.life <= 0) s.notification = null;
  }
}

function updateNPCs(s: GameState, _dt: number) {
  const { w } = MAP_SIZES.garden;
  const { min, max } = GARDEN_ROAD_Y;
  const roadY = (min + max) / 2;

  s.npcs = s.npcs.map((npc, i) => {
    const n = { ...npc };
    // Each NPC walks horizontally at fixed speed, bounces at edges
    if (n.vx === 0) {
      // Init direction: alternate left/right per NPC index
      n.vx = i % 2 === 0 ? 0.7 : -0.7;
    }
    n.x += n.vx;
    // Bounce at map edges
    if (n.x <= 60) { n.x = 60; n.vx = Math.abs(n.vx); }
    if (n.x >= w - 60) { n.x = w - 60; n.vx = -Math.abs(n.vx); }
    // Keep on road, no vertical drift
    n.y = roadY;
    n.vy = 0;
    return n;
  });
}

function updateFishing(s: GameState, dt: number) {
  const b = s.fishBobber;
  const newB = { ...b };
  newB.bobTimer += dt * 0.05;
  if (!newB.biting) {
    newB.biteTimer -= 1;
    if (newB.biteTimer <= 0) {
      newB.biting = true;
      newB.biteTimer = 60 + Math.random() * 90;
    }
  }
  s.fishBobber = newB;
}

let _pid = 0,
  _did = 0;

export function spawnVFX(
  s: GameState,
  x: number,
  y: number,
  type: "harvest" | "plant" | "water" | "coin" | "sparkle" | "fish" | "dust" | "flash" | "slash" | "bubble",
  facing?: "left" | "right" | "up" | "down",
) {
  const palettes: Record<string, string[]> = {
    harvest: ["#FFD700", "#FFA500", "#FF6347", "#FFFFFF"],
    plant: ["#90EE90", "#228B22", "#FFFFFF"],
    water: ["#03A9F4", "#B3E5FC", "#FFFFFF"],
    coin: ["#FFD700", "#FFC200", "#FFF"],
    sparkle: ["#FFEB3B", "#FFFFFF", "#FFC107"],
    bubble: ["#81D4FA", "#4FC3F7", "#B3E5FC", "#E1F5FE"],
    fish: ["#2196F3", "#B3E5FC", "#FFF"],
    dust: ["#8D6E63", "#5D4037", "#BCAAA4"],
    flash: ["#FFFFFF", "#FFF9C4"],
    slash: ["#E1F5FE", "#B3E5FC", "#FFFFFF"]
  };
  const c = palettes[type] || ["#FFF"];
  
  // REMOVED: flash effect (fire-like VFX)
  if (type === "flash") {
    return; // Disabled - no more fire effects
  }

  // MINIMAL particle count - removed ALL excessive effects
  const count = type === "dust" ? 3 : (type === "slash" ? 0 : 4); // slash = 0 particles!
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = type === "dust" ? 0.6 + Math.random() * 1.5 : (type === "slash" ? 0 : 2.0 + Math.random() * 4.5);
    
    s.vfxParticles.push({
      id: `p${s.particleId++}`,
      x: x + (Math.random() - 0.5) * 15,
      y: y + (Math.random() - 0.5) * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (type === "dust" ? 0.5 : 1.5),
      life: type === "dust" ? 35 + Math.random() * 25 : (type === "slash" ? 12 : 50 + Math.random() * 40),
      maxLife: type === "dust" ? 60 : (type === "slash" ? 12 : 90),
      color: c[Math.floor(Math.random() * c.length)],
      size: type === "dust" ? 4 + Math.random() * 6 : (type === "slash" ? 22 : 3 + Math.random() * 6),
      type: type === "water" ? "drop" : (type === "slash" ? "slash" : (type === "dust" ? "dust" : (type === "sparkle" ? "sparkle" : (type === "bubble" ? "bubble" : "leaf")))),
      ...(type === "slash" && facing ? { facing } : {}),
    });
  }
}

export function spawnText(
  s: GameState,
  x: number,
  y: number,
  text: string,
  color: string,
  vy?: number,
) {
  s.damageNumbers.push({
    id: `d${_did++}`,
    x,
    y,
    text,
    color,
    life: 95,
    maxLife: 95,
    vy: vy ?? -0.85,
  });
}

function updatePlayerAction(s: GameState, dt: number) {
  if (s.player.actionTimer > 0) {
    s.player.actionTimer -= dt;
    if (s.player.actionTimer <= 0) {
      s.player.action = null;
      s.farmingEngine = farmingEngineRelease();
    }
  }
}

export function handleToolAction(
  s: GameState,
  mouseX?: number,
  mouseY?: number,
): GameState {
  // [DEBUG] Log every tool action for Capacitor Inspect
  console.log(`[handleToolAction] tool=${s.player.tool ?? "null"} map=${s.currentMap} mouseX=${mouseX ?? "none"} mouseY=${mouseY ?? "none"} actionTimer=${s.player.actionTimer}`);

  let ns = {
    ...s,
    player: { ...s.player },
    farmPlots: [...s.farmPlots],
    vfxParticles: [...s.vfxParticles],
    damageNumbers: [...s.damageNumbers],
    trees: [...s.trees],
  };
  const { x: px, y: py, tool } = ns.player;

  // Fishing map — special handling (no click-to-move on fishing map)
  if (ns.currentMap === "fishing") {
    handleFishingAction(ns);
    return ns;
  }

  // Convert click canvas coords to world coords
  let tx = px,
    ty = py;
  if (mouseX !== undefined && mouseY !== undefined) {
    tx = (mouseX + ns.cameraX) / ns.zoom;
    ty = (mouseY + ns.cameraY) / ns.zoom;

    // ── WALKABLE ZONE SNAP ──
    // For maps with restricted areas (city roads, suburban roads, etc.)
    // smoothly route clicks to the nearest valid walkable spot.
    // No notification, no jarring stop — just smooth redirection.
    const snapped = snapToWalkableZone(tx, ty, ns.currentMap);
    tx = snapped.tx;
    ty = snapped.ty;

    ns.player.targetX = tx;
    ns.player.targetY = ty;
  }

  if (ns.currentMap === "suburban" && mouseX !== undefined && mouseY !== undefined) {
    for (const z of SUBURBAN_HOUSE_ZONES) {
      if (
        tx >= z.x &&
        tx <= z.x + z.w &&
        ty >= z.y &&
        ty <= z.y + z.h
      ) {
        ns.notification = {
          text: "You need a Suburban Key (NFT) to unlock this house. Stay tuned for Beta!",
          life: 130,
        };
        break;
      }
    }
  }

  // Non-farm maps: just move
  if (ns.currentMap !== "home") return ns;

  // No tool: give contextual guidance
  if (!tool) {
    // Smart hint based on farm state
    const hasReady = ns.farmPlots.some(p => p.crop?.ready);
    const hasDead = ns.farmPlots.some(p => p.crop?.dead);
    const needsWater = ns.farmPlots.some(p => p.crop && !p.watered && !p.crop.dead);
    const needsSeed = ns.farmPlots.some(p => p.tilled && !p.crop);
    const needsTill = ns.farmPlots.some(p => !p.tilled);
    if (hasReady) ns.notification = { text: "SELECT HOE (SLOT 1) TO HARVEST!", life: 100 };
    else if (hasDead) ns.notification = { text: "SELECT AXE (SLOT 2) TO CLEAR DEAD CROPS!", life: 100 };
    else if (needsWater) ns.notification = { text: "SELECT WATER CAN (SLOT 4) TO WATER CROPS!", life: 100 };
    else if (needsSeed) ns.notification = { text: "SELECT A SEED THEN TAP THE TILLED SOIL!", life: 100 };
    else if (needsTill) ns.notification = { text: "SELECT HOE (SLOT 1) THEN TAP SOIL TO TILL!", life: 100 };
    else ns.notification = { text: "SELECT A TOOL FROM THE TRAY BELOW!", life: 80 };
    return ns;
  }

  // Axe on trees/obstacles (before plot routing)
  if (tool === "axe" || tool === "axe-large") {
    const treeIdx = ns.trees.findIndex(
      (t) => Math.hypot(t.x - tx, t.y - ty) < 100,
    );
    if (treeIdx !== -1) {
      const tree = { ...ns.trees[treeIdx] };
      tree.hp -= tool === "axe-large" ? 2 : 1; // Mega axe is stronger!
      ns.player.action = tool;
      ns.player.actionTimer = 20;
      ns.shake = 12; // Visual impact!
      spawnVFX(ns, tree.x, tree.y - 40, "coin");
      if (tree.hp <= 0) {
        ns.player.gold += 15;
        ns.player.exp += 25;
        spawnText(ns, tree.x, tree.y - 60, "+15 GOLD", "#FFD700", -2);
        addEarnQuestProgress(ns, 15);
        ns.trees.splice(treeIdx, 1);
        ns.notification = {
          text: `${tree.type.toUpperCase()} CLEARED! +15G`,
          life: 100,
        };
      } else {
        ns.trees[treeIdx] = tree;
      }
      return ns;
    }
  }

  // Find clicked plot — first try exact hit, then nearest to player
  let targetPlot = ns.farmPlots.find((p) => {
    const wx = FARM_GRID.startX + p.gridX * FARM_GRID.cellW;
    const wy = FARM_GRID.startY + p.gridY * FARM_GRID.cellH;
    return (
      tx >= wx &&
      tx <= wx + FARM_GRID.cellW &&
      ty >= wy &&
      ty <= wy + FARM_GRID.cellH
    );
  });

  // Fallback: nearest plot to click point within generous range
  if (!targetPlot) {
    let bestDist = 200;
    for (const p of ns.farmPlots) {
      const pcx =
        FARM_GRID.startX + p.gridX * FARM_GRID.cellW + FARM_GRID.cellW / 2;
      const pcy =
        FARM_GRID.startY + p.gridY * FARM_GRID.cellH + FARM_GRID.cellH / 2;
      const d = Math.hypot(pcx - tx, pcy - ty);
      if (d < bestDist) {
        bestDist = d;
        targetPlot = p;
      }
    }
  }

  // Also check nearest to player position (for when player is standing on plot)
  if (!targetPlot) {
    let bestDist = 120;
    for (const p of ns.farmPlots) {
      const pcx =
        FARM_GRID.startX + p.gridX * FARM_GRID.cellW + FARM_GRID.cellW / 2;
      const pcy =
        FARM_GRID.startY + p.gridY * FARM_GRID.cellH + FARM_GRID.cellH / 2;
      const d = Math.hypot(pcx - px, pcy - py);
      if (d < bestDist) {
        bestDist = d;
        targetPlot = p;
      }
    }
  }

  if (!targetPlot) return ns;

  // Move player to the clicked position (not always plot center)
  // This ensures consistent behavior: click on land → character moves to that exact spot
  const plotCX = FARM_GRID.startX + targetPlot.gridX * FARM_GRID.cellW + FARM_GRID.cellW / 2;
  const plotCY = FARM_GRID.startY + targetPlot.gridY * FARM_GRID.cellH + FARM_GRID.cellH / 2;
  
  // Use the actual clicked position (tx, ty) as the movement target
  // This makes the behavior consistent: click anywhere → player moves there
  ns.player.targetX = tx;
  ns.player.targetY = ty;
  // Zoom already set above on first click - just follow character now

  // Only execute action immediately if player is already close enough
  const distToPlot = Math.hypot(plotCX - px, plotCY - py);
  if (distToPlot <= FARM_ACTION_RADIUS_PX) {
    // Snap player to plot center to guarantee radius validation passes
    ns.player.x = plotCX;
    ns.player.y = plotCY;
    const plotGate = validateFarmAction(ns, targetPlot.id, tool);
    if (!plotGate.ok) {
      ns.notification = {
        text: plotGate.reason.toUpperCase().slice(0, 40),
        life: 75,
      };
      ns.bubbleText = plotGate.reason;
      ns.player.targetX = null;
      ns.player.targetY = null;
      return ns;
    }
    spawnVFX(ns, ns.player.x, ns.player.y - 15, "slash", ns.player.facing);
    ns = executePlotAction(ns, targetPlot.id, tool);
  } else {
    ns.pendingPlotAction = { plotId: targetPlot.id, tool };
  }
  return ns;
}

function levelUpBannerMessage(newLevel: number, _diff: FarmBalancePreset): string {
  if (newLevel === 2) return "LEVEL UP! Tomato seeds unlocked!";
  if (newLevel === 3) return "LEVEL UP! Carrot seeds unlocked!";
  if (newLevel === 5) return "LEVEL UP! Pumpkin seeds unlocked!";
  return `LEVEL UP! Welcome to Level ${newLevel}!`;
}

function handleLevelUp(ns: GameState, px: number, py: number) {
  while (ns.player.exp >= ns.player.maxExp) {
    ns.player.level++;
    ns.player.exp -= ns.player.maxExp;
    ns.player.maxExp = Math.floor(ns.player.maxExp * 1.5);
    ns.player.maxHp += 5;
    ns.player.hp = Math.min(ns.player.hp + 5, ns.player.maxHp);
    spawnVFX(ns, px, py - 30, "sparkle");
    AudioManager.playSFX("levelUp");
    const msg = levelUpBannerMessage(ns.player.level, ns.farmBalancePreset);
    ns.notification = { text: msg.toUpperCase().slice(0, 48), life: 140 };
    ns.levelUpPopup = { message: msg, until: ns.time + 4500 };
    ns.pendingCloudSave = true;
  }
}

export function handleFishingAction(s: GameState) {
  if (s.fishingSession) {
    const fs = s.fishingSession;
    
    if (fs.state === "waiting" || fs.state === "casting") {
       s.fishingSession = null;
       s.notification = { text: "LINE RETRACTED", life: 60 };
       return;
    }
    if (fs.state === "failed" || fs.state === "success") {
       s.fishingSession = null;
       return;
    }
    handleFishingInput(s);
    return;
  }

  // Player must be near the dock area (y > 220 — anywhere on the dock/shore)
  if (s.player.y < 220) {
    s.notification = { text: "WALK TO THE DOCK TO FISH!", life: 80 };
    return;
  }

  const tx = s.player.x + (Math.random() * 60 - 30);
  const ty = Math.max(80, s.player.y - 160 - Math.random() * 60);
  
  s.player.action = "work";
  s.player.actionTimer = 45;
  AudioManager.playSFX("water");

  s.fishingSession = {
    state: "casting",
    timer: 600,
    bobberX: tx,
    bobberY: ty,
    struggleProgress: 50,
  };
}

export function handleFishingInput(s: GameState) {
  const fs = s.fishingSession;
  if (!fs) return;

  if (fs.state === "bite") {
    fs.state = "struggle";
    fs.struggleProgress = 45;
    AudioManager.playSFX("harvest");
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(120);
  } else if (fs.state === "struggle") {
    // Each tap gives solid progress — feels powerful
    fs.struggleProgress = Math.min(100, fs.struggleProgress + 18);
    AudioManager.playSFX("dig");
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([30]);
  }
}

function makeCrop(
  type: "wheat" | "tomato" | "carrot" | "pumpkin",
  time: number,
  farmBalancePreset: FarmBalancePreset,
): Crop {
  const preset = FARM_BALANCE_PRESETS[farmBalancePreset];
  const isRare = Math.random() < preset.rareChance;
  const growTime = CROP_GROW_TIMES[type] || 20000;

  return {
    id: `c${time}-${Math.random()}`,
    type,
    plantedAt: time,
    growTime,
    stage: 0,
    ready: false,
    isRare,
  };
}

export function switchMap(s: GameState, map: MapType): GameState {
  if (map === "suburban" && s.player.level < 3) {
    // If we're already NOT in suburban, this is a transition attempt that failed.
    // If we're just updating, don't keep adding shake.
    const isNewAttempt = s.currentMap !== "suburban";
    if (isNewAttempt) AudioManager.playSFX("fail");
    return {
      ...s,
      notification: isNewAttempt ? { text: "UNLOCKS AT LVL 3! KEEP FARMING!", life: 5000 } : s.notification,
      shake: isNewAttempt ? 10 : s.shake,
      activePanel: null,
    };
  }
  const ns = {
    ...s,
    currentMap: map,
    activePanel: null, // CLEAR POPUPS ON SWITCH
    farmingEngine: farmingEngineRelease(),
    gardenRemotePlayers: [],
    vfxParticles: [],
    damageNumbers: [],
    pointerCanvas: null,
    plotHoverFromPointer: null,
    plotJuice: null,
    fishingCatchHold: null,
    fishingRareFlash: null,
    gardenCritters: [],
    fishBobber: {
      active: false,
      x: 0,
      y: 0,
      bobTimer: 0,
      biting: false,
      biteTimer: 0,
    },
  };
  ns.player = { ...s.player, ...MAP_PLAYER_START[map] };
  ns.cameraX = 0;
  ns.cameraY = 0;
  rollMarketTrend(ns);
  
  // Ambient Music / Soundscape Logic
  if (map === "home") AudioManager.setMapAmbient("farm_wind");
  else if (map === "suburban") AudioManager.setMapAmbient("suburban_birds");
  else AudioManager.setMapAmbient("none");
  
  return ns;
}

function updateDemoLogic(s: GameState, dt: number) {
  // 1. WORLD TOUR TIMER (Switch map every 40 seconds)
  s.demoTimer = (s.demoTimer || 0) + dt;
  const mapCycle: MapType[] = ["home", "city", "garden", "suburban", "fishing"];
  const mapDuration = 40000; // Slower tour — 40 seconds per location
  const nextTargetIdx = Math.floor(s.demoTimer / mapDuration) % mapCycle.length;
  const nextMap = mapCycle[nextTargetIdx];

  if (s.currentMap !== nextMap) {
    Object.assign(s, switchMap(s, nextMap));
    // Refresh demo plots if returning home
    if (nextMap === "home") {
      const crops = ["wheat", "tomato", "pumpkin", "carrot", "wheat", "tomato"];
      s.farmPlots = s.farmPlots.map((p, i) => {
        if (i < 6)
          return {
            ...p,
            tilled: true,
            watered: true,
            crop: {
              id: `crop-${i}`,
              type: crops[i] as any,
              plantedAt: Date.now() - 100000,
              growTime: 60000,
              stage: 4,
              ready: true,
            },
          };
        return p;
      });
    }
  }

  // 2. Map-specific action dispatch
  if (s.currentMap === "home") {
    updateDemoLogicFarm(s, dt);
  } else if (s.currentMap === "city") {
    updateDemoLogicCity(s, dt);
  } else if (s.currentMap === "garden") {
    updateDemoLogicGarden(s, dt);
  } else if (s.currentMap === "suburban") {
    updateDemoLogicSuburban(s, dt);
  } else if (s.currentMap === "fishing") {
    updateDemoLogicFishing(s, dt);
  }
}

function updateDemoLogicFarm(s: GameState, dt: number) {
  s.demoTimer = (s.demoTimer || 0) + dt;
  const plotCount = Math.min(s.farmPlots.length, 6);
  const cyclePerPlot = 3000;
  const totalCycle = plotCount * cyclePerPlot;
  const globalPhase = s.demoTimer % totalCycle;

  const currentPlotIndex = Math.floor(globalPhase / cyclePerPlot);
  const phase = globalPhase % cyclePerPlot;
  const p = s.farmPlots[currentPlotIndex];
  if (!p) return;

  // Always compute from FARM_GRID — never trust stale worldX/worldY
  const plotCX = FARM_GRID.startX + p.gridX * FARM_GRID.cellW + FARM_GRID.cellW / 2;
  const plotCY = FARM_GRID.startY + p.gridY * FARM_GRID.cellH + FARM_GRID.cellH / 2;
  s.player.targetX = plotCX;
  s.player.targetY = plotCY;

  const cropTypes = ["wheat", "tomato", "pumpkin", "carrot"];
  const myCrop = cropTypes[currentPlotIndex % cropTypes.length];

  if (phase < 800) {
    s.player.tool = "hoe";
    if (phase > 600 && phase < 700 && !p.tilled)
      executePlotAction(s, p.id, "hoe");
  } else if (phase < 1600) {
    const seedTool = (myCrop + "-seed") as any;
    s.player.tool = seedTool;
    if (phase > 1400 && phase < 1500 && !p.crop)
      executePlotAction(s, p.id, seedTool);
  } else if (phase < 2400) {
    s.player.tool = "water";
    if (phase > 2200 && phase < 2300) executePlotAction(s, p.id, "water");
  } else {
    s.player.tool = "sickle";
    if (phase > 2800 && phase < 2900 && p.crop?.ready)
      executePlotAction(s, p.id, "sickle");
  }
}

function updateDemoLogicCity(s: GameState, dt: number) {
  const p = s.player;
  const shops = [
    { x: 130, label: "SEED MARKET", text: "BROWSING SEEDS...", buy: "WHEAT SEED", cost: 5, panel: "shop" },
  ];

  const phase = s.demoTimer % 40000;
  const shop = shops[0];

  p.targetX = shop.x;
  p.targetY = 460;
  p.tool = null;

  const dist = Math.abs(p.x - shop.x);
  if (dist < 15) {
    if (phase < 15000) {
      s.bubbleText = `CHECKING ${shop.label}... (E)`;
      // s.activePanel = shop.panel; // AUTO-OPEN DISABLED
    } else {
      s.bubbleText = `MOVING ON...`;
      s.activePanel = null; // AUTO CLOSE
      // Ready for next map
    }
  } else {
    // Keep shop closed while moving
    s.activePanel = null;
  }
}

function updateDemoLogicGarden(s: GameState, dt: number) {
  const p = s.player;
  const now = Date.now();
  const cx = 520,
    cy = 460;
  const angle = now / 3500;
  p.targetX = cx + Math.cos(angle) * 160;
  p.targetY = cy + Math.sin(angle) * 70;
  p.tool = null;
}

function updateDemoLogicSuburban(s: GameState, dt: number) {
  const p = s.player;
  const now = Date.now();
  p.targetX = 520 + Math.sin(now / 5000) * 450;
  p.targetY = 480;
  p.tool = null;
}

function updateDemoLogicFishing(s: GameState, dt: number) {
  const p = s.player;
  p.targetX = 520;
  p.targetY = 320;
  p.tool = null;
  p.facing = "up";
}
