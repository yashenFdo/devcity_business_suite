import React, { useId, useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { assessPassword } from '../../security/passwordPolicy';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, id, className = '', ...rest }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const [visible, setVisible] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);

    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={`input h-10 pr-10 ${error ? 'input-error' : ''} ${className}`}
            spellCheck={false}
            autoCapitalize="off"
            onKeyDown={onKey}
            onKeyUp={onKey}
            aria-invalid={!!error}
            {...rest}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {capsLock && <p className="mt-1.5 text-xs font-medium text-amber-600">Caps Lock is on</p>}
        {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

const BAR_COLORS = ['bg-rose-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'];
const TEXT_COLORS = ['text-rose-600', 'text-rose-600', 'text-amber-600', 'text-emerald-600', 'text-emerald-700'];

export const PasswordStrength: React.FC<{ password: string; personal?: string[] }> = ({ password, personal }) => {
  const a = assessPassword(password, personal);
  return (
    <div className="mt-2.5 space-y-2.5" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                password && i < Math.max(1, a.score) ? BAR_COLORS[a.score] : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        {password && <span className={`w-16 text-right text-xs font-medium ${TEXT_COLORS[a.score]}`}>{a.label}</span>}
      </div>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {a.rules.map((r) => (
          <li
            key={r.id}
            className={`flex items-center gap-1.5 text-xs ${
              r.ok ? 'text-emerald-700' : r.required ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            {r.ok ? (
              <Check size={13} className="flex-shrink-0" />
            ) : r.required ? (
              <X size={13} className="flex-shrink-0 text-slate-300" />
            ) : (
              <span className="flex h-[13px] w-[13px] flex-shrink-0 items-center justify-center">
                <span className="h-1 w-1 rounded-full bg-slate-300" />
              </span>
            )}
            {r.label.replace(/^Tip: /, '')}
            {!r.required && !r.ok && <span className="text-[10px] uppercase tracking-wide text-slate-300">optional</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};
