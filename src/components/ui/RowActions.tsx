import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Dropdown } from './Dropdown';

export interface RowAction {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/** "⋯" menu for table rows. Stops click propagation so row-click navigation isn't triggered. */
export const RowActions: React.FC<{ actions: RowAction[]; label?: string }> = ({ actions, label = 'Actions' }) => {
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;
  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-flex">
      <Dropdown
        panelClassName="w-48"
        trigger={({ toggle, open }) => (
          <button type="button" onClick={toggle} aria-expanded={open} aria-label={label} className="btn-icon btn-ghost h-7 w-7">
            <MoreHorizontal size={16} />
          </button>
        )}
      >
        {(close) =>
          visible.map((a, i) => (
            <React.Fragment key={a.label}>
              {a.danger && i > 0 && <div className="my-1 h-px bg-slate-100" />}
              <button
                type="button"
                className={`menu-item ${a.danger ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700' : ''}`}
                onClick={() => {
                  close();
                  a.onClick();
                }}
              >
                <a.icon size={15} className={a.danger ? '' : 'text-slate-400'} /> {a.label}
              </button>
            </React.Fragment>
          ))
        }
      </Dropdown>
    </div>
  );
};
