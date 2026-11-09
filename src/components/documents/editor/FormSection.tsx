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

const FORM_CONTROLS = new Set(['input', 'select', 'textarea']);
type ControlProps = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean };

/**
 * Label + control + hint/error. When the child is a single native input, select or
 * textarea, it is linked to the label (and to its hint/error) automatically.
 */
export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, required, className = '', children }) => {
  const autoId = useId();
  const native =
    React.isValidElement<ControlProps>(children) && typeof children.type === 'string' && FORM_CONTROLS.has(children.type);
  const controlId = htmlFor ?? (native ? children.props.id ?? `${autoId}-control` : undefined);
  const noteId = error || hint ? `${autoId}-note` : undefined;
  const control = native
    ? React.cloneElement(children, {
        id: controlId,
        'aria-describedby': [children.props['aria-describedby'], noteId].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })
    : children;
  return (
    <div className={className}>
      <label htmlFor={controlId} className="label">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {control}
      {error ? (
        <p id={noteId} className="mt-1.5 text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={noteId} className="hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
};
