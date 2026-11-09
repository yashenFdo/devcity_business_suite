import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../Avatar';

/** Card list shown instead of the table below the `md` breakpoint. */
export const MobileList: React.FC<{ children: React.ReactNode; label: string }> = ({ children, label }) => (
  <ul className="divide-y divide-slate-100 md:hidden" aria-label={label}>
    {children}
  </ul>
);

interface MobileRowProps {
  /** Route to open on tap (or use `onOpen`). */
  to?: string;
  onOpen?: () => void;
  title: React.ReactNode;
  /** Document numbers render in mono. */
  mono?: boolean;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  avatarName?: string;
  amount?: React.ReactNode;
  amountClassName?: string;
  /** Small line under the amount, e.g. "3 days overdue". */
  hint?: React.ReactNode;
  /** Usually a `<RowActions>`; hidden while selecting. */
  actions?: React.ReactNode;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  selectLabel: string;
}

export const MobileRow: React.FC<MobileRowProps> = ({
  to,
  onOpen,
  title,
  mono = false,
  badge,
  subtitle,
  avatarName,
  amount,
  amountClassName = 'text-slate-900',
  hint,
  actions,
  selecting,
  selected,
  onToggle,
  selectLabel,
}) => {
  const body = (
    <>
      {avatarName !== undefined && <Avatar name={avatarName || '?'} size="sm" />}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`truncate font-semibold text-slate-900 ${mono ? 'font-mono text-[13px]' : 'text-sm'}`}>{title}</span>
          {badge && <span className="flex-shrink-0">{badge}</span>}
        </div>
        {subtitle && <div className="mt-0.5 truncate text-[13px] text-slate-500">{subtitle}</div>}
      </div>
      {(amount || hint) && (
        <div className="flex-shrink-0 text-right">
          {amount && <p className={`whitespace-nowrap text-[13px] font-semibold tabular ${amountClassName}`}>{amount}</p>}
          {hint && <div className="mt-0.5 whitespace-nowrap text-xs">{hint}</div>}
        </div>
      )}
    </>
  );

  const rowCls = 'flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left';

  return (
    <li className={`flex items-center transition-colors last:rounded-b-xl ${selected ? 'bg-primary-50/70' : 'active:bg-slate-50'}`}>
      {selecting ? (
        <label className={`${rowCls} cursor-pointer pr-4`}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={selectLabel}
            className="h-5 w-5 flex-shrink-0 cursor-pointer accent-primary-600"
          />
          {body}
        </label>
      ) : (
        <>
          {to ? (
            <Link to={to} className={`${rowCls} focus-visible:bg-slate-50 focus-visible:outline-none`}>
              {body}
            </Link>
          ) : (
            <button type="button" onClick={onOpen} className={`${rowCls} focus-visible:bg-slate-50 focus-visible:outline-none`}>
              {body}
            </button>
          )}
          {/* 40px touch target for the "⋯" trigger (RowActions renders div > div > button). */}
          <div className="flex w-12 flex-shrink-0 justify-center pr-1">
            {actions}
          </div>
        </>
      )}
    </li>
  );
};
