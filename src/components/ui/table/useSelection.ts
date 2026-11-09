import { useEffect, useState } from 'react';

const isTextField = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    (el instanceof HTMLInputElement && el.type !== 'checkbox' && el.type !== 'radio'));

/**
 * Multi-select state for a list. Only ids in `visibleIds` (the current filtered,
 * sorted list) count as selected, so bulk actions never touch hidden rows.
 * Escape clears the selection unless a dialog or menu is open, or a text field is focused.
 */
export function useSelection(visibleIds: readonly string[]) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  // Mobile "Select" mode: checkboxes on cards, taps toggle instead of opening.
  const [selecting, setSelecting] = useState(false);

  const selectedIds = visibleIds.filter((id) => picked.has(id));
  const count = selectedIds.length;
  const allSelected = visibleIds.length > 0 && count === visibleIds.length;
  const active = count > 0 || selecting;

  const isSelected = (id: string) => picked.has(id);

  const toggle = (id: string, range = false) => {
    const on = !picked.has(id);
    const next = new Set(picked);
    const from = anchor ? visibleIds.indexOf(anchor) : -1;
    const to = visibleIds.indexOf(id);
    if (range && from >= 0 && to >= 0) {
      const [lo, hi] = from < to ? [from, to] : [to, from];
      for (let i = lo; i <= hi; i++) {
        if (on) next.add(visibleIds[i]);
        else next.delete(visibleIds[i]);
      }
    } else if (on) next.add(id);
    else next.delete(id);
    setPicked(next);
    setAnchor(id);
  };

  const toggleAll = () => {
    setPicked(allSelected ? new Set() : new Set(visibleIds));
    setAnchor(null);
  };

  const selectAll = () => setPicked(new Set(visibleIds));

  const clear = () => {
    setPicked(new Set());
    setAnchor(null);
    setSelecting(false);
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isTextField(e.target)) return;
      // Let an open dialog / menu handle its own Escape first.
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      setPicked(new Set());
      setAnchor(null);
      setSelecting(false);
    };
    // Capture phase so we see the dialog/menu before their own handlers close them.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);

  return {
    selectedIds,
    count,
    allSelected,
    someSelected: count > 0 && !allSelected,
    selecting,
    setSelecting,
    isSelected,
    toggle,
    toggleAll,
    selectAll,
    clear,
  };
}
