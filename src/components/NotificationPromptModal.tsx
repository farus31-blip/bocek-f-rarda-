import { Bell, BellRing, X } from 'lucide-react';
import { useState } from 'react';

interface NotificationPromptModalProps {
  isEmbedded: boolean;
  onEnable: () => Promise<'granted' | 'denied' | 'default' | 'unsupported'>;
  onDismissFor3Days: () => void;
}

export function NotificationPromptModal({
  isEmbedded,
  onEnable,
  onDismissFor3Days,
}: NotificationPromptModalProps) {
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleEnableClick = async () => {
    if (busy) return;
    setBusy(true);
    setStatusMsg(null);
    const result = await onEnable();
    setBusy(false);

    if (isEmbedded || result === 'granted') {
      return;
    }

    if (result === 'denied') {
      setStatusMsg(
        'Tarayıcı bildirim izni kapalı görünüyor. İstediğin zaman tarayıcı ayarlarından açabilirsin.',
      );
      window.setTimeout(() => {
        onDismissFor3Days();
      }, 1800);
    } else if (result === 'unsupported') {
      setStatusMsg('Bu tarayıcıda bildirim desteği kapalı.');
      window.setTimeout(() => {
        onDismissFor3Days();
      }, 1500);
    } else if (result === 'default') {
      onDismissFor3Days();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#131e33] to-[#0d1424] border-2 border-emerald-400/85 p-6 shadow-[0_0_52px_rgba(16,185,129,0.35)]">
        <button
          type="button"
          onClick={onDismissFor3Days}
          aria-label="Kapat"
          className="absolute -top-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 border-2 border-white text-white shadow-lg hover:bg-rose-400 active:scale-95 transition-transform"
        >
          <X className="h-5 w-5 stroke-[3]" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 border-2 border-white/85 text-slate-950 shadow-[0_0_32px_rgba(251,191,36,0.55)]">
            <BellRing className="h-10 w-10 stroke-[2.4] animate-bounce" />
          </div>

          <h2 className="font-display mt-4 text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight text-white">
            OYUNDAN HABERDAR OL!
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-300 leading-relaxed">
            Sürprizlerden ve firar heyecanından anında haberdar olmak için bildirimleri aç!
          </p>
        </div>

        {statusMsg && (
          <div className="mt-4 rounded-xl bg-rose-500/20 border border-rose-400/50 px-3 py-2 text-center text-[11px] font-bold text-rose-200">
            {statusMsg}
          </div>
        )}

        {/* Huge One-Tap CTA Button */}
        <button
          type="button"
          disabled={busy}
          onClick={handleEnableClick}
          className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-500 border-[3px] border-slate-950 border-b-[6px] py-4 text-lg font-extrabold tracking-wide text-slate-950 shadow-[0_12px_32px_rgba(16,185,129,0.5)] hover:brightness-105 active:translate-y-0.5 active:border-b-[3px] transition-all disabled:opacity-60"
        >
          <Bell className="h-6 w-6 fill-slate-950 stroke-[2.5]" />
          <span>{busy ? 'İZİN İSTENİYOR...' : 'BİLDİRİMLERİ AÇ'}</span>
        </button>

        <button
          type="button"
          onClick={onDismissFor3Days}
          className="mt-3 w-full py-1.5 text-center text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
        >
          Şimdi değil
        </button>
      </div>
    </div>
  );
}
