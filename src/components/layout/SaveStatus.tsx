import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, CloudOff, Loader2 } from 'lucide-react';
import { useSyncStatus } from '../../cloud/sync';

const useOnline = () => {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
};

/** Header pill: Saving… / All changes saved / Offline / Couldn't save. */
export const SaveStatus: React.FC = () => {
  const { pending, error, lastSavedAt } = useSyncStatus();
  const online = useOnline();
  const [now, setNow] = useState(() => Date.now());

  // Re-render occasionally so "Saved just now" fades to "All changes saved".
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 4000);
    return () => clearInterval(t);
  }, []);

  let icon: React.ReactNode;
  let text: string;
  let tone: string;
  if (!online) {
    icon = <CloudOff size={14} />;
    text = 'Offline';
    tone = 'bg-amber-50 text-amber-800 ring-amber-200';
  } else if (pending > 0) {
    icon = <Loader2 size={14} className="animate-spin" />;
    text = 'Saving…';
    tone = 'bg-slate-100 text-slate-600 ring-slate-200';
  } else if (error) {
    icon = <AlertTriangle size={14} />;
    text = "Couldn't save";
    tone = 'bg-rose-50 text-rose-700 ring-rose-200';
  } else if (lastSavedAt && now - lastSavedAt < 5000) {
    icon = <Check size={14} />;
    text = 'Saved';
    tone = 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  } else {
    icon = <Check size={14} />;
    text = 'All changes saved';
    tone = 'text-slate-400 ring-transparent';
  }

  return (
    <span
      role="status"
      aria-live="polite"
      title={!online ? 'You are offline. Changes made now may not be saved.' : error ?? undefined}
      className={`hidden items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors sm:inline-flex ${tone}`}
    >
      {icon}
      {text}
    </span>
  );
};

/** Full-width banner while offline. */
export const OfflineBanner: React.FC = () => {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="alert" className="no-print flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white">
      <CloudOff size={14} /> You're offline. Viewing still works; changes may not be saved until you reconnect.
    </div>
  );
};
