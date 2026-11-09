import React from 'react';
import logo from '../../assets/brand/devcity-logo.png';
import logoOnDark from '../../assets/brand/devcity-logo-on-dark.png';
import icon from '../../assets/brand/devcity-icon.png';

/** The DevCity "d" app icon (navy tile). */
export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <img
    src={icon}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    draggable={false}
    className={`flex-shrink-0 select-none rounded-[22%] ${className}`}
  />
);

/** Official DevCity wordmark with the product name. */
export const Logo: React.FC<{ subtitle?: string; dark?: boolean; height?: number }> = ({
  subtitle = 'Business Suite',
  dark,
  height = 26,
}) => (
  <div className="flex items-center gap-3">
    <img
      src={dark ? logoOnDark : logo}
      alt="DevCity"
      style={{ height }}
      className="w-auto select-none"
      draggable={false}
    />
    {subtitle && (
      <>
        <span className={`h-5 w-px ${dark ? 'bg-white/20' : 'bg-slate-200'}`} aria-hidden="true" />
        <span className={`text-[13px] font-medium tracking-tight ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{subtitle}</span>
      </>
    )}
  </div>
);
