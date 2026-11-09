import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { SortState } from './useSortable';

/** A `<th>` whose label sorts the column. Exposes `aria-sort` on the active column. */
export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={`${align === 'right' ? 'text-right' : ''} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Sort by ${label.toLowerCase()}`}
        className={`group -mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 uppercase tracking-wider transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${active ? 'text-slate-900' : ''}`}
      >
        {label}
        <Icon
          size={12}
          strokeWidth={2.5}
          aria-hidden="true"
          className={active ? 'text-primary-600' : 'text-slate-300 transition-colors group-hover:text-slate-500'}
        />
      </button>
    </th>
  );
}
