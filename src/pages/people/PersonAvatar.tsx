import React, { useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { safeAvatarUrl } from './peopleUtils';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const DIMS: Record<Size, string> = { xs: 'h-6 w-6', sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' };

/** Profile photo (e.g. from Google) with an initials fallback when missing or broken. */
export const PersonAvatar: React.FC<{ name: string; url?: string; size?: Size; className?: string }> = ({
  name,
  url,
  size = 'sm',
  className = '',
}) => {
  const src = safeAvatarUrl(url);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) return <Avatar name={name} size={size} className={className} />;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={`${DIMS[size]} flex-shrink-0 rounded-full bg-slate-100 object-cover ring-1 ring-slate-900/5 ${className}`}
    />
  );
};
