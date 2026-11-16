import { useState } from 'react';
import {
  Check,
  Flashlight,
  Lock,
  Magnet,
  Rocket,
  Shield,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react';
import {
  SKINS,
  UPGRADE_CATALOG,
  getUpgradeCost,
} from '../game/storage';
import { SkinId, UpgradeKey } from '../game/types';

interface SkinShopModalProps {
  totalCoins: number;
  unlockedSkins: SkinId[];
  selectedSkin: SkinId;
  upgrades: Record<UpgradeKey, number>;
  portraits: Partial<Record<SkinId, string>>;
  onSelect: (id: SkinId) => void;
  onUnlock: (id: SkinId, cost: number) => void;
  onUpgrade: (key: UpgradeKey) => void;
  onClose: () => void;
}

const UPGRADE_ICONS: Record<UpgradeKey, typeof Rocket> = {
  wings: Rocket,
  magnet: Magnet,
  turbo: Zap,
  flashlight: Flashlight,
  shield: Shield,
};

export function SkinShopModal({
  totalCoins,
  unlockedSkins,
  selectedSkin,
  upgrades,
  portraits,
  onSelect,
  onUnlock,
  onUpgrade,
  onClose,
}: SkinShopModalProps) {
  const [tab, setTab] = useState<'skins' | 'upgrades'>('skins');

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar: Close Button Left · Kırıntı Right (leaves live 3D character visible on left!) */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500 border-2 border-white text-white shadow-xl hover:bg-rose-400 active:scale-95 transition-transform"
        >
          <X className="h-6 w-6 stroke-[3]" />
        </button>

        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-950/90 border-2 border-white/50 px-4 py-1.5 shadow-xl">
          <span className="inline-block h-3.5 w-3.5 rotate-12 rounded-sm bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
          <span className="font-mono-num text-base font-extrabold text-white">
            {totalCoins.toLocaleString('tr-TR')}
          </span>
        </div>
      </div>

      {/* Right-aligned Shop Drawer so the live 3D character stands visibly on the left */}
      <div className="pointer-events-auto ml-auto my-auto w-[66vw] min-w-[238px] max-w-[390px] relative rounded-[24px] bg-[#0b0e1d]/94 border-2 border-pink-500/80 p-3 sm:p-4 pt-7 sm:pt-8 shadow-[0_0_32px_rgba(236,72,153,0.3)]">
        {/* Overlapping Neon MAĞAZA Header */}
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 border-2 border-white/75 px-6 sm:px-7 py-1 shadow-lg">
          <h2 className="font-display text-base sm:text-lg font-extrabold tracking-widest text-white">
            MAĞAZA
          </h2>
        </div>

        {/* Category Tabs: KARAKTERLER · GÜÇLENDİR */}
        <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-900/90 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setTab('skins')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] sm:text-xs font-extrabold tracking-wide transition-colors ${
              tab === 'skins'
                ? 'bg-fuchsia-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>KARAKTERLER</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('upgrades')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] sm:text-xs font-extrabold tracking-wide transition-colors ${
              tab === 'upgrades'
                ? 'bg-sky-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>GÜÇLENDİR</span>
          </button>
        </div>

        {tab === 'skins' ? (
          /* 2-Column Character Grid with Real 3D Portrait Photos & Prices */
          <div className="grid grid-cols-2 gap-2 sm:gap-3 max-h-[62dvh] overflow-y-auto pr-0.5">
            {SKINS.map((skin, idx) => {
              const isUnlocked = unlockedSkins.includes(skin.id);
              const isSelected = selectedSkin === skin.id;
              const canAfford = totalCoins >= skin.cost;
              const portraitUrl = portraits[skin.id];
              const accentHex = `#${skin.accentColor.toString(16).padStart(6, '0')}`;
              const isShowcaseOddLast =
                SKINS.length % 2 === 1 && idx === SKINS.length - 1;

              const handleCardClick = () => {
                if (isUnlocked) {
                  onSelect(skin.id);
                } else if (canAfford) {
                  onUnlock(skin.id, skin.cost);
                }
              };

              return (
                <button
                  key={skin.id}
                  type="button"
                  onClick={handleCardClick}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                    isShowcaseOddLast ? 'col-span-2' : ''
                  } ${
                    isSelected
                      ? 'bg-[#172038] border-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.35)]'
                      : isUnlocked
                        ? 'bg-[#121629] border-purple-400/50 hover:border-purple-300'
                        : 'bg-[#101323] border-slate-700/80 hover:border-amber-400/60'
                  }`}
                >
                  <div className="px-2 pt-2 text-center">
                    <div className="text-[11px] font-extrabold tracking-wide text-white truncate">
                      {skin.name}
                    </div>
                  </div>

                  <div
                    className="relative mx-auto mt-1 h-28 w-full flex items-center justify-center overflow-hidden"
                    style={{
                      background: `radial-gradient(circle at 50% 60%, ${accentHex}2a 0%, transparent 72%)`,
                    }}
                  >
                    {portraitUrl ? (
                      <img
                        src={portraitUrl}
                        alt={skin.name}
                        className="h-full w-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.8)] group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div
                        className="h-14 w-14 rounded-full border-2 border-white/25"
                        style={{ backgroundColor: accentHex }}
                      />
                    )}
                  </div>

                  <div
                    className={`mt-auto flex items-center justify-center gap-1.5 border-t py-2 text-xs font-extrabold ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                        : isUnlocked
                          ? 'bg-white/[0.05] border-white/10 text-slate-200'
                          : canAfford
                            ? 'bg-amber-500/18 border-amber-400/40 text-amber-300'
                            : 'bg-slate-900/80 border-slate-800 text-slate-500'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                        <span>Kuşanıldı</span>
                      </>
                    ) : isUnlocked ? (
                      <span>Seç</span>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" />
                        <span className="inline-block h-2.5 w-2.5 rotate-12 rounded-[2px] bg-amber-400" />
                        <span className="font-mono-num">
                          {skin.cost.toLocaleString('tr-TR')}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Upgrades Tab (Lv 1–5) */
          <div className="flex flex-col gap-2.5 max-h-[62dvh] overflow-y-auto pr-0.5">
            {UPGRADE_CATALOG.map((item) => {
              const Icon = UPGRADE_ICONS[item.key];
              const level = upgrades[item.key] ?? 1;
              const isMax = level >= item.maxLevel;
              const cost = getUpgradeCost(item.baseCost, level);
              const canAfford = !isMax && totalCoins >= cost;

              return (
                <div
                  key={item.key}
                  className="flex items-center gap-3 rounded-2xl bg-[#12172b] border border-white/12 p-2.5"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20"
                    style={{ backgroundColor: `${item.accentHex}22`, color: item.accentHex }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-white truncate">
                        {item.name}
                      </span>
                      <span className="font-mono-num text-[10px] font-bold text-slate-400">
                        Sv.{level}/{item.maxLevel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-tight text-slate-400 line-clamp-2">
                      {item.desc}
                    </p>
                    {/* Level Pips */}
                    <div className="mt-1.5 flex gap-1">
                      {Array.from({ length: item.maxLevel }).map((_, idx) => (
                        <span
                          key={idx}
                          className={`h-1.5 flex-1 rounded-full ${
                            idx < level ? 'bg-sky-400' : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onUpgrade(item.key)}
                    className={`shrink-0 rounded-xl px-2.5 py-2 text-xs font-extrabold transition-transform active:scale-95 ${
                      isMax
                        ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 cursor-default'
                        : canAfford
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isMax ? (
                      'MAX'
                    ) : (
                      <span className="flex items-center gap-1 font-mono-num">
                        <span className="inline-block h-2.5 w-2.5 rotate-12 rounded-[2px] bg-slate-950/60" />
                        {cost}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Spacer */}
      <div className="h-2" />
    </div>
  );
}
