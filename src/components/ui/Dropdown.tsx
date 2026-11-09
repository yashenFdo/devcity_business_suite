import React, { useEffect, useRef, useState } from 'react';

interface DropdownProps {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
  side?: 'bottom' | 'top';
  className?: string;
  panelClassName?: string;
}

/** Lightweight accessible dropdown: closes on outside click and Escape. */
export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  children,
  align = 'right',
  side = 'bottom',
  className = '',
  panelClassName = 'w-56',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="menu"
          className={`popover absolute z-50 ${align === 'right' ? 'right-0' : 'left-0'} ${
            side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
          } ${panelClassName}`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
};
