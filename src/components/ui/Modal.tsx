import React, { useEffect, useId } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  showClose?: boolean;
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-5xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  showClose = true,
}) => {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`modal-content ${sizeClasses[size]} flex max-h-[90vh] flex-col`}
      >
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
            <div>
              {title && (
                <h2 id={titleId} className="text-base font-semibold text-slate-900">
                  {title}
                </h2>
              )}
              {description && <p className="mt-1 text-[13px] text-slate-500">{description}</p>}
            </div>
            {showClose && (
              <button type="button" onClick={onClose} className="btn-icon btn-ghost -mr-2 -mt-1" aria-label="Close">
                <X size={17} />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto px-6 pb-6 pt-3">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-6 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}) => {
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showClose={false}>
      <div className="flex gap-4 pt-2">
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
            variant === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-primary-50 text-primary-600'
          }`}
        >
          <AlertTriangle size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{message}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          {cancelLabel}
        </button>
        <button
          type="button"
          autoFocus
          className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};
