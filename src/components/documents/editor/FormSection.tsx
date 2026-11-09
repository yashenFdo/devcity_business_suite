import React, { useId } from 'react';

interface FormSectionProps {
  step?: number;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** A numbered card that groups one step of a document form. */
export const FormSection: React.FC<FormSectionProps> = ({ step, title, description, actions, children }) => {
  const id = useId();
  return (
    <section className="card" aria-labelledby={id}>
      <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-4">
        <div className="flex items-start gap-3">
          {step !== undefined && (
            <span className="mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
              {step}
            </span>
          )}
          <div>
            <h2 id={id} className="text-sm font-semibold text-slate-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="px-5 pb-5 pt-3">{children}</div>
    </section>
  );
};

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, required, className = '', children }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="label">
      {label}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
    {children}
    {error ? <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p> : hint && <p className="hint">{hint}</p>}
  </div>
);
