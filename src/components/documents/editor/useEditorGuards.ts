import { useEffect, useRef } from 'react';

/** Warn before closing/reloading the tab while there are unsaved changes. */
export const useUnsavedChangesWarning = (dirty: boolean) => {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
};

/** Ctrl/⌘ + S triggers save. */
export const useSaveShortcut = (onSave: () => void) => {
  const ref = useRef(onSave);
  useEffect(() => {
    ref.current = onSave;
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
};
