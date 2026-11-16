import {
  ClipboardList,
  Play,
  Settings,
  ShoppingCart,
  Trophy,
} from 'lucide-react';
import {
  SKINS,
  getMissionById,
  getReadyAchievementsCount,
  getScoreMultiplierFromMissions,
} from '../game/storage';
import { SaveData } from '../game/types';
import { MissionsModal } from './MissionsModal';

interface MainMenuOverlayProps {
  save: SaveData;
  missionsOpen: boolean;
  onSetMissionsOpen: (open: boolean) => void;
  onStopCharacterVoice?: () => void;
  onStart: () => void;
  onOpenShop: () => void;
  onOpenSettings: () => void;
  onClaimMission: (missionId: string) => void;
  onRerollMission: (missionId: string) => void;
  onClaimDailyQuest: (missionId: string) => void;
  onClaimDailyChest: () => void;
  onClaimAchievement: (achievementId: string) => void;
}

export function MainMenuOverlay({
  save,
  missionsOpen,
  onSetMissionsOpen,
  onStopCharacterVoice,
  onStart,
  onOpenShop,
  onOpenSettings,
  onClaimMission,
  onRerollMission,
  onClaimDailyQuest,
  onClaimDailyChest,
  onClaimAchievement,
}: MainMenuOverlayProps) {
  const activeSkin = SKINS.find((s) => s.id === save.selectedSkin) || SKINS[0];
  const scoreMult = getScoreMultiplierFromMissions(save.missions.completedCount);

  const dailyClaimedCount = save.missions.dailyIds.filter((id) =>
    save.missions.dailyClaimedIds.includes(id),
  ).length;
  const dailyChestReady =
    dailyClaimedCount >= 3 && !save.missions.dailyChestClaimed;
  const dailyReadyCount =
    save.missions.dailyIds.filter((id) => {
      const def = getMissionById(id);
      if (!def || save.missions.dailyClaimedIds.includes(id)) return false;
      return (save.missions.dailyProgress[id] ?? 0) >= def.target;
    }).length + (dailyChestReady ? 1 : 0);

  const readyAchievementsCount = getReadyAchievementsCount(save);
  const totalClaimableCount =
    save.missions.claimableIds.length + dailyReadyCount + readyAchievementsCount;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar: Options + Görevler Left · Shop + Kırıntı Right */}
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex items-start gap-2.5">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111926]/90 border-2 border-white/75 text-white shadow-lg group-hover:bg-slate-800">
              <Settings className="h-6 w-6" />
            </span>
            <span className="text-[11px] font-extrabold tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              Ayarlar
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onStopCharacterVoice?.();
              onSetMissionsOpen(true);
            }}
            className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
          >
            <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111926]/90 border-2 border-emerald-400/80 text-emerald-300 shadow-lg group-hover:bg-slate-800">
              <ClipboardList className="h-6 w-6" />
              <span className="absolute -bottom-1.5 -right-1.5 rounded-md bg-emerald-400 px-1 text-[9px] font-extrabold text-slate-950 shadow">
                {scoreMult}x
              </span>
              {totalClaimableCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 border-2 border-white px-1 text-[10px] font-extrabold text-white shadow animate-pulse">
                  {totalClaimableCount}
                </span>
              )}
            </span>
            <span className="text-[11px] font-extrabold tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              Görevler
            </span>
          </button>
        </div>

        {/* Compact Top Title (leaves entire center viewport open for the 3D character!) */}
        <div className="mt-0.5 text-center select-none">
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]">
            BÖCEK FİRAR
          </h1>
        </div>

        <div className="pointer-events-auto flex items-start gap-2.5">
          <button
            type="button"
            onClick={onOpenShop}
            className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111926]/90 border-2 border-white/75 text-white shadow-lg group-hover:bg-slate-800">
              <ShoppingCart className="h-6 w-6" />
            </span>
            <span className="text-[11px] font-extrabold tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              Mağaza
            </span>
          </button>

          <div className="mt-1.5 flex items-center gap-2 rounded-full bg-[#111926]/92 border-2 border-white/60 px-3.5 py-1.5 shadow-lg">
            <span className="inline-block h-3.5 w-3.5 rotate-12 rounded-sm bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
            <span className="font-mono-num text-sm sm:text-base font-extrabold text-white">
              {save.totalCoins.toLocaleString('tr-TR')}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Center: Character Name + Chunky PLAY Button + Record */}
      <div className="mx-auto mb-3 sm:mb-5 flex w-full max-w-xs flex-col items-center gap-3">
        <div className="text-center select-none">
          <span className="rounded-full bg-black/55 border border-white/25 px-3.5 py-1 text-xs font-extrabold tracking-wide text-amber-300 shadow">
            {activeSkin.name}
          </span>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="pointer-events-auto flex w-56 sm:w-64 items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-amber-400 via-orange-500 to-orange-600 border-[3px] border-slate-950 border-b-[6px] py-3.5 text-2xl font-extrabold tracking-wider text-white shadow-[0_12px_30px_rgba(249,115,22,0.5)] hover:brightness-105 active:translate-y-0.5 active:border-b-[3px] transition-all"
        >
          <Play className="h-6 w-6 fill-white" />
          <span>OYNA</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs font-extrabold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] select-none">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span>Rekor:</span>
          <span className="font-mono-num text-amber-300">
            {save.highScore.toLocaleString('tr-TR')}
          </span>
        </div>
      </div>

      {/* Upgraded Missions Modal */}
      {missionsOpen && (
        <MissionsModal
          save={save}
          onClaimMission={onClaimMission}
          onRerollMission={onRerollMission}
          onClaimDailyQuest={onClaimDailyQuest}
          onClaimDailyChest={onClaimDailyChest}
          onClaimAchievement={onClaimAchievement}
          onClose={() => onSetMissionsOpen(false)}
        />
      )}
    </div>
  );
}
