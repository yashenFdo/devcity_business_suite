import { useEffect, useRef, useState } from 'react';

/** How long the "Saved ✓" state shows before moving on. */
const SAVED_FLASH_MS = 600;

/**
 * Brief success state for editor save buttons.
 *
 * Saves are synchronous (optimistic store + background sync), so instead of a
 * spinner the clicked button flips to "Saved ✓" for a moment, then `then()`
 * runs (usually navigating to the document).
 */
export const useSaveFeedback = () => {
  /** Id of the action that just succeeded, or null when idle. */
  const [saved, setSaved] = useState<string | null>(null);
  const after = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => after.current?.(), SAVED_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [saved]);

  return {
    saved,
    /** True from the moment a save succeeds — block further saves and leave-guards. */
    busy: saved !== null,
    succeed: (actionId: string, then: () => void) => {
      after.current = then;
      setSaved(actionId);
    },
  };
};
