import { useCallback, useEffect, useRef, useState } from 'react';
import { DailyRewardModal } from './components/DailyRewardModal';
import { GameHudOverlay, MissionToast } from './components/GameHudOverlay';
import { GameOverOverlay } from './components/GameOverOverlay';
import { MainMenuOverlay } from './components/MainMenuOverlay';
import { NotificationPromptModal } from './components/NotificationPromptModal';
import { SettingsModal } from './components/SettingsModal';
import { SkinShopModal } from './components/SkinShopModal';
import { RunnerEngine } from './game/RunnerEngine';
import {
  adBridge,
  maybeShowInterstitialAfterCrash,
  recordCrashForAd,
  resetCrashCountForAd,
} from './game/adBridge';
import { gameAudio } from './game/audio';
import { ZONES } from './game/dialogues';
import {
  evaluateAndSendScheduledNotifications,
  getBrowserNotificationPermission,
  isEmbeddedIframe,
  registerNotificationServiceWorker,
  requestBrowserNotificationPermission,
  sendGameNotification,
} from './game/notifications';
import {
  ACHIEVEMENT_POOL,
  DAILY_CHEST_BONUS,
  UPGRADE_CATALOG,
  ensureDailyQuestsFresh,
  getAchievementById,
  getAchievementValue,
  getContinueCost,
  getDailyRewardInfo,
  getLocalDateKey,
  getMetricValueFromRun,
  getMissionById,
  getScoreMultiplierFromMissions,
  getUpgradeCost,
  isSingleRunMission,
  loadSaveData,
  pickReplacementMission,
  shouldShowNotificationPrompt,
  writeSaveData,
} from './game/storage';
import {
  GraphicsQuality,
  HudSnapshot,
  RunMetrics,
  SaveData,
  SkinId,
  UpgradeKey,
  ZoneConfig,
} from './game/types';

const ZERO_METRICS: RunMetrics = {
  distance: 0,
  coins: 0,
  rolls: 0,
  jumps: 0,
  nearMisses: 0,
  flights: 0,
  powerups: 0,
  magnets: 0,
  shields: 0,
  flashlights: 0,
  turbos: 0,
  zonesReached: ['mahalle_caddesi'],
};

const INITIAL_HUD: HudSnapshot = {
  phase: 'menu',
  score: 0,
  distance: 0,
  coins: 0,
  highScore: 0,
  speedMultiplier: 1.0,
  combo: 1,
  stumbleTimer: 0,
  zone: ZONES[0],
  activePowerups: {
    magnet: 0,
    flashlight: 0,
    turbo: 0,
    wings: 0,
    shield: false,
  },
  deathReason: '',
  isNewRecord: false,
  continueCount: 0,
  adReviveUsed: false,
  metrics: { ...ZERO_METRICS, zonesReached: ['mahalle_caddesi'] },
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RunnerEngine | null>(null);

  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const saveRef = useRef(save);
  saveRef.current = save;

  const [hud, setHud] = useState<HudSnapshot>(() => ({
    ...INITIAL_HUD,
    highScore: save.highScore,
  }));
  const [portraits, setPortraits] = useState<Partial<Record<SkinId, string>>>({});
  const [zoneBanner, setZoneBanner] = useState<ZoneConfig | null>(null);
  const [missionToast, setMissionToast] = useState<MissionToast | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [dailyDismissed, setDailyDismissed] = useState(false);
  const [notifDismissedSession, setNotifDismissedSession] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => getBrowserNotificationPermission());
  const [isEmbedded] = useState<boolean>(() => isEmbeddedIframe());
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);
  const [inAppNotifBanner, setInAppNotifBanner] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [adNotice, setAdNotice] = useState<string | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [completedMissionsThisRun, setCompletedMissionsThisRun] = useState<
    { title: string; rewardCoins: number }[]
  >([]);

  const zoneTimeoutRef = useRef<number | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const creditedRunCoinsRef = useRef(0);
  const creditedScoreRef = useRef(0);
  const creditedMetricsRef = useRef<RunMetrics>({
    ...ZERO_METRICS,
    zonesReached: ['mahalle_caddesi'],
  });
  const toastedMissionIdsRef = useRef<Set<string>>(new Set());
  const menuIntroPlayedRef = useRef(false);
  const pendingAutoVoiceRef = useRef(false);
  const adActionBusyRef = useRef(false);

  // Unified 1-swipe = 1-action gesture state during gameplay + menu turntable drag / character tap
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const menuDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const menuDragMovedRef = useRef(0);
  const lastDragXRef = useRef<number | null>(null);
  const swipeConsumedRef = useRef(false);

  const dailyRewardInfo = getDailyRewardInfo(save.dailyReward);
  const dailyRewardOpen =
    hud.phase === 'menu' &&
    !shopOpen &&
    !settingsOpen &&
    !missionsOpen &&
    !dailyDismissed &&
    dailyRewardInfo.canClaim;

  const notificationPromptOpen =
    hud.phase === 'menu' &&
    !shopOpen &&
    !settingsOpen &&
    !missionsOpen &&
    !dailyRewardOpen &&
    !notifDismissedSession &&
    shouldShowNotificationPrompt(save.notifications, browserPermission, isEmbedded);

  const isCleanMainMenu =
    hud.phase === 'menu' &&
    !shopOpen &&
    !settingsOpen &&
    !missionsOpen &&
    !dailyRewardOpen &&
    !notificationPromptOpen;
  const isCleanMainMenuRef = useRef(isCleanMainMenu);
  isCleanMainMenuRef.current = isCleanMainMenu;

  const persistSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = updater(prev);
      saveRef.current = next;
      writeSaveData(next);
      return next;
    });
  }, []);

  useEffect(() => {
    void registerNotificationServiceWorker();
    setBrowserPermission(getBrowserNotificationPermission());

    const touchLastOpened = () => {
      const todayKey = getLocalDateKey();
      persistSave((prev) =>
        prev.notifications.lastOpenedDate === todayKey
          ? prev
          : {
              ...prev,
              notifications: {
                ...prev.notifications,
                lastOpenedDate: todayKey,
              },
            },
      );
    };

    touchLastOpened();
    const onVisibility = () => {
      if (!document.hidden) touchLastOpened();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [persistSave]);

  useEffect(() => {
    const runScheduler = () => {
      setSave((prev) => ensureDailyQuestsFresh(prev));
      const freshSave = saveRef.current;
      const freshDaily = getDailyRewardInfo(freshSave.dailyReward);
      void evaluateAndSendScheduledNotifications(
        freshSave,
        freshDaily,
        (slot, todayKey, msgIdx) => {
          persistSave((prev) => {
            const prevCount =
              prev.notifications.sentCountDate === todayKey
                ? prev.notifications.sentCountToday
                : 0;
            const prevDailyIds = prev.notifications.usedDailyMsgIds;
            const prevPrimeIds = prev.notifications.usedPrimeMsgIds;
            const nextDailyIds =
              slot === 'daily'
                ? prevDailyIds.length >= 13
                  ? [msgIdx]
                  : [...prevDailyIds.filter((i) => i !== msgIdx), msgIdx]
                : prevDailyIds;
            const nextPrimeIds =
              slot === 'prime'
                ? prevPrimeIds.length >= 13
                  ? [msgIdx]
                  : [...prevPrimeIds.filter((i) => i !== msgIdx), msgIdx]
                : prevPrimeIds;

            return {
              ...prev,
              notifications: {
                ...prev.notifications,
                lastDailyNotifyDate:
                  slot === 'daily'
                    ? todayKey
                    : prev.notifications.lastDailyNotifyDate,
                lastPrimeNotifyDate:
                  slot === 'prime'
                    ? todayKey
                    : prev.notifications.lastPrimeNotifyDate,
                lastSentDate: todayKey,
                sentCountDate: todayKey,
                sentCountToday: Math.min(2, prevCount + 1),
                usedDailyMsgIds: nextDailyIds,
                usedPrimeMsgIds: nextPrimeIds,
              },
            };
          });
        },
      );
    };

    runScheduler();
    const id = window.setInterval(runScheduler, 30_000);
    return () => window.clearInterval(id);
  }, [persistSave, save.notifications.enabled, save.dailyReward.lastClaimDate]);

  useEffect(() => {
    gameAudio.configure({
      sfxEnabled: save.sfxEnabled,
      ambienceEnabled: save.ambienceEnabled,
      sfxVolume: save.sfxVolume,
      ambienceVolume: save.ambienceVolume,
    });
  }, [save.sfxEnabled, save.ambienceEnabled, save.sfxVolume, save.ambienceVolume]);

  useEffect(() => {
    engineRef.current?.setGraphicsQuality(save.graphicsQuality);
  }, [save.graphicsQuality]);

  useEffect(() => {
    engineRef.current?.setUpgrades(save.upgrades);
  }, [save.upgrades]);

  useEffect(() => {
    engineRef.current?.setBonusMultiplier(
      getScoreMultiplierFromMissions(save.missions.completedCount),
    );
  }, [save.missions.completedCount]);

  useEffect(() => {
    engineRef.current?.setShopPreviewMode(shopOpen);
  }, [shopOpen]);

  const triggerMenuIntroOnce = useCallback((skinId: SkinId) => {
    if (menuIntroPlayedRef.current || !gameAudio.hasMenuVoice(skinId)) {
      pendingAutoVoiceRef.current = false;
      return;
    }
    void gameAudio.playMenuCharacterVoice(skinId, { auto: true }).then((status) => {
      if (
        !isCleanMainMenuRef.current ||
        saveRef.current.selectedSkin !== skinId
      ) {
        if (status === 'played') gameAudio.stopMenuVoice();
        return;
      }
      if (status === 'played') {
        menuIntroPlayedRef.current = true;
        pendingAutoVoiceRef.current = false;
        engineRef.current?.triggerMenuCharacterTapAnim();
      } else if (status === 'blocked') {
        pendingAutoVoiceRef.current = true;
      } else {
        pendingAutoVoiceRef.current = false;
      }
    });
  }, []);

  useEffect(() => {
    if (hud.phase !== 'menu' || shopOpen) {
      menuIntroPlayedRef.current = false;
      pendingAutoVoiceRef.current = false;
    }
    if (!isCleanMainMenu) {
      gameAudio.stopMenuVoice();
      return;
    }
    triggerMenuIntroOnce(save.selectedSkin);
  }, [hud.phase, shopOpen, isCleanMainMenu, save.selectedSkin, triggerMenuIntroOnce]);

  const checkLiveMissionToast = useCallback((snap: HudSnapshot) => {
    if (snap.phase !== 'playing') return;
    const curSave = saveRef.current;
    const prevM = creditedMetricsRef.current;
    const activeSkin = curSave.selectedSkin;

    const triggerToast = (toastId: string, title: string, rewardCoins: number) => {
      toastedMissionIdsRef.current.add(toastId);
      gameAudio.playPowerup();
      setMissionToast({
        id: `${toastId}_${Date.now()}`,
        title,
        rewardCoins,
      });
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = window.setTimeout(() => {
        setMissionToast(null);
      }, 3000);
    };

    const checkList = (
      ids: string[],
      progressMap: Record<string, number>,
      doneIds: string[],
    ) => {
      for (const id of ids) {
        if (doneIds.includes(id) || toastedMissionIdsRef.current.has(id)) {
          continue;
        }
        const def = getMissionById(id);
        if (!def) continue;

        const liveVal = getMetricValueFromRun(
          def,
          snap.metrics,
          snap.score,
          activeSkin,
        );
        let effectiveVal = liveVal;
        if (!isSingleRunMission(def)) {
          const prevVal = getMetricValueFromRun(
            def,
            prevM,
            creditedScoreRef.current,
            activeSkin,
          );
          const delta = Math.max(0, liveVal - prevVal);
          effectiveVal = (progressMap[id] ?? 0) + delta;
        }

        if (effectiveVal >= def.target) {
          triggerToast(id, def.title, def.rewardCoins);
          return true;
        }
      }
      return false;
    };

    if (
      checkList(
        curSave.missions.activeIds,
        curSave.missions.progress,
        curSave.missions.claimableIds,
      )
    ) {
      return;
    }

    if (
      checkList(
        curSave.missions.dailyIds,
        curSave.missions.dailyProgress,
        curSave.missions.dailyClaimedIds,
      )
    ) {
      return;
    }

    for (const ach of ACHIEVEMENT_POOL) {
      if (
        curSave.achievements.claimedIds.includes(ach.id) ||
        toastedMissionIdsRef.current.has(ach.id)
      ) {
        continue;
      }
      const prevStored = getAchievementValue(ach, curSave);
      if (prevStored >= ach.target) continue;

      let effectiveVal = prevStored;
      if (ach.type === 'skin_distance' && ach.skinId === activeSkin) {
        effectiveVal += Math.max(0, snap.metrics.distance - prevM.distance);
      } else if (
        ach.type === 'reach_zone' &&
        ach.zoneId &&
        snap.metrics.zonesReached.includes(ach.zoneId)
      ) {
        effectiveVal = 1;
      } else if (ach.type === 'total_flights') {
        effectiveVal += Math.max(0, snap.metrics.flights - prevM.flights);
      } else if (ach.type === 'total_coins') {
        effectiveVal += Math.max(0, snap.metrics.coins - prevM.coins);
      } else if (ach.type === 'total_distance') {
        effectiveVal += Math.max(0, snap.metrics.distance - prevM.distance);
      }

      if (effectiveVal >= ach.target) {
        triggerToast(ach.id, ach.title, ach.rewardCoins);
        return;
      }
    }
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new RunnerEngine(
      container,
      saveRef.current.selectedSkin,
      saveRef.current.highScore,
      {
        onHudUpdate: (snap) => {
          setHud(snap);
          checkLiveMissionToast(snap);
        },
        onDialogue: () => {
          // On-screen text sayings removed; voice audio hooks will trigger here later
        },
        onZoneChange: (zone) => {
          setZoneBanner(zone);
          if (zoneTimeoutRef.current) {
            window.clearTimeout(zoneTimeoutRef.current);
          }
          zoneTimeoutRef.current = window.setTimeout(() => {
            setZoneBanner(null);
          }, 3200);
        },
        onGameOver: (snap) => {
          recordCrashForAd();
          const newlyEarned = Math.max(
            0,
            snap.coins - creditedRunCoinsRef.current,
          );
          creditedRunCoinsRef.current = snap.coins;

          const prevM = creditedMetricsRef.current;
          const prevScore = creditedScoreRef.current;
          const deltaMetrics: RunMetrics = {
            distance: Math.max(0, snap.metrics.distance - prevM.distance),
            coins: Math.max(0, snap.metrics.coins - prevM.coins),
            rolls: Math.max(0, snap.metrics.rolls - prevM.rolls),
            jumps: Math.max(0, snap.metrics.jumps - prevM.jumps),
            nearMisses: Math.max(0, snap.metrics.nearMisses - prevM.nearMisses),
            flights: Math.max(0, snap.metrics.flights - prevM.flights),
            powerups: Math.max(0, snap.metrics.powerups - prevM.powerups),
            magnets: Math.max(0, snap.metrics.magnets - prevM.magnets),
            shields: Math.max(0, snap.metrics.shields - prevM.shields),
            flashlights: Math.max(0, snap.metrics.flashlights - prevM.flashlights),
            turbos: Math.max(0, snap.metrics.turbos - prevM.turbos),
            zonesReached: [...snap.metrics.zonesReached],
          };
          const deltaScore = Math.max(0, snap.score - prevScore);
          creditedMetricsRef.current = {
            ...snap.metrics,
            zonesReached: [...snap.metrics.zonesReached],
          };
          creditedScoreRef.current = snap.score;

          const finishedNow: { title: string; rewardCoins: number }[] = [];

          persistSave((prevRaw) => {
            const prev = ensureDailyQuestsFresh(prevRaw);
            const activeSkin = prev.selectedSkin;
            const nextProgress = { ...prev.missions.progress };
            const nextClaimable = [...prev.missions.claimableIds];

            for (const id of prev.missions.activeIds) {
              if (nextClaimable.includes(id)) continue;
              const def = getMissionById(id);
              if (!def) continue;

              const updatedVal = !isSingleRunMission(def)
                ? (nextProgress[id] ?? 0) +
                  getMetricValueFromRun(def, deltaMetrics, deltaScore, activeSkin)
                : Math.max(
                    nextProgress[id] ?? 0,
                    getMetricValueFromRun(def, snap.metrics, snap.score, activeSkin),
                  );

              nextProgress[id] = Math.min(def.target, updatedVal);

              if (updatedVal >= def.target) {
                nextClaimable.push(id);
                finishedNow.push({
                  title: def.title,
                  rewardCoins: def.rewardCoins,
                });
              }
            }

            const nextDailyProgress = { ...prev.missions.dailyProgress };
            for (const id of prev.missions.dailyIds) {
              if (prev.missions.dailyClaimedIds.includes(id)) continue;
              const def = getMissionById(id);
              if (!def) continue;

              const prevVal = nextDailyProgress[id] ?? 0;
              if (prevVal >= def.target) continue;

              const updatedVal = !isSingleRunMission(def)
                ? prevVal +
                  getMetricValueFromRun(def, deltaMetrics, deltaScore, activeSkin)
                : Math.max(
                    prevVal,
                    getMetricValueFromRun(def, snap.metrics, snap.score, activeSkin),
                  );

              nextDailyProgress[id] = Math.min(def.target, updatedVal);

              if (updatedVal >= def.target && prevVal < def.target) {
                finishedNow.push({
                  title: def.title,
                  rewardCoins: def.rewardCoins,
                });
              }
            }

            const nextAchProgress = { ...prev.achievements.progress };
            for (const ach of ACHIEVEMENT_POOL) {
              if (prev.achievements.claimedIds.includes(ach.id)) continue;
              if (ach.type === 'unlock_skin') continue;

              const prevVal = nextAchProgress[ach.id] ?? 0;
              if (prevVal >= ach.target) continue;

              let updatedVal = prevVal;
              if (ach.type === 'skin_distance') {
                if (ach.skinId === activeSkin) {
                  updatedVal = prevVal + deltaMetrics.distance;
                }
              } else if (ach.type === 'reach_zone') {
                if (ach.zoneId && snap.metrics.zonesReached.includes(ach.zoneId)) {
                  updatedVal = 1;
                }
              } else if (ach.type === 'total_flights') {
                updatedVal = prevVal + deltaMetrics.flights;
              } else if (ach.type === 'total_coins') {
                updatedVal = prevVal + deltaMetrics.coins;
              } else if (ach.type === 'total_distance') {
                updatedVal = prevVal + deltaMetrics.distance;
              }

              const clampedVal = Math.min(ach.target, updatedVal);
              nextAchProgress[ach.id] = clampedVal;

              if (clampedVal >= ach.target && prevVal < ach.target) {
                finishedNow.push({
                  title: ach.title,
                  rewardCoins: ach.rewardCoins,
                });
              }
            }

            return {
              ...prev,
              highScore: Math.max(prev.highScore, snap.score),
              totalCoins: prev.totalCoins + newlyEarned,
              missions: {
                ...prev.missions,
                progress: nextProgress,
                claimableIds: nextClaimable,
                dailyProgress: nextDailyProgress,
              },
              achievements: {
                ...prev.achievements,
                progress: nextAchProgress,
              },
            };
          });

          if (finishedNow.length > 0) {
            setCompletedMissionsThisRun((prev) => [...prev, ...finishedNow]);
          }
        },
      },
    );

    engine.setGraphicsQuality(saveRef.current.graphicsQuality);
    engine.setUpgrades(saveRef.current.upgrades);
    engine.setBonusMultiplier(
      getScoreMultiplierFromMissions(saveRef.current.missions.completedCount),
    );
    engineRef.current = engine;

    // Generate crisp 3D portrait thumbnails of every cockroach skin for the Shop
    try {
      const shots = engine.captureSkinPortraits();
      setPortraits(shots);
    } catch {
      // Fallback handled cleanly in SkinShopModal
    }

    return () => {
      if (zoneTimeoutRef.current) {
        window.clearTimeout(zoneTimeoutRef.current);
      }
      if (hintTimeoutRef.current) {
        window.clearTimeout(hintTimeoutRef.current);
      }
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      engine.dispose();
      engineRef.current = null;
    };
  }, [persistSave, checkLiveMissionToast]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        engine.moveLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        engine.moveRight();
      } else if (
        e.key === 'ArrowUp' ||
        e.key === 'w' ||
        e.key === 'W' ||
        e.key === ' '
      ) {
        e.preventDefault();
        engine.jump();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        engine.slide();
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (hud.phase === 'playing') engine.pause();
        else if (hud.phase === 'paused') engine.resume();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud.phase]);

  // Unified Pointer Swipe (Gameplay: 1 swipe = 1 lane/jump/roll; Menu: drag to spin 3D hero or tap character)
  const handlePointerDown = (e: React.PointerEvent) => {
    gameAudio.unlock();
    if ((e.target as HTMLElement)?.closest('button, input')) return;
    if (
      hud.phase === 'menu' &&
      !settingsOpen &&
      !missionsOpen &&
      !dailyRewardOpen &&
      !notificationPromptOpen
    ) {
      lastDragXRef.current = e.clientX;
      menuDownPosRef.current = !shopOpen ? { x: e.clientX, y: e.clientY } : null;
      menuDragMovedRef.current = 0;
      return;
    }
    if (hud.phase !== 'playing') return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
    swipeConsumedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (hud.phase === 'menu' && lastDragXRef.current !== null && !settingsOpen) {
      const dx = e.clientX - lastDragXRef.current;
      lastDragXRef.current = e.clientX;
      if (menuDownPosRef.current) {
        const totalMove = Math.hypot(
          e.clientX - menuDownPosRef.current.x,
          e.clientY - menuDownPosRef.current.y,
        );
        if (totalMove > menuDragMovedRef.current) {
          menuDragMovedRef.current = totalMove;
        }
      }
      engineRef.current?.rotateMenuCharacter(dx);
      return;
    }
    if (
      hud.phase !== 'playing' ||
      !swipeStartRef.current ||
      swipeConsumedRef.current
    ) {
      return;
    }

    const dx = e.clientX - swipeStartRef.current.x;
    const dy = e.clientY - swipeStartRef.current.y;
    const threshold = 22;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    swipeConsumedRef.current = true;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) engineRef.current?.moveLeft();
      else engineRef.current?.moveRight();
    } else {
      if (dy < 0) engineRef.current?.jump();
      else engineRef.current?.slide();
    }
  };

  const handlePointerUp = () => {
    const moved = menuDragMovedRef.current;
    swipeStartRef.current = null;
    lastDragXRef.current = null;
    swipeConsumedRef.current = false;

    if (
      isCleanMainMenu &&
      pendingAutoVoiceRef.current &&
      moved >= 18 &&
      gameAudio.hasMenuVoice(saveRef.current.selectedSkin)
    ) {
      pendingAutoVoiceRef.current = false;
      menuIntroPlayedRef.current = true;
      void gameAudio.playMenuCharacterVoice(saveRef.current.selectedSkin);
      engineRef.current?.triggerMenuCharacterTapAnim();
    }
  };

  const handlePointerCancel = () => {
    swipeStartRef.current = null;
    lastDragXRef.current = null;
    swipeConsumedRef.current = false;
    menuDownPosRef.current = null;
    menuDragMovedRef.current = 0;
  };

  const handleMenuCharacterClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement)?.closest('button, input')) return;
    if (!isCleanMainMenu) return;
    const moved = menuDragMovedRef.current;
    menuDownPosRef.current = null;
    menuDragMovedRef.current = 0;
    if (moved >= 18) return;

    const skinId = saveRef.current.selectedSkin;
    const hitCharacter = engineRef.current?.isPointOnMenuCharacter(
      e.clientX,
      e.clientY,
    );
    if (hitCharacter || pendingAutoVoiceRef.current) {
      pendingAutoVoiceRef.current = false;
      menuIntroPlayedRef.current = true;
      if (gameAudio.hasMenuVoice(skinId)) {
        void gameAudio.playMenuCharacterVoice(skinId);
        engineRef.current?.triggerMenuCharacterTapAnim();
      }
    }
  };

  const handleStartRun = () => {
    gameAudio.stopMenuVoice();
    setShopOpen(false);
    setSettingsOpen(false);
    setMissionsOpen(false);
    setMissionToast(null);
    setAdNotice(null);
    creditedRunCoinsRef.current = 0;
    creditedScoreRef.current = 0;
    creditedMetricsRef.current = {
      ...ZERO_METRICS,
      zonesReached: ['mahalle_caddesi'],
    };
    toastedMissionIdsRef.current = new Set();
    setCompletedMissionsThisRun([]);
    persistSave((prev) => ({ ...prev, totalRuns: prev.totalRuns + 1 }));
    setShowSwipeHint(true);
    if (hintTimeoutRef.current) window.clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = window.setTimeout(() => {
      setShowSwipeHint(false);
    }, 3500);
    engineRef.current?.startRun();
  };

  const handleContinueWithCoins = () => {
    setAdNotice(null);
    const count = engineRef.current?.getContinueCount() ?? hud.continueCount;
    const cost = getContinueCost(count);
    if (saveRef.current.totalCoins < cost) return;
    persistSave((prev) => ({
      ...prev,
      totalCoins: Math.max(0, prev.totalCoins - cost),
    }));
    engineRef.current?.continueRun(false);
  };

  const handleContinueWithAd = async () => {
    if (adActionBusyRef.current) return;
    if (hud.adReviveUsed) return;
    if (!adBridge.isRewardedReady()) {
      setAdNotice(
        'AdMob Android paketi kurulunca burada gerçek ödüllü reklam oynatılıp ücretsiz canlandırır.',
      );
      return;
    }
    setAdNotice(null);
    adActionBusyRef.current = true;
    try {
      const rewarded = await adBridge.showRewardedContinue();
      if (rewarded) {
        resetCrashCountForAd();
        engineRef.current?.continueRun(true);
      }
    } finally {
      adActionBusyRef.current = false;
    }
  };

  const handleRestartAfterGameOver = async () => {
    if (adActionBusyRef.current) return;
    adActionBusyRef.current = true;
    try {
      await maybeShowInterstitialAfterCrash();
      handleStartRun();
    } finally {
      adActionBusyRef.current = false;
    }
  };

  const handleMainMenuAfterGameOver = async () => {
    if (adActionBusyRef.current) return;
    adActionBusyRef.current = true;
    try {
      await maybeShowInterstitialAfterCrash();
      engineRef.current?.returnToMenu();
    } finally {
      adActionBusyRef.current = false;
    }
  };

  const handleSelectSkin = (id: SkinId) => {
    gameAudio.stopMenuVoice();
    menuIntroPlayedRef.current = false;
    pendingAutoVoiceRef.current = false;
    persistSave((prev) => ({ ...prev, selectedSkin: id }));
    engineRef.current?.setSkin(id);
  };

  const handleUnlockSkin = (id: SkinId, cost: number) => {
    if (save.totalCoins < cost) return;
    gameAudio.stopMenuVoice();
    menuIntroPlayedRef.current = false;
    pendingAutoVoiceRef.current = false;
    persistSave((prev) => ({
      ...prev,
      totalCoins: prev.totalCoins - cost,
      unlockedSkins: prev.unlockedSkins.includes(id)
        ? prev.unlockedSkins
        : [...prev.unlockedSkins, id],
      selectedSkin: id,
    }));
    engineRef.current?.setSkin(id);
  };

  const handleUpgrade = (key: UpgradeKey) => {
    const info = UPGRADE_CATALOG.find((u) => u.key === key);
    if (!info) return;
    const currentLv = save.upgrades[key] ?? 1;
    if (currentLv >= info.maxLevel) return;
    const cost = getUpgradeCost(info.baseCost, currentLv);
    if (save.totalCoins < cost) return;

    persistSave((prev) => ({
      ...prev,
      totalCoins: prev.totalCoins - cost,
      upgrades: {
        ...prev.upgrades,
        [key]: currentLv + 1,
      },
    }));
  };

  const handleClaimMission = (missionId: string) => {
    const def = getMissionById(missionId);
    if (!def) return;
    gameAudio.playPowerup();
    persistSave((prev) => {
      if (!prev.missions.claimableIds.includes(missionId)) return prev;
      const nextCompleted = prev.missions.completedCount + 1;
      const nextProgress = { ...prev.missions.progress };
      delete nextProgress[missionId];

      const replacement = pickReplacementMission(
        prev.missions.activeIds,
        nextCompleted,
        prev.unlockedSkins,
      );
      const nextActive = prev.missions.activeIds.map((id) =>
        id === missionId ? replacement.id : id,
      );
      nextProgress[replacement.id] = 0;

      return {
        ...prev,
        totalCoins: prev.totalCoins + def.rewardCoins,
        missions: {
          ...prev.missions,
          activeIds: nextActive,
          progress: nextProgress,
          claimableIds: prev.missions.claimableIds.filter((id) => id !== missionId),
          completedCount: nextCompleted,
        },
      };
    });
  };

  const handleRerollMission = (missionId: string) => {
    const todayKey = getLocalDateKey();
    persistSave((prev) => {
      if (prev.missions.rerollDate === todayKey) return prev;
      if (prev.missions.claimableIds.includes(missionId)) return prev;
      const replacement = pickReplacementMission(
        prev.missions.activeIds,
        prev.missions.completedCount,
        prev.unlockedSkins,
      );
      const nextProgress = { ...prev.missions.progress };
      delete nextProgress[missionId];
      nextProgress[replacement.id] = 0;

      return {
        ...prev,
        missions: {
          ...prev.missions,
          activeIds: prev.missions.activeIds.map((id) =>
            id === missionId ? replacement.id : id,
          ),
          progress: nextProgress,
          rerollDate: todayKey,
        },
      };
    });
  };

  const handleClaimDailyQuest = (missionId: string) => {
    const def = getMissionById(missionId);
    if (!def) return;
    gameAudio.playPowerup();
    persistSave((prev) => {
      if (prev.missions.dailyClaimedIds.includes(missionId)) return prev;
      if ((prev.missions.dailyProgress[missionId] ?? 0) < def.target) return prev;
      return {
        ...prev,
        totalCoins: prev.totalCoins + def.rewardCoins,
        missions: {
          ...prev.missions,
          dailyClaimedIds: [...prev.missions.dailyClaimedIds, missionId],
        },
      };
    });
  };

  const handleClaimDailyChest = () => {
    gameAudio.playNewRecord();
    persistSave((prev) => {
      if (prev.missions.dailyChestClaimed) return prev;
      const doneCount = prev.missions.dailyIds.filter((id) =>
        prev.missions.dailyClaimedIds.includes(id),
      ).length;
      if (doneCount < 3) return prev;
      return {
        ...prev,
        totalCoins: prev.totalCoins + DAILY_CHEST_BONUS,
        missions: {
          ...prev.missions,
          dailyChestClaimed: true,
        },
      };
    });
  };

  const handleClaimAchievement = (achievementId: string) => {
    const def = getAchievementById(achievementId);
    if (!def) return;
    gameAudio.playNewRecord();
    persistSave((prev) => {
      if (prev.achievements.claimedIds.includes(achievementId)) return prev;
      if (getAchievementValue(def, prev) < def.target) return prev;
      return {
        ...prev,
        totalCoins: prev.totalCoins + def.rewardCoins,
        achievements: {
          ...prev.achievements,
          claimedIds: [...prev.achievements.claimedIds, achievementId],
        },
      };
    });
  };

  const showInAppNotifBanner = useCallback((title: string, body: string) => {
    setInAppNotifBanner({ title, body });
    window.setTimeout(() => {
      setInAppNotifBanner((cur) => (cur?.title === title ? null : cur));
    }, 3600);
  }, []);

  const handleEnableNotificationsFromPrompt = async () => {
    const perm = await requestBrowserNotificationPermission();
    setBrowserPermission(perm);
    const todayKey = getLocalDateKey();

    if (perm === 'granted' || isEmbedded) {
      persistSave((prev) => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          v: 2,
          enabled: true,
          userDisabledInSettings: false,
          lastPromptDate: todayKey,
        },
      }));
      setNotifDismissedSession(true);
      void sendGameNotification(
        'Bildirimler Açıldı! 🔔',
        'Sürprizlerden ve firarlardan ilk sen haberdar ol!',
        'bocek-welcome',
        showInAppNotifBanner,
      );
    } else {
      persistSave((prev) => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          v: 2,
          enabled: false,
          lastPromptDate: todayKey,
        },
      }));
    }
    return perm;
  };

  const handleDismissNotificationPromptFor3Days = () => {
    const todayKey = getLocalDateKey();
    setNotifDismissedSession(true);
    persistSave((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        v: 2,
        lastPromptDate: todayKey,
      },
    }));
  };

  const handleToggleNotificationsInSettings = () => {
    setNotifFeedback(null);
    const currentlyOn =
      save.notifications.enabled &&
      (browserPermission === 'granted' || isEmbedded);

    if (currentlyOn) {
      persistSave((prev) => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          v: 2,
          enabled: false,
          userDisabledInSettings: true,
        },
      }));
      setNotifFeedback('Bildirimler kapatıldı.');
      return;
    }

    void requestBrowserNotificationPermission().then((perm) => {
      setBrowserPermission(perm);
      const todayKey = getLocalDateKey();
      if (perm === 'granted' || isEmbedded) {
        persistSave((prev) => ({
          ...prev,
          notifications: {
            ...prev.notifications,
            v: 2,
            enabled: true,
            userDisabledInSettings: false,
            lastPromptDate: todayKey,
          },
        }));
        setNotifFeedback(
          perm === 'granted'
            ? 'Bildirimler açıldı!'
            : 'Bildirim tercihi açıldı (gerçek tarayıcı bildirimleri tam sekmede aktif olur).',
        );
      } else {
        persistSave((prev) => ({
          ...prev,
          notifications: {
            ...prev.notifications,
            v: 2,
            enabled: false,
          },
        }));
        setNotifFeedback(
          'Tarayıcı adres çubuğundan bildirim iznine izin vermelisin.',
        );
      }
    });
  };

  const handleToggleAllMute = () => {
    const anyOn = save.sfxEnabled || save.ambienceEnabled;
    const nextVal = !anyOn;
    persistSave((prev) => ({
      ...prev,
      sfxEnabled: nextVal,
      ambienceEnabled: nextVal,
    }));
  };

  const handleChangeQuality = (quality: GraphicsQuality) => {
    persistSave((prev) => ({ ...prev, graphicsQuality: quality }));
  };

  const handleClaimDailyReward = () => {
    const freshInfo = getDailyRewardInfo(saveRef.current.dailyReward);
    if (!freshInfo.canClaim) return;
    if (freshInfo.claimDay === 7) {
      gameAudio.playNewRecord();
    } else {
      gameAudio.playPowerup();
    }
    persistSave((prev) => ({
      ...prev,
      totalCoins: prev.totalCoins + freshInfo.rewardCoins,
      dailyReward: {
        lastClaimDate: freshInfo.todayKey,
        streak: freshInfo.claimDay,
      },
    }));
  };

  const isMuted = !save.sfxEnabled && !save.ambienceEnabled;

  return (
    <div
      className="relative h-dvh w-screen overflow-hidden bg-[#081513] touch-none"
      onClick={handleMenuCharacterClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      {hud.phase === 'menu' && !shopOpen && !settingsOpen && (
        <MainMenuOverlay
          save={save}
          missionsOpen={missionsOpen}
          onSetMissionsOpen={setMissionsOpen}
          onStopCharacterVoice={() => gameAudio.stopMenuVoice()}
          onStart={handleStartRun}
          onOpenShop={() => {
            gameAudio.stopMenuVoice();
            setMissionsOpen(false);
            setShopOpen(true);
          }}
          onOpenSettings={() => {
            gameAudio.stopMenuVoice();
            setMissionsOpen(false);
            setSettingsOpen(true);
          }}
          onClaimMission={handleClaimMission}
          onRerollMission={handleRerollMission}
          onClaimDailyQuest={handleClaimDailyQuest}
          onClaimDailyChest={handleClaimDailyChest}
          onClaimAchievement={handleClaimAchievement}
        />
      )}

      {(hud.phase === 'playing' || hud.phase === 'paused') && (
        <GameHudOverlay
          hud={hud}
          zoneBanner={zoneBanner}
          missionToast={missionToast}
          muted={isMuted}
          showSwipeHint={showSwipeHint}
          onToggleMute={handleToggleAllMute}
          onPause={() => engineRef.current?.pause()}
          onResume={() => engineRef.current?.resume()}
          onMainMenu={() => {
            engineRef.current?.returnToMenu();
          }}
        />
      )}

      {hud.phase === 'gameover' && (
        <GameOverOverlay
          hud={hud}
          totalCoins={save.totalCoins}
          missions={save.missions}
          completedMissionsThisRun={completedMissionsThisRun}
          adNotice={adNotice}
          onContinueWithCoins={handleContinueWithCoins}
          onContinueWithAd={handleContinueWithAd}
          onRestart={() => void handleRestartAfterGameOver()}
          onMainMenu={() => void handleMainMenuAfterGameOver()}
        />
      )}

      {shopOpen && (
        <SkinShopModal
          totalCoins={save.totalCoins}
          unlockedSkins={save.unlockedSkins}
          selectedSkin={save.selectedSkin}
          upgrades={save.upgrades}
          portraits={portraits}
          onSelect={handleSelectSkin}
          onUnlock={handleUnlockSkin}
          onUpgrade={handleUpgrade}
          onClose={() => setShopOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          save={save}
          browserPermission={browserPermission}
          isEmbedded={isEmbedded}
          notifFeedback={notifFeedback}
          onChangeSfxVolume={(val) =>
            persistSave((prev) => ({
              ...prev,
              sfxVolume: val,
              sfxEnabled: val > 0.01,
            }))
          }
          onChangeAmbienceVolume={(val) =>
            persistSave((prev) => ({
              ...prev,
              ambienceVolume: val,
              ambienceEnabled: val > 0.01,
            }))
          }
          onToggleSfx={() =>
            persistSave((prev) => ({ ...prev, sfxEnabled: !prev.sfxEnabled }))
          }
          onToggleAmbience={() =>
            persistSave((prev) => ({
              ...prev,
              ambienceEnabled: !prev.ambienceEnabled,
            }))
          }
          onToggleNotifications={handleToggleNotificationsInSettings}
          onChangeQuality={handleChangeQuality}
          onClose={() => {
            setNotifFeedback(null);
            setSettingsOpen(false);
          }}
        />
      )}

      {dailyRewardOpen && (
        <DailyRewardModal
          info={dailyRewardInfo}
          onClaim={handleClaimDailyReward}
          onDismiss={() => setDailyDismissed(true)}
        />
      )}

      {notificationPromptOpen && (
        <NotificationPromptModal
          isEmbedded={isEmbedded}
          onEnable={handleEnableNotificationsFromPrompt}
          onDismissFor3Days={handleDismissNotificationPromptFor3Days}
        />
      )}

      {inAppNotifBanner && (
        <div className="pointer-events-none fixed top-4 left-1/2 z-[60] -translate-x-1/2 w-[90vw] max-w-sm rounded-2xl bg-emerald-950/95 border-2 border-emerald-400 px-4 py-3 shadow-2xl">
          <div className="text-xs font-extrabold text-emerald-300">
            {inAppNotifBanner.title}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-white">
            {inAppNotifBanner.body}
          </div>
        </div>
      )}
    </div>
  );
}
