import {
  DailyRewardInfo,
  SKINS,
  getDaysBetweenDateKeys,
  getLocalDateKey,
  getMissionById,
} from './storage';
import { SaveData } from './types';

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register('/sw.js')
      .catch(() => null);
  }
  return swRegistrationPromise;
}

export function isEmbeddedIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function sendGameNotification(
  title: string,
  body: string,
  tag: string,
  onInAppFallback?: (title: string, body: string) => void,
): Promise<boolean> {
  if (getBrowserNotificationPermission() === 'granted') {
    try {
      const reg = await registerNotificationServiceWorker();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          tag,
          renotify: false,
        } as NotificationOptions);
        return true;
      }
    } catch {
      // Fall back to direct window Notification
    }

    try {
      new Notification(title, { body, tag });
      return true;
    } catch {
      // Fall through to in-app fallback if embedded
    }
  }

  if (onInAppFallback) {
    onInAppFallback(title, body);
    return true;
  }
  return false;
}

interface NotificationPayload {
  title: string;
  body: string;
  tag: string;
}

function pickNonRepeatingIndex(poolLength: number, usedIds: number[]): number {
  const allIndices = Array.from({ length: poolLength }, (_, i) => i);
  const lastUsed = usedIds.length > 0 ? usedIds[usedIds.length - 1] : -1;
  let available = allIndices.filter((i) => !usedIds.includes(i));
  if (available.length === 0) {
    // Havuz bittiğinde son gönderileni hariç tutarak sıfırla
    available = allIndices.filter((i) => i !== lastUsed);
  }
  if (available.length === 0) return 0;
  return available[Math.floor(Math.random() * available.length)];
}

function buildDailyRewardNotification(
  usedIds: number[],
): { payload: NotificationPayload; msgIdx: number } {
  const mysteryPool: NotificationPayload[] = [
    {
      title: 'Bugünkü Hediyen Hazır! 🎁',
      body: 'Oyuncular girdi, ödülünü aldı bile. Sen de kap!',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Sürpriz Ödülün Açıldı! 👀',
      body: 'Herkes hediyesini aldı, sıra sende. Hemen tıkla!',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Günlük Kasan Bekliyor! ✨',
      body: 'Bakalım bugünkü sürprizden sana ne çıkacak?',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Serini Bozma, Ödül Kap! 🔥',
      body: 'Diğerleri çoktan giriş yaptı. Hediyeni kaçırma!',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Sana Özel Hediye Var! 🥐',
      body: 'Kıvırcık Rıza kapıda! Girip sürprizini aç!',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Ödül Saati Geldi! ⏰',
      body: 'Gizemli ödül aktif! Oyuncular kaptı bile.',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Günün Sürprizi Hazır! 🌟',
      body: 'İçinde ne var görmek için tek tıkla oyuna gir!',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Hediye Kutun Açılıyor! 🎉',
      body: 'Günlük hakkın doldu! Geç kalmadan hemen al.',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Fırından Yeni Çıktı! 🥖',
      body: 'Bugünün gizli ödülünü açıp şansını gör!',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Saklı Ödülün Hazır! 🗝️',
      body: 'Diğer firarcılar payını kaptı. Sıra sende!',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Seri Ödülün Aktif! 💎',
      body: 'Giriş serini koru, sürpriz ödülünü kaçırma!',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Şanslı Günün Olabilir! 🍀',
      body: 'Günlük kilit açıldı! Bakalım bugün ne çıkacak?',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Günlük Hediyen Geldi! 🚪',
      body: 'Herkes topluyor, seninkini almadan günü bitirme!',
      tag: 'bocek-daily-reward',
    },
    {
      title: 'Sürpriz Zamanı! 🎊',
      body: 'Hadi ödülünü al, oyuncular girdi aldı bile!',
      tag: 'bocek-daily-reward',
    },
  ];

  const msgIdx = pickNonRepeatingIndex(mysteryPool.length, usedIds);
  return { payload: mysteryPool[msgIdx], msgIdx };
}

function buildPrimeTimeNotification(
  save: SaveData,
  usedIds: number[],
): { payload: NotificationPayload; msgIdx: number } {
  const skin = SKINS.find((s) => s.id === save.selectedSkin) || SKINS[0];
  const activeDef = save.missions.activeIds
    .map((id) => getMissionById(id))
    .find(Boolean);

  const pool: NotificationPayload[] = [
    {
      title: 'Mutfakta Kaçış Başladı! 🪳',
      body:
        save.highScore > 0
          ? `${skin.name} hazır! ${save.highScore.toLocaleString('tr-TR')} rekorunu geç!`
          : `${skin.name} bekliyor! Bu akşam kaç metre gideceksin?`,
      tag: 'bocek-prime-time',
    },
    {
      title: 'Akşam Yarışı Kızıştı! 🏆',
      body: 'Kaçakçılar puanları topluyor. Hadi piste!',
      tag: 'bocek-prime-time',
    },
    activeDef
      ? {
          title: 'Görevin Seni Bekliyor! 🎯',
          body: `${activeDef.title} görevi için kısa bir koşu yap!`,
          tag: 'bocek-prime-time',
        }
      : {
          title: 'Hadi Kısa Bir Koşuya! ⚡',
          body: 'Kıvırcık Rıza firarda! Çarşıdan galaksiye koş!',
          tag: 'bocek-prime-time',
        },
    {
      title: 'Süpürge Peşinde! 🧹💨',
      body: '2 dakikalık çılgın bir koşuyla stres at!',
      tag: 'bocek-prime-time',
    },
    {
      title: 'Peynir Galaksisi’ne Uç! 🧀',
      body: 'Jetpack’i tak, akşamın en iyisi sen ol!',
      tag: 'bocek-prime-time',
    },
    {
      title: 'Diva Yemek Yapmıyor! 😎',
      body: 'Mutfak karıştı! Girip kırıntıları topla!',
      tag: 'bocek-prime-time',
    },
    {
      title: 'Buzul ve Ateş Bekliyor! ❄️',
      body: 'Bu akşam yeni dünyalara ulaşmaya var mısın?',
      tag: 'bocek-prime-time',
    },
    {
      title: 'Günlük Görevler Bitiyor! ⏳',
      body: 'Büyük Kasayı açmak için son koşunu yap!',
      tag: 'bocek-prime-time',
    },
    {
      title: 'Yeni Karakter Çok Yakın! 🛒',
      body: 'Birkaç koşuluk kırıntıyla yeni böcek aç!',
      tag: 'bocek-prime-time',
    },
    {
      title: 'Işıklar Söndü, Firar! 🔦',
      body: 'Feneri yak, altın kırıntıları topla!',
      tag: 'bocek-prime-time',
    },
    {
      title: 'Acilci Duktur Çağırıyor! 🩺',
      body: 'Çarşı karıştı! Kombonu katla, rekor kır!',
      tag: 'bocek-prime-time',
    },
    {
      title: 'Tamirci Kazım Tam Gaz! 🔧',
      body: 'Turbo’yu kap, engellerden yıldırım gibi geç!',
      tag: 'bocek-prime-time',
    },
    {
      title: 'Dev Mutfak Tehlikede! 🍳',
      body: 'Süpürgeler hazır! Kaç engeli sıyıracaksın?',
      tag: 'bocek-prime-time',
    },
    {
      title: 'Skor Çarpanını Artır! 📈',
      body: '1 görev daha bitir, puanını katla!',
      tag: 'bocek-prime-time',
    },
  ];

  const msgIdx = pickNonRepeatingIndex(pool.length, usedIds);
  return { payload: pool[msgIdx], msgIdx };
}

export async function evaluateAndSendScheduledNotifications(
  save: SaveData,
  dailyInfo: DailyRewardInfo,
  onMarkSent: (slot: 'daily' | 'prime', todayKey: string, msgIdx: number) => void,
  now = new Date(),
): Promise<void> {
  if (!save.notifications.enabled) return;
  if (getBrowserNotificationPermission() !== 'granted') return;

  const todayKey = getLocalDateKey(now);
  const sentToday =
    save.notifications.sentCountDate === todayKey
      ? save.notifications.sentCountToday
      : 0;

  if (sentToday >= 2) return;

  // İnaktiflik kuralı: ilk 7 gün her gün, 8-27. günler 3 günde bir, 28. günde tamamen durur
  const inactiveDays = Math.max(
    0,
    getDaysBetweenDateKeys(save.notifications.lastOpenedDate || todayKey, todayKey),
  );
  if (inactiveDays >= 28) return;
  if (inactiveDays > 7 && sentToday === 0 && save.notifications.lastSentDate) {
    const daysSinceLastSent = getDaysBetweenDateKeys(
      save.notifications.lastSentDate,
      todayKey,
    );
    if (daysSinceLastSent < 3) return;
  }

  const hour = now.getHours();
  const minute = now.getMinutes();

  // 1. Bildirim: Günlük dönüş hakkı (Gece 23:00 - 09:30 arası sessiz saat -> 09:30'da gider)
  const inDaytimeWindow =
    (hour > 9 || (hour === 9 && minute >= 30)) && hour < 23;
  if (
    dailyInfo.canClaim &&
    inDaytimeWindow &&
    save.notifications.lastDailyNotifyDate !== todayKey
  ) {
    const { payload, msgIdx } = buildDailyRewardNotification(
      save.notifications.usedDailyMsgIds,
    );
    const ok = await sendGameNotification(payload.title, payload.body, payload.tag);
    if (ok) {
      onMarkSent('daily', todayKey, msgIdx);
      return;
    }
  }

  // 2. Bildirim: Akşam 19:30 - 21:30 arası oyuna teşvik bildirimi (günde 1 kez)
  const inPrimeWindow =
    (hour === 19 && minute >= 30) ||
    hour === 20 ||
    (hour === 21 && minute <= 30);
  if (inPrimeWindow && save.notifications.lastPrimeNotifyDate !== todayKey) {
    const { payload, msgIdx } = buildPrimeTimeNotification(
      save,
      save.notifications.usedPrimeMsgIds,
    );
    const ok = await sendGameNotification(payload.title, payload.body, payload.tag);
    if (ok) {
      onMarkSent('prime', todayKey, msgIdx);
    }
  }
}
