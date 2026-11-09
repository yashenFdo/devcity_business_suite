import React, { useEffect, useRef, useState } from 'react';
import { Lock, Timer } from 'lucide-react';
import { useAccessStore } from '../../store/useAccessStore';
import { lockWorkspace } from '../../security/session';

const WARNING_SECONDS = 60;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/** Auto-locks the workspace after inactivity, with a 60-second warning. */
export const IdleWatcher: React.FC = () => {
  const { autoLockMinutes, lockOnHiddenMinutes } = useAccessStore((s) => s.policy);
  const lastActivity = useRef(0);
  const hiddenSince = useRef<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    lastActivity.current = Date.now();
    const idleLimit = autoLockMinutes * 60_000;
    const hiddenLimit = lockOnHiddenMinutes * 60_000;
    let lastBump = 0;

    const bump = () => {
      const now = Date.now();
      if (now - lastBump < 1000) return;
      lastBump = now;
      lastActivity.current = now;
    };
    const onVisibility = () => {
      if (document.hidden) hiddenSince.current = Date.now();
      else {
        if (hiddenLimit > 0 && hiddenSince.current && Date.now() - hiddenSince.current >= hiddenLimit) {
          void lockWorkspace('hidden');
        }
        hiddenSince.current = null;
      }
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisibility);

    const timer = setInterval(() => {
      const now = Date.now();
      if (hiddenLimit > 0 && hiddenSince.current && now - hiddenSince.current >= hiddenLimit) {
        void lockWorkspace('hidden');
        return;
      }
      if (idleLimit <= 0) return;
      const left = idleLimit - (now - lastActivity.current);
      if (left <= 0) {
        void lockWorkspace('idle');
        return;
      }
      setSecondsLeft(left <= WARNING_SECONDS * 1000 ? Math.ceil(left / 1000) : null);
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(timer);
    };
  }, [autoLockMinutes, lockOnHiddenMinutes]);

  if (secondsLeft === null) return null;

  return (
    <div className="no-print fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4" role="alertdialog" aria-live="assertive">
      <div className="flex w-full max-w-md items-center gap-4 rounded-2xl bg-slate-900 p-4 text-white shadow-modal animate-slide-up">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10">
          <Timer size={18} className="text-amber-300" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Still there?</p>
          <p className="text-xs text-slate-400">
            Locking in <span className="tabular font-semibold text-white">{secondsLeft}s</span> to protect your data.
          </p>
        </div>
        <button
          type="button"
          className="btn-sm btn rounded-lg bg-white/10 text-white hover:bg-white/20"
          onClick={() => void lockWorkspace('manual')}
          aria-label="Lock now"
        >
          <Lock size={14} />
        </button>
        <button
          type="button"
          className="btn-sm btn bg-white text-slate-900 hover:bg-slate-100"
          onClick={() => {
            lastActivity.current = Date.now();
            setSecondsLeft(null);
          }}
        >
          Stay signed in
        </button>
      </div>
    </div>
  );
};
