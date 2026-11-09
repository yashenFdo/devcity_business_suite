import React from 'react';

const TONES = [
  'bg-primary-100 text-primary-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-800',
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';

const toneFor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
};

export const Avatar: React.FC<{ name: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }> = ({
  name,
  size = 'sm',
  className = '',
}) => {
  const dims = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' }[size];
  return (
    <span
      className={`inline-flex flex-shrink-0 select-none items-center justify-center rounded-full font-semibold ${dims} ${toneFor(name)} ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
};
