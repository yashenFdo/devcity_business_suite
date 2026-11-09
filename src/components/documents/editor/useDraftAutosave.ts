import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../../../security/sessionState';
import { formatDate, today } from '../../../utils/formatters';

/**
 * Draft autosave for NEW documents.
 *
 * Drafts live in `sessionStorage`, never `localStorage`: documents carry client
 * personal data, so a draft survives a reload or crash in this tab but is gone
 * as soon as the tab is closed.
 */

const PREFIX = 'devcity:draft:';
const DEBOUNCE_MS = 800;

export type DraftKind = 'invoice' | 'quotation' | 'bill' | 'receipt';

export interface DraftSnapshot<T> {
  form: T;
  /** Epoch ms of the last write. */
  savedAt: number;
  /** Human label for `savedAt`, e.g. "10:42" or "08 Nov, 16:05". */
  savedAtLabel: string;
}

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null; // storage disabled (privacy mode, sandboxed iframe…)
  }
};

const timeLabel = (ms: number) => {
  const iso = new Date(ms).toISOString();
  const local = formatDate(iso, 'yyyy-MM-dd');
  return local === today() ? formatDate(iso, 'HH:mm') : formatDate(iso, 'dd MMM, HH:mm');
};

const readDraft = <T>(key: string | null): DraftSnapshot<T> | null => {
  if (!key) return null;
  try {
    const raw = storage()?.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { savedAt, form } = parsed as { savedAt?: unknown; form?: unknown };
    if (typeof savedAt !== 'number' || !form || typeof form !== 'object') return null;
    return { form: form as T, savedAt, savedAtLabel: timeLabel(savedAt) };
  } catch {
    return null;
  }
};

const writeDraft = (key: string, serializedForm: string) => {
  try {
    storage()?.setItem(key, `{"savedAt":${Date.now()},"form":${serializedForm}}`);
  } catch {
    // Quota exceeded or storage unavailable: autosave is best-effort.
  }
};

const removeDraft = (key: string) => {
  try {
    storage()?.removeItem(key);
  } catch {
    // ignore
  }
};

/** Remove every editor draft in this tab, e.g. on sign-out or workspace switch. */
export const clearAllDrafts = () => {
  const s = storage();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
  } catch {
    // ignore
  }
};

/** Storage key for a new-document draft in the active workspace; `null` disables autosave. */
export const useDraftKey = (kind: DraftKind, enabled: boolean) => {
  const workspaceId = useSession((s) => s.workspace?.id);
  return enabled && workspaceId ? `${PREFIX}${kind}:${workspaceId}` : null;
};

/**
 * Saves `form` to sessionStorage (debounced) whenever it differs from `initial`.
 * Pass `key = null` to disable (edit mode).
 *
 * Returns the draft that existed when the editor opened (for a "Restore" banner),
 * plus `clear()` to call after a successful save or an explicit discard.
 */
export const useDraftAutosave = <T extends object>(key: string | null, form: T, initial: T) => {
  // Read once, when the editor opens — the banner offers this snapshot.
  const [found] = useState<DraftSnapshot<T> | null>(() => readDraft<T>(key));
  const [offered, setOffered] = useState(found !== null);

  /** Latest unsaved serialization waiting for the debounce, flushed on unmount / page hide. */
  const pending = useRef<string | null>(null);
  /** Set after a save or discard: never write this editor's draft again. */
  const stopped = useRef(false);
  /** Whether this editor instance has written a draft (so we may remove it on revert). */
  const wrote = useRef(false);

  const serialized = useMemo(() => JSON.stringify(form), [form]);
  const initialSerialized = useMemo(() => JSON.stringify(initial), [initial]);
  const changed = serialized !== initialSerialized;

  // Debounced write while the form differs from its starting point.
  useEffect(() => {
    if (!key || stopped.current) return;
    if (!changed) {
      pending.current = null;
      // Edited back to the original: drop the draft this editor wrote (but never
      // an older draft that is still being offered for restore).
      if (wrote.current) {
        removeDraft(key);
        wrote.current = false;
      }
      return;
    }
    pending.current = serialized;
    const timer = window.setTimeout(() => {
      if (stopped.current || pending.current === null) return;
      writeDraft(key, pending.current);
      pending.current = null;
      wrote.current = true;
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [key, serialized, changed]);

  // Flush the last keystrokes when the page is hidden/unloaded or the editor unmounts.
  useEffect(() => {
    if (!key) return;
    const flush = () => {
      if (stopped.current || pending.current === null) return;
      writeDraft(key, pending.current);
      pending.current = null;
      wrote.current = true;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [key]);

  return {
    /** Draft found when the editor opened, while the banner is still pending. */
    draft: offered ? found : null,
    /** Hide the banner and hand back the draft form (the caller applies it). */
    takeDraft: (): T | null => {
      setOffered(false);
      // Merge over `initial` so fields added since the draft was written get defaults.
      return found ? { ...initial, ...found.form } : null;
    },
    /** Dismiss the banner and delete the stored draft. */
    discardDraft: () => {
      setOffered(false);
      // If this editor already autosaved, storage now holds the *current* work — keep it.
      if (key && !wrote.current) removeDraft(key);
    },
    /** Stop autosaving and delete the draft — call after a successful save or explicit discard. */
    clear: () => {
      stopped.current = true;
      pending.current = null;
      setOffered(false);
      if (key) removeDraft(key);
    },
  };
};
