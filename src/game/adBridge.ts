/**
 * Android / Capacitor AdMob entegrasyonu için hazır köprü arayüzü.
 * - Rewarded (Ödüllü): Oyuncu isterse reklam izleyip ücretsiz canlanır.
 * - Interstitial (Geçiş): Her 2 yanışta 1 kez, oyun sonu çıkışında gösterilir.
 */
export interface AdBridge {
  isRewardedReady: () => boolean;
  showRewardedContinue: () => Promise<boolean>;
  isInterstitialReady: () => boolean;
  showInterstitial: () => Promise<boolean>;
}

export const INTERSTITIAL_CRASH_INTERVAL = 2;
const AD_CRASH_COUNTER_KEY = 'bocek_firar_ad_crash_count';

export const adBridge: AdBridge = {
  isRewardedReady: () => false,
  showRewardedContinue: async () => false,
  isInterstitialReady: () => false,
  showInterstitial: async () => false,
};

export function getCrashCountSinceAd(): number {
  try {
    const raw = localStorage.getItem(AD_CRASH_COUNTER_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

export function recordCrashForAd(): number {
  const next = getCrashCountSinceAd() + 1;
  try {
    localStorage.setItem(AD_CRASH_COUNTER_KEY, String(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function resetCrashCountForAd(): void {
  try {
    localStorage.setItem(AD_CRASH_COUNTER_KEY, '0');
  } catch {
    // Ignore storage quota errors
  }
}

export async function maybeShowInterstitialAfterCrash(): Promise<boolean> {
  if (getCrashCountSinceAd() < INTERSTITIAL_CRASH_INTERVAL) {
    return false;
  }
  if (!adBridge.isInterstitialReady()) {
    return false;
  }
  const shown = await adBridge.showInterstitial();
  if (shown) {
    resetCrashCountForAd();
  }
  return shown;
}
