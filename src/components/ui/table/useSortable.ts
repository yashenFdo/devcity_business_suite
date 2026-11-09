import { useCallback, useState } from 'react';

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}
export type SortValue = string | number | null | undefined;
export type SortAccessors<T, K extends string> = Record<K, (row: T) => SortValue>;

/** Workflow order for status columns (earliest stage first). */
export const STATUS_RANK: Record<string, number> = {
  draft: 0,
  sent: 1,
  unpaid: 1,
  partially_paid: 2,
  overdue: 3,
  accepted: 4,
  paid: 5,
  rejected: 6,
  expired: 7,
  cancelled: 8,
};

const isEmpty = (v: SortValue) => v === null || v === undefined || v === '';

const readStored = <K extends string>(storageKey: string, keys: readonly K[], fallback: SortState<K>): SortState<K> => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const { key, dir } = parsed as { key?: unknown; dir?: unknown };
      if (typeof key === 'string' && (keys as readonly string[]).includes(key) && (dir === 'asc' || dir === 'desc')) {
        return { key: key as K, dir };
      }
    }
  } catch {
    // Storage unavailable or corrupt — fall back to the default order.
  }
  return fallback;
};

/**
 * Column sort state for a list page, remembered per page in localStorage.
 * `descFirst` lists the columns whose first click sorts high→low (dates, amounts).
 */
export function useSortable<K extends string>({
  storageKey,
  keys,
  initial,
  descFirst = [],
}: {
  storageKey: string;
  keys: readonly K[];
  initial: SortState<K>;
  descFirst?: readonly K[];
}) {
  const [sort, setSortState] = useState<SortState<K>>(() => readStored(storageKey, keys, initial));

  const setSort = useCallback(
    (next: SortState<K>) => {
      setSortState(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Private mode / quota — sorting still works for this visit.
      }
    },
    [storageKey]
  );

  const toggle = (key: K) =>
    setSort(
      sort.key === key
        ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: descFirst.includes(key) ? 'desc' : 'asc' }
    );

  return { sort, setSort, toggle };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Sorts a copy of `rows`. Empty values always go last; `tieBreak` keeps the order stable. */
export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K>,
  accessors: SortAccessors<T, K>,
  tieBreak?: (a: T, b: T) => number
): T[] {
  const get = accessors[sort.key];
  const mul = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    const ea = isEmpty(va);
    const eb = isEmpty(vb);
    const c =
      ea || eb
        ? ea === eb
          ? 0
          : ea
            ? 1
            : -1
        : typeof va === 'number' && typeof vb === 'number'
          ? (va - vb) * mul
          : collator.compare(String(va), String(vb)) * mul;
    return c !== 0 ? c : tieBreak ? tieBreak(a, b) : 0;
  });
}
