import { useId } from 'react';
import { CheckSquare } from 'lucide-react';
import type { SortState } from './useSortable';

export interface SortOption<K extends string> extends SortState<K> {
  label: string;
}

/**
 * Phone-only row under the search box: a sort picker (tables have clickable
 * headers on desktop) and a "Select" toggle for bulk actions.
 */
export function MobileToolbar<K extends string>({
  sort,
  onSort,
  options,
  selecting,
  onToggleSelecting,
}: {
  sort: SortState<K>;
  onSort: (s: SortState<K>) => void;
  options: readonly SortOption<K>[];
  selecting: boolean;
  onToggleSelecting: () => void;
}) {
  const id = useId();
  const current = options.findIndex((o) => o.key === sort.key && o.dir === sort.dir);
  return (
    <div className="flex items-center gap-2 md:hidden">
      <label className="sr-only" htmlFor={id}>
        Sort by
      </label>
      <select
        id={id}
        className="select h-10 min-w-0 flex-1"
        value={current >= 0 ? String(current) : ''}
        onChange={(e) => {
          const o = options[Number(e.target.value)];
          if (o) onSort({ key: o.key, dir: o.dir });
        }}
      >
        {current < 0 && (
          <option value="" disabled>
            Custom order
          </option>
        )}
        {options.map((o, i) => (
          <option key={`${o.key}-${o.dir}`} value={String(i)}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onToggleSelecting}
        aria-pressed={selecting}
        className={`btn h-10 flex-shrink-0 border ${
          selecting ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-700 shadow-xs'
        }`}
      >
        <CheckSquare size={15} aria-hidden="true" />
        {selecting ? 'Done' : 'Select'}
      </button>
    </div>
  );
}
