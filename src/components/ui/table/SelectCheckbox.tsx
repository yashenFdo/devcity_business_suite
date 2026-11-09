import React from 'react';

/**
 * Row / header selection checkbox. `onToggle(range)` receives `true` when
 * Shift was held, so callers can select a range.
 */
export const SelectCheckbox: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onToggle: (range: boolean) => void;
  className?: string;
}> = ({ checked, indeterminate = false, label, onToggle, className = '' }) => (
  <input
    type="checkbox"
    ref={(el) => {
      if (el) el.indeterminate = indeterminate && !checked;
    }}
    checked={checked}
    onChange={(e) => onToggle('shiftKey' in e.nativeEvent && (e.nativeEvent as MouseEvent).shiftKey)}
    aria-label={label}
    className={`h-4 w-4 flex-shrink-0 cursor-pointer rounded border-slate-300 accent-primary-600 ${className}`}
  />
);

/** Table cell holding a row checkbox; the whole cell is the hit area and clicks don't open the row. */
export const SelectCell: React.FC<{
  checked: boolean;
  label: string;
  onToggle: (range: boolean) => void;
}> = ({ checked, label, onToggle }) => (
  <td className="w-10 !py-0 !pr-0" onClick={(e) => e.stopPropagation()}>
    <label className="flex min-h-[44px] cursor-pointer items-center">
      <SelectCheckbox checked={checked} label={label} onToggle={onToggle} />
    </label>
  </td>
);
