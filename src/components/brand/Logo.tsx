import React from 'react';

export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="dc-logo-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3b68f6" />
        <stop offset="1" stopColor="#1d39d8" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="8" fill="url(#dc-logo-g)" />
    <path d="M11 8.5h6.6L22.5 13.4V22.5a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" fill="#fff" />
    <path d="M17.5 8.5V12.4a1 1 0 0 0 1 1h4" fill="none" stroke="#bfd3fe" strokeWidth="1.4" />
    <path d="M13 16.6h6.2M13 19.6h4" stroke="#2549eb" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const Logo: React.FC<{ subtitle?: string; dark?: boolean }> = ({ subtitle = 'Business Suite', dark }) => (
  <div className="flex items-center gap-2.5">
    <LogoMark size={30} />
    <div className="leading-tight">
      <div className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>DevCity</div>
      <div className={`text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</div>
    </div>
  </div>
);
