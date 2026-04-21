import { useEffect, useRef, useState, useCallback } from "react";
import { App } from "@capacitor/app";
import {
  GameState, MapType, SHOP_ITEMS, FARM_GRID, FarmBalancePreset,
  applyFarmBalancePreset, getShopSeedPrice, toolIdToCrop,
  isCropPlantingUnlocked, seedUnlockLevel, CROP_GROW_TIMES,
  CROP_GOLD_REWARDS, CROP_HARVEST_XP, FARM_BALANCE_PRESETS,
  getLoginRewardForStreak, claimLoginReward, buildSessionHook,
  getNextMilestone, getProgressionData, LOGIN_REWARDS,
  DailyStreak,
} from "../game/Game";
import {
  createInitialState, updateGame, handleToolAction, switchMap, spawnText, handleFishingAction,
} from "../game/GameEngine";
import { renderGame, preloadAssets } from "../game/Renderer";
import { supabase } from "../game/supabase";
import { checkSolanaNFT } from "../game/blockchain";
import { applyNFTBoostsToState } from "../game/playerState";
import {
  getClaimableQuests, claimQuestReward, updateSupabaseGold, applyStoredQuestClaims,
} from "../game/questManager";
import { getShopItemBadge } from "../game/shopCatalog";
import SplashScreen from "../components/SplashScreen";
import PreFarmTutorial from "../components/tutorial/PreFarmTutorial";
import { initializeTokenAccount } from "../game/solanaToken";
import {
  registerDevnetHooks, unregisterDevnetHooks, onShopPurchase,
  fetchDevnetLFGBalance, DEVNET_TOKEN_MINT, fundTreasuryIfNeeded,
} from "../game/devnetTransactions";
import { TOKEN_MINT } from "../game/solanaToken";
import { AudioManager } from "../game/AudioSystem";
import {
  signSolanaLogin, signEvmLogin, verifyWalletWithSupabase,
} from "../game/walletHandshake";
import {
  isMobilePlatform, openWalletDeepLink, detectWalletEnvironment, detectMobileWallets,
  setupWalletDeepLinkHandler, setupVisibilityRestart,
  getTouchQuadrant, quadrantToKeys,
} from "../game/MobileController";
import { solanaWallet } from "../game/Web3Config";
import WorldMapScreen from "../components/WorldMapScreen";
import MobileHUD, { mobileHudAccentBtnStyle, mobileHudActionBtnStyle } from "../components/MobileHUD";
import ActionPopup, { type ActionPopupData } from "../components/ActionPopup";
import { registerDemoTrigger, abortDemo } from "../game/DemoScript";

const TOOLS = [
  { id: "sickle",      label: "HOE",      img: "/celurit_1774349990712.png", tip: "STEP 1: Till soil\nor harvest crops", tipSub: "Click any plot" },
  { id: "axe",         label: "AXE",      img: "/kapak_1_1774349990715.png", tip: "Clear dead crops\nor cut trees",      tipSub: "Click dead plant" },
  { id: "axe-large",   label: "MEGA AXE", img: "/kapak_1774349990716.png",   tip: "Chop trees fast\n+15 Gold each",     tipSub: "Click a tree" },
  { id: "water",       label: "WATER",    img: "/teko_siram.png",             tip: "STEP 3: Water crops\nafter planting", tipSub: "Click planted plot" },
  { id: "wheat-seed",  label: "WHEAT",    img: "/wheat.png",                  tip: "STEP 2: Plant wheat\n(till soil first!)", tipSub: "Needs tilled plot" },
  { id: "tomato-seed", label: "TOMATO",   img: "/tomato.png",                 tip: "STEP 2: Plant tomato\n(till soil first!)", tipSub: "Needs tilled plot" },
  { id: "carrot-seed", label: "CARROT",   img: "/carrot.png",                 tip: "STEP 2: Plant carrot\n(till soil first!)", tipSub: "Needs tilled plot" },
  { id: "pumpkin-seed",label: "PUMPKIN",  img: "/pumpkin.png",                tip: "STEP 2: Plant pumpkin\n(till soil first!)", tipSub: "Needs tilled plot" },
] as const;

const MAPS: { id: MapType; label: string; desc: string }[] = [
  { id: "home",     label: "Farm",     desc: "Your farm" },
  { id: "city",     label: "City",     desc: "Buy items" },
  { id: "fishing",  label: "Fishing",  desc: "Catch fish" },
  { id: "garden",   label: "Garden",   desc: "Meet players" },
  { id: "suburban", label: "Suburban", desc: "Cozy area" },
];

const TOOL_IDS = TOOLS.map((t) => t.id);

// â”€â”€ Action popup definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function makeActionPopup(notifText: string, id: number): ActionPopupData | null {
  const t = notifText.toUpperCase();
  if (t.includes("TILLED"))    return { id, icon: "[ HOE ]", title: "SOIL TILLED!", subtitle: "Ready for seeds", color: "#8D5A32", accent: "#D4AF37", minimal: true };
  if (t.includes("PLANTED"))   return { id, icon: "[ SEED ]", title: "PLANTED!", subtitle: t.replace("PLANTED ", ""), color: "#2D5A3D", accent: "#6DBF82", minimal: true };
  if (t.includes("WATERED"))   return { id, icon: "[ WATER ]", title: "WATERED!", subtitle: "Crops will grow now", color: "#1A3A5C", accent: "#4FC3F7", minimal: true };
  if (t.includes("HARVEST") || (t.includes("+") && t.includes("G")))
    return { id, icon: "[ HARVEST ]", title: "HARVESTED!", subtitle: t, color: "#5C3A00", accent: "#FFD700", minimal: true };
  if (t.includes("FERTILIZ"))  return { id, icon: "[ BOOST ]", title: "FERTILIZED!", subtitle: "Growth boosted!", color: "#3A1A5C", accent: "#CE93D8", minimal: true };
  if (t.includes("CLEARED"))   return { id, icon: "[ AXE ]", title: "CLEARED!", subtitle: "Plot ready to till", color: "#4A2800", accent: "#FF8A65", minimal: true };
  if (t.includes("FISH") || t.includes("EXOTIC") || t.includes("RARE FISH"))
    return { id, icon: "[ FISH ]", title: "FISH CAUGHT!", subtitle: t, color: "#0D2B45", accent: "#29B6F6", minimal: true };
  if (t.includes("LEVEL UP"))  return { id, icon: "[ LVL UP ]", title: "LEVEL UP!", subtitle: t, color: "#3A2800", accent: "#FFD700", minimal: true };
  if (t.includes("QUEST") && t.includes("CLAIMED"))
    return { id, icon: "[ REWARD ]", title: "QUEST DONE!", subtitle: t, color: "#1A3A1A", accent: "#66BB6A", minimal: true };
  if (t.includes("PHANTOM CONNECTED") || t.includes("METAMASK CONNECTED") || t.includes("TRUST WALLET CONNECTED"))
    return { id, icon: "[ WALLET ]", title: "CONNECTED!", subtitle: t, color: "#1A0A3A", accent: "#9D7BFF", minimal: true };
  if (t.includes("BOOST") || t.includes("NFT"))
    return { id, icon: "[ BOOST ]", title: "BOOST ACTIVE!", subtitle: t, color: "#0A2A0A", accent: "#B2FF59", minimal: true };
  return null;
}

function snapshotEconomy(p: GameState["player"]) {
  return { gold: p.gold, exp: p.exp, level: p.level, maxExp: p.maxExp, inventory: { ...p.inventory } };
}

function formatGrowDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

// â”€â”€ Farm status helper â€” crystal-clear step-by-step instruction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getFarmStatusGuide(plots: GameState["farmPlots"], activeTool: string | null): { action: string; slot: number | null; slotLabel: string | null } {
  const ready     = plots.filter(p => p.crop?.ready).length;
  const dead      = plots.filter(p => p.crop?.dead).length;
  const needWater = plots.filter(p => p.crop && !p.watered && !p.crop.dead && !p.crop.ready).length;
  const growing   = plots.filter(p => p.crop && !p.crop.ready && !p.crop.dead && p.watered).length;
  const needSeed  = plots.filter(p => p.tilled && !p.crop).length;
  const needTill  = plots.filter(p => !p.tilled).length;

  // Priority: DEAD crops > UNTILLED plots > EMPTY TILLED plots > NEED WATER > GROWING > HARVEST READY
  // This ensures the player always knows what to do next without confusion
  if (dead > 0) {
    return { action: `CLEAR ${dead} WITHERED CROP${dead > 1 ? "S" : ""} - PRESS [2] AXE`, slot: 2, slotLabel: "AXE" };
  }
  if (needTill > 0) {
    return { action: `TILL ${needTill} PLOT${needTill > 1 ? "S" : ""} - PRESS [1] HOE THEN TAP`, slot: 1, slotLabel: "HOE" };
  }
  if (needSeed > 0) {
    // Determine which seed slot based on active tool
    if (activeTool && activeTool.endsWith("-seed")) {
      return { action: `PLOT READY - TAP THE PLOT TO PLANT!`, slot: null, slotLabel: null };
    }
    return { action: `SELECT SEED [5-8] THEN TAP A PLOT`, slot: 5, slotLabel: "SEED" };
  }
  if (needWater > 0) {
    return { action: `WATER ${needWater} GROWING PLOT${needWater > 1 ? "S" : ""} - PRESS [4] WATER`, slot: 4, slotLabel: "WATER" };
  }
  if (growing > 0) {
    return { action: `${growing} PLOT${growing > 1 ? "S" : ""} GROWING - WAIT OR USE BOOST!`, slot: null, slotLabel: null };
  }
  if (ready > 0) {
    return { action: `HARVEST ${ready} READY CROP${ready > 1 ? "S" : ""} - PRESS [1] HOE`, slot: 1, slotLabel: "HOE" };
  }
  return { action: `TILL SOIL TO START - PRESS [1] HOE`, slot: 1, slotLabel: "HOE" };
}

export default function FarmingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  /** Mobile: one-finger pan = walk (quadrant keys); quick release = tap canvas (farm / move) */
  const mobilePanRef = useRef<{
    id: number;
    sx: number;
    sy: number;
    t0: number;
    maxD: number;
    activeDir: ReturnType<typeof getTouchQuadrant>;
  } | null>(null);
  const [ds, setDs] = useState<GameState>(stateRef.current);
  const [guestId] = useState(() => {
    const saved = localStorage.getItem("guest_id");
    if (saved) return saved;
    const nid = `guest_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem("guest_id", nid);
    return nid;
  });
  const [loaded, setLoaded] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [introTutorialDone, setIntroTutorialDone] = useState(false);
  const [worldMapDone, setWorldMapDone] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutStep, setTutStep] = useState(0);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletType, setWalletType] = useState<"solana" | "evm" | null>(null);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [showOutfitPanel, setShowOutfitPanel] = useState(false);
  const [nfts, setNfts] = useState<string[]>([]);
  const nftsRef = useRef<string[]>([]);
  const lastServerEconomyRef = useRef(snapshotEconomy(stateRef.current.player));
  const walletProviderRef = useRef<any>(null);
  const lastSyncedGoldRef = useRef<number>(ds.player.gold);
  const goldSyncBusyRef = useRef(false);
  const [phantomFound, setPhantomFound] = useState(false);
  const [solflareFound, setSolflareFound] = useState(false);
  const [backpackFound, setBackpackFound] = useState(false);
  const [metamaskFound, setMetamaskFound] = useState(false);
  const [trustWalletFound, setTrustWalletFound] = useState(false);
  // Mobile native wallet detection (via Capacitor App plugin)
  const [mobilePhantomInstalled, setMobilePhantomInstalled] = useState(false);
  const [mobileSolflareInstalled, setMobileSolflareInstalled] = useState(false);
  const [mobileBackpackInstalled, setMobileBackpackInstalled] = useState(false);
  const [mobileMetamaskInstalled, setMobileMetamaskInstalled] = useState(false);
  const [mobileTrustInstalled, setMobileTrustInstalled] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  // [DEBUG] Version counter — incrementing forces RAF useEffect to re-run after deep link resume
  const [walletDeeplinkVersion, setWalletDeeplinkVersion] = useState(0);
  const initialLoadCompleteRef = useRef(false);
  const cloudSaveBusy = useRef(false);
  const walletConnectedRef = useRef(false);
  const [shopHoverId, setShopHoverId] = useState<string | null>(null);
  const gameRootRef = useRef<HTMLDivElement>(null);
  const goldHudRef = useRef<HTMLDivElement>(null);
  const [coinBursts, setCoinBursts] = useState<
    { id: number; sx: number; sy: number; tx: number; ty: number }[]
  >([]);
  // Action popup state
  const [actionPopup, setActionPopup] = useState<ActionPopupData | null>(null);
  const popupIdRef = useRef(0);
  const lastNotifRef = useRef<string>("");
  // Mobile detection
  const isMobile = isMobilePlatform();
  // localStorage buffer for mobile battery saving
  const localSaveBuffer = useRef<Record<string, unknown>>({});
  const localSaveDirty = useRef(false);
  // Wallet connecting state
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  // Boost charges (limited uses per session)
  const [boostCharges, setBoostCharges] = useState(3);

  // â”€â”€ Unity-style 2D VFX overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [vfxOverlay, setVfxOverlay] = useState<Array<{
    id: number; type: "star" | "ripple" | "pop" | "sparkle" | "leaf";
    x: number; y: number; color: string; size: number;
  }>>([]);
  const vfxIdRef = useRef(0);

  const spawnVFXOverlay = useCallback((x: number, y: number, type: "star" | "ripple" | "pop" | "sparkle" | "leaf", color = "#FFD700", count = 1) => {
    const newParticles = Array.from({ length: count }, () => ({
      id: ++vfxIdRef.current,
      type,
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 30,
      color,
      size: 8 + Math.random() * 16,
    }));
    setVfxOverlay(prev => [...prev.slice(-30), ...newParticles]);
    setTimeout(() => {
      setVfxOverlay(prev => prev.filter(p => !newParticles.find(n => n.id === p.id)));
    }, 800);
  }, []);

  // â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    localStorage.removeItem("farm_grid");
    (FARM_GRID as any).cols = 3; (FARM_GRID as any).rows = 2;
    (FARM_GRID as any).cellW = 83; (FARM_GRID as any).cellH = 68;
    (FARM_GRID as any).startX = 197; (FARM_GRID as any).startY = 259;

    preloadAssets().then(() => setLoaded(true)).catch(() => setLoaded(true));

    // Disable context menu + user-select (mobile spam-tap safe)
    const noCtx = (e: MouseEvent) => e.preventDefault();
    const noTouch = (e: TouchEvent) => { if ((e.target as HTMLElement)?.tagName === "CANVAS") e.preventDefault(); };
    const noKey = (e: KeyboardEvent) => {
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["I","i","J","j"].includes(e.key)) || (e.ctrlKey && ["U","u"].includes(e.key)))
        e.preventDefault();
    };
    window.addEventListener("contextmenu", noCtx);
    window.addEventListener("touchstart", noTouch, { passive: false });
    window.addEventListener("keydown", noKey);
    // Pixel art sharpness
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.imageSmoothingEnabled = false;
    }
    return () => {
      window.removeEventListener("contextmenu", noCtx);
      window.removeEventListener("touchstart", noTouch);
      window.removeEventListener("keydown", noKey);
    };
  }, []);

  useEffect(() => { initialLoadCompleteRef.current = initialLoadComplete; }, [initialLoadComplete]);
  useEffect(() => { nftsRef.current = nfts; }, [nfts]);
  useEffect(() => { walletConnectedRef.current = walletConnected; }, [walletConnected]);
  // Sync activePanel to stateRef so Renderer can suppress canvas overlays
  useEffect(() => { stateRef.current.activePanel = activePanel; }, [activePanel]);
  // ── Devnet TX state ──────────────────────────────────────────────────────────
  const [devnetTxBusy, setDevnetTxBusy] = useState<string | null>(null);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [showTxPopup, setShowTxPopup] = useState(false);
  const [devnetLFGBalance, setDevnetLFGBalance] = useState<number>(0);

  // ── Devnet TX: Airdrop 5 LFG (mint from treasury) ───────────────────────────
  const devnetAirdrop = async () => {
    if (!walletConnected || walletAddress.startsWith('guest')) {
      stateRef.current.notification = { text: 'CONNECT WALLET FIRST!', life: 100 };
      setDs({ ...stateRef.current }); return;
    }
    setDevnetTxBusy('airdrop');
    try {
      const { devnetMintToPlayer } = await import('../game/devnetTransactions');
      await fundTreasuryIfNeeded().catch(()=>{});
      const res = await devnetMintToPlayer(walletAddress, 5, 'airdrop:manual', walletProviderRef.current);
      if (res.success && res.txid) {
        setLastTxId(res.txid);
        setShowTxPopup(true);
        fetchDevnetLFGBalance(walletAddress).then(setDevnetLFGBalance).catch(() => {});
        triggerPopup('AIRDROP +5 LFG ON DEVNET!');
      } else {
        stateRef.current.notification = { text: (res.error || 'AIRDROP FAILED').toUpperCase().slice(0,40), life: 120 };
        setDs({ ...stateRef.current });
      }
    } catch(e: any) {
      stateRef.current.notification = { text: (e.message || 'TX FAILED').toUpperCase().slice(0,40), life: 120 };
      setDs({ ...stateRef.current });
    } finally { setDevnetTxBusy(null); }
  };

  // ── Devnet TX: Harvest Claim — mint LFG for current ready crops ──────────────
  const devnetHarvestClaim = async () => {
    if (!walletConnected || walletAddress.startsWith('guest')) {
      stateRef.current.notification = { text: 'CONNECT WALLET FIRST!', life: 100 };
      setDs({ ...stateRef.current }); return;
    }
    const readyCrops = stateRef.current.farmPlots.filter(p => p.crop?.ready);
    if (readyCrops.length === 0) {
      stateRef.current.notification = { text: 'NO READY CROPS TO CLAIM!', life: 100 };
      setDs({ ...stateRef.current }); return;
    }
    setDevnetTxBusy('harvest');
    try {
      const { devnetMintToPlayer } = await import('../game/devnetTransactions');
      const amount = readyCrops.reduce((sum, p) => {
        const base: Record<string,number> = { wheat:1, tomato:2, carrot:3, pumpkin:5, corn:4 };
        return sum + (base[p.crop!.type] ?? 1) * (p.crop!.isRare ? 3 : 1);
      }, 0);
      await fundTreasuryIfNeeded().catch(()=>{});
      const res = await devnetMintToPlayer(walletAddress, amount, `harvest:${readyCrops.length}crops`, walletProviderRef.current);
      if (res.success && res.txid) {
        setLastTxId(res.txid);
        setShowTxPopup(true);
        fetchDevnetLFGBalance(walletAddress).then(setDevnetLFGBalance).catch(() => {});
        triggerPopup(`HARVEST +${amount} LFG ON DEVNET!`);
      } else {
        stateRef.current.notification = { text: (res.error || 'CLAIM FAILED').toUpperCase().slice(0,40), life: 120 };
        setDs({ ...stateRef.current });
      }
    } catch(e: any) {
      stateRef.current.notification = { text: (e.message || 'TX FAILED').toUpperCase().slice(0,40), life: 120 };
      setDs({ ...stateRef.current });
    } finally { setDevnetTxBusy(null); }
  };

  // ── Devnet TX: View reference TX (the original devnet tx) ────────────────────
  const REFERENCE_TX = '5Yad6ss2HVzP25tUrbnRfw2rg22YebhuHnxbgzzf5VdHsMSWShvVvFoGSSN3RhBdtVm4ZeSFuQiJDg4Wr7PJSHzZ';
  const devnetViewRefTx = () => {
    setLastTxId(REFERENCE_TX);
    setShowTxPopup(true);
  };


  // â”€â”€ Gold ↔ Blockchain sync (LFG token mint/burn) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Gold sync disabled: in-game GOLD is purely cosmetic/gameplay currency.
  // LFG on-chain tokens are only minted via explicit player actions:
  //   - devnetHarvestClaim (harvest ready crops)
  //   - devnetAirdrop (manual airdrop button)
  // This prevents shop purchases / any gold spend from burning real tokens.
  // â”€â”€ Register window.startLifetopiaDemo() â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Use refs so the demo always has fresh closures without re-registering
  const setSplashDoneRef = useRef(setSplashDone);
  const setIntroTutorialDoneRef = useRef(setIntroTutorialDone);
  const setWalletConnectedRef = useRef(setWalletConnected);
  const setWalletAddressRef = useRef(setWalletAddress);
  const setActivePanelRef = useRef(setActivePanel);
  const setDsRef = useRef(setDs);
  const triggerPopupRef = useRef<(t: string) => void>(() => {});

  useEffect(() => {
    setSplashDoneRef.current = setSplashDone;
    setIntroTutorialDoneRef.current = setIntroTutorialDone;
    setWalletConnectedRef.current = setWalletConnected;
    setWalletAddressRef.current = setWalletAddress;
    setActivePanelRef.current = setActivePanel;
    setDsRef.current = setDs;
  });

  useEffect(() => {
    registerDemoTrigger({
      stateRef,
      setDs: (s) => setDsRef.current(s),
      selectTool: (id) => {
        stateRef.current.player.tool = id as any;
        setDsRef.current({ ...stateRef.current });
      },
      doSwitchMap: (map) => {
        stateRef.current.currentMap = map as any;
        setDsRef.current({ ...stateRef.current });
      },
      setActivePanel: (p) => setActivePanelRef.current(p),
      setSplashDone: (v) => setSplashDoneRef.current(v),
      setIntroTutorialDone: (v) => setIntroTutorialDoneRef.current(v),
      setWalletConnected: (v) => setWalletConnectedRef.current(v),
      setWalletAddress: (v) => setWalletAddressRef.current(v),
      triggerPopup: (t) => triggerPopupRef.current(t),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closePanel = useCallback(() => { AudioManager.playSFX("close"); setActivePanel(null); setConnectingWallet(null); }, []);
  const doSwitchMap = (map: MapType) => {
    if (ds.demoMode && !isMobile) {
      // Keep demo but jump to map's slot so it stays there for 40s
      const cycle: MapType[] = ["home", "city", "garden", "suburban", "fishing"];
      const i = cycle.indexOf(map);
      if (i !== -1) stateRef.current.demoTimer = i * 40000;
    } else if (ds.demoMode) {
      abortDemo();
    }
    const prev = stateRef.current.currentMap;
    stateRef.current = switchMap(stateRef.current, map);
    if (prev !== map) {
      AudioManager.init();
      AudioManager.playSFX("step", 0.22);
    }
    saveProgress();
    setDs({ ...stateRef.current });
  };

  // â”€â”€ Notification â†’ ActionPopup bridge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const triggerPopup = useCallback((text: string) => {
    if (text === lastNotifRef.current) return;
    lastNotifRef.current = text;
    const id = ++popupIdRef.current;
    const popup = makeActionPopup(text, id);
    if (popup) setActionPopup(popup);
    // Spawn Unity-style VFX overlay based on action type
    const t = text.toUpperCase();
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    if (t.includes("HARVEST") || t.includes("+") && t.includes("G")) {
      spawnVFXOverlay(cx, cy - 80, "star", "#FFD700", 6);
      spawnVFXOverlay(cx, cy - 60, "ripple", "#FFD700");
      AudioManager.playSFX("harvest");
    } else if (t.includes("PLANTED")) {
      spawnVFXOverlay(cx, cy - 60, "pop", "#6DBF82", 4);
      AudioManager.playSFX("plant");
    } else if (t.includes("TILLED")) {
      spawnVFXOverlay(cx, cy - 40, "pop", "#8D5A32", 3);
      AudioManager.playSFX("hoe");
    } else if (t.includes("WATERED")) {
      spawnVFXOverlay(cx, cy - 50, "sparkle", "#4FC3F7", 5);
      AudioManager.playSFX("water");
    } else if (t.includes("LEVEL UP")) {
      spawnVFXOverlay(cx, cy - 100, "star", "#FFD700", 10);
      spawnVFXOverlay(cx, cy - 80, "ripple", "#FFD700");
      AudioManager.playSFX("levelUp");
    } else if (t.includes("CONNECTED")) {
      spawnVFXOverlay(cx, cy - 60, "star", "#9D7BFF", 5);
    }
  }, [spawnVFXOverlay]);

  // Keep triggerPopupRef in sync so demo can call it
  useEffect(() => { triggerPopupRef.current = triggerPopup; }, [triggerPopup]);

  // ── Real-time Blockchain Sync (LFG + unified Alpha mint on Devnet) ───────────
  const blockchainSyncBusy = useRef(false);

  const syncBlockchainData = useCallback(async () => {
    if (!walletConnected || !walletAddress || walletAddress.startsWith("guest")) return;
    if (blockchainSyncBusy.current) return;
    blockchainSyncBusy.current = true;

    try {
      const bal = await fetchDevnetLFGBalance(walletAddress);
      setDevnetLFGBalance(bal);

      stateRef.current.player.gold = Math.floor(bal);
      stateRef.current.player.lifetopiaGold = bal;

      const hasUtility = await checkSolanaNFT(walletAddress);
      const boost = applyNFTBoostsToState(hasUtility);

      if (stateRef.current.nftBoostActive !== boost.nftBoostActive) {
        stateRef.current.farmingSpeedMultiplier = boost.farmingSpeedMultiplier;
        stateRef.current.nftBoostActive = boost.nftBoostActive;
        const boostMsg = hasUtility
          ? "ALPHA MINT HELD — BOOST ACTIVE!"
          : "BOOST DEACTIVATED (NO MINT BALANCE)";
        stateRef.current.notification = { text: boostMsg, life: 120 };
        triggerPopup(boostMsg);
      }

      setDs({ ...stateRef.current });
      console.log(`[Sync] Real-time sync complete for ${walletAddress.slice(0, 8)}...`);
    } catch (e) {
      console.warn("[Sync] Blockchain sync stalled, retrying next cycle...", e);
    } finally {
      blockchainSyncBusy.current = false;
    }
  }, [walletConnected, walletAddress, triggerPopup]);

  useEffect(() => {
    if (!walletConnected || !walletAddress || walletAddress.startsWith("guest")) return;

    syncBlockchainData();

    const id = setInterval(syncBlockchainData, 8_000);

    const cleanupVisibility = setupVisibilityRestart(() => {
      console.log("[Sync] Restarting loop after app resume...");
      syncBlockchainData();
    });

    return () => {
      clearInterval(id);
      cleanupVisibility();
    };
  }, [walletConnected, walletAddress, syncBlockchainData]);

  // â”€â”€ Splash / Tutorial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSplashSelect = useCallback((map: MapType) => {
    AudioManager.init();
    AudioManager.playBGM("/backsound.mp3");
    doSwitchMap(map);
    setSplashDone(true);
    setIntroTutorialDone(false);
  }, [doSwitchMap]);

  const handlePreFarmTutorialFinished = useCallback(() => {
    setIntroTutorialDone(true);
    setWorldMapDone(true);
    setShowWorldMap(true); // Show world map chooser after tutorial (desktop + mobile)
    stateRef.current.currentMap = "home";
    if (walletConnectedRef.current) {
      stateRef.current.notification = { text: "WELCOME BACK, FARMER!", life: 160 };
    } else {
      const gAddr = `guest_${Math.random().toString(36).slice(2, 12)}`;
      setWalletAddress(gAddr);
      setWalletType(null);
      setWalletConnected(true);
      stateRef.current.player.walletAddress = gAddr;
      stateRef.current.notification = { text: "WELCOME! SYNC PROGRESS WITH WALLET", life: 200 };
    }
    setDs({ ...stateRef.current });
    // Demo starts after player picks a map from world map screen
  }, []);

  const handlePreFarmMapFocus = useCallback((map: MapType) => {
    stateRef.current.currentMap = map;
    setDs({ ...stateRef.current });
  }, []);

  // â”€â”€ Wallet detection - TRAP-based: fires the INSTANT extension injects â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const w = window as any;

    const applyState = () => {
      const eth = w.ethereum;
      const providers: any[] = Array.isArray(eth?.providers) ? eth.providers : eth ? [eth] : [];
      setPhantomFound(!!(w.phantom?.solana?.isPhantom || w.solana?.isPhantom));
      setSolflareFound(!!(w.solflare?.isSolflare));
      setBackpackFound(!!(w.backpack?.isBackpack));
      setMetamaskFound(!!(eth?.isMetaMask || providers.some((p: any) => p?.isMetaMask)));
      setTrustWalletFound(!!(w.trustwallet || eth?.isTrust || eth?.isTrustWallet || providers.some((p: any) => p?.isTrust || p?.isTrustWallet)));
    };

    // Run immediately â€” catches extensions that inject synchronously
    applyState();

    // Trap window.ethereum: fires the moment MetaMask/Trust injects
    const trapProp = (prop: string, cb: () => void) => {
      if (w[prop]) { cb(); return; } // already there
      try {
        let _val: any;
        Object.defineProperty(w, prop, {
          configurable: true,
          get() { return _val; },
          set(v) {
            _val = v;
            // Restore normal property so future sets work
            try { Object.defineProperty(w, prop, { configurable: true, writable: true, value: v }); } catch { /* ignore */ }
            cb();
          },
        });
      } catch { /* defineProperty blocked â€” fallback to event */ }
    };

    trapProp("ethereum", applyState);
    trapProp("solana", applyState);
    trapProp("phantom", applyState);
    trapProp("solflare", applyState);
    trapProp("backpack", applyState);
    trapProp("trustwallet", applyState);

    // Standard event emitted by MetaMask
    window.addEventListener("ethereum#initialized", applyState, { once: true });
    // Fallback: immediate check (no delay for fast wallet detection)
    const t = setTimeout(applyState, 0);

    // Mobile wallet detection via Capacitor App plugin
    if (isMobile) {
      detectMobileWallets().then(mobile => {
        setMobilePhantomInstalled(mobile.phantomInstalled);
        setMobileSolflareInstalled(mobile.solflareInstalled);
        setMobileBackpackInstalled(mobile.backpackInstalled);
        setMobileMetamaskInstalled(mobile.metamaskInstalled);
        setMobileTrustInstalled(mobile.trustInstalled);
      }).catch(() => { /* ignore */ });
    }

    return () => {
      clearTimeout(t);
      window.removeEventListener("ethereum#initialized", applyState);
    };
  }, [isMobile]);

  // â”€â”€ Set up deep link handler so wallet callbacks return to game â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    setupWalletDeepLinkHandler();
    
    const handleWalletCallback = (addr: string, type?: string) => {
      if (addr) {
        const walletType = (type === "evm" ? "evm" : "solana") as "solana" | "evm";
        const label = walletType === "solana" ? "PHANTOM" : "METAMASK";
        _onWalletConnected(addr, walletType, null, label);
        setActivePanel(null);
      }
    };
    
    const sub = App.addListener("appUrlOpen", (data) => {
      try {
        const url = new URL(data.url);
        const addr = url.searchParams.get("addr") || url.searchParams.get("public_key") || url.searchParams.get("pk");
        const type = url.searchParams.get("type");
        console.log(`[DeepLink] appUrlOpen: ${data.url} addr=${addr}`);
        if (addr) {
          handleWalletCallback(addr, type ?? undefined);
          // [DEBUG] Force RAF useEffect to re-run after app returns from wallet
          setWalletDeeplinkVersion(v => v + 1);
        }
      } catch (e) { /* ignore */ }
    });

    window.addEventListener('wallet-connected', ((e: CustomEvent) => {
      console.log(`[DeepLink] wallet-connected event: addr=${e.detail.address}`);
      handleWalletCallback(e.detail.address, e.detail.type);
      // [DEBUG] Force RAF useEffect to re-run after app returns from wallet
      setWalletDeeplinkVersion(v => v + 1);
    }) as any);

    const url = new URL(window.location.href);
    const initAddr = url.searchParams.get("addr") || url.searchParams.get("public_key") || url.searchParams.get("pk");
    const initType = url.searchParams.get("type");
    if (initAddr) handleWalletCallback(initAddr, initType ?? undefined);

    return () => { sub.then(s => s.remove()); };
  }, []);

  // â”€â”€ Connect Phantom - SIMPLE, no async/await â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const connectPhantom = () => {
    const w = window as any;
    const isNative = !!(w.Capacitor?.isNativePlatform?.());
    const sol = w.phantom?.solana ?? w.solana;
    const injected = !!(sol?.connect && (sol.isPhantom || w.phantom?.solana?.isPhantom));

    if (injected) {
      setConnectingWallet("phantom");
      const timeoutId = setTimeout(() => setConnectingWallet(null), 8000);
      sol.connect().then((res: any) => {
        clearTimeout(timeoutId);
        setConnectingWallet(null);
        const pk = res?.publicKey ?? sol.publicKey;
        if (!pk) throw new Error("No public key returned");
        _onWalletConnected(pk.toString(), "solana", sol);
      }).catch((e: any) => {
        clearTimeout(timeoutId);
        setConnectingWallet(null);
        console.error("[Phantom]", e);
        stateRef.current.notification = { text: (e?.message || "CONNECT FAILED").toUpperCase().slice(0, 40), life: 120 };
        setDs({ ...stateRef.current });
      });
      return;
    }

    if (isMobile || isNative) {
      openWalletDeepLink("phantom");
      return;
    }

    stateRef.current.notification = { text: "PHANTOM NOT INSTALLED - GET IT AT PHANTOM.APP", life: 150 };
    setDs({ ...stateRef.current });
  };
  const connectSolflare = () => {
    const w = window as any;
    const isNative = !!(w.Capacitor?.isNativePlatform?.());
    const sol = w.solflare ?? w.solana;
    const injected = !!(sol?.connect && (w.solflare?.isSolflare || sol?.isSolflare));
    if (injected) {
      setConnectingWallet("solflare");
      const timeoutId = setTimeout(() => setConnectingWallet(null), 8000);
      sol.connect().then((res: any) => {
        clearTimeout(timeoutId);
        setConnectingWallet(null);
        const pk = res?.publicKey ?? sol.publicKey;
        if (!pk) throw new Error("No public key returned");
        _onWalletConnected(pk.toString(), "solana", sol);
      }).catch((e: any) => {
        clearTimeout(timeoutId);
        setConnectingWallet(null);
        console.error("[Solflare]", e);
        stateRef.current.notification = { text: (e?.message || "CONNECT FAILED").toUpperCase().slice(0, 40), life: 120 };
        setDs({ ...stateRef.current });
      });
      return;
    }
    if (isMobile || isNative) {
      openWalletDeepLink("solflare");
      return;
    }
    stateRef.current.notification = { text: "SOLFLARE NOT INSTALLED - GET IT AT SOLFLARE.COM", life: 150 };
    setDs({ ...stateRef.current });
  };
  const connectBackpack = () => {
    const w = window as any;
    const isNative = !!(w.Capacitor?.isNativePlatform?.());
    const sol = w.backpack ?? w.solana;
    const injected = !!(sol?.connect && w.backpack?.isBackpack);
    if (injected) {
      setConnectingWallet("backpack");
      const timeoutId = setTimeout(() => setConnectingWallet(null), 8000);
      sol.connect().then((res: any) => {
        clearTimeout(timeoutId);
        setConnectingWallet(null);
        const pk = res?.publicKey ?? sol.publicKey;
        if (!pk) throw new Error("No public key returned");
        _onWalletConnected(pk.toString(), "solana", sol);
      }).catch((e: any) => {
        clearTimeout(timeoutId);
        setConnectingWallet(null);
        console.error("[Backpack]", e);
        stateRef.current.notification = { text: (e?.message || "CONNECT FAILED").toUpperCase().slice(0, 40), life: 120 };
        setDs({ ...stateRef.current });
      });
      return;
    }
    if (isMobile || isNative) {
      openWalletDeepLink("backpack");
      return;
    }
    stateRef.current.notification = { text: "BACKPACK NOT INSTALLED - GET IT AT BACKPACK.APP", life: 150 };
    setDs({ ...stateRef.current });
  };
  const connectWeb3 = useCallback(async () => {
    if (isMobilePlatform()) {
      // Try injected provider first — Phantom/Solflare inject into Android WebViews
      const mobilePhantom = (window as any).phantom?.solana ?? (window as any).solana;
      if (mobilePhantom?.isPhantom && typeof mobilePhantom.connect === "function") {
        setConnectingWallet("web3");
        try {

        const res = await mobilePhantom.connect();

          const pk = res?.publicKey ?? mobilePhantom.publicKey;
          if (!pk) throw new Error("No public key returned");
          await _onWalletConnected(pk.toString(), "solana", mobilePhantom);
        } catch (e: any) {
          console.error("[Web3 Mobile]", e);
          stateRef.current.notification = { text: (e?.message || "CONNECT FAILED").toUpperCase().slice(0, 40), life: 120 };
          setDs({ ...stateRef.current });
        } finally {
          setConnectingWallet(null);
        }
        return;
      }
      // No injected provider — try HTTPS deep link
      if (!openWalletDeepLink("phantom")) {
        stateRef.current.notification = {
          text: "HTTPS NEEDED. DEPLOY TO HTTPS OR ADD VITE_WALLET_DAPP_URL=https://your-url.railway.app",
          life: 300,
        };
        setDs({ ...stateRef.current });
      }
      return;
    }
    try {
      setConnectingWallet("web3");
      
      const result = await solanaWallet.connect();
      
      if (result && result.publicKey) {
        const walletLabel = result.walletName || "PHANTOM";
        await _onWalletConnected(result.publicKey, "solana", result.provider, walletLabel);
      }
      
      setConnectingWallet(null);
    } catch (e) {
      console.error("[Solana Wallet]", e);
      stateRef.current.notification = { text: "WALLET CONNECT FAILED", life: 120 };
      setDs({ ...stateRef.current });
      setConnectingWallet(null);
    }
  }, []);

  // â”€â”€ Play as Guest (no wallet required) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const playAsGuest = () => {
    const gAddr = `guest_${guestId.slice(6, 16)}`;
    setWalletAddress(gAddr);
    setWalletType(null);
    setWalletConnected(true);
    stateRef.current.player.walletAddress = gAddr;
    AudioManager.playSFX("click");
    const notifText = "PLAYING AS GUEST - CONNECT WALLET TO SAVE PROGRESS";
    stateRef.current.notification = { text: notifText, life: 160 };
    triggerPopup(notifText);
    setDs({ ...stateRef.current });
  };

  const _onWalletConnected = async (addr: string, type: "solana" | "evm", provider: any, label?: string) => {
    // 1. INSTANT UI update â€” no await before this
    walletProviderRef.current = provider;
    setWalletAddress(addr);
    setWalletType(type);
    setWalletConnected(true);
    localStorage.setItem("wallet_addr", addr);
    localStorage.setItem("wallet_type", type);
    stateRef.current.player.walletAddress = addr;

    const notifText = label ? `${label} CONNECTED!` : type === "solana" ? "PHANTOM CONNECTED!" : "METAMASK CONNECTED!";
    stateRef.current.notification = { text: notifText, life: 120 };
    triggerPopup(notifText);
    AudioManager.playSFX("wallet");
    // Close wallet-connect panel immediately so user can play right away
    setActivePanel(null);
    setDs({ ...stateRef.current });

    // 2. Background: signature + supabase + NFT check â€” all parallel, non-blocking
    // Switch to home map immediately (no delay)
    if (stateRef.current.currentMap !== "home") doSwitchMap("home");

    // Register devnet hooks so GameEngine can fire on-chain LFG rewards
    if (addr && provider) {
      registerDevnetHooks({ walletAddress: addr, provider });
    }

    // loadProgress runs immediately — no waiting on sign message or NFT check
    loadProgress(addr).then(() => {
      setDs({ ...stateRef.current });
      saveProgress().catch(console.error);
    }).catch(console.error);

    // NFT check — independent, non-blocking
    if (provider && type === "solana") {
      checkSolanaNFT(addr).then(hasNft => {
        if (hasNft) {
          const boost = applyNFTBoostsToState(true);
          stateRef.current.farmingSpeedMultiplier = boost.farmingSpeedMultiplier;
          stateRef.current.nftBoostActive = boost.nftBoostActive;
          const boostText = "ALPHA NFT — FARM SPEED BOOST!";
          stateRef.current.notification = { text: boostText, life: 3000 };
          triggerPopup(boostText);
          setDs({ ...stateRef.current });
        }
      }).catch(console.error);
    }

    // Sign message — fully fire-and-forget, never blocks UI or loadProgress
    if (provider) {
      const signFn = type === "solana" ? signSolanaLogin(provider, addr) : signEvmLogin(provider, addr);
      signFn.then(proof => {
        verifyWalletWithSupabase(proof).catch(console.error);
      }).catch(e => console.warn("[WalletHandshake] Sign skipped:", e?.message));
    }
  };

  const disconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress("");
    setWalletType(null);
    walletProviderRef.current = null;
    lastSyncedGoldRef.current = 0;
    unregisterDevnetHooks();
    localStorage.removeItem("wallet_addr");
    localStorage.removeItem("wallet_type");
    stateRef.current.player.walletAddress = "";
  };

  // â”€â”€ Persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadProgress = async (addr: string) => {
    try {
      const applyRow = (data: Record<string, unknown> | null): boolean => {
        if (!data) return false;
        const { gold, exp, level } = data;
        if (typeof gold !== "number" || typeof exp !== "number" || typeof level !== "number") return false;
        stateRef.current.player.gold = gold;
        stateRef.current.player.exp = exp;
        stateRef.current.player.level = level;
        stateRef.current.player.maxExp = typeof data.max_exp === "number" ? data.max_exp : stateRef.current.player.maxExp;
        // Merge: DB/localStorage may store `{}` â€” empty object is truthy and would wipe default seeds
        if (data.inventory != null && typeof data.inventory === "object" && !Array.isArray(data.inventory)) {
          stateRef.current.player.inventory = {
            ...stateRef.current.player.inventory,
            ...(data.inventory as GameState["player"]["inventory"]),
          };
        }
        stateRef.current.player.nftEligibility = !!data.nft_eligibility;
        if (data.nfts && Array.isArray(data.nfts)) setNfts(data.nfts as string[]);
        // Restore farm plots with crop data
        if (data.farm_plots && Array.isArray(data.farm_plots)) {
          for (const savedPlot of data.farm_plots) {
            const plot = stateRef.current.farmPlots.find(p => p.plotUuid === savedPlot.plot_id);
            if (plot) {
              plot.tilled = !!savedPlot.tilled;
              plot.watered = !!savedPlot.watered;
              plot.fertilized = !!savedPlot.fertilized;
              plot.crop = savedPlot.crop || null;
              plot.stressDrySince = savedPlot.stressDrySince || null;
            }
          }
        }
        applyStoredQuestClaims(stateRef.current, addr);
        lastServerEconomyRef.current = snapshotEconomy(stateRef.current.player);
        setDs({ ...stateRef.current });
        return true;
      };
      // Try localStorage buffer first (mobile battery saving) - FAST PATH
      const cached = localStorage.getItem(`progress_${addr}`);
      if (cached) {
        try { 
          if (applyRow(JSON.parse(cached))) {
            setInitialLoadComplete(true);
            // Background sync with Supabase - non-blocking
            supabase.from("users").select("*").eq("wallet_address", addr).maybeSingle().then(u => {
              if (u.data) applyRow(u.data);
            }).catch(() => {});
            // Sync on-chain $GOLD token balance -> in-game GOLD (overrides DB value)
            if (!addr.startsWith("guest")) {
              fetchDevnetLFGBalance(addr).then(bal => {
                if (bal > 0) {
                  stateRef.current.player.gold = Math.floor(bal);
                  stateRef.current.player.lifetopiaGold = bal;
                  setDs({ ...stateRef.current });
                }
              }).catch(() => {});
            }
            return;
          }
        } catch { /* ignore */ }
      }
      // Fallback to Supabase if localStorage fails
      const u = await supabase.from("users").select("*").eq("wallet_address", addr).maybeSingle();
      let loaded = applyRow(u.data);
      if (!loaded) {
        const p = await supabase.from("players").select("*").eq("wallet_address", addr).maybeSingle();
        loaded = applyRow(p.data);
      }
      if (!loaded) applyStoredQuestClaims(stateRef.current, addr);
      setInitialLoadComplete(true);
      // Sync on-chain $GOLD token balance -> in-game GOLD (overrides DB value)
      if (!addr.startsWith("guest")) {
        fetchDevnetLFGBalance(addr).then(bal => {
          if (bal > 0) {
            stateRef.current.player.gold = Math.floor(bal);
            stateRef.current.player.lifetopiaGold = bal;
            setDs({ ...stateRef.current });
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn("[Persistence] Load error:", e);
      setInitialLoadComplete(true);
    }
  };

  const saveProgress = async () => {
    const addr = stateRef.current.player.walletAddress;
    if (!addr || addr.toLowerCase().startsWith("guest") || !initialLoadCompleteRef.current) return;
    const payload = {
      wallet_address: addr,
      gold: stateRef.current.player.gold,
      exp: stateRef.current.player.exp,
      level: stateRef.current.player.level,
      max_exp: stateRef.current.player.maxExp,
      inventory: stateRef.current.player.inventory,
      nfts: nftsRef.current,
      farm_plots: stateRef.current.farmPlots.map((p) => ({ plot_id: p.plotUuid, grid_x: p.gridX, grid_y: p.gridY })),
      last_seen: new Date().toISOString(),
    };
    // Always write to localStorage buffer first (instant, battery-friendly)
    localStorage.setItem(`progress_${addr}`, JSON.stringify(payload));
    try {
      const [pa, ua] = await Promise.all([
        supabase.from("players").upsert(payload, { onConflict: "wallet_address" }),
        supabase.from("users").upsert(payload, { onConflict: "wallet_address" }),
      ]);
      if (pa.error) throw pa.error;
      lastServerEconomyRef.current = snapshotEconomy(stateRef.current.player);
    } catch (e) {
      console.error("[Persistence] Save error (Gold persisted locally):", e);
      // Removed: Restoring snap.gold here causes "stuck gold" bugs when sync fails.
      // We rely on local state being canonical and cloud catch-up later.
      stateRef.current.notification = { text: "CLOUD SYNC DELAYED - PROGRESS SAVED LOCALLY", life: 100 };
      setDs({ ...stateRef.current });
    } finally {
      stateRef.current.pendingCloudSave = false;
    }
  };

  useEffect(() => {
    const timer = setInterval(saveProgress, 30000);
    return () => clearInterval(timer);
  }, [nfts]);

  // Auto-reconnect wallet silently on page reload (onlyIfTrusted = no popup)
  useEffect(() => {
    const savedAddr = localStorage.getItem("wallet_addr");
    const savedType = localStorage.getItem("wallet_type");
    if (!savedAddr || !savedType) return;

    // Wallet extensions inject into window asynchronously — wait up to 1s
    const tryReconnect = (attempt = 0) => {
      const w = window as any;

      if (savedType === "solana") {
        const providers: Array<{ sol: any; name: string }> = [];
        if (w.phantom?.solana?.isPhantom) providers.push({ sol: w.phantom.solana, name: "Phantom" });
        else if (w.solana?.isPhantom) providers.push({ sol: w.solana, name: "Phantom" });
        if (w.solflare?.isSolflare) providers.push({ sol: w.solflare, name: "Solflare" });
        if (w.backpack?.isBackpack) providers.push({ sol: w.backpack, name: "Backpack" });

        if (providers.length === 0) {
          // Extension not injected yet — retry up to 5x with 100ms gap (faster)
          if (attempt < 5) { setTimeout(() => tryReconnect(attempt + 1), 100); }
          return;
        }

        const { sol, name } = providers[0];
        if (typeof sol.connect !== "function") return;

        sol.connect({ onlyIfTrusted: true })
          .then((res: any) => {
            const pk = res?.publicKey?.toString() ?? sol.publicKey?.toString();
            if (pk && pk === savedAddr) {
              console.log(`[AutoReconnect] ${name} silently reconnected`);
              _onWalletConnected(pk, "solana", sol, name.toUpperCase());
            }
          })
          .catch(() => {
            // Not trusted yet — clear stale data so button shows correctly
            localStorage.removeItem("wallet_addr");
            localStorage.removeItem("wallet_type");
          });
      }
    };

    tryReconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Map ambient audio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!splashDone || !introTutorialDone) return;
    if (ds.currentMap === "suburban") { AudioManager.init(); AudioManager.setMapAmbient("suburban_birds"); }
    else AudioManager.setMapAmbient("none");
  }, [ds.currentMap, splashDone, introTutorialDone]);

  // â”€â”€ Garden presence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!splashDone || !introTutorialDone || ds.currentMap !== "garden") return;
    let cancelled = false;
    const pull = async () => {
      try {
        const { count, error } = await supabase.from("sessions").select("*", { count: "exact", head: true });
        if (!cancelled && !error && count != null) { stateRef.current.gardenActivePlayers = count; setDs({ ...stateRef.current }); }
      } catch { if (!cancelled) stateRef.current.gardenActivePlayers = 0; }
    };
    pull();
    const t = setInterval(pull, 12000);
    return () => { cancelled = true; clearInterval(t); };
  }, [ds.currentMap, splashDone, introTutorialDone]);

  useEffect(() => {
    if (!splashDone || !introTutorialDone || ds.currentMap !== "garden") return;
    const addr = walletAddress || stateRef.current.player.walletAddress || guestId;
    if (!addr) return;
    const channel = supabase.channel("garden-live", { config: { presence: { key: addr } } });
    const pushPresence = () => void channel.track({
      x: stateRef.current.player.x,
      y: stateRef.current.player.y,
      emote: stateRef.current.player.emote,
      at: Date.now()
    });
    channel.subscribe(async (status) => { if (status === "SUBSCRIBED") pushPresence(); });
    const flushOthers = () => {
      const st = channel.presenceState() as Record<string, Array<{ x?: number; y?: number; emote?: string }>>;
      const others: { id: string; x: number; y: number; emote?: any }[] = [];
      for (const [key, entries] of Object.entries(st)) {
        if (key === addr) continue;
        const v = entries?.[0];
        if (v && typeof v.x === "number" && typeof v.y === "number") {
          others.push({ id: key.slice(0, 12), x: v.x, y: v.y, emote: v.emote });
        }
      }
      stateRef.current.gardenRemotePlayers = others;
    };
    channel.on("presence", { event: "sync" }, flushOthers);
    channel.on("presence", { event: "join" }, flushOthers);
    channel.on("presence", { event: "leave" }, flushOthers);
    const iv = setInterval(pushPresence, 320);
    return () => { clearInterval(iv); void channel.unsubscribe(); };
  }, [ds.currentMap, splashDone, introTutorialDone, walletAddress]);

  // â”€â”€ NFT claim â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const claimNFT = async () => {
    const addr = (walletAddress || localStorage.getItem("wallet_addr") || "").trim();
    if (!addr || addr.toLowerCase().startsWith("guest")) {
      stateRef.current.notification = { text: "CONNECT SOLANA WALLET FIRST!", life: 120 };
      setDs({ ...stateRef.current });
      return;
    }
    if (!walletProviderRef.current) {
      stateRef.current.notification = { text: "OPEN WALLET PANEL AND CONNECT", life: 120 };
      setDs({ ...stateRef.current });
      return;
    }
    stateRef.current.notification = { text: "MINTING ALPHA PASS (+LFG)...", life: 300 };
    setDs({ ...stateRef.current });
    try {
      // Fund treasury in parallel, don't wait
      fundTreasuryIfNeeded().catch(() => {});
      const { devnetMintToPlayer } = await import("../game/devnetTransactions");
      const res = await devnetMintToPlayer(addr, 10, "alpha-claim", walletProviderRef.current);
      if (res.success && res.txid) {
        setLastTxId(res.txid);
        setShowTxPopup(true);
        const updatedNfts = [...nfts, `ALPHA PASS | ${res.txid.slice(0, 10)}…`];
        setNfts(updatedNfts);
        // Fetch balance + NFT check in background
        Promise.all([
          fetchDevnetLFGBalance(addr),
          checkSolanaNFT(addr)
        ]).then(([onChainBalance, hasUtility]) => {
          stateRef.current.player.lifetopiaGold = onChainBalance;
          stateRef.current.player.gold = Math.floor(onChainBalance);
          setDevnetLFGBalance(onChainBalance);
          const boost = applyNFTBoostsToState(hasUtility);
          stateRef.current.farmingSpeedMultiplier = boost.farmingSpeedMultiplier;
          stateRef.current.nftBoostActive = boost.nftBoostActive;
          setDs({ ...stateRef.current });
        }).catch(() => {});
        stateRef.current.player.nftEligibility = false;
        const claimText = "ALPHA PASS RECEIVED — LFG ON DEVNET!";
        stateRef.current.notification = { text: claimText, life: 160 };
        triggerPopup(claimText);
        AudioManager.playSFX("wallet", 0.55);
        setDs({ ...stateRef.current });
        try {
          await supabase.from("players").update({
            nfts: updatedNfts,
            nft_eligibility: false,
            gold: stateRef.current.player.gold,
          }).eq("wallet_address", addr);
        } catch {
          /* non-fatal */
        }
      } else {
        stateRef.current.notification = {
          text: (res.error || "CLAIM FAILED").toUpperCase().slice(0, 48),
          life: 160,
        };
        setDs({ ...stateRef.current });
      }
    } catch (e: any) {
      stateRef.current.notification = {
        text: (e?.message || "CLAIM FAILED").toUpperCase().slice(0, 48),
        life: 140,
      };
      setDs({ ...stateRef.current });
    }
  };

  // â”€â”€ Keyboard input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Block all input during demo
      if (stateRef.current.demoMode) return;
      if (activePanel) return;
      const key = e.key.toLowerCase();
      stateRef.current.keys.add(key);
      if (!introTutorialDone) {
        if (key === "escape") setActivePanel(null);
        if (key === "f2") { stateRef.current.showFarmDebugOverlay = !stateRef.current.showFarmDebugOverlay; setDs({ ...stateRef.current }); e.preventDefault(); return; }
        const consumed = ["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"," ","e","enter","tab","f2","k"];
        if (consumed.includes(key)) e.preventDefault();
        return;
      }
      if (key === " " || key === "e" || key === "enter") {
        if (stateRef.current.currentMap === "city") setActivePanel("shop");
        else stateRef.current = handleToolAction(stateRef.current);
      }
      if (key === "escape") { setActivePanel(null); }
      if (key === "shift") stateRef.current.player.running = true;
      let n = parseInt(e.key);
      if (e.key === "0") n = 10;
      if (n >= 1 && n <= TOOL_IDS.length) {
        if (stateRef.current.currentMap === "garden" && n >= 1 && n <= 4) {
          const emotes = ["wave", "dance", "sit", "laugh"] as const;
          stateRef.current.player.emote = emotes[n - 1];
          stateRef.current.player.emoteUntil = stateRef.current.time + 3200;
          AudioManager.init();
          AudioManager.playSFX("click", 0.35);
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(18);
        } else {
          stateRef.current.player.tool = TOOL_IDS[n - 1] as any;
        }
        setDs({ ...stateRef.current });
      }
      if (key === "f2") { stateRef.current.showFarmDebugOverlay = !stateRef.current.showFarmDebugOverlay; setDs({ ...stateRef.current }); e.preventDefault(); return; }
      const consumed = ["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"," ","e","enter","tab","f2"];
      if (consumed.includes(key)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys.delete(e.key.toLowerCase());
      if (e.key === "Shift") stateRef.current.player.running = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [doSwitchMap, introTutorialDone]);


  // â”€â”€ Game loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false; // HD rendering â€” no more "pecah grafik"





    // Resize canvas to match device screen (critical for mobile/APK blank screen fix)
    const resizeCanvas = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        ctx.imageSmoothingEnabled = false;
      }
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 100));
    const loop = (ts: number) => {
      const dt = Math.min(ts - (lastTimeRef.current || ts) || 16, 32);
      lastTimeRef.current = ts;

      // Sync viewport size every frame so camera covers full screen
      stateRef.current.viewportW = canvas.width || window.innerWidth;
      stateRef.current.viewportH = canvas.height || window.innerHeight;

      // Guard FARM_GRID integrity
      if (FARM_GRID.cols !== 3 || FARM_GRID.rows !== 2 || FARM_GRID.cellW !== 83 || FARM_GRID.cellH !== 68 || FARM_GRID.startX !== 197 || FARM_GRID.startY !== 259) {
        (FARM_GRID as any).cols = 3; (FARM_GRID as any).rows = 2;
        (FARM_GRID as any).cellW = 83; (FARM_GRID as any).cellH = 68;
        (FARM_GRID as any).startX = 197; (FARM_GRID as any).startY = 259;
      }
      if (stateRef.current.farmPlots.length !== 6) {
        const plots: any[] = [];
        for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
          const existing = stateRef.current.farmPlots.find(p => p.gridX === c && p.gridY === r);
          const uid = globalThis.crypto?.randomUUID?.() ?? `plot-${Date.now()}-${c}-${r}`;
          plots.push(existing ? { ...existing, plotUuid: existing.plotUuid ?? uid, stressDrySince: existing.stressDrySince ?? null }
            : { id: `plot-${r}-${c}`, plotUuid: uid, gridX: c, gridY: r, worldX: 197 + c * 83, worldY: 259 + r * 68, tilled: false, watered: false, fertilized: false, crop: null, stressDrySince: null });
        }
        stateRef.current.farmPlots = plots;
      }

      const prevNotif = stateRef.current.notification?.text;

      stateRef.current = updateGame(stateRef.current, dt, stateRef);
      
      const newNotif = stateRef.current.notification?.text;
      if (newNotif && newNotif !== prevNotif) triggerPopup(newNotif);

      if (stateRef.current.pendingCloudSave && initialLoadCompleteRef.current && !cloudSaveBusy.current) {
        cloudSaveBusy.current = true;
        void saveProgress().finally(() => { cloudSaveBusy.current = false; });
      }

      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderGame(ctx, stateRef.current, canvas.width, canvas.height);
      } catch (err) {
        console.error("[GameLoop] renderGame CRASHED:", err);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // [DEBUG] Log player state when render crashes for Capacitor Inspect
        console.warn(`[GameLoop] Player state: x=${Math.round(stateRef.current.player.x)} y=${Math.round(stateRef.current.player.y)} action=${stateRef.current.player.action} actionTimer=${stateRef.current.player.actionTimer} map=${stateRef.current.currentMap} zoom=${stateRef.current.zoom}`);
      }

      if (stateRef.current.activePanel !== activePanel) setActivePanel(stateRef.current.activePanel);
      // â”€â”€ LOOP PERFORMANCE: Update UI at 15fps instead of 8fps for smoother feedback â”€â”€
      if (Math.floor(ts / 66) !== Math.floor((ts - dt) / 66)) {
        setDs({ ...stateRef.current });
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    // [DEBUG] Visibility restart guard — ensures RAF loop restarts after app resumes from wallet deep link
    const cleanupVisibility = setupVisibilityRestart(() => {
      console.log(`[RAF] Visibility restart called`);
      if (!animRef.current) {
        animRef.current = requestAnimationFrame(loop);
      }
    });

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resizeCanvas);
      cleanupVisibility();
    };
  }, [loaded, splashDone, introTutorialDone, walletDeeplinkVersion]);

  // â”€â”€ Tool selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const selectTool = (toolId: string) => {
    AudioManager.playSFX("click");
    const cropGate = toolIdToCrop(toolId);
    if (cropGate && !isCropPlantingUnlocked(cropGate, stateRef.current.player.level, stateRef.current.farmBalancePreset)) {
      const need = seedUnlockLevel(cropGate, stateRef.current.farmBalancePreset);
      stateRef.current.notification = { text: `LOCKED - UNLOCKS AT LVL ${need}`, life: 120 };
      AudioManager.playSFX("fail");
      setDs({ ...stateRef.current });
      return;
    }
    // If seed tool selected but inventory is 0, auto-open shop with hint
    if (toolId.endsWith("-seed")) {
      const count = stateRef.current.player.inventory[toolId] || 0;
      if (count <= 0) {
        const cropName = toolId.replace("-seed", "").toUpperCase();
        stateRef.current.notification = { text: `NO ${cropName} SEEDS - BUY FROM CITY SHOP!`, life: 160 };
        setDs({ ...stateRef.current });
        // Still select the tool so user knows what they picked
      } else {
        // AUTO-PLANT: Find first available tilled plot and plant immediately
        const availablePlot = stateRef.current.farmPlots.find(p => p.tilled && !p.crop);
        if (availablePlot) {
          // Plant directly on the first available tilled plot
          stateRef.current.player.tool = toolId as any;
          stateRef.current = handleToolAction(stateRef.current);
          setDs({ ...stateRef.current });
          return;
        }
      }
    }
    stateRef.current.player.tool = toolId as any;
    const s = stateRef.current.player;
    if (s.tutorialStep === 1 && toolId === "sickle") s.tutorialStep = 2;
    if (s.tutorialStep === 3 && toolId === "fertilizer") s.tutorialStep = 4;
    if (s.tutorialStep === 5 && toolId.includes("wheat-seed")) s.tutorialStep = 6;
    if (s.tutorialStep === 7 && toolId === "water") s.tutorialStep = 8;
    if (s.tutorialStep === 9 && toolId === "sickle") s.tutorialStep = 10;
    setDs({ ...stateRef.current });
  };

  const applyBalancePreset = (preset: FarmBalancePreset) => {
    stateRef.current.farmBalancePreset = preset;
    applyFarmBalancePreset(preset);
    stateRef.current.notification = { text: `BALANCE PRESET: ${preset.toUpperCase()}`, life: 120 };
    setDs({ ...stateRef.current });
  };

  // â”€â”€ Farm Boost (limited uses â€” speeds up all growing crops by 30%) â”€â”€â”€â”€â”€â”€â”€â”€
  const useFarmBoost = () => {
    const s = stateRef.current;
    if (s.currentMap === "fishing" && s.player.y > 550) {
      s.notification = { text: "WALK TO THE WATER EDGE!", life: 60 };
      setDs({ ...s }); return;
    }
    if (boostCharges <= 0) {
      stateRef.current.notification = { text: "NO BOOST CHARGES LEFT!", life: 100 };
      setDs({ ...stateRef.current }); return;
    }
    const hasGrowing = stateRef.current.farmPlots.some(p => p.crop && !p.crop.ready && !p.crop.dead);
    if (!hasGrowing) {
      stateRef.current.notification = { text: "NO GROWING CROPS TO BOOST!", life: 100 };
      setDs({ ...stateRef.current }); return;
    }
    // Advance all growing crops by 30% of their remaining grow time
    stateRef.current.farmPlots = stateRef.current.farmPlots.map(p => {
      if (!p.crop || p.crop.ready || p.crop.dead) return p;
      const gt = Math.max(1, p.crop.growTime || 20000);
      const boost = gt * 0.30;
      return { ...p, crop: { ...p.crop, plantedAt: p.crop.plantedAt - boost } };
    });
    setBoostCharges(c => c - 1);
    AudioManager.playSFX("boost");
    const boostText = `BOOST APPLIED! ${boostCharges - 1} CHARGES LEFT`;
    stateRef.current.notification = { text: boostText, life: 120 };
    triggerPopup(boostText);
    setDs({ ...stateRef.current });
  };

  const onWheel = (e: React.WheelEvent) => {
    // Disable wheel zoom - no zoom changes allowed
    e.preventDefault();
  };

  // â”€â”€ Canvas click / touch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const onClick = (e: React.MouseEvent) => {
    if (isMobile) return;
    if (activePanel) return;
    if (stateRef.current.demoMode) return;
    if (showWorldMap) return; // let WorldMapScreen handle it
    
    const s = stateRef.current;

    // Fishing map: ALL clicks trigger fishing action (cast or interact)
    if (s.currentMap === "fishing") {
      handleFishingAction(s);
      setDs({ ...s });
      return;
    }

    if (s.fishingSession) {
      handleFishingAction(s);
      setDs({ ...s });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const ps = s.player;
    const oldStep = ps.tutorialStep;
    stateRef.current = handleToolAction(stateRef.current, mx, my);
    if (oldStep === 2 && stateRef.current.farmPlots.some(p => p.tilled)) ps.tutorialStep = 3;
    if (oldStep === 4 && stateRef.current.farmPlots.some(p => p.fertilized)) ps.tutorialStep = 5;
    if (oldStep === 6 && stateRef.current.farmPlots.some(p => p.crop)) ps.tutorialStep = 7;
    if (oldStep === 8 && stateRef.current.farmPlots.some(p => p.watered)) ps.tutorialStep = 9;
    setDs({ ...stateRef.current });
  };

  // â”€â”€ Shop buy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const buyItem = (id: string, price: number, e?: React.MouseEvent) => {
    const s = stateRef.current;
    const effPrice = id.endsWith("-seed") ? getShopSeedPrice(id, price, s.farmBalancePreset) : price;
    const crop = id.endsWith("-seed") ? toolIdToCrop(id) : null;
    if (crop && !isCropPlantingUnlocked(crop, s.player.level, s.farmBalancePreset)) {
      const need = seedUnlockLevel(crop, s.farmBalancePreset);
      stateRef.current.notification = { text: `SEED LOCKED - LVL ${need}`, life: 90 };
      setDs({ ...stateRef.current }); return;
    }
    if (s.player.gold < effPrice) {
      stateRef.current.notification = { text: "NOT ENOUGH GOLD!", life: 80 };
      setDs({ ...stateRef.current }); return;
    }
    AudioManager.playSFX("buy");
    stateRef.current.player = { ...s.player, gold: s.player.gold - effPrice, inventory: { ...s.player.inventory, [id]: (s.player.inventory[id] || 0) + 1 } };
    stateRef.current.pendingCloudSave = true;
    spawnText(stateRef.current, s.player.x, s.player.y - 40, `-${effPrice}G`, "#FF8888");
    if (e && gameRootRef.current && goldHudRef.current && e.currentTarget instanceof HTMLElement) {
      const root = gameRootRef.current.getBoundingClientRect();
      const br = e.currentTarget.getBoundingClientRect();
      const gr = goldHudRef.current.getBoundingClientRect();
      const burstId = Date.now() + Math.random();
      setCoinBursts(prev => [...prev, { id: burstId, sx: br.left + br.width / 2 - root.left, sy: br.top + br.height / 2 - root.top, tx: gr.left + gr.width / 2 - root.left, ty: gr.top + gr.height / 2 - root.top }]);
      window.setTimeout(() => setCoinBursts(prev => prev.filter(b => b.id !== burstId)), 750);
    }
    // Fire on-chain LFG burn for shop purchase (50% of gold spent)
    onShopPurchase(id, effPrice).catch(e => console.warn("[FarmingGame] onShopPurchase:", e.message));
    setDs({ ...stateRef.current });
  };

  const hpPct = ds.player.hp / ds.player.maxHp;
  const claimableQuests = splashDone && introTutorialDone && worldMapDone ? getClaimableQuests(ds) : [];
  const farmGuide = ds.currentMap === "home" ? getFarmStatusGuide(ds.farmPlots, ds.player.tool) : null;

  // â”€â”€ Map context hints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const MAP_REASON: Record<string, string> = {
    city:     "ALPHA — Seeds & GOLD loop. Walk to SHOP signs or tap SHOP.",
    fishing:  "Relax by the water — CAST, wait for a bite, PULL to reel.",
    garden:   "Social hub — walk, meet others (presence). Keys 1–4 emote.",
    suburban: "Cozy slice — explore; progression unlocks more maps.",
  };
  const mapHint = splashDone && introTutorialDone && ds.currentMap !== "home"
    ? MAP_REASON[ds.currentMap] ?? null : null;

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    background: "#000",
    zIndex: 2000,
  };

  // Cover mode: canvas always fills full viewport, no black bars
  // Camera system handles what's visible â€” same as CSS background-size:cover
  const gameContainerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  };

  // â”€â”€ RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div ref={gameRootRef} style={containerStyle}>
      <style>{`
        .gf { font-family: 'Press Start 2P', 'Courier New', monospace; }
        .gf { font-family: 'Press Start 2P', 'Courier New', Courier, monospace; }
        * { -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
        /* Wood panels — same family as pill buttons, thicker gold rim (Lifetopia / Avatar-style HUD) */
        .wood-panel {
          background: linear-gradient(180deg, #D4B896 0%, #9D6B43 45%, #6D4C32 100%);
          border: 4px solid #E8C547;
          border-radius: 18px;
          box-shadow: 0 10px 28px rgba(0,0,0,0.55), 0 4px 0 #3d2918, inset 0 2px 5px rgba(255,255,255,0.35);
          position: relative;
        }
        .gold-header {
          font-family: 'Press Start 2P', 'Courier New', Courier, monospace;
          background: linear-gradient(180deg, #5C4033 0%, #3E2723 100%);
          border-radius: 14px 14px 0 0;
          border: 3px solid #E8C547;
          border-bottom: none;
          padding: 10px 12px;
          color: #FFFFFF;
          text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
          font-size: 10px;
          letter-spacing: 1px;
        }
        /* Primary pill buttons — DEVNET reference: warm brown gradient + thick gold ring + white label */
        .wb {
          font-family: 'Press Start 2P', 'Courier New', Courier, monospace;
          font-weight: bold;
          background: linear-gradient(180deg, #D4B896 0%, #B8895A 42%, #7A5234 100%);
          border: 4px solid #F4D03F;
          border-radius: 999px;
          color: #FFFFFF;
          cursor: pointer;
          box-shadow: 0 5px 0 #2f1f10, inset 0 2px 3px rgba(255,255,255,0.5);
          transition: transform 0.07s ease, box-shadow 0.07s ease, filter 0.12s ease;
          padding: 9px 16px;
          font-size: 8px;
          text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
          touch-action: manipulation;
        }
        .wb:hover {
          background: linear-gradient(180deg, #E8D4B8 0%, #C9A06E 45%, #8B5E3F 100%);
          filter: brightness(1.05);
          transform: translateY(-2px);
          box-shadow: 0 7px 0 #2f1f10, inset 0 2px 4px rgba(255,255,255,0.55);
        }
        .wb:active { transform: translateY(3px); box-shadow: 0 2px 0 #2f1f10; filter: brightness(0.96); }
        .wb.active {
          background: linear-gradient(180deg, #FFE082 0%, #F4D03F 40%, #C9A227 100%);
          border-color: #FFF8E1;
          color: #3E2723;
          text-shadow: 1px 1px 0 rgba(255,255,255,0.35);
          box-shadow: 0 0 18px rgba(255, 215, 0, 0.45), 0 5px 0 #5d4a16;
        }
        .tray { background: linear-gradient(180deg, #A07844 0%, #7B502C 100%); padding: 12px 20px; border-radius: 50px; border: 4px solid #5C4033; box-shadow: 0 10px 0 rgba(0,0,0,0.5), inset 0 2px 8px rgba(255,255,255,0.25); display: flex; gap: 8px; }
        .slot { width: 58px; height: 58px; background: linear-gradient(135deg, #8B5E3C 0%, #5E3A24 100%); border: 3px solid #4D2D18; border-radius: 50%; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; transition: all 0.1s; box-shadow: inset 0 0 10px rgba(0,0,0,0.7), 0 3px 6px rgba(0,0,0,0.3); touch-action: manipulation; }
        .slot:hover { transform: translateY(-3px) scale(1.05); border-color: #FFD700; box-shadow: 0 5px 12px rgba(255,215,0,0.25), inset 0 0 8px rgba(0,0,0,0.5); }
        .slot:active { transform: translateY(2px) scale(0.95) !important; box-shadow: inset 0 4px 12px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.4) !important; border-color: #FFD700 !important; filter: brightness(0.85); }
        .slot.active-tool { background: linear-gradient(135deg, #D4AF37 0%, #A07820 100%); border-color: #FFD700; border-width: 3px; box-shadow: 0 3px 10px rgba(255,215,0,0.35), inset 0 0 8px rgba(0,0,0,0.4); }
        .slot.active-tool:active { transform: translateY(2px) scale(0.95) !important; filter: brightness(0.8); }
        .tool-img { width: 40px; height: 40px; object-fit: contain; filter: drop-shadow(2px 4px 4px rgba(0,0,0,0.6)); transition: transform 0.2s; }
        .slot-key { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); font-size: 5px; color: #FFD700; font-weight: bold; text-shadow: 1px 1.5px 1px #000; }
        .logo-container { position: absolute; top: 15px; left: 15px; z-index: 2000; overflow: hidden; cursor: pointer; border-radius: 20px; }
        .logo-img { height: 150px; object-fit: contain; filter: drop-shadow(4px 0 0 #FFF) drop-shadow(-4px 0 0 #FFF) drop-shadow(0 4px 0 #FFF) drop-shadow(0 -4px 0 #FFF) drop-shadow(0 20px 20px rgba(0,0,0,0.6)); }
        .logo-container::after { content: ""; position: absolute; top: -50%; left: -60%; width: 25%; height: 200%; background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 100%); transform: rotate(30deg); animation: shine 4s infinite linear; }
        @keyframes shine { 0% { left: -100%; } 30% { left: 150%; } 100% { left: 150%; } }
        @keyframes coinFlyToHud { from { transform: translate(0,0) scale(1); opacity: 1; } to { transform: translate(var(--cdx), var(--cdy)) scale(0.25); opacity: 0; } }
        @keyframes toolGlow { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.8); } 50% { box-shadow: 0 0 25px 15px rgba(255,255,255,0.5); } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.8); } }
        .glowing-tool { animation: toolGlow 1.5s infinite; z-index: 10000; border-radius: 50%; }
        .slot-tooltip { display: none; position: absolute; bottom: calc(100% + 22px); left: 50%; transform: translateX(-50%); background: rgba(30,18,8,0.97); border: 3px solid #E8C547; border-radius: 10px; padding: 7px 10px; white-space: nowrap; z-index: 99999; pointer-events: none; min-width: 120px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.7); color: #FFF5E0; text-shadow: 1px 1px 0 #000; }
        .slot-tooltip::after { content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: #E8C547; }
        .slot:hover .slot-tooltip { display: block; }
        @keyframes farmStatusPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
        .farm-status-bar { animation: farmStatusPulse 3s infinite; }
        .shop-scroll-area::-webkit-scrollbar { width: 10px; }
        .shop-scroll-area::-webkit-scrollbar-track { background: #5C4033; border-radius: 10px; }
        .shop-scroll-area::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #D4AF37 0%, #8B5E3C 100%); border: 2px solid #5C4033; border-radius: 10px; }
        @keyframes walletPulse { 0%,100% { box-shadow: 0 4px 0 #3a2212, 0 0 0 0 rgba(171,159,242,0.7); } 50% { box-shadow: 0 4px 0 #3a2212, 0 0 0 8px rgba(171,159,242,0); } }
        @keyframes wc-spin { to { transform: rotate(360deg); } }
        @keyframes vfxPop { 0% { transform: scale(0) rotate(0deg); opacity: 1; } 60% { transform: scale(1.4) rotate(180deg); opacity: 0.8; } 100% { transform: scale(0.8) rotate(360deg); opacity: 0; } }
        @keyframes vfxFloat { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-60px) scale(0.3); opacity: 0; } }
        @keyframes vfxStar { 0% { transform: scale(0) rotate(0deg); opacity: 1; } 50% { transform: scale(1.2) rotate(180deg); opacity: 1; } 100% { transform: scale(0) rotate(360deg); opacity: 0; } }
        @keyframes vfxRipple { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes vfxBounce { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-20px) scale(1.1); } 60% { transform: translateY(-8px) scale(0.95); } 100% { transform: translateY(0) scale(1); } }
        @keyframes wobble { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        .vfx-particle { position: absolute; pointer-events: none; border-radius: 50%; }
        .vfx-star { position: absolute; pointer-events: none; }
        .vfx-ripple { position: absolute; pointer-events: none; border-radius: 50%; border: 2px solid; }
        /* Mobile landscape fit */
        @media (max-height: 500px) and (orientation: landscape) {
          .tray { padding: 6px 10px !important; gap: 4px !important; }
          .slot { width: 44px !important; height: 44px !important; }
          .tool-img { width: 30px !important; height: 30px !important; }
        }
      `}</style>

      {/* â”€â”€ LOGO â”€â”€ */}
      {splashDone && (walletConnected || walletAddress.toLowerCase().startsWith("guest")) && !isMobile && (
        <div className="logo-container"><img src="/logo.png" alt="LIFETOPIA" className="logo-img" /></div>
      )}

      {/* â”€â”€ COIN BURST ANIMATION â”€â”€ */}
      {coinBursts.map((b) => (
        <div key={b.id} style={{ position: "absolute", left: b.sx, top: b.sy, width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: 2, background: "#FFD700", boxShadow: "0 0 6px #FFF8", pointerEvents: "none", zIndex: 2500, ["--cdx" as string]: `${b.tx - b.sx}px`, ["--cdy" as string]: `${b.ty - b.sy}px`, animation: "coinFlyToHud 0.65s ease-out forwards" }} />
      ))}

      {/* â”€â”€ CANVAS â”€â”€ */}
      <div style={gameContainerStyle}>
      <canvas
        ref={canvasRef}
        width={window.innerWidth || 1280}
        height={window.innerHeight || 720}
        onClick={onClick}
        onMouseMove={(e) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          stateRef.current.pointerCanvas = { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
        }}
        onMouseLeave={() => { stateRef.current.pointerCanvas = null; stateRef.current.plotHoverFromPointer = null; }}
        onWheel={onWheel}
        onTouchStart={(e) => {
          if (!isMobile) return;
          if (!introTutorialDone || activePanel || stateRef.current.demoMode || showWorldMap) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          // One finger tap - check if it's a quick tap for movement
          if (e.touches.length === 1) {
            const t = e.touches[0];
            if (!t) return;
            if (mobilePanRef.current !== null) return;

            const rect = canvas.getBoundingClientRect();
            const dir = getTouchQuadrant(
              t.clientX - rect.left,
              t.clientY - rect.top,
              rect.width,
              rect.height,
            );
            mobilePanRef.current = {
              id: t.identifier,
              sx: t.clientX,
              sy: t.clientY,
              t0: Date.now(),
              maxD: 0,
              activeDir: dir,
            };
            // Only add quadrant keys for swipe movement, not tap
            if (dir) {
              quadrantToKeys(dir).forEach((k) => stateRef.current.keys.add(k));
            }
          }
          // Two finger touch - start camera pan
          else if (e.touches.length === 2) {
            e.preventDefault();
          }
          e.stopPropagation();
        }}
        onTouchMove={(e) => {
          if (!isMobile || !mobilePanRef.current) return;
          
          // Two finger drag - camera pan
          if (e.touches.length === 2) {
            e.preventDefault();
            return;
          }
          
          // One finger movement
          const m = mobilePanRef.current;
          let t: React.Touch | null = null;
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === m.id) {
              t = e.touches[i];
              break;
            }
          }
          if (!t) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          m.maxD = Math.max(m.maxD, Math.hypot(t.clientX - m.sx, t.clientY - m.sy));
          
          // Only update quadrant if movement is significant (>30px from start)
          if (m.maxD > 30) {
            const rect = canvas.getBoundingClientRect();
            const newDir = getTouchQuadrant(
              t.clientX - rect.left,
              t.clientY - rect.top,
              rect.width,
              rect.height,
            );
            if (newDir !== m.activeDir) {
              ["arrowup", "arrowdown", "arrowleft", "arrowright"].forEach((k) => stateRef.current.keys.delete(k));
              m.activeDir = newDir;
              if (newDir) {
                quadrantToKeys(newDir).forEach((k) => stateRef.current.keys.add(k));
              }
            }
          }
          e.preventDefault();
        }}
        onTouchEnd={(e) => {
          if (!isMobile || !mobilePanRef.current) return;
          const m = mobilePanRef.current;
          let endTouch: React.Touch | null = null;
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === m.id) {
              endTouch = e.changedTouches[i];
              break;
            }
          }
          if (!endTouch) {
            mobilePanRef.current = null;
            return;
          }

          ["arrowup", "arrowdown", "arrowleft", "arrowright"].forEach((k) => stateRef.current.keys.delete(k));

          const dur = Date.now() - m.t0;
          // Quick tap with small movement = tap to move/act
          const tap = dur < 300 && m.maxD < 25;

          if (tap && introTutorialDone && !activePanel && !stateRef.current.demoMode && !showWorldMap) {
            const canvas = canvasRef.current;
            if (canvas) {
              const rect = canvas.getBoundingClientRect();
              const mx = (endTouch.clientX - rect.left) * (canvas.width / rect.width);
              const my = (endTouch.clientY - rect.top) * (canvas.height / rect.height);
              stateRef.current.keys.clear();
              const ps = stateRef.current.player;
              const oldStep = ps.tutorialStep;
              stateRef.current = handleToolAction(stateRef.current, mx, my);
              if (oldStep === 2 && stateRef.current.farmPlots.some((p) => p.tilled)) ps.tutorialStep = 3;
              if (oldStep === 4 && stateRef.current.farmPlots.some((p) => p.fertilized)) ps.tutorialStep = 5;
              if (oldStep === 6 && stateRef.current.farmPlots.some((p) => p.crop)) ps.tutorialStep = 7;
              if (oldStep === 8 && stateRef.current.farmPlots.some((p) => p.watered)) ps.tutorialStep = 9;
              setDs({ ...stateRef.current });
            }
          }

          mobilePanRef.current = null;
          e.preventDefault();
        }}
        onTouchCancel={() => {
          if (!isMobile || !mobilePanRef.current) return;
          ["arrowup", "arrowdown", "arrowleft", "arrowright"].forEach((k) => stateRef.current.keys.delete(k));
          mobilePanRef.current = null;
        }}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          cursor: ds.demoMode ? "default" : "crosshair",
          touchAction: "none",
          pointerEvents: ds.demoMode ? "none" : "auto",
        }}
      />
      </div>

      {/* â”€â”€ ACTION POPUP â”€â”€ */}
      <ActionPopup popup={actionPopup} onDone={() => setActionPopup(null)} />

      {/* â”€â”€ UNITY-STYLE 2D VFX OVERLAY â”€â”€ */}
      {vfxOverlay.map(p => {
        if (p.type === "star") return (
          <div key={p.id} className="vfx-star" style={{
            left: p.x, top: p.y, position: "absolute", pointerEvents: "none", zIndex: 4000,
            animation: "vfxStar 0.7s ease-out forwards",
            filter: `drop-shadow(0 0 6px ${p.color})`,
          }}>
            <svg width={p.size} height={p.size} viewBox="0 0 10 10">
              <polygon points="5,0 6.5,3.5 10,4 7.5,6.5 8,10 5,8 2,10 2.5,6.5 0,4 3.5,3.5" fill={p.color} />
            </svg>
          </div>
        );
        if (p.type === "ripple") return (
          <div key={p.id} className="vfx-ripple" style={{
            left: p.x - p.size, top: p.y - p.size,
            width: p.size * 2, height: p.size * 2,
            borderColor: p.color, zIndex: 4000,
            animation: "vfxRipple 0.6s ease-out forwards",
          }} />
        );
        if (p.type === "sparkle") return (
          <div key={p.id} style={{
            position: "absolute", left: p.x, top: p.y, pointerEvents: "none", zIndex: 4000,
            width: p.size / 2, height: p.size / 2, borderRadius: "50%",
            background: p.color, boxShadow: `0 0 ${p.size}px ${p.color}`,
            animation: "vfxFloat 0.8s ease-out forwards",
          }} />
        );
        return (
          <div key={p.id} style={{
            position: "absolute", left: p.x, top: p.y, pointerEvents: "none", zIndex: 4000,
            width: p.size, height: p.size, borderRadius: "50%",
            background: `radial-gradient(circle, ${p.color} 0%, transparent 70%)`,
            animation: "vfxPop 0.6s ease-out forwards",
          }} />
        );
      })}

      {/* â”€â”€ SPLASH â”€â”€ */}
      {!splashDone && <SplashScreen onSelectMap={handleSplashSelect} />}

      {/* â”€â”€ PRE-FARM TUTORIAL â”€â”€ */}
      {splashDone && !introTutorialDone && (
        <PreFarmTutorial visible={true} onFinished={handlePreFarmTutorialFinished} onMapFocus={handlePreFarmMapFocus} />
      )}

      {/* â”€â”€ WORLD MAP (shown after tutorial on desktop + mobile) â”€â”€ */}
      {splashDone && introTutorialDone && !ds.demoMode && showWorldMap && (
        <WorldMapScreen
          onSelectMap={(map) => {
            doSwitchMap(map);
            AudioManager.playSFX("click");
            setShowWorldMap(false);
          }}
        />
      )}

      {/* â”€â”€ MOBILE HUD (compact, single screen) â€” hidden when WorldMapScreen is open â”€â”€ */}
      {isMobile && splashDone && introTutorialDone && !ds.demoMode && !showWorldMap && (
        <MobileHUD
          ds={ds}
          tools={TOOLS}
          onSelectTool={selectTool}
          onOpenPanel={setActivePanel}
          onOpenWorldMap={() => { setShowWorldMap(true); AudioManager.playSFX("click"); }}
          currentMap={ds.currentMap}
          gold={ds.player.gold}
          level={ds.player.level}
          claimableCount={claimableQuests.length}
          boostCharges={boostCharges}
          onBoost={useFarmBoost}
          isGuest={walletType === null}
          mapActions={
            !activePanel ? (
              <>
                {ds.currentMap === "city" && (
                  <button
                    type="button"
                    style={mobileHudAccentBtnStyle}
                    onClick={() => { setActivePanel("shop"); AudioManager.playSFX("click"); }}
                  >
                    SHOP
                  </button>
                )}
                {ds.currentMap === "home" && (
                  <button
                    type="button"
                    style={ds.player.tool ? mobileHudAccentBtnStyle : mobileHudActionBtnStyle}
                    onClick={() => {
                      if (stateRef.current.demoMode) return;
                      const s = stateRef.current;
                      const canvas = canvasRef.current;
                      if (!canvas) return;
                      const p = s.player;
                      // Convert player world pos → canvas screen coords correctly
                      const screenX = p.x * s.zoom - s.cameraX;
                      const screenY = p.y * s.zoom - s.cameraY;
                      stateRef.current = handleToolAction(stateRef.current, screenX, screenY);
                      setDs({ ...stateRef.current });
                      AudioManager.playSFX("click");
                    }}
                  >
                    {ds.player.tool ? "USE" : "ACT"}
                  </button>
                )}
                {ds.currentMap === "fishing" && (
                  <button
                    type="button"
                    style={
                      ds.fishingSession && (ds.fishingSession.state === "bite" || ds.fishingSession.state === "struggle")
                        ? mobileHudAccentBtnStyle
                        : mobileHudActionBtnStyle
                    }
                    onClick={() => { handleFishingAction(stateRef.current); setDs({ ...stateRef.current }); AudioManager.playSFX("click"); }}
                  >
                    {!ds.fishingSession
                      ? "CAST"
                      : ds.fishingSession.state === "bite" || ds.fishingSession.state === "struggle"
                        ? "PULL"
                        : "WAIT"}
                  </button>
                )}
                {ds.currentMap === "garden" && (
                  <>
                    {[
                      { key: "wave", label: "1" },
                      { key: "dance", label: "2" },
                      { key: "sit", label: "3" },
                      { key: "laugh", label: "4" },
                    ].map((emote) => (
                      <button
                        key={emote.key}
                        type="button"
                        style={mobileHudActionBtnStyle}
                        onClick={() => {
                          stateRef.current.player.emote = emote.key as any;
                          stateRef.current.player.emoteUntil = stateRef.current.time + 5000;
                          setDs({ ...stateRef.current });
                          AudioManager.playSFX("click");
                        }}
                      >
                        {emote.label}
                      </button>
                    ))}
                  </>
                )}
              </>
            ) : null
          }
        />
      )}

      {/* â”€â”€ DESKTOP TOP NAV â”€â”€ */}
      {!isMobile && !showWorldMap && (
        <div style={{ position: "absolute", top: 20, right: 20, display: "flex", gap: 8, alignItems: "center" }}>
          {/* â”€â”€ MAP BUTTON â”€â”€ */}
          <button
            className="wb gf"
            onClick={() => { setShowWorldMap(true); AudioManager.playSFX("click"); }}
            style={{
              background: "linear-gradient(180deg, #CE9E64 0%, #8D5A32 100%)",
              border: "3px solid #D4AF37",
              boxShadow: "0 4px 0 #3a2212, 0 0 8px rgba(212,175,55,0.3)",
              color: "#FFF5E0",
              fontSize: 7,
              padding: "8px 14px",
              letterSpacing: 1,
            }}
          >
            MAP
          </button>
          <div className="wb gf" style={{ color: "#FFFFFF", padding: "6px 15px", pointerEvents: "none" }}>LVL {ds.player.level}</div>
          <button className="wb gf" onClick={() => { setActivePanel("quests"); AudioManager.playSFX("click"); }} style={{ position: "relative" }}>
            TASKS
            {claimableQuests.length > 0 && <span style={{ position: "absolute", top: -6, right: -4, color: "#FFFFFF", fontSize: 14, lineHeight: 1, fontWeight: "bold", textShadow: "0 0 4px #000" }}>!</span>}
          </button>
          <button className="wb gf" onClick={() => { setActivePanel("inventory"); AudioManager.playSFX("click"); }}>ITEMS</button>
          <button className="wb gf" onClick={() => { setActivePanel("nft"); AudioManager.playSFX("click"); }}>MY NFTS</button>
          <div ref={goldHudRef} className="wb gf" style={{ color: "#FFD700", padding: "8px 20px", fontSize: 13, border: "2px solid #FFD700", boxShadow: "0 0 10px rgba(255,215,0,0.4)", pointerEvents: "none" }}>GOLD {ds.player.gold}</div>
          <div className="wb gf" style={{ color: "#FFFFFF", padding: "6px 12px", pointerEvents: "none" }}>{ds.player.lifetopiaGold} LFG</div>
          {/* Devnet status button */}
          <button
            className="wb gf"
            onClick={() => { setActivePanel("devnet"); AudioManager.playSFX("click"); }}
            style={{
              background: "linear-gradient(180deg, #CE9E64 0%, #8D5A32 100%)",
              border: "3px solid #D4AF37",
              boxShadow: "0 4px 0 #3a2212, 0 0 8px rgba(212,175,55,0.3)",
              color: "#FFFFFF",
              fontSize: 7,
              padding: "8px 14px",
              letterSpacing: 1,
            }}
          >
            DEVNET
          </button>
          {walletType === null && (
            <button
              className="wb gf"
              onClick={() => { setActivePanel("wallet"); AudioManager.playSFX("click"); }}
              style={{
                background: "linear-gradient(180deg,#ab9ff2,#512da8)",
                border: "3px solid #ab9ff2",
                boxShadow: "0 4px 0 #2a1654, 0 0 8px rgba(171,159,242,0.4)",
                color: "#FFFFFF",
                fontSize: 7,
                padding: "8px 14px",
                letterSpacing: 1,
                animation: "walletPulse 2s infinite",
              }}
            >
              CONNECT WALLET
            </button>
          )}
          <button className="wb gf" style={{ fontSize: 10, padding: "6px 10px" }} onClick={() => { setActivePanel("settings"); AudioManager.playSFX("click"); }}>SET</button>
          {ds.nftBoostActive && <div className="wb gf" style={{ color: "#FFFFFF", padding: "6px 12px", pointerEvents: "none", fontSize: 6, borderColor: "#5C4033", background: "linear-gradient(180deg,#CE9E64 0%,#8D5A32 100%)" }}>BOOST ACTIVE</div>}
        </div>
      )}

      {/* â”€â”€ FARM STATUS BAR â”€â”€ */}
      {splashDone && introTutorialDone && worldMapDone && !showWorldMap && !activePanel && ds.currentMap === "home" && farmGuide && (
        <div style={{
          position: "absolute",
          top: isMobile ? 38 : 64,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1200,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          maxWidth: isMobile ? "96vw" : 1000,
          background: isMobile ? "rgba(10,8,4,0.82)" : "transparent",
          borderRadius: isMobile ? 8 : 0,
          padding: isMobile ? "3px 8px" : 0,
        }}>
          {farmGuide.slot !== null && (
            <span className="gf" style={{
              fontSize: isMobile ? 7 : 10,
              color: "#FFD700",
              textShadow: "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
              letterSpacing: "0.05em",
              flexShrink: 0,
            }}>
              [{farmGuide.slot}]
            </span>
          )}
          <span className="gf" style={{
            fontSize: isMobile ? 6 : 9,
            color: "#FFD700",
            textShadow: "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
            letterSpacing: "0.04em",
            lineHeight: 1.5,
            whiteSpace: isMobile ? "normal" : "nowrap",
            textAlign: "center",
          }}>
            {farmGuide.action}
          </span>
        </div>
      )}


      {/* â”€â”€ MAP CONTEXT HINT (non-farm maps) â”€â”€ */}
      {mapHint && !activePanel && (
        <div style={{
          position: "absolute",
          top: isMobile ? 38 : 64,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1200,
          pointerEvents: "none",
          maxWidth: isMobile ? "96vw" : 800,
          background: isMobile ? "rgba(10,8,4,0.82)" : "transparent",
          borderRadius: isMobile ? 8 : 0,
          padding: isMobile ? "3px 8px" : 0,
          textAlign: "center",
        }}>
          <span className="gf" style={{
            fontSize: isMobile ? 6 : 9,
            color: "#FFD700",
            textShadow: "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
            letterSpacing: "0.04em",
            lineHeight: 1.5,
            whiteSpace: isMobile ? "normal" : "nowrap",
          }}>
            {mapHint}
          </span>
        </div>
      )}

      {/* â”€â”€ DESKTOP TOOL TRAY + BOOST BUTTON â”€â”€ */}
      {!isMobile && !showWorldMap && (
        <div style={{ position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, pointerEvents: "auto" }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}>
          {ds.currentMap === "home" && (
            <>
              <div className="tray">
                {TOOLS.map((t, i) => {
                  const slotNum = i + 1;
                  const isActive = ds.player.tool === t.id;
                  const isGuideTarget = farmGuide?.slot === slotNum;
                  const matchesStep = tutorialActive && ((tutStep === 1 && t.id === "sickle") || (tutStep === 2 && (t.id === "wheat-seed" || t.id.includes("seed"))) || (tutStep === 3 && t.id === "water") || (tutStep === 4 && (t.id === "axe" || t.id === "axe-large")));
                  const cropGate = t.id.endsWith("-seed") ? toolIdToCrop(t.id) : null;
                  const toolLocked = cropGate && !isCropPlantingUnlocked(cropGate, ds.player.level, ds.farmBalancePreset);
                  const neededLvl = cropGate ? seedUnlockLevel(cropGate, ds.farmBalancePreset) : 0;
                  return (
                    <div key={t.id} className={`slot ${isActive ? "active-tool" : ""} ${matchesStep || isGuideTarget ? "glowing-tool" : ""}`} onClick={() => { selectTool(t.id); AudioManager.playSFX("click"); }}
                      style={{ position: "relative", opacity: toolLocked ? 0.6 : 1 }}>
                      {/* Tooltip on hover */}
                      <div className="slot-tooltip gf">
                        {(t as any).tip.split("\n").map((line: string, li: number) => (
                          <div key={li} style={{ fontSize: li === 0 ? 6 : 5, color: li === 0 ? "#FFD700" : "#FFE4B5", lineHeight: 1.7 }}>{line}</div>
                        ))}
                        {t.id.endsWith("-seed") && (
                          <>
                            {(() => {
                              const seedInfo: Record<string, {time: string; gold: string; color: string}> = {
                                "wheat-seed":  { time: "30s",   gold: "+5G",  color: "#FFD700" },
                                "tomato-seed": { time: "60s",   gold: "+10G", color: "#FF6347" },
                                "carrot-seed": { time: "90s",   gold: "+15G", color: "#FF8C00" },
                                "pumpkin-seed":{ time: "120s",  gold: "+25G", color: "#FF4500" },
                              };
                              const info = seedInfo[t.id];
                              return info ? (
                                <div style={{ display: "flex", gap: 6, marginTop: 3, fontSize: 4, color: "#FFE4B5" }}>
                                  <span style={{ color: "#4FC3F7" }}>{info.time}</span>
                                  <span style={{ color: info.color }}>{info.gold}</span>
                                </div>
                              ) : null;
                            })()}
                            <div style={{ fontSize: 5, color: toolLocked ? "#FF4444" : (ds.player.inventory[t.id] || 0) > 0 ? "#6DBF82" : "#FF7070", marginTop: 2 }}>
                              {toolLocked ? `LOCKED - LV ${neededLvl}` : (ds.player.inventory[t.id] || 0) > 0 ? `${ds.player.inventory[t.id]} seeds` : "OUT - Buy from City"}
                            </div>
                          </>
                        )}
                      </div>
                      {/* Slot number badge */}
                      <div style={{
                        position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                        background: isGuideTarget
                          ? "linear-gradient(180deg, #CE9E64 0%, #8D5A32 100%)"
                          : isActive
                            ? "linear-gradient(180deg, #FFFFFF 0%, #CCCCCC 100%)"
                            : "linear-gradient(180deg, #CE9E64 0%, #8D5A32 100%)",
                        border: `2px solid ${isGuideTarget ? "#FFFFFF" : "#5C4033"}`,
                        borderRadius: "50%",
                        width: 20, height: 20,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isGuideTarget ? "0 0 8px rgba(255,255,255,0.8)" : "0 2px 0 #3a2212",
                        zIndex: 10,
                        animation: isGuideTarget ? "toolGlow 1s infinite" : "none",
                      }}>
                        <span className="gf" style={{ fontSize: 6, color: isGuideTarget ? "#FFFFFF" : isActive ? "#3E2723" : "#FFFFFF", fontWeight: "bold" }}>{slotNum}</span>
                      </div>
                      <div style={{ width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img src={t.img} style={{ width: 44, height: 44, opacity: isActive ? 1 : 0.8 }} alt={t.label} />
                      </div>
                      
                      {/* SEED COUNT BADGE */}
                      {t.id.endsWith("-seed") && (
                        <div style={{
                          position: "absolute", bottom: -5, right: -5,
                          background: (ds.player.inventory[t.id] || 0) > 0 ? "#4CAF50" : "#F44336",
                          border: "2px solid #5C4033", borderRadius: "50%",
                          width: 18, height: 18, fontSize: 8,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#FFF", fontWeight: "bold", zIndex: 5
                        }}>
                          {ds.player.inventory[t.id] || 0}
                        </div>
                      )}
                      
                      {/* Seed Cooldown Timer Overlay */}
                      {(ds.seedCooldowns[t.id] || 0) > 0 && (
                        <div style={{
                          position: "absolute", inset: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(0,0,0,0.4)", borderRadius: "50%",
                          fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#FFFFFF",
                          textShadow: "1px 1px 2px #000"
                        }}>
                          {Math.ceil(ds.seedCooldowns[t.id] / 1000)}s
                        </div>
                      )}

                      {/* Tool label below */}
                      <div className="gf" style={{ position: "absolute", bottom: -16, left: "50%", transform: "translateX(-50%)", fontSize: 5, color: isActive ? "#FFD700" : "#FFE4B5", textShadow: "1px 1px #000", whiteSpace: "nowrap" }}>
                        {t.label}
                      </div>

                      {/* Level lock overlay */}
                      {toolLocked && (
                        <div style={{
                          position: "absolute", inset: 0, borderRadius: "50%",
                          background: "rgba(0,0,0,0.5)",
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          zIndex: 10,
                        }}>
                          <span className="gf" style={{ fontSize: 7, color: "#FFF", textShadow: "1px 1px #000" }}>[ LV{neededLvl} ]</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* BOOST button */}
                <div
                  onClick={() => { useFarmBoost(); AudioManager.playSFX("click"); }}
                  className="slot"
                  style={{
                    position: "relative",
                    background: boostCharges > 0
                      ? "linear-gradient(135deg, #FFE4B5 0%, #C8A020 100%)"
                      : "linear-gradient(135deg, #5A4030 0%, #3A2010 100%)",
                    border: boostCharges > 0 ? "3px solid #FFD700" : "3px solid #4D2D18",
                    boxShadow: boostCharges > 0 ? "0 0 14px rgba(255,215,0,0.5), inset 0 0 6px rgba(255,255,255,0.3)" : "inset 0 0 10px rgba(0,0,0,0.7)",
                    opacity: boostCharges > 0 ? 1 : 0.5,
                    cursor: boostCharges > 0 ? "pointer" : "not-allowed",
                  }}
                >
                  {/* Slot number badge for boost */}
                  <div style={{
                    position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                    background: "linear-gradient(180deg, #CE9E64 0%, #8D5A32 100%)",
                    border: "2px solid #5C4033", borderRadius: "50%",
                    width: 20, height: 20,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 0 #3a2212", zIndex: 10,
                  }}>
                    <span className="gf" style={{ fontSize: 6, color: "#FFD700" }}>B</span>
                  </div>
                  <div style={{ position: "relative", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src="/boost.png" style={{ width: 40, height: 40, opacity: boostCharges > 0 ? 1 : 0.6 }} alt="BOOST" />
                    <div style={{
                      position: "absolute", bottom: 2, right: 2,
                      background: boostCharges > 0 ? "#4CAF50" : "#8D5A32",
                      border: "2px solid #5C4033", borderRadius: "50%",
                      width: 18, height: 18, fontSize: 8,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#FFF", fontWeight: "bold", zIndex: 10
                    }}>
                      {boostCharges}
                    </div>
                  </div>
                  <div className="gf" style={{ position: "absolute", bottom: -16, left: "50%", transform: "translateX(-50%)", fontSize: 5, color: "#FFE4B5", textShadow: "1px 1px #000", whiteSpace: "nowrap" }}>
                    BOOST
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}



      {/* â”€â”€ PANELS OVERLAY â€” compact on mobile â”€â”€ */}
      {activePanel && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: `env(safe-area-inset-top,0) ${isMobile ? 8 : 16}px env(safe-area-inset-bottom,0)` }} onClick={(e) => { if (e.target === e.currentTarget) closePanel(); }}>
          <div className="wood-panel" style={{ padding: 0, minWidth: isMobile ? "min(300px,94vw)" : 280, maxWidth: isMobile ? "94vw" : 380, maxHeight: isMobile ? "72dvh" : "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="gold-header gf" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: isMobile ? 7 : 10, flexShrink: 0, padding: isMobile ? "6px 10px" : "10px 12px" }}>
              <span>
                {activePanel === "wallet" && "WALLET"}
                {activePanel === "quests" && "DAILY TASKS"}
                {activePanel === "inventory" && "INVENTORY"}
                {activePanel === "nft" && "MY NFTS"}
                {activePanel === "shop" && "CITY SHOP"}
                {activePanel === "settings" && "SETTINGS"}
                {activePanel === "devnet" && "DEVNET INFO"}
              </span>
              <button className="wb" style={{ padding: isMobile ? "2px 8px" : "4px 10px", fontSize: isMobile ? 7 : 9 }} onClick={() => { closePanel(); AudioManager.playSFX("click"); }}>X</button>
            </div>
            <div style={{ padding: isMobile ? 8 : 14, color: "#4D2D18", overflowY: "auto", flex: 1 }} className="gf">

              {/* â”€â”€ WALLET PANEL â€” compact for mobile â”€â”€ */}
              {activePanel === "wallet" && (
                <div style={{ textAlign: "center" }}>
                  {walletType !== null ? (
                    <>
                      {/* Connected header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: isMobile ? 6 : 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4CAF50", boxShadow: "0 0 8px #4CAF50", flexShrink: 0 }} />
                        <div className="gf" style={{ color: "#4CAF50", fontSize: isMobile ? 6 : 8 }}>CONNECTED</div>
                        <div className="gf" style={{ fontSize: 5, color: "#ab9ff2", background: "rgba(0,0,0,0.2)", padding: "2px 6px", borderRadius: 4 }}>
                          SOLANA
                        </div>
                      </div>
                      {/* Address box */}
                      <div
                        onClick={() => { navigator.clipboard?.writeText(walletAddress); stateRef.current.notification = { text: "ADDRESS COPIED!", life: 80 }; setDs({ ...stateRef.current }); AudioManager.playSFX("click"); }}
                        style={{ background: "rgba(0,0,0,0.3)", border: "2px solid #5C4033", padding: isMobile ? "6px 8px" : "10px 12px", borderRadius: 10, fontSize: isMobile ? 5 : 6, wordBreak: "break-all", color: "#FFE4B5", textShadow: "1px 1px #000", marginBottom: isMobile ? 6 : 10, cursor: "pointer", lineHeight: 1.8 }}
                        title="Click to copy"
                      >
                        {walletAddress}
                        <div style={{ fontSize: 4, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>TAP TO COPY</div>
                      </div>
                      <div className="gf" style={{ color: "#FFD700", fontSize: isMobile ? 8 : 10, marginBottom: isMobile ? 8 : 14 }}>{ds.player.lifetopiaGold} LFG</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 10 }}>
                        <button className="wb gf" style={{ width: "100%", fontSize: isMobile ? 5 : 7, padding: isMobile ? "8px" : "12px" }}
                          onClick={async () => { AudioManager.playSFX("click"); const res = await initializeTokenAccount(); stateRef.current.notification = { text: res.success ? "TOKEN ACCOUNT INITIALIZED!" : (res.error || "INIT FAILED").toUpperCase().slice(0, 40), life: 200 }; setDs({ ...stateRef.current }); }}>
                          INIT TOKEN ACCOUNT
                        </button>
                        <a href={`https://solscan.io/address/${walletAddress}`} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
                          <button className="wb gf" style={{ width: "100%", fontSize: isMobile ? 5 : 7, padding: isMobile ? "8px" : "12px" }}>SOLSCAN â†—</button>
                        </a>
                        <button className="wb gf" style={{ width: "100%", fontSize: isMobile ? 5 : 6, padding: isMobile ? "6px" : "10px", marginTop: isMobile ? 2 : 4, background: "linear-gradient(180deg,#8B2020,#5C1010)", borderColor: "#8B2020" }}
                          onClick={() => { disconnectWallet(); AudioManager.playSFX("click"); closePanel(); }}>
                          DISCONNECT
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 8 : 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 2px 0" }}>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
                        <span className="gf" style={{ fontSize: 5, color: "rgba(255,255,255,0.3)" }}>OR EXTENSIONS</span>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
                      </div>
                      {/* Phantom â€” green dot if found (injected) OR mobile native detected */}
                      <button className="wb gf" onClick={() => connectPhantom()} disabled={connectingWallet !== null}
                        style={{ fontSize: isMobile ? 6 : 8, padding: isMobile ? "8px" : "14px", background: "linear-gradient(180deg,#A0693A,#6B3E1E)", border: "2px solid #7C5230", color: "#FFE4B5", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: "100%", borderRadius: 999, boxShadow: "0 3px 0 #3E1F08" }}>
                        <span style={{ flex: 1, textAlign: "center" }}>{connectingWallet === "phantom" ? "..." : "PHANTOM"}</span>
                        {connectingWallet === "phantom" && <span style={{ position:"absolute", right: isMobile ? 8 : 14, width:8, height:8, border:"2px solid rgba(255,228,181,0.3)", borderTopColor:"#FFE4B5", borderRadius:"50%", animation:"wc-spin 0.7s linear infinite" }} />}
                        {(phantomFound || mobilePhantomInstalled) && connectingWallet !== "phantom" && (
                          <span style={{ position:"absolute", right: isMobile ? 8 : 14, width:8, height:8, borderRadius:"50%", background:"#6BFF8A", boxShadow:"0 0 6px #6BFF8A" }} />
                        )}
                      </button>
                      {/* Solflare */}
                      <button className="wb gf" onClick={() => connectSolflare()} disabled={connectingWallet !== null}
                        style={{ fontSize: isMobile ? 6 : 8, padding: isMobile ? "8px" : "14px", background: "linear-gradient(180deg,#A0693A,#6B3E1E)", border: "2px solid #7C5230", color: "#FFE4B5", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: "100%", borderRadius: 999, boxShadow: "0 3px 0 #3E1F08" }}>
                        <span style={{ flex: 1, textAlign: "center" }}>{connectingWallet === "solflare" ? "..." : "SOLFLARE"}</span>
                        {connectingWallet === "solflare" && <span style={{ position:"absolute", right: isMobile ? 8 : 14, width:8, height:8, border:"2px solid rgba(255,228,181,0.3)", borderTopColor:"#FFE4B5", borderRadius:"50%", animation:"wc-spin 0.7s linear infinite" }} />}
                        {(solflareFound || mobileSolflareInstalled) && connectingWallet !== "solflare" && (
                          <span style={{ position:"absolute", right: isMobile ? 8 : 14, width:8, height:8, borderRadius:"50%", background:"#6BFF8A", boxShadow:"0 0 6px #6BFF8A" }} />
                        )}
                      </button>
                      {/* Backpack */}
                      <button className="wb gf" onClick={() => connectBackpack()} disabled={connectingWallet !== null}
                        style={{ fontSize: isMobile ? 6 : 8, padding: isMobile ? "8px" : "14px", background: "linear-gradient(180deg,#A0693A,#6B3E1E)", border: "2px solid #7C5230", color: "#FFE4B5", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: "100%", borderRadius: 999, boxShadow: "0 3px 0 #3E1F08" }}>
                        <span style={{ flex: 1, textAlign: "center" }}>{connectingWallet === "backpack" ? "..." : "BACKPACK"}</span>
                        {connectingWallet === "backpack" && <span style={{ position:"absolute", right: isMobile ? 8 : 14, width:8, height:8, border:"2px solid rgba(255,228,181,0.3)", borderTopColor:"#FFE4B5", borderRadius:"50%", animation:"wc-spin 0.7s linear infinite" }} />}
                        {(backpackFound || mobileBackpackInstalled) && connectingWallet !== "backpack" && (
                          <span style={{ position:"absolute", right: isMobile ? 8 : 14, width:8, height:8, borderRadius:"50%", background:"#6BFF8A", boxShadow:"0 0 6px #6BFF8A" }} />
                        )}
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
                        <span className="gf" style={{ fontSize: 5, color: "rgba(255,255,255,0.35)" }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
                      </div>
                      {walletType === null && (
                        <button className="wb gf" onClick={() => { playAsGuest(); closePanel(); }}
                          style={{ fontSize: isMobile ? 6 : 8, padding: isMobile ? "8px" : "12px", width: "100%" }}>
                          PLAY AS GUEST
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── QUESTS PANEL ── */}
              {activePanel === "quests" && (
                <div>
                  {/* ── STREAK & LOGIN REWARD HEADER ── */}
                  {(() => {
                    const streak = ds.dailyStreak as DailyStreak;
                    const loginReward = getLoginRewardForStreak(streak);
                    const hook = buildSessionHook(ds, streak);
                    const nextMile = getNextMilestone(ds.player.level);
                    return (
                      <div style={{ marginBottom: 12 }}>
                        {/* Welcome back banner */}
                        <div style={{ background: "linear-gradient(180deg, #3A1F0A, #5C3A1E)", border: "2px solid #FFD700", borderRadius: 10, padding: "10px 12px", marginBottom: 10, textAlign: "center" }}>
                          <div style={{ fontSize: 6, color: "#FFE082", fontFamily: "'Press Start 2P', monospace", marginBottom: 4 }}>WELCOME BACK, FARMER!</div>
                          <div style={{ fontSize: 5, color: "#FFF", fontFamily: "'Press Start 2P', monospace" }}>{hook.welcomeMessage}</div>
                        </div>

                        {/* Streak display */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ fontSize: 8, color: "#FFD700", fontFamily: "'Press Start 2P', monospace" }}>🔥 {streak.consecutiveDays}</div>
                            <div style={{ fontSize: 5, color: "#CCC" }}>DAY STREAK</div>
                          </div>
                          {loginReward && (
                            <button
                              className="wb gf"
                              style={{ fontSize: 5, padding: "6px 10px", background: "linear-gradient(180deg, #FFD700, #C8A020)", color: "#3E2723", border: "2px solid #FFF", animation: "mwPulse 2s infinite" }}
                              onClick={() => {
                                AudioManager.playSFX("click");
                                const res = claimLoginReward(stateRef.current, streak);
                                if (res) {
                                  stateRef.current.dailyStreak = { ...streak, claimedToday: true };
                                  spawnText(stateRef.current, stateRef.current.player.x, stateRef.current.player.y - 52, `+${res.gold} GOLD!`, "#FFD700", -2.2);
                                  stateRef.current.notification = { text: `LOGIN REWARD CLAIMED! +${res.gold}G${res.item ? ` + ${res.item}` : ""}`, life: 150 };
                                  setDs({ ...stateRef.current });
                                }
                              }}
                            >
                              CLAIM LOGIN REWARD
                            </button>
                          )}
                          {!loginReward && (
                            <div style={{ fontSize: 5, color: "#888", fontFamily: "'Press Start 2P', monospace" }}>REWARD CLAIMED ✓</div>
                          )}
                        </div>

                        {/* Login reward progress (7-day streak calendar) */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 10 }}>
                          {LOGIN_REWARDS.map((r, i) => {
                            const isToday = i < streak.consecutiveDays;
                            const isClaimed = streak.weeklyClaimed?.includes(r.day);
                            const isCurrent = i === streak.consecutiveDays - 1;
                            return (
                              <div key={i} style={{
                                background: isClaimed ? "rgba(255,215,0,0.3)" : isToday ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.2)",
                                border: `2px solid ${isCurrent ? "#FFD700" : isClaimed ? "#C8A020" : "#5C4033"}`,
                                borderRadius: 8,
                                padding: "5px 2px",
                                textAlign: "center",
                                opacity: isToday || isClaimed ? 1 : 0.4,
                              }}>
                                <div style={{ fontSize: 3, color: isClaimed ? "#FFD700" : "#FFF", fontFamily: "'Press Start 2P', monospace" }}>{r.day}d</div>
                                <div style={{ fontSize: 4, color: "#FFD700" }}>{r.gold}G</div>
                                {r.milestone && <div style={{ fontSize: 3, color: "#FF8A80" }}>{r.milestone}</div>}
                                {isClaimed && <div style={{ fontSize: 4 }}>✓</div>}
                              </div>
                            );
                          })}
                        </div>

                        {/* Progression bar (EXP) */}
                        {nextMile && (
                          <div style={{ background: "#3B2416", borderRadius: 8, padding: "8px", marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontSize: 5, color: "#FFD700", fontFamily: "'Press Start 2P', monospace" }}>LV {ds.player.level}</span>
                              <span style={{ fontSize: 5, color: "#CCC" }}>→ LV {nextMile.level} ({nextMile.description.split("!")[0].trim()})</span>
                            </div>
                            <div style={{ background: "#1a0e06", borderRadius: 4, height: 8, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.min(100, (ds.player.exp / ds.player.maxExp) * 100)}%`, background: "linear-gradient(90deg, #4CAF50, #8BC34A)", transition: "width 0.5s ease", borderRadius: 4 }} />
                            </div>
                            <div style={{ fontSize: 4, color: "#888", marginTop: 2 }}>{ds.player.exp}/{ds.player.maxExp} EXP — {nextMile.reward}G milestone reward!</div>
                          </div>
                        )}

                        {/* Active boosts */}
                        {(() => {
                          const descs = Object.entries(ds.activeBoosts).filter(([, exp]) => Date.now() < exp);
                          return descs.length > 0 ? (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                              {descs.map(([boost]) => (
                                <div key={boost} style={{ background: "rgba(255,215,0,0.15)", border: "1px solid #FFD700", borderRadius: 6, padding: "3px 6px", fontSize: 4, color: "#FFD700" }}>
                                  ⚡ {boost.replace(/_/g, " ")}
                                </div>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    );
                  })()}

                  <div style={{ fontSize: 7, color: "#FFFFFF", marginBottom: 12, textAlign: "center", lineHeight: 1.8 }}>
                    COMPLETE TASKS TO EARN GOLD REWARDS!
                  </div>
                  {ds.quests.map((q) => {
                    const pct = Math.min(100, Math.round((q.current / q.target) * 100));
                    return (
                      <div key={q.id} style={{ background: q.claimed ? "rgba(0,0,0,0.08)" : q.completed ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)", border: `2px solid ${q.claimed ? "#5C4033" : q.completed ? "#FFFFFF" : "#8B5E3C"}`, borderRadius: 12, padding: "12px", marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 7, color: "#FFFFFF", textShadow: "1px 1px #000" }}>
                            {q.claimed ? "[DONE]" : q.completed ? "[CLAIM]" : "[...]"} {q.title}
                          </span>
                          <span style={{ fontSize: 7, color: "#FFFFFF" }}>{q.current}/{q.target}</span>
                        </div>
                        {/* Progress bar */}
                        <div style={{ background: "#3B2416", borderRadius: 6, height: 10, overflow: "hidden", marginBottom: 8 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: q.completed ? "linear-gradient(90deg, #FFFFFF, #CCCCCC)" : "linear-gradient(90deg, #C19A6B, #8D5A32)", transition: "width 0.4s ease", borderRadius: 6 }} />
                        </div>
                        <div style={{ fontSize: 6, color: "#FFFFFF", marginBottom: q.completed && !q.claimed ? 8 : 0 }}>
                          REWARD: +{q.reward} GOLD {pct < 100 ? `(${pct}% done)` : ""}
                        </div>
                        {q.completed && !q.claimed && (
                          <button className="wb gf" style={{ width: "100%", fontSize: 7, padding: "10px", background: "linear-gradient(180deg, #FFD700, #C8A020)", color: "#3E2723", border: "2px solid #FFD700" }}
                            onClick={async () => {
                              AudioManager.playSFX("click");
                              const w = stateRef.current.player.walletAddress || localStorage.getItem("wallet_addr") || "";
                              const res = claimQuestReward(stateRef.current, q.id, w);
                              if (!res) return;
                              spawnText(stateRef.current, stateRef.current.player.x, stateRef.current.player.y - 52, `+${res.reward} GOLD`, "#FFD700", -2.2);
                              const claimText = `QUEST CLAIMED: +${res.reward} GOLD`;
                              stateRef.current.notification = { text: claimText, life: 110 };
                              triggerPopup(claimText);
                              if (w && !w.toLowerCase().startsWith("guest")) { await updateSupabaseGold(w, stateRef.current.player.gold); await saveProgress(); }
                              setDs({ ...stateRef.current });
                            }}>
                          CLAIM +{q.reward} GOLD
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* â”€â”€ INVENTORY PANEL â”€â”€ */}
              {/* INVENTORY PANEL */}
              {activePanel === "inventory" && (
                <div>
                  <div style={{ fontSize: 7, color: "#FFD700", marginBottom: 10, textAlign: "center", fontFamily: "'Press Start 2P', monospace" }}>INVENTORY</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, padding: "2px" }}>
                    {[
                      { key: "wheat",        label: "WHEAT",   img: "/wheat.png" },
                      { key: "tomato",       label: "TOMATO",  img: "/tomato.png" },
                      { key: "carrot",       label: "CARROT",  img: "/carrot.png" },
                      { key: "pumpkin",      label: "PUMPKIN", img: "/pumpkin.png" },
                      { key: "fish",         label: "FISH",    img: "/ikan.png" },
                      { key: "seeds",        label: "SEEDS",   img: "/karung_1774349990717.png" },
                      { key: "wheat-seed",   label: "W.SEED",  img: "/wheat.png" },
                      { key: "tomato-seed",  label: "T.SEED",  img: "/tomato.png" },
                      { key: "carrot-seed",  label: "C.SEED",  img: "/carrot.png" },
                      { key: "pumpkin-seed", label: "P.SEED",  img: "/pumpkin.png" },
                    ].map(item => {
                      const count = ds.player.inventory[item.key] || 0;
                      return (
                        <div key={item.key} style={{
                          position: "relative",
                          aspectRatio: "1",
                          background: "linear-gradient(160deg, #2a1a0e 0%, #1a0e06 100%)",
                          border: "2px solid #ffffff",
                          boxShadow: "inset 0 0 0 3px #3a1e0a, inset 0 0 0 5px #5C3A1E",
                          display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center",
                          gap: 2, opacity: count === 0 ? 0.4 : 1,
                        }}>
                          <img src={item.img} alt={item.label} style={{ width: "52%", height: "52%", imageRendering: "pixelated", objectFit: "contain" }} />
                          <div style={{ fontSize: 4, color: "#A07040", fontFamily: "'Press Start 2P', monospace", lineHeight: 1 }}>{item.label}</div>
                          <div style={{ position: "absolute", bottom: 2, right: 3, fontSize: 6, color: count > 0 ? "#FFD700" : "#5a3a1a", fontFamily: "'Press Start 2P', monospace", textShadow: count > 0 ? "1px 1px 0 #000" : "none" }}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* â”€â”€ NFT PANEL â”€â”€ */}
              {activePanel === "nft" && (
                <div style={{ textAlign: "center" }}>
                  {nfts.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                      {nfts.map((n, i) => {
                        const addr = walletAddress || localStorage.getItem("wallet_addr") || "";
                        return (
                          <div key={i} style={{ background: "#8D5A32", borderRadius: 12, overflow: "hidden", border: "2px solid #5C4033" }}>
                            <div style={{ color: "#FFFFFF", padding: "8px 10px", fontSize: 6 }}>{n}</div>
                            {addr && (
                              <a href={`https://solscan.io/account/${addr}`} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none" }}>
                                <div style={{ background: "rgba(0,0,0,0.4)", borderTop: "2px solid #5C4033", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#FFFFFF" }}>solscan.io/{addr.slice(0,6)}...{addr.slice(-4)}</span>
                                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#FFFFFF" }}>TRACK â†’</span>
                                </div>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 8, color: "#4D2D18", marginBottom: 16 }}>NO NFTS DETECTED</div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button className="wb gf" onClick={async () => { AudioManager.playSFX("click"); const res = await initializeTokenAccount(); stateRef.current.notification = { text: res.success ? "INITIALIZED!" : (res.error || "INIT FAILED").toUpperCase().slice(0,40), life: 200 }; setDs({ ...stateRef.current }); }} style={{ width: "100%", fontSize: 7 }}>INIT ACCOUNT</button>
                    {ds.player.nftEligibility ? (
                      <button className="wb gf" onClick={() => { claimNFT(); AudioManager.playSFX("click"); }} style={{ width: "100%", fontSize: 7, background: "linear-gradient(180deg, #A2FF9E, #228B22)", color: "#FFF", border: "2px solid #FFF" }}>CLAIM ALPHA NFT</button>
                    ) : (
                      <div className="gf" style={{ fontSize: 6, color: "#8B4513", marginTop: 10, background: "rgba(0,0,0,0.05)", padding: 8, borderRadius: 8 }}>
                        FINISH ALL DAILY TASKS TO UNLOCK THIS NFT CLAIM!
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* â”€â”€ SHOP PANEL â”€â”€ */}
              {activePanel === "shop" && (
                <div style={{ padding: "0 10px 10px" }}>
                  <div className="gf" style={{ fontSize: 13, color: "var(--wood-dark)", marginBottom: 12, textAlign: "center", fontWeight: "bold" }}>
                    SEED MARKET
                  </div>
                  <div className="shop-scroll-area" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, maxHeight: isMobile ? "55dvh" : 380, overflowY: "auto", padding: "4px" }}>
                    {SHOP_ITEMS.map((item) => {
                      const crop = item.type === "seed" ? toolIdToCrop(item.id) : null;
                      const locked = !!crop && !isCropPlantingUnlocked(crop, ds.player.level, ds.farmBalancePreset);
                      const needLvl = crop ? seedUnlockLevel(crop, ds.farmBalancePreset) : 1;
                      const effPrice = item.type === "seed" ? getShopSeedPrice(item.id, item.price, ds.farmBalancePreset) : item.price;
                      return (
                        <div key={item.id} className="wood-slot" style={{ padding: "16px 10px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", opacity: locked ? 0.7 : 1 }}>
                          {locked && <div className="gf" style={{ position: "absolute", top: 8, left: 0, right: 0, fontSize: 10, color: "#FFFFFF", textAlign: "center", textShadow: "1px 1px #000", zIndex: 10 }}>LVL {needLvl}</div>}
                          <div style={{ width: 44, height: 44, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 4px 0 rgba(0,0,0,0.2))" }}>
                            <img src={item.spriteUrl} alt={item.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                          </div>
                          <div className="gf" style={{ fontSize: 12, color: "var(--wood-dark)", marginBottom: 4, textAlign: "center", fontWeight: "bold" }}>{item.name.toUpperCase()}</div>
                          <div className="gf" style={{ fontSize: 14, color: "#D4AF37", marginBottom: 10, fontWeight: "bold", textShadow: "2px 2px 0 rgba(0,0,0,0.4)" }}>{effPrice} GOLD</div>
                          <button className="wb gf" style={{ width: "95%", fontSize: 12, padding: "8px 0" }}
                            disabled={locked}
                            onClick={(ev) => buyItem(item.id, item.price, ev)}>
                            {locked ? "LOCKED" : "BUY"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* â”€â”€ SETTINGS PANEL â”€â”€ */}
              {activePanel === "settings" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: "#8B4513", marginBottom: 4 }}>SOUND CONTROL</div>
                  <button className="wb gf" style={{ width: "100%", fontSize: 7, padding: "12px" }}
                    onClick={() => { AudioManager.init(); AudioManager.playBGM("/backsound.mp3"); stateRef.current.notification = { text: "AUDIO SYSTEM ACTIVE!", life: 100 }; setDs({ ...stateRef.current }); }}>
                    REACTIVATE AUDIO
                  </button>
                  <div style={{ fontSize: 8, color: "#8B4513", marginTop: 8, marginBottom: 4 }}>FARM DIFFICULTY</div>
                  <div style={{ fontSize: 6, color: "#D4AF37", marginBottom: 8, lineHeight: 1.8 }}>
                    EASY: Fast grow, low reward<br/>
                    MEDIUM: Balanced (recommended)<br/>
                    HARD: Slow grow, 5Ã— gold reward
                  </div>
                  {(["easy","medium","hard"] as FarmBalancePreset[]).map((preset) => (
                    <button key={preset} className={`wb gf ${ds.farmBalancePreset === preset ? "active" : ""}`} style={{ width: "100%", fontSize: 7, padding: "12px" }} onClick={() => applyBalancePreset(preset)}>
                      {preset.toUpperCase()} MODE
                    </button>
                  ))}
                  <button className="wb gf" style={{ width: "100%", fontSize: 7, padding: "10px", marginTop: 4 }}
                    onClick={() => { stateRef.current.player.level = 1; stateRef.current.player.exp = 0; stateRef.current.player.maxExp = 100; stateRef.current.pendingCloudSave = true; stateRef.current.notification = { text: "LEVEL RESET TO 1", life: 120 }; setDs({ ...stateRef.current }); void saveProgress(); }}>
                    RESET PROGRESS (LEVEL 1)
                  </button>
                  <div style={{ marginTop: 8, fontSize: 6, color: "#8B4513", opacity: 0.7 }}>ACTIVE: {ds.farmBalancePreset.toUpperCase()} | V.1.0.0</div>
                </div>
              )}

              {/* DEVNET PANEL */}
              {activePanel === "devnet" && (
                <div style={{ background: "#1a0f08", padding: "4px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="gf" style={{ fontSize: 8, color: "#D4AF37", letterSpacing: 1, textAlign: "center" }}>◎ SOLANA DEVNET</div>
                  <div className="gf" style={{ fontSize: isMobile ? 4 : 5, color: "rgba(255,255,255,0.4)", textAlign: "center", wordBreak: "break-all" }}>
                    {DEVNET_TOKEN_MINT}
                  </div>
                  {walletConnected && !walletAddress.startsWith("guest") && (
                    <div className="gf" style={{ fontSize: isMobile ? 5 : 6, color: "#9D7BFF", textAlign: "center" }}>
                      LFG: {devnetLFGBalance.toFixed(2)}
                    </div>
                  )}
                  <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "2px 0" }} />

                  {/* TX 1: Airdrop */}
                  <button
                    className="wb gf"
                    disabled={!!devnetTxBusy}
                    onClick={devnetAirdrop}
                    style={{ fontSize: isMobile ? 6 : 7, padding: "10px 14px", opacity: devnetTxBusy === "airdrop" ? 0.6 : 1 }}
                  >
                    {devnetTxBusy === "airdrop" ? "SENDING..." : "◎ AIRDROP +5 LFG"}
                  </button>
                  <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>mint 5 LFG to wallet on devnet</div>

                  <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "2px 0" }} />

                  {/* TX 2: Harvest Claim */}
                  <button
                    className="wb gf"
                    disabled={!!devnetTxBusy}
                    onClick={devnetHarvestClaim}
                    style={{ fontSize: isMobile ? 6 : 7, padding: "10px 14px", opacity: devnetTxBusy === "harvest" ? 0.6 : 1 }}
                  >
                    {devnetTxBusy === "harvest" ? "SENDING..." : "CLAIM HARVEST LFG"}
                  </button>
                  <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>mint LFG for ready crops on devnet</div>

                  <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "2px 0" }} />

                  {/* TX 3: View Reference TX */}
                  <button
                    className="wb gf"
                    onClick={devnetViewRefTx}
                    style={{ fontSize: isMobile ? 6 : 7, padding: "10px 14px", background: "linear-gradient(180deg,#2d1060,#1a0a3a)", border: "2px solid #9D7BFF", color: "#9D7BFF", boxShadow: "0 4px 0 #1a0a3a" }}
                  >
                    ◎ VIEW DEVNET TX
                  </button>
                  <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>5Yad6ss2...PJSHzZ</div>

                  {lastTxId && (
                    <>
                      <div style={{ height: 1, background: "rgba(212,175,55,0.25)", margin: "2px 0" }} />
                      <div className="gf" style={{ fontSize: 5, color: "#D4AF37", textAlign: "center" }}>LAST TX</div>
                      <button
                        className="wb gf"
                        onClick={() => setShowTxPopup(true)}
                        style={{ fontSize: 4, padding: "6px 10px", wordBreak: "break-all", background: "rgba(0,0,0,0.3)", border: "1px solid #D4AF37", color: "#D4AF37", boxShadow: "none" }}
                      >
                        {lastTxId.slice(0,18)}...{lastTxId.slice(-6)}
                      </button>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* IN-APP SOLSCAN TX POPUP */}
      {showTxPopup && lastTxId && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowTxPopup(false)}
        >
          <div
            className="wb"
            style={{ background: "linear-gradient(180deg,#2d1a08,#1a0f04)", border: "3px solid #D4AF37", borderRadius: 12, padding: "20px 24px", maxWidth: isMobile ? "92vw" : 500, width: "100%", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 8px 0 #3a2212, 0 0 40px rgba(212,175,55,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gf" style={{ fontSize: 9, color: "#D4AF37", textAlign: "center", letterSpacing: 1 }}>◎ DEVNET TX</div>
            <div style={{ height: 1, background: "rgba(212,175,55,0.3)" }} />
            <div className="gf" style={{ fontSize: isMobile ? 4 : 5, color: "#FFFFFF", wordBreak: "break-all", lineHeight: 2, textAlign: "center" }}>
              {lastTxId}
            </div>
            <div style={{ height: 1, background: "rgba(212,175,55,0.3)" }} />
            <iframe
              src={`https://solscan.io/tx/${lastTxId}?cluster=devnet`}
              style={{ width: "100%", height: isMobile ? 200 : 300, border: "2px solid #5C4033", borderRadius: 6, background: "#111" }}
              title="Solscan TX"
            />
            <div className="gf" style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>solscan.io — devnet</div>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={`https://solscan.io/tx/${lastTxId}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="wb gf"
                style={{ flex: 1, fontSize: isMobile ? 6 : 7, padding: "10px", textAlign: "center", textDecoration: "none", color: "#9D7BFF", background: "linear-gradient(180deg,#2d1060,#1a0a3a)", border: "2px solid #9D7BFF", boxShadow: "0 4px 0 #1a0a3a", borderRadius: 6 }}
                onClick={(e) => e.stopPropagation()}
              >
                OPEN BROWSER
              </a>
              <button className="wb gf" onClick={() => setShowTxPopup(false)} style={{ flex: 1, fontSize: isMobile ? 6 : 7, padding: "10px" }}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ LOGO â”€â”€ */}
      {splashDone && (walletConnected || walletAddress.toLowerCase().startsWith("guest")) && !isMobile && (
        <div className="logo-container"><img src="/logo.png" alt="LIFETOPIA" className="logo-img" /></div>
      )}

      {/* â”€â”€ SKIP DEMO (Rectangular wood style) â”€â”€ */}
      {ds.demoMode && (
        <button
          onClick={() => abortDemo()}
          className="wb gf"
          style={{
            position: "absolute", bottom: 40, right: 40, zIndex: 10000,
            width: 100, height: 50, fontSize: 10,
            boxShadow: "0 6px 0 #3a2212, 0 10px 20px rgba(0,0,0,0.4)",
          }}
        >
          SKIP
        </button>
      )}

      {/* FISHING — desktop only; mobile uses MobileHUD action row */}
      {splashDone && ds.currentMap === "fishing" && !ds.demoMode && !isMobile && (
        <div style={{ position: "absolute", bottom: 38, right: 30, zIndex: 1300, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {/* Fishing instruction label */}
          {(!ds.fishingSession || ds.fishingSession.state === "casting") && (
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 7,
              color: "#4FC3F7",
              textShadow: "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
              textAlign: "center",
            }}>TAP TO CAST LINE</div>
          )}
          {ds.fishingSession?.state === "bite" && (
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 7,
              color: "#FFD700",
              textShadow: "1px 1px 0 #000, -1px -1px 0 #000",
              animation: "wobble 0.3s infinite",
            }}>FISH ON! PULL NOW!</div>
          )}
          {ds.fishingSession?.state === "waiting" && (
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 7,
              color: "#FFF",
              textShadow: "1px 1px 0 #000",
            }}>Waiting for bite...</div>
          )}
          <button
            onClick={() => { handleFishingAction(stateRef.current); setDs({ ...stateRef.current }); }}
            onTouchEnd={(e) => { e.preventDefault(); handleFishingAction(stateRef.current); setDs({ ...stateRef.current }); }}
            className="wb gf"
            style={{
              width: 140,
              height: 60,
              background: ds.fishingSession ? "linear-gradient(180deg, #FFD700 0%, #C8A020 100%)" : undefined,
              boxShadow: ds.fishingSession ? "0 3px 0 #8d6e15, 0 0 10px rgba(255,215,0,0.4)" : "0 3px 0 #3a2212",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, borderRadius: 999,
              touchAction: "manipulation",
              animation: ds.fishingSession?.state === "bite" ? "pulse 0.3s infinite" : undefined,
            }}
          >
            {ds.fishingSession ? (ds.fishingSession.state === "bite" || ds.fishingSession.state === "struggle" ? "PULL!" : "WAIT") : "CAST"}
          </button>
        </div>
      )}

      {/* â”€â”€ LEVEL UP POPUP â”€â”€ */}
      {ds.levelUpPopup && ds.time < ds.levelUpPopup.until && (
        <div style={{ position: "absolute", inset: 0, zIndex: 5500, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)" }}>
          <div className="gf" style={{ padding: "28px 40px", maxWidth: 520, textAlign: "center", textShadow: "0 0 20px #FFD700" }}>
            <div style={{ fontSize: 24, color: "#FFD700", marginBottom: 14, letterSpacing: "0.1em", fontWeight: "bold" }}>LEVEL UP!</div>
            <div style={{ fontSize: 10, color: "#FFFDE7", fontWeight: "bold" }}>{ds.levelUpPopup.message}</div>
          </div>
        </div>
      )}

      {/* â”€â”€ NOTIFICATION BANNER â”€â”€ */}
      {ds.notification && (
        <div style={{ position: "absolute", top: isMobile ? "15%" : "20%", left: "50%", transform: "translateX(-50%)", zIndex: 5000, pointerEvents: "none" }}>
          <div className="gf" style={{ padding: "14px 28px", fontSize: isMobile ? 12 : 14, color: "#FFD700", textShadow: "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000", textAlign: "center", maxWidth: isMobile ? "85vw" : "none", lineHeight: 1.5 }}>
            {ds.notification.text.toUpperCase()}
          </div>
        </div>
      )}
      {/* â”€â”€ FISHING REGION LABELS â”€â”€ */}
      {splashDone && ds.currentMap === "fishing" && !activePanel && (
        <div style={{ position: "absolute", bottom: isMobile ? 100 : 40, left: "50%", transform: "translateX(-50%)", display: "flex", gap: isMobile ? 8 : 20, pointerEvents: "none" }}>
          <div className="gf" style={{ fontSize: isMobile ? 5 : 8, color: "rgba(255,255,255,0.7)", textShadow: "1px 1px 0 #000" }}>
            DEEP WATER
          </div>
          <div className="gf" style={{ fontSize: isMobile ? 5 : 8, color: "rgba(255,215,0,0.7)", textShadow: "1px 1px 0 #000" }}>
            RARE FISH HUB
          </div>
        </div>
      )}
      {/* PREMIUM OUTFIT PANEL */}
      {showOutfitPanel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[12px] animate-in fade-in zoom-in duration-300">
          <div className="relative w-full max-w-sm p-6 bg-[#3A2010] border-4 border-[#CE9E64] rounded-3xl shadow-2xl transform transition-transform hover:scale-[1.02] active:scale-[0.98]">
            <h2 className="mb-4 text-xl font-bold text-center text-[#FFD700] drop-shadow-md">SELECT OUTFIT</h2>
            <div className="grid grid-cols-2 gap-4">
              {["default", "farmer", "city", "suburban"].map((o) => (
                <button
                  key={o}
                  onClick={() => {
                    stateRef.current.player.outfit = o as any;
                    setDs({ ...stateRef.current });
                    AudioManager.playSFX("click");
                  }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    ds.player.outfit === o ? "bg-[#CE9E64] border-[#FFD700] scale-105" : "bg-[#5C3A1E] border-transparent opacity-80"
                  } text-white font-bold uppercase text-xs`}
                >
                  {o}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowOutfitPanel(false)}
              className="mt-6 w-full py-3 bg-[#AD7D54] hover:bg-[#D9B380] text-white font-black rounded-xl border-b-4 border-[#5C3A1E] active:border-b-0 active:translate-y-1 transition-all"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


