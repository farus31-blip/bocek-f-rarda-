import {
  Award,
  CalendarDays,
  CheckCircle2,
  Compass,
  Flame,
  Gift,
  MapPin,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import {
  ACHIEVEMENT_POOL,
  DAILY_CHEST_BONUS,
  getAchievementValue,
  getBugRank,
  getLocalDateKey,
  getMissionById,
  getReadyAchievementsCount,
  getScoreMultiplierFromMissions,
} from '../game/storage';
import {
  AchievementCategory,
  MissionCategory,
  SaveData,
} from '../game/types';

interface MissionsModalProps {
  save: SaveData;
  onClaimMission: (missionId: string) => void;
  onRerollMission: (missionId: string) => void;
  onClaimDailyQuest: (missionId: string) => void;
  onClaimDailyChest: () => void;
  onClaimAchievement: (achievementId: string) => void;
  onClose: () => void;
}

const CATEGORY_BADGE: Record<
  MissionCategory,
  { label: string; className: string }
> = {
  birikimli: {
    label: 'BİRİKİMLİ',
    className: 'bg-sky-500/20 border-sky-400/40 text-sky-300',
  },
  tek_kosu: {
    label: 'TEK KOŞU',
    className: 'bg-amber-500/20 border-amber-400/45 text-amber-300',
  },
  bolge: {
    label: 'SAHNE',
    className: 'bg-fuchsia-500/20 border-fuchsia-400/45 text-fuchsia-300',
  },
  karakter: {
    label: 'KARAKTER',
    className: 'bg-emerald-500/20 border-emerald-400/45 text-emerald-300',
  },
  guc: {
    label: 'GÜÇ',
    className: 'bg-cyan-500/20 border-cyan-400/45 text-cyan-300',
  },
};

const ACHIEVEMENT_BADGE: Record<
  AchievementCategory,
  { label: string; className: string }
> = {
  karakter: {
    label: 'KARAKTER',
    className: 'bg-emerald-500/20 border-emerald-400/45 text-emerald-300',
  },
  sahne: {
    label: 'SAHNE',
    className: 'bg-fuchsia-500/20 border-fuchsia-400/45 text-fuchsia-300',
  },
  ustalik: {
    label: 'USTALIK',
    className: 'bg-cyan-500/20 border-cyan-400/45 text-cyan-300',
  },
};

export function MissionsModal({
  save,
  onClaimMission,
  onRerollMission,
  onClaimDailyQuest,
  onClaimDailyChest,
  onClaimAchievement,
  onClose,
}: MissionsModalProps) {
  const [tab, setTab] = useState<'set' | 'daily' | 'achievements'>('set');
  const [achFilter, setAchFilter] = useState<'all' | AchievementCategory>('all');
  const scoreMult = getScoreMultiplierFromMissions(save.missions.completedCount);
  const rank = getBugRank(save.missions.completedCount);
  const todayKey = getLocalDateKey();
  const canRerollToday = save.missions.rerollDate !== todayKey;

  const nextMultProgress = save.missions.completedCount % 2;

  const dailyClaimedCount = save.missions.dailyIds.filter((id) =>
    save.missions.dailyClaimedIds.includes(id),
  ).length;
  const dailyChestReady =
    dailyClaimedCount >= 3 && !save.missions.dailyChestClaimed;

  const setReadyCount = save.missions.claimableIds.length;
  const dailyReadyCount =
    save.missions.dailyIds.filter((id) => {
      const def = getMissionById(id);
      if (!def || save.missions.dailyClaimedIds.includes(id)) return false;
      return (save.missions.dailyProgress[id] ?? 0) >= def.target;
    }).length + (dailyChestReady ? 1 : 0);
  const readyAchievementsCount = getReadyAchievementsCount(save);

  const filteredAchievements = ACHIEVEMENT_POOL.filter(
    (a) => achFilter === 'all' || a.category === achFilter,
  ).sort((a, b) => {
    const aClaimed = save.achievements.claimedIds.includes(a.id);
    const bClaimed = save.achievements.claimedIds.includes(b.id);
    const aReady = !aClaimed && getAchievementValue(a, save) >= a.target;
    const bReady = !bClaimed && getAchievementValue(b, save) >= b.target;
    if (aReady !== bReady) return aReady ? -1 : 1;
    if (aClaimed !== bClaimed) return aClaimed ? 1 : -1;
    return 0;
  });

  const claimedAchCount = save.achievements.claimedIds.length;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-md rounded-3xl bg-[#0f1626] border-2 border-emerald-400/80 p-5 shadow-[0_0_45px_rgba(16,185,129,0.24)] max-h-[90dvh] flex flex-col">
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="absolute -top-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 border-2 border-white text-white shadow-lg hover:bg-rose-400 active:scale-95 transition-transform"
        >
          <X className="h-5 w-5 stroke-[3]" />
        </button>

        {/* Header & Rank Banner */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-extrabold tracking-wide text-white">
                GÖREVLER
              </h2>
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400/20 border border-amber-400/45 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
                <Award className="h-3 w-3" />
                {rank.title}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {rank.nextTitle
                ? `Sonraki rütbe (${rank.nextTitle}) için ${rank.remainingForNext} görev`
                : 'En yüksek böcek rütbesine ulaştın!'}
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-block rounded-xl bg-emerald-500/20 border border-emerald-400/60 px-2.5 py-1 text-xs font-extrabold text-emerald-300">
              Skor: {scoreMult}x
            </span>
            <div className="mt-1 text-[10px] font-bold text-slate-400">
              +1x için {nextMultProgress}/2
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-900/90 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setTab('set')}
            className={`relative flex items-center justify-center gap-1 rounded-xl py-2 px-1 text-[11px] font-extrabold transition-colors ${
              tab === 'set'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Target className="h-3.5 w-3.5 shrink-0" />
            <span>Gelişim</span>
            {setReadyCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">
                {setReadyCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTab('daily')}
            className={`relative flex items-center justify-center gap-1 rounded-xl py-2 px-1 text-[11px] font-extrabold transition-colors ${
              tab === 'daily'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span>Günlük</span>
            {dailyReadyCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">
                {dailyReadyCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTab('achievements')}
            className={`relative flex items-center justify-center gap-1 rounded-xl py-2 px-1 text-[11px] font-extrabold transition-colors ${
              tab === 'achievements'
                ? 'bg-fuchsia-400 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Trophy className="h-3.5 w-3.5 shrink-0" />
            <span>Hedefler</span>
            {readyAchievementsCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">
                {readyAchievementsCount}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Quest List */}
        <div className="mt-3 flex-1 overflow-y-auto pr-0.5 flex flex-col gap-2.5">
          {tab === 'set' && (
            <>
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                <span>Her 2 görev kalıcı skor çarpanını +1x artırır.</span>
                <span className="font-bold text-cyan-300">
                  {canRerollToday ? '1x Ücretsiz Değişim' : 'Değişim Kullanıldı'}
                </span>
              </div>

              {save.missions.activeIds.map((id) => {
                const def = getMissionById(id);
                if (!def) return null;
                const isClaimable = save.missions.claimableIds.includes(id);
                const val = isClaimable
                  ? def.target
                  : Math.min(def.target, save.missions.progress[id] ?? 0);
                const pct = Math.min(100, Math.round((val / def.target) * 100));
                const badge = CATEGORY_BADGE[def.category];

                return (
                  <div
                    key={id}
                    className={`rounded-2xl border p-3 transition-all ${
                      isClaimable
                        ? 'bg-emerald-500/15 border-emerald-400/75 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        : 'bg-slate-900/90 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-300">
                          SET {def.tier}
                        </span>
                      </div>

                      <span className="font-mono-num text-xs font-extrabold text-amber-300">
                        +{def.rewardCoins} kırıntı
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-white">
                        {def.title}
                      </span>

                      {!isClaimable && canRerollToday && (
                        <button
                          type="button"
                          onClick={() => onRerollMission(id)}
                          title="Bu görevi değiştir"
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-800 border border-white/15 px-2 py-1 text-[10px] font-bold text-cyan-300 hover:bg-slate-700 active:scale-95"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Değiştir</span>
                        </button>
                      )}
                    </div>

                    {isClaimable ? (
                      <button
                        type="button"
                        onClick={() => onClaimMission(id)}
                        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-300 to-emerald-500 border border-slate-950 border-b-[3px] py-2 text-xs font-extrabold text-slate-950 shadow hover:brightness-105 active:translate-y-0.5"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>ÖDÜLÜ AL (+{def.rewardCoins} KIRINTI)</span>
                      </button>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono-num text-[11px] font-bold text-slate-300">
                          {val}/{def.target}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {tab === 'daily' && (
            <>
              {/* Daily Grand Chest */}
              <div
                className={`rounded-2xl border p-3.5 ${
                  dailyChestReady
                    ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/20 border-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.28)]'
                    : save.missions.dailyChestClaimed
                      ? 'bg-emerald-500/12 border-emerald-400/45'
                      : 'bg-slate-900/90 border-amber-400/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                      <Gift className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-white">
                        Günlük Büyük Kasa ({dailyClaimedCount}/3)
                      </div>
                      <div className="text-[11px] text-slate-300">
                        3 günlük görevi bitirip ödülünü al!
                      </div>
                    </div>
                  </div>
                  <span className="font-mono-num text-xs font-extrabold text-amber-300">
                    +{DAILY_CHEST_BONUS}
                  </span>
                </div>

                {dailyChestReady && (
                  <button
                    type="button"
                    onClick={onClaimDailyChest}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-amber-300 to-orange-500 border border-slate-950 border-b-[3px] py-2 text-xs font-extrabold text-slate-950 shadow hover:brightness-105"
                  >
                    <Flame className="h-3.5 w-3.5" />
                    <span>KASAYI AÇ (+{DAILY_CHEST_BONUS} KIRINTI)</span>
                  </button>
                )}

                {save.missions.dailyChestClaimed && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Bugünkü Büyük Kasa Alındı!</span>
                  </div>
                )}
              </div>

              {save.missions.dailyIds.map((id) => {
                const def = getMissionById(id);
                if (!def) return null;
                const isClaimed = save.missions.dailyClaimedIds.includes(id);
                const val = Math.min(
                  def.target,
                  save.missions.dailyProgress[id] ?? 0,
                );
                const isReady = !isClaimed && val >= def.target;
                const pct = Math.min(100, Math.round((val / def.target) * 100));

                return (
                  <div
                    key={id}
                    className={`rounded-2xl border p-3 ${
                      isClaimed
                        ? 'bg-emerald-500/10 border-emerald-400/35 opacity-80'
                        : isReady
                          ? 'bg-amber-400/15 border-amber-300'
                          : 'bg-slate-900/90 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-white">
                      <span className="flex items-center gap-1.5">
                        {def.category === 'tek_kosu' && (
                          <Compass className="h-3.5 w-3.5 text-amber-300" />
                        )}
                        <span>{def.title}</span>
                      </span>
                      <span className="font-mono-num text-amber-300">
                        +{def.rewardCoins} kırıntı
                      </span>
                    </div>

                    {isClaimed ? (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Tamamlandı</span>
                      </div>
                    ) : isReady ? (
                      <button
                        type="button"
                        onClick={() => onClaimDailyQuest(id)}
                        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 border border-slate-950 border-b-[3px] py-2 text-xs font-extrabold text-slate-950 shadow hover:brightness-105"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>ÖDÜLÜ AL (+{def.rewardCoins} KIRINTI)</span>
                      </button>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono-num text-[11px] font-bold text-slate-300">
                          {val}/{def.target}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {tab === 'achievements' && (
            <>
              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-[11px] text-slate-400">
                  Kalıcı hedefler ({claimedAchCount}/{ACHIEVEMENT_POOL.length})
                </span>
                <div className="flex items-center gap-1">
                  {(
                    [
                      { key: 'all', label: 'Tümü' },
                      { key: 'karakter', label: 'Karakter' },
                      { key: 'sahne', label: 'Sahneler' },
                      { key: 'ustalik', label: 'Ustalık' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setAchFilter(f.key)}
                      className={`rounded-lg px-2 py-1 text-[10px] font-extrabold transition-colors ${
                        achFilter === f.key
                          ? 'bg-fuchsia-400 text-slate-950'
                          : 'bg-slate-800/90 text-slate-300 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredAchievements.map((def) => {
                const isClaimed = save.achievements.claimedIds.includes(def.id);
                const rawVal = getAchievementValue(def, save);
                const val = Math.min(def.target, rawVal);
                const isReady = !isClaimed && val >= def.target;
                const pct = Math.min(100, Math.round((val / def.target) * 100));
                const badge = ACHIEVEMENT_BADGE[def.category];

                const Icon =
                  def.category === 'karakter'
                    ? UserCheck
                    : def.category === 'sahne'
                      ? MapPin
                      : Zap;

                return (
                  <div
                    key={def.id}
                    className={`rounded-2xl border p-3 transition-all ${
                      isClaimed
                        ? 'bg-emerald-500/10 border-emerald-400/35 opacity-80'
                        : isReady
                          ? 'bg-fuchsia-500/15 border-fuchsia-400 shadow-[0_0_20px_rgba(232,121,249,0.22)]'
                          : 'bg-slate-900/90 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold ${badge.className}`}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        <span>{badge.label}</span>
                      </span>

                      <span className="font-mono-num text-xs font-extrabold text-amber-300">
                        +{def.rewardCoins} kırıntı
                      </span>
                    </div>

                    <div className="mt-1.5 text-xs font-extrabold text-white">
                      {def.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {def.desc}
                    </div>

                    {isClaimed ? (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Tamamlandı</span>
                      </div>
                    ) : isReady ? (
                      <button
                        type="button"
                        onClick={() => onClaimAchievement(def.id)}
                        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-500 border border-slate-950 border-b-[3px] py-2 text-xs font-extrabold text-slate-950 shadow hover:brightness-105 active:translate-y-0.5"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>ÖDÜLÜ AL (+{def.rewardCoins} KIRINTI)</span>
                      </button>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono-num text-[11px] font-bold text-slate-300">
                          {val}/{def.target}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
