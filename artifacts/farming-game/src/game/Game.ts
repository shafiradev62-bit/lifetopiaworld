export const ASSET_PATHS = {
  chibi: "/chibi_1774349990714.png",
  celurit: "/celurit_1774349990712.png",
  kapak: "/kapak_1774349990716.png",
  kapak1: "/kapak_1_1774349990715.png",
  karung: "/karung_1774349990717.png",
  home: "/home_1774349990715.jpg",
  kota: "/kota_1774349990717.png",
  mapCity: "/map_city_new.png",
  mapFishing: "/map_fishing_v2.png",
  mapGarden: "/map_garden_new.png",
  mapSuburban: "/map_suburban_v2.png",
  teko: "/teko_siram.png",
};

export type MapType = "home" | "city" | "fishing" | "garden" | "suburban";
export type ToolType =
  | "shovel"
  | "seed"
  | "tomato"
  | "water"
  | "axe"
  | "axe-large"
  | "hoe"
  | "sickle"
  | "play"
  | "work"
  | "fish"
  | "fertilizer"
  | "wheat-seed"
  | "tomato-seed"
  | "carrot-seed"
  | "pumpkin-seed";

/** Game difficulty: affects grow duration & sell value multipliers */
export type FarmBalancePreset = "easy" | "medium" | "hard";
export type CropType = "wheat" | "tomato" | "carrot" | "pumpkin";
export type CropTimingMap = Record<CropType | "corn", number>;

export interface Tree {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  type: "oak" | "pine" | "rock";
}

export interface Crop {
  id: string;
  type: CropType;
  plantedAt: number;
  growTime: number;
  stage: 0 | 1 | 2 | 3 | 4;
  ready: boolean;
  isRare?: boolean;
  /** Failed / withered — can be cleared with axe */
  dead?: boolean;
}

export type VFXType =
  | "dust"
  | "plant"
  | "harvest"
  | "coin"
  | "sparkle"
  | "flash"
  | "slash"
  | "drop"
  | "water"
  | "leaf"
  | "petal"
  | "bubble"
  | "shockwave";

export interface FarmPlot {
  id: string;
  /** Stable UUID for Supabase `plot_id` / sync */
  plotUuid: string;
  gridX: number;
  gridY: number;
  worldX: number;
  worldY: number;
  tilled: boolean;
  watered: boolean;
  fertilized: boolean;
  crop: Crop | null;
  /** Game time when drought stress began (crop exists, not watered) */
  stressDrySince: number | null;
}

export interface VFXParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: VFXType;
  /** For slash: which direction the arc should face (shoots toward player direction) */
  facing?: "left" | "right" | "up" | "down";
}

export interface DamageNumber {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy?: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: "harvest" | "plant" | "earn" | "chop" | "fish";
  target: number;
  current: number;
  reward: number;
  /** Objective reached — reward not yet claimed */
  completed: boolean;
  /** Reward taken (prevents spam); paired with localStorage / gold sync */
  claimed: boolean;
  /** If true, this quest resets every 24h */
  daily?: boolean;
}

export interface NPC {
  id: string;
  x: number;
  y: number;
  name: string;
  color: string;
  vx: number;
  vy: number;
  moveTimer: number;
  state: "idle" | "walking" | "sitting" | "waving";
  targetX?: number;
  targetY?: number;
  chatText?: string;
  chatTimer?: number;
  chatVisible?: boolean;
  map?: MapType;
  facing?: number;
  idleTimer?: number;
}

export interface FakePlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  vx: number;
  vy: number;
  color: string;
  level: number;
  map: MapType;
  moveTimer: number;
  action?: string;
  actionTimer?: number;
  facing: number;
}

export interface ActivityFeedItem {
  id: string;
  text: string;
  timestamp: number;
  type: "harvest" | "plant" | "level" | "trade";
}

export interface AmbientParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  type: "leaf" | "dust" | "sparkle" | "butterfly";
  size: number;
}

export interface FishBobber {
  active: boolean;
  x: number;
  y: number;
  bobTimer: number;
  biting: boolean;
  biteTimer: number;
}

export interface FishingCatchHold {
  until: number;
  tier: 0 | 1 | 2;
  gold: number;
}

export interface GardenCritter {
  id: string;
  kind: "butterfly" | "bird";
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
}

export interface LifeParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: "leaf" | "dust" | "butterfly" | "petal";
  color: string;
  rotation: number;
  rotVel: number;
}

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: "seed" | "tool" | "cosmetic";
  emoji: string;
  spriteUrl: string;
}

export interface CollisionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Locked house zones — suburban NFT teaser */
export const SUBURBAN_HOUSE_ZONES: CollisionRect[] = [
  { x: 200, y: 180, w: 140, h: 120 },
  { x: 700, y: 160, w: 160, h: 130 },
  { x: 480, y: 320, w: 120, h: 100 },
];

export interface GardenRemotePlayer {
  id: string;
  x: number;
  y: number;
}

export interface Footprint {
  x: number;
  y: number;
  facing: "left" | "right" | "up" | "down";
  life: number;
  maxLife: number;
  foot: "left" | "right";
}

export interface Collectible {
  id: string;
  map: MapType;
  x: number;
  y: number;
  kind: "coin" | "gem" | "star" | "mushroom" | "shell";
  collected: boolean;
  respawnAt: number;
  value: number;
}

export interface InteractiveSpot {
  id: string;
  map: MapType;
  x: number;
  y: number;
  label: string;
  action: "sit" | "sleep" | "read" | "dance" | "fish_spot" | "shop" | "dress";
  hint: string;
  color: string;
}

export interface GameState {
  player: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    level: number;
    exp: number;
    maxExp: number;
    gold: number;
    facing: "left" | "right" | "up" | "down";
    moving: boolean;
    speed: number;
    tool: ToolType | null;
    inventory: Record<string, number>;
    animFrame: number;
    animTimer: number;
    running: boolean;
    action: ToolType | null;
    actionTimer: number;
    targetX: number | null;
    targetY: number | null;
    tutorialStep: number;
    harvestCount: number; // Added to track 1st harvest unlock
    lifetopiaGold: number;
    walletAddress: string;
    jumpY: number; // For professional jump/flip mechanics
    jumpFlip: number;
    jumpCount: number;
    emote: "wave" | "dance" | "sit" | "laugh" | "cry" | "angry" | "sleep" | "eat" | "drink" | "cheer" | null;
    emoteUntil: number;
    emoteBubble: string | null;
    emoteBubbleUntil: number;
    nftEligibility: boolean;
    outfit: "default" | "farmer" | "city" | "suburban";
    chatText?: string;
    chatUntil?: number;
    isSitting?: boolean;
    sittingSpotId?: string;
  };
  currentMap: MapType;
  farmPlots: FarmPlot[];
  vfxParticles: VFXParticle[];
  damageNumbers: DamageNumber[];
  quests: Quest[];
  npcs: NPC[];
  fishBobber: FishBobber;
  zoom: number;
  targetZoom: number;
  cameraX: number;
  cameraY: number;
  keys: Set<string>;
  time: number;
  notification: { text: string; life: number } | null;
  bubbleText: string;
  shopOpen: boolean;
  shopItems: ShopItem[];
  fishingActive: boolean;
  seedCooldowns: Record<string, number>;
  particleId: number;
  damageId: number;
  trees: Tree[];
  footprints: Footprint[];
  hoveredPlotId: string | null;
  harvestLocked: boolean;
  pendingPlotAction: { plotId: string; tool: string } | null;
  demoMode: boolean;
  demoTimer: number;
  tutorialActive: boolean;
  showFarmDebugOverlay: boolean;
  farmBalancePreset: FarmBalancePreset;
  shake: number;
  /** Canvas pixels (match mouse on 1280×720 buffer) */
  pointerCanvas: { x: number; y: number } | null;
  /** Plot under cursor on farm (for hover outline) */
  plotHoverFromPointer: string | null;
  /** Squash/stretch juice on plot */
  plotJuice: { plotId: string; until: number } | null;
  farmingSpeedMultiplier: number;
  nftBoostActive: boolean;
  fishingCatchHold: FishingCatchHold | null;
  fishingRareFlash: string | null;
  gardenCritters: GardenCritter[];
  gardenActivePlayers: number;
  marketTrendCrop: CropType | null;
  marketTrendUntil: number;
  levelUpPopup: { message: string; until: number } | null;
  pendingCloudSave: boolean;
  /** Actual viewport dimensions for cover-mode camera (no black bars) */
  viewportW: number;
  viewportH: number;
  /** Whether a UI panel is open — suppresses canvas overlays */
  activePanel: string | null;
  farmingEngine:
    | { kind: "idle" }
    | {
        kind: "busy";
        plotId: string;
        plotUuid: string;
        toolKey: string;
      };
  gardenRemotePlayers: GardenRemotePlayer[];
  collectibles: Collectible[];
  weatherType: "none" | "rain" | "snow" | "petals";
  weatherIntensity: number;
  interactiveSpots: InteractiveSpot[];
  npcChatPool: Record<string, string[]>;
  worldEventText: string | null;
  worldEventUntil: number;
  fishingSession: {
    state: "casting" | "waiting" | "bite" | "struggle" | "success" | "failed";
    timer: number;
    bobberX: number;
    bobberY: number;
    struggleProgress: number;
    rarity?: "common" | "rare" | "exotic";
  } | null;
  /** Flag to track if camera has zoomed in (for one-time zoom) */
  _hasZoomedInThisSession?: boolean;
  /** Fishing map: timestamp when player started drowning (for respawn timer) */
  _fishingDrownStart?: number;
  mapTransition: {
    type: "none" | "fade-out" | "fade-in";
    progress: number;
    tip: string;
  };
  lifeParticles: LifeParticle[];
  /** Fake multiplayer system */
  fakePlayers: FakePlayer[];
  activityFeed: ActivityFeedItem[];
  ambientParticles: AmbientParticle[];
  /** Player presence enhancements */
  playerIdleTime: number;
  playerReaction: string | null;
  playerReactionUntil: number;

  // ═══════════════════════════════════════════════════════════════
  // RETENTION SYSTEM FIELDS
  // ═══════════════════════════════════════════════════════════════

  /** Daily login streak tracking */
  dailyStreak: DailyStreak;
  /** Token (premium currency) state */
  tokenState: TokenState;
  /** All milestones ever claimed (prevents double-claim) */
  claimedMilestones: number[];
  /** Last timestamp for daily reset check */
  lastDailyResetCheck: number;
  /** Active boost effects: { type: expiresAt } */
  activeBoosts: Record<string, number>;
  /** Total lifetime gold earned (for stats) */
  lifetimeGoldEarned: number;
  /** Daily action counter for soft caps */
  dailyActions: { date: string; count: number };
  /** Next daily quest refresh timestamp */
  nextDailyRefresh: number;
}

export const LOADING_TIPS = [
  "Tip: Rare fish sell for 3x Gold!",
  "Tip: Watering crops twice a day is a myth—once is enough!",
  "Tip: Visit the Garden to meet other players!",
  "Tip: Fertilized crops grow 2x faster!",
  "Tip: Check the market trend for bonus prices!",
  "Tip: Use the Axe to clear withered crops.",
  "Tip: The City Shop stocks new seeds daily!",
];

// ═══════════════════════════════════════════════════════════════
// RETENTION SYSTEM — DAILY STREAK & LOGIN REWARDS
// ═══════════════════════════════════════════════════════════════

export interface DailyStreak {
  /** Consecutive days played */
  consecutiveDays: number;
  /** Last login date (ISO date string YYYY-MM-DD) */
  lastLoginDate: string;
  /** Claimed today's reward yet */
  claimedToday: boolean;
  /** Claimed day 1..7 in current week */
  weeklyClaimed: number[];
}

export interface LoginReward {
  day: number;        // 1–7
  gold: number;
  item: string | null;
  label: string;
  /** Milestone bonus for special days */
  milestone?: string;
}

export const LOGIN_REWARDS: LoginReward[] = [
  { day: 1, gold: 15,  item: "wheat-seed:3",  label: "Day 1 — Bronze Welcome" },
  { day: 2, gold: 25,  item: "wheat-seed:5",  label: "Day 2 — Rising Star" },
  { day: 3, gold: 40,  item: "tomato-seed:3", label: "Day 3 — Growing Strong" },
  { day: 4, gold: 55,  item: "carrot-seed:2", label: "Day 4 — On Fire!", milestone: "FIRE" },
  { day: 5, gold: 75,  item: "carrot-seed:3", label: "Day 5 — Halfway Hero" },
  { day: 6, gold: 100, item: "pumpkin-seed:2",label: "Day 6 — Almost Legend", milestone: "STAR" },
  { day: 7, gold: 150, item: "pumpkin-seed:3",label: "Day 7 — Weekly Champion!", milestone: "CROWN" },
];

export const MAX_STREAK_WEEKS = 4; // Reset streak grace after 4 missed days

// ═══════════════════════════════════════════════════════════════
// PROGRESSION — LEVEL MILESTONE REWARDS
// ═══════════════════════════════════════════════════════════════

export interface LevelMilestone {
  level: number;
  reward: number;     // gold bonus
  bonusItem?: string;
  description: string;
  /** Unlock feature name */
  unlock?: string;
}

export const LEVEL_MILESTONES: LevelMilestone[] = [
  { level: 2,  reward: 20,  description: "Unlocked: Tomato Seeds!", unlock: "tomato-seed" },
  { level: 3,  reward: 30,  description: "Suburban map unlocked!", unlock: "suburban" },
  { level: 5,  reward: 50,  description: "Pumpkin Seeds & faster tools!", unlock: "pumpkin-seed" },
  { level: 8,  reward: 60,  description: "Rare crop chance increased!" },
  { level: 10, reward: 80,  description: "Super Growth (Fertilizer) discounted!", unlock: "fertilizer" },
  { level: 15, reward: 100, description: "Speed bonus +10%!", unlock: "speed_bonus" },
  { level: 20, reward: 150, description: "Golden sickle available!", unlock: "sickle-gold" },
  { level: 25, reward: 200, description: "VIP shop access unlocked!", unlock: "vip_shop" },
  { level: 30, reward: 300, description: "Legendary farming gear!", unlock: "legendary" },
];

export function getMilestoneForLevel(level: number): LevelMilestone | null {
  return LEVEL_MILESTONES.find(m => m.level === level) ?? null;
}

export function getNextMilestone(currentLevel: number): LevelMilestone | null {
  const next = LEVEL_MILESTONES.find(m => m.level > currentLevel);
  return next ?? null;
}

// ═══════════════════════════════════════════════════════════════
// ECONOMY SCALING — COST & REWARD CURVES
// ═══════════════════════════════════════════════════════════════

/**
 * Soft-cap player level. Beyond this, EXP required grows faster.
 * Formula: maxExp = baseExp * 1.5^level * softCapMultiplier
 * Soft cap kicks in after level 20.
 */
export const SOFT_CAP_LEVEL = 20;
export const SOFT_CAP_MULTIPLIER = 2.5;

export function getExpRequiredForLevel(level: number): number {
  if (level <= SOFT_CAP_LEVEL) {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }
  const baseAtCap = Math.floor(100 * Math.pow(1.5, SOFT_CAP_LEVEL - 1));
  const extraLevels = level - SOFT_CAP_LEVEL;
  return Math.floor(baseAtCap * SOFT_CAP_MULTIPLIER * Math.pow(1.8, extraLevels));
}

/**
 * Seed cost scales with player level (exponential soft-cap).
 * Starting price * (1 + level * 0.08)^0.7 (diminishing returns)
 */
export function getScaledSeedPrice(basePrice: number, playerLevel: number): number {
  const scale = Math.pow(1 + playerLevel * 0.08, 0.7);
  return Math.ceil(basePrice * scale);
}

/**
 * Reward multiplier based on level (diminishing returns).
 * Early game: fast rewards. Late game: slower but meaningful.
 */
export function getLevelRewardMultiplier(level: number): number {
  if (level <= 5) return 1.0 + (level - 1) * 0.05;  // 1.0 → 1.2
  if (level <= 15) return 1.2 + (level - 5) * 0.025; // 1.2 → 1.45
  return 1.45 + (level - 15) * 0.01;                  // 1.45 → capped ~1.8
}

/**
 * Gold sink: cost to expand farm plots (future feature).
 * Exponential — ensures late-game sink.
 */
export function getPlotUnlockCost(plotCount: number): number {
  return Math.floor(50 * Math.pow(2.2, plotCount));
}

// ═══════════════════════════════════════════════════════════════
// SESSION HOOK — "Welcome Back" / "Rewards Ready" state
// ═══════════════════════════════════════════════════════════════

export interface SessionHook {
  /** Crops are ready to harvest right now */
  cropsReady: boolean;
  /** Login reward available to claim */
  loginRewardAvailable: boolean;
  /** How many quests are complete and unclaimed */
  questCountReady: number;
  /** Total reward gold waiting */
  totalRewardGold: number;
  /** Player's current streak */
  streakDays: number;
  /** Encouragement message */
  welcomeMessage: string;
}

export function buildSessionHook(state: GameState, streak: DailyStreak): SessionHook {
  const readyCrops = state.farmPlots.filter(p => p.crop?.ready).length;
  const claimableQuests = state.quests.filter(q => q.completed && !q.claimed).length;
  const pendingGold = state.quests.filter(q => q.completed && !q.claimed).reduce((sum, q) => sum + q.reward, 0);

  // Welcome message based on context
  let message = "Welcome back, farmer!";
  if (readyCrops > 0) message = `Harvest ${readyCrops} ready crop${readyCrops > 1 ? "s" : ""}!`;
  else if (claimableQuests > 0) message = `${claimableQuests} quest${claimableQuests > 1 ? "s" : ""} ready to claim!`;
  else if (streak.consecutiveDays > 1) message = `Day ${streak.consecutiveDays} streak! Keep going!`;
  else if (state.player.gold > 100) message = "Your farm is prospering!";
  else message = "Start farming — every action earns!";

  return {
    cropsReady: readyCrops > 0,
    loginRewardAvailable: !streak.claimedToday,
    questCountReady: claimableQuests,
    totalRewardGold: pendingGold,
    streakDays: streak.consecutiveDays,
    welcomeMessage: message,
  };
}

// ═══════════════════════════════════════════════════════════════
// RESOURCE LAYER — Second currency "LIFETOPIA TOKENS" (optional)
// ═══════════════════════════════════════════════════════════════

export interface TokenState {
  tokens: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}

// Token sources: milestone completions, streak bonuses, rare events
// Token sinks: cosmetic unlocks, speed boosts, special items
export const TOKEN_ITEM_CATALOG: Record<string, { cost: number; name: string; type: "cosmetic" | "boost" | "convenience" }> = {
  "avatar_frame_bronze": { cost: 50,  name: "Bronze Frame", type: "cosmetic" },
  "avatar_frame_silver": { cost: 150, name: "Silver Frame", type: "cosmetic" },
  "avatar_frame_gold":   { cost: 300, name: "Gold Frame",   type: "cosmetic" },
  "speed_boost_1h":       { cost: 80,  name: "1hr Speed Boost", type: "boost" },
  "double_exp_1h":        { cost: 100, name: "1hr 2x EXP",     type: "boost" },
  "inventory_expand":     { cost: 200, name: "Inventory +5",   type: "convenience" },
};

// ═══════════════════════════════════════════════════════════════
// RETENTION STATE — Extended GameState fields
// ═══════════════════════════════════════════════════════════════


/** GDD base grow times (ms) - Harvest Moon style
 * wheat: 2 min, tomato: 4 min, carrot: 6 min, pumpkin: 8 min */
export const CROP_BASE_GROW_MS: Record<CropType, number> = {
  wheat: 120000,
  tomato: 240000,
  carrot: 360000,
  pumpkin: 480000,
};

/** Base sell gold before difficulty multiplier */
export const CROP_BASE_SELL_GOLD: Record<CropType, number> = {
  wheat: 5,
  tomato: 10,
  carrot: 15,
  pumpkin: 25,
};

export const CROP_HARVEST_XP: Record<CropType, number> = {
  wheat: 10,
  tomato: 20,
  carrot: 35,
  pumpkin: 55,
};

export const FARM_BALANCE_PRESETS: Record<
  FarmBalancePreset,
  {
    growTimeMultiplier: number;
    goldRewardMultiplier: number;
    expMultiplier: number;
    playerSpeedBonus: number;
    rareChance: number;
    seedPriceExtra: Partial<Record<string, number>>;
  }
> = {
  easy: {
    growTimeMultiplier: 1.0,
    goldRewardMultiplier: 1.0,
    expMultiplier: 1.0,
    playerSpeedBonus: 0,
    rareChance: 0.08,
    seedPriceExtra: {},
  },
  medium: {
    growTimeMultiplier: 1.5,
    goldRewardMultiplier: 2.0,
    expMultiplier: 1.15,
    playerSpeedBonus: 0,
    rareChance: 0.12,
    seedPriceExtra: { "carrot-seed": 1.35, "pumpkin-seed": 1.55 },
  },
  hard: {
    growTimeMultiplier: 2.0,
    goldRewardMultiplier: 5.0,
    expMultiplier: 1.35,
    playerSpeedBonus: 0,
    rareChance: 0.18,
    seedPriceExtra: { "carrot-seed": 1.7, "pumpkin-seed": 2.1 },
  },
};

export const CROP_GROW_TIMES: CropTimingMap = {
  wheat: CROP_BASE_GROW_MS.wheat,
  tomato: CROP_BASE_GROW_MS.tomato,
  carrot: CROP_BASE_GROW_MS.carrot,
  pumpkin: CROP_BASE_GROW_MS.pumpkin,
  corn: 140000,
};

export const CROP_GOLD_REWARDS: CropTimingMap = {
  wheat: CROP_BASE_SELL_GOLD.wheat,
  tomato: CROP_BASE_SELL_GOLD.tomato,
  carrot: CROP_BASE_SELL_GOLD.carrot,
  pumpkin: CROP_BASE_SELL_GOLD.pumpkin,
  corn: 12,
};

export function applyFarmBalancePreset(
  preset: FarmBalancePreset,
  options?: { overwriteGlobals?: boolean },
): { growTimes: CropTimingMap; goldRewards: CropTimingMap; expMultiplier: number; speedBonus: number } {
  const sel = FARM_BALANCE_PRESETS[preset];
  const growTimes: CropTimingMap = {
    wheat: Math.round(CROP_BASE_GROW_MS.wheat * sel.growTimeMultiplier),
    tomato: Math.round(CROP_BASE_GROW_MS.tomato * sel.growTimeMultiplier),
    carrot: Math.round(CROP_BASE_GROW_MS.carrot * sel.growTimeMultiplier),
    pumpkin: Math.round(CROP_BASE_GROW_MS.pumpkin * sel.growTimeMultiplier),
    corn: Math.round(140000 * sel.growTimeMultiplier),
  };
  const goldRewards: CropTimingMap = {
    wheat: Math.round(CROP_BASE_SELL_GOLD.wheat * sel.goldRewardMultiplier),
    tomato: Math.round(CROP_BASE_SELL_GOLD.tomato * sel.goldRewardMultiplier),
    carrot: Math.round(CROP_BASE_SELL_GOLD.carrot * sel.goldRewardMultiplier),
    pumpkin: Math.round(CROP_BASE_SELL_GOLD.pumpkin * sel.goldRewardMultiplier),
    corn: Math.round(12 * sel.goldRewardMultiplier),
  };

  if (options?.overwriteGlobals !== false) {
    Object.assign(CROP_GROW_TIMES, growTimes);
    Object.assign(CROP_GOLD_REWARDS, goldRewards);
  }

  return {
    growTimes,
    goldRewards,
    expMultiplier: sel.expMultiplier,
    speedBonus: sel.playerSpeedBonus,
  };
}

export function getFarmBalancePreset(
  growTimes: Partial<CropTimingMap>,
): FarmBalancePreset {
  for (const name of ["easy", "medium", "hard"] as FarmBalancePreset[]) {
    applyFarmBalancePreset(name, { overwriteGlobals: false });
    const probe = FARM_BALANCE_PRESETS[name];
    const g = {
      wheat: Math.round(CROP_BASE_GROW_MS.wheat * probe.growTimeMultiplier),
      tomato: Math.round(CROP_BASE_GROW_MS.tomato * probe.growTimeMultiplier),
      carrot: Math.round(CROP_BASE_GROW_MS.carrot * probe.growTimeMultiplier),
      pumpkin: Math.round(CROP_BASE_GROW_MS.pumpkin * probe.growTimeMultiplier),
    };
    const same =
      g.wheat === growTimes.wheat &&
      g.tomato === growTimes.tomato &&
      g.carrot === growTimes.carrot &&
      g.pumpkin === growTimes.pumpkin;
    if (same) return name;
  }
  return "medium";
}

/**
 * Crop gates (all difficulties): Wheat 1, Tomato 2+, Carrot 3+, Pumpkin 5+.
 * `difficulty` retained for API compatibility; multipliers still from preset.
 */
export function seedUnlockLevel(
  crop: CropType,
  _difficulty: FarmBalancePreset,
): number {
  // All crops unlocked from level 1 — player can see and buy all seeds
  return 1;
}

/** Medium/Hard drought stress — ms without water before wither */
export function stressWiltThresholdMs(preset: FarmBalancePreset): number {
  if (preset === "easy") return 20000;
  if (preset === "medium") return 7500;
  return 5000;
}

export function isCropPlantingUnlocked(
  crop: CropType,
  playerLevel: number,
  difficulty: FarmBalancePreset,
): boolean {
  return playerLevel >= seedUnlockLevel(crop, difficulty);
}

export function toolIdToCrop(tool: string): CropType | null {
  if (tool.includes("wheat")) return "wheat";
  if (tool.includes("tomato")) return "tomato";
  if (tool.includes("carrot")) return "carrot";
  if (tool.includes("pumpkin")) return "pumpkin";
  return null;
}

export function getShopSeedPrice(
  itemId: string,
  basePrice: number,
  difficulty: FarmBalancePreset,
): number {
  const extra = FARM_BALANCE_PRESETS[difficulty].seedPriceExtra[itemId] ?? 1;
  return Math.ceil(basePrice * extra);
}

export const CROP_STAGES_COLORS: Record<string, string[]> = {
  wheat: ["#C8B058", "#DAA520", "#FFD700"],
  tomato: ["#90EE90", "#FF6347", "#FF2200"],
  carrot: ["#90EE90", "#FF8C00", "#FF6600"],
  pumpkin: ["#90EE90", "#FF8C00", "#FF4500"],
};

export const MAP_SIZES: Record<MapType, { w: number; h: number }> = {
  home: { w: 1040, h: 585 },
  city: { w: 1040, h: 585 },
  fishing: { w: 1040, h: 585 },
  garden: { w: 1040, h: 585 },
  suburban: { w: 1040, h: 585 },
};

export const MAP_PLAYER_START: Record<MapType, { x: number; y: number }> = {
  home: { x: 488, y: 290 }, // Center of farm soil area
  city: { x: 520, y: 470 },
  fishing: { x: 280, y: 490 },
  garden: { x: 520, y: 460 },
  suburban: { x: 120, y: 480 },
};

export const GARDEN_ROAD_Y = { min: 420, max: 520 };

/**
 * Per-map walkable zone definitions (used for click-to-move validation).
 * Only for maps that restrict where the player can walk.
 * Each entry is a CollisionRect representing a walkable area.
 * null = no restriction (all ground is walkable, use MAP_COLLISIONS for obstacles).
 *
 * City & Suburban use wide overlapping bands + corridors so player can
 * click anywhere and be smoothly routed to a valid road spot.
 */
export const MAP_WALKABLE_ZONES: Partial<Record<MapType, CollisionRect[] | null>> = {
  home: null,          // All grass/soil walkable; MAP_COLLISIONS.home blocks obstacles only
  city: [
    // Sidewalk in front of shops (y:440-560)
    { x: 30, y: 440, w: 980, h: 120 },
    // Left corridor
    { x: 30, y: 168, w: 80, h: 400 },
    // Right corridor
    { x: 930, y: 168, w: 80, h: 400 },
  ],
  fishing: [
    // Dock/land only — water at y < 305 is death
    { x: 0, y: 305, w: 1040, h: 280 },
  ],
  garden: null,        // All garden ground walkable; MAP_COLLISIONS.garden blocks obstacles
  suburban: [
    // Top road band with overlap to allow crossing between two roads
    { x: 30, y: 390, w: 980, h: 130 },
  ],
};

export const MAP_COLLISIONS: Record<MapType, CollisionRect[]> = {
  home: [
    // Map boundaries
    { x: 0, y: 0, w: 1040, h: 30 },
    { x: 0, y: 0, w: 30, h: 585 },
    { x: 1010, y: 0, w: 30, h: 585 },
    { x: 0, y: 560, w: 1040, h: 25 },
    // House/farmhouse — only covers actual house area (x:350-960, y:0-165)
    { x: 350, y: 0, w: 610, h: 165 },
    // Trees
    { x: 100, y: 310, w: 50, h: 65 },   // tree1 (oak)
    { x: 78, y: 462, w: 50, h: 68 },    // tree2 (pine)
    { x: 900, y: 260, w: 50, h: 65 },   // tree3 (oak)
    // Rocks
    { x: 832, y: 420, w: 40, h: 45 },   // rock1
    { x: 182, y: 120, w: 40, h: 45 },  // rock2
  ],
  city: [
    // Map boundaries
    { x: 0, y: 0, w: 1040, h: 30 },
    { x: 0, y: 0, w: 30, h: 585 },
    { x: 1010, y: 0, w: 30, h: 585 },
    { x: 0, y: 560, w: 1040, h: 25 },
    // Buildings — only block above the sidewalk (y:0 to y:430)
    { x: 200, y: 0, w: 190, h: 430 },
    { x: 415, y: 0, w: 180, h: 430 },
    { x: 620, y: 0, w: 220, h: 430 },
    { x: 0, y: 0, w: 180, h: 430 },
    { x: 860, y: 0, w: 180, h: 430 },
  ],
  fishing: [
    // Map boundaries
    { x: 0, y: 0, w: 30, h: 585 },
    { x: 1010, y: 0, w: 30, h: 585 },
    { x: 0, y: 560, w: 1040, h: 25 },
    // WATER = DEATH ZONE — collision wall at y:300 means player cannot enter water
    // Player must stay on dock/land (y:300-585)
    { x: 0, y: 0, w: 1040, h: 300 },
  ],
  garden: [
    // Map boundaries
    { x: 0, y: 0, w: 1040, h: 30 },
    { x: 0, y: 0, w: 30, h: 585 },
    { x: 1010, y: 0, w: 30, h: 585 },
    { x: 0, y: 560, w: 1040, h: 25 },
    // Fountain obstacle in center social plaza
    { x: 455, y: 295, w: 90, h: 90 },
    // Trees on left side of garden
    { x: 120, y: 230, w: 55, h: 65 },
    { x: 80, y: 380, w: 55, h: 65 },
    // Tree on right side
    { x: 860, y: 260, w: 55, h: 65 },
    { x: 890, y: 400, w: 55, h: 65 },
  ],
  suburban: [
    // Map boundaries
    { x: 0, y: 0, w: 30, h: 585 },
    { x: 1010, y: 0, w: 30, h: 585 },
    // TOP houses barrier — player cannot walk into house area (y:0-420)
    { x: 0, y: 0, w: 1040, h: 420 },
    // BOTTOM yards barrier — player cannot walk into yard area (y:520-585)
    { x: 0, y: 520, w: 1040, h: 65 },
    // Individual house collision boxes (houses are on the TOP area, already blocked by above)
    // But let's add them so visually accurate:
    { x: 200, y: 180, w: 140, h: 120 },
    { x: 700, y: 160, w: 160, h: 130 },
    { x: 480, y: 320, w: 120, h: 100 },
  ],
};

export const SHOP_ITEMS: ShopItem[] = [
  { id: "wheat-seed", name: "Wheat Seed", price: 2, type: "seed", emoji: "🌾", spriteUrl: "/wheat.png" },
  { id: "tomato-seed", name: "Tomato Seed", price: 5, type: "seed", emoji: "🍅", spriteUrl: "/tomato.png" },
  { id: "carrot-seed", name: "Carrot Seed", price: 8, type: "seed", emoji: "🥕", spriteUrl: "/carrot.png" },
  { id: "pumpkin-seed", name: "Pumpkin Seed", price: 12, type: "seed", emoji: "🎃", spriteUrl: "/pumpkin.png" },
  { id: "water", name: "Watering Can", price: 15, type: "tool", emoji: "💧", spriteUrl: "/teko_siram.png" },
  { id: "fertilizer", name: "Super Growth", price: 10, type: "tool", emoji: "✨", spriteUrl: "/karung_1774349990717.png" },
  { id: "axe", name: "Wood Axe", price: 25, type: "tool", emoji: "🪓", spriteUrl: "/kapak_1774349990716.png" },
  { id: "hoe", name: "Steel Hoe", price: 30, type: "tool", emoji: "⛏️", spriteUrl: "/celurit_1774349990712.png" },
];

export const FARM_GRID = {
  cols: 3,
  rows: 2,
  cellW: 83,
  cellH: 68,
  startX: 197,
  startY: 259,
};

export function farmPlotIsActionable(
  plot: FarmPlot,
  tool: string | null,
): boolean {
  if (!tool) return false;

  // Axe: Clear crops (dead or alive) OR untill/reset the soil
  if (tool === "axe" || tool === "axe-large") {
    return plot.tilled || !!plot.crop;
  }

  // Soil tools (Hoe, Sickle, Shovel): Till the earth OR harvest ready crops
  const isSoil = tool === "hoe" || tool === "shovel" || tool === "sickle" || tool === "sickle-gold";
  if (isSoil) {
    if (!plot.tilled) return true; // Can till
    if (plot.crop?.ready) return true; // Can harvest
    return false;
  }

  // Water: Any tilled plot, with or without crop, as long as it's dry
  if (tool === "water") {
    return plot.tilled && !plot.watered;
  }

  // Fertilizer: Any tilled plot that hasn't been boosted yet
  if (tool === "fertilizer") {
    return plot.tilled && !plot.fertilized;
  }

  // Seeds: Only on tilled, empty soil — allow through validation so executePlotAction can give helpful message
  if (tool.endsWith("-seed")) {
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// RETENTION UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

const STREAK_STORAGE_KEY = "lifetopia_daily_streak";

export function loadDailyStreak(wallet: string): DailyStreak {
  try {
    const raw = localStorage.getItem(`${STREAK_STORAGE_KEY}_${wallet}`);
    if (!raw) return createFreshStreak();
    return JSON.parse(raw) as DailyStreak;
  } catch {
    return createFreshStreak();
  }
}

export function saveDailyStreak(wallet: string, streak: DailyStreak) {
  try {
    localStorage.setItem(`${STREAK_STORAGE_KEY}_${wallet}`, JSON.stringify(streak));
  } catch { /* ignore */ }
}

function createFreshStreak(): DailyStreak {
  return {
    consecutiveDays: 0,
    lastLoginDate: "",
    claimedToday: false,
    weeklyClaimed: [],
  };
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function checkAndUpdateStreak(streak: DailyStreak): DailyStreak {
  const today = todayDateStr();
  const yesterday = yesterdayDateStr();

  if (streak.lastLoginDate === today) {
    // Same day — no change
    return streak;
  } else if (streak.lastLoginDate === yesterday) {
    // Consecutive day — increment streak
    return {
      ...streak,
      consecutiveDays: streak.consecutiveDays + 1,
      lastLoginDate: today,
      claimedToday: false,
    };
  } else {
    // Streak broken — reset but keep small grace bonus
    const graceBonus = streak.consecutiveDays > 3 ? 2 : 0; // Keep 2 days if long streak
    return {
      ...streak,
      consecutiveDays: graceBonus,
      lastLoginDate: today,
      claimedToday: false,
      weeklyClaimed: [],
    };
  }
}

export function getLoginRewardForStreak(streak: DailyStreak): LoginReward | null {
  if (streak.claimedToday) return null;
  const day = Math.min(streak.consecutiveDays, 7);
  if (day < 1) return null;
  return LOGIN_REWARDS[day - 1] ?? LOGIN_REWARDS[6]; // Cap at day 7 reward
}

export function claimLoginReward(
  state: GameState,
  streak: DailyStreak,
): { reward: LoginReward; gold: number; item: string | null } | null {
  const reward = getLoginRewardForStreak(streak);
  if (!reward) return null;

  // Add gold
  state.player.gold += reward.gold;
  state.lifetimeGoldEarned += reward.gold;

  // Parse and add item rewards
  let item: string | null = null;
  if (reward.item) {
    const [itemId, count] = reward.item.split(":");
    if (itemId && count) {
      state.player.inventory[itemId] = (state.player.inventory[itemId] ?? 0) + parseInt(count, 10);
      item = `${count}x ${itemId}`;
    }
  }

  // Mark claimed
  streak.claimedToday = true;
  streak.weeklyClaimed = streak.weeklyClaimed || [];
  streak.weeklyClaimed.push(reward.day);

  return { reward, gold: reward.gold, item };
}

/**
 * Check daily quest reset — if more than 24h since last check,
 * reset all quests and bump dailyActions counter.
 */
export function checkDailyReset(state: GameState): boolean {
  const now = Date.now();
  const lastCheck = state.lastDailyResetCheck || 0;
  const MS_24H = 86400000;

  if (now - lastCheck < MS_24H) return false;

  // Reset quests
  state.quests = state.quests.map(q => ({
    ...q,
    current: 0,
    completed: false,
    claimed: false,
  }));

  // Reset daily actions counter
  state.dailyActions = { date: todayDateStr(), count: 0 };

  // Reset cooldowns
  state.seedCooldowns = {};

  state.lastDailyResetCheck = now;
  state.nextDailyRefresh = now + MS_24H;

  return true; // Did reset
}

/**
 * Apply level milestone reward. Returns reward info or null if already claimed.
 */
export function applyMilestoneReward(
  state: GameState,
  milestone: LevelMilestone,
): boolean {
  if (state.claimedMilestones.includes(milestone.level)) return false;

  state.player.gold += milestone.reward;
  state.lifetimeGoldEarned += milestone.reward;
  state.claimedMilestones.push(milestone.level);

  if (milestone.bonusItem) {
    const [itemId, count] = milestone.bonusItem.split(":");
    if (itemId) {
      state.player.inventory[itemId] = (state.player.inventory[itemId] ?? 0) + (parseInt(count || "1", 10));
    }
  }

  // Bonus unlock: activate boost directly
  if (milestone.unlock === "speed_bonus") {
    state.player.speed += 0.3;
  }

  return true;
}

/**
 * Calculate total daily action soft cap.
 * After cap, rewards are reduced by 40% (still meaningful, just slower).
 */
export function getDailyActionCap(playerLevel: number): number {
  return 30 + playerLevel * 2; // 32 at level 1, 70 at level 20
}

export function isDailyActionCapped(state: GameState): boolean {
  const today = todayDateStr();
  const cap = getDailyActionCap(state.player.level);
  return state.dailyActions.date === today && state.dailyActions.count >= cap;
}

export function recordDailyAction(state: GameState) {
  const today = todayDateStr();
  if (state.dailyActions.date !== today) {
    state.dailyActions = { date: today, count: 0 };
  }
  state.dailyActions.count++;
}

/**
 * Scaled reward — applies daily cap penalty and level multiplier.
 */
export function getScaledReward(baseGold: number, state: GameState): number {
  const capped = isDailyActionCapped(state);
  const levelMult = getLevelRewardMultiplier(state.player.level);
  const scaled = baseGold * levelMult;
  return capped ? Math.floor(scaled * 0.6) : Math.floor(scaled);
}

/**
 * Get progress bar data for UI rendering.
 * Returns { current, max, percentage, nextMilestone, nextMilestoneProgress }
 */
export function getProgressionData(state: GameState) {
  const nextMilestone = getNextMilestone(state.player.level);
  const progressToNext = nextMilestone
    ? Math.min(100, (state.player.level / nextMilestone.level) * 100)
    : 100;

  return {
    level: state.player.level,
    exp: state.player.exp,
    maxExp: state.player.maxExp,
    expPct: Math.floor((state.player.exp / state.player.maxExp) * 100),
    nextMilestone,
    progressToNextMilestone: progressToNext,
    gold: state.player.gold,
    lifetimeGold: state.lifetimeGoldEarned,
  };
}

/**
 * Check active boosts and clean up expired ones.
 */
export function getActiveBoostDescriptions(state: GameState): string[] {
  const now = Date.now();
  const active: string[] = [];

  for (const [boost, expiresAt] of Object.entries(state.activeBoosts)) {
    if (now < expiresAt) {
      const remaining = Math.ceil((expiresAt - now) / 60000);
      active.push(`${boost.replace(/_/g, " ")} (${remaining}m)`);
    }
  }

  return active;
}

export function activateBoost(state: GameState, boostType: string, durationMs: number) {
  const now = Date.now();
  state.activeBoosts[boostType] = now + durationMs;

  if (boostType === "speed_boost_1h") {
    state.player.speed += 0.5;
  } else if (boostType === "double_exp_1h") {
    // Applied in harvest/plant XP calculations
  }
}

export function cleanupExpiredBoosts(state: GameState) {
  const now = Date.now();
  const remaining: Record<string, number> = {};
  for (const [boost, expiresAt] of Object.entries(state.activeBoosts)) {
    if (now < expiresAt) remaining[boost] = expiresAt;
  }
  state.activeBoosts = remaining;
}
