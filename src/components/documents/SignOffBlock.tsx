import React from 'react';
import type { DocumentData } from './documentTypes';
import { StampSVG, PaidStampSVG } from './stamps/StampSVG';

/**
 * Signatures (up to 5: signature, name, role, contact) with applied stamps
 * overlapping them like real ink. Shared by every document template.
 */
export const SignOffBlock: React.FC<{ data: DocumentData; heading?: string; accent?: string }> = ({ data, heading, accent }) => {
  const signatories = data.signatories ?? [];
  const stamps = data.stamps ?? [];
  const showPaid = !!data.showPaidStamp;
  if (!signatories.length && !stamps.length && !showPaid) return null;

  const cols = Math.max(1, Math.min(5, signatories.length));
  const compact = signatories.length >= 4;
  const stampSize = (shape: 'round' | 'rect') => (shape === 'round' ? (compact ? 118 : 132) : compact ? 160 : 180);

  return (
    <section className="relative mt-10" style={{ breakInside: 'avoid' }}>
      {heading && (
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400" style={accent ? { color: accent } : undefined}>
          {heading}
        </p>
      )}

      {/* Stamps: overlapping the signature area, slightly rotated, like real ink */}
      {(stamps.length > 0 || showPaid) && (
        <div className="pointer-events-none relative z-10 -mb-14 flex flex-wrap items-end justify-end gap-x-1 pr-2" aria-hidden="true">
          {stamps.map((s) => (
            <div key={s.id} className="-ml-6 first:ml-0">
              <StampSVG stamp={s} ink={s.kind === 'company' ? 'company' : 'personal'} date={data.stampDate} size={stampSize(s.shape)} />
            </div>
          ))}
          {showPaid && (
            <div className="-ml-4">
              <PaidStampSVG date={data.stampDate} size={compact ? 150 : 165} />
            </div>
          )}
        </div>
      )}

      {signatories.length > 0 && (
        <div className="grid gap-x-6 gap-y-6" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {signatories.map((s) => (
            <div key={s.id} className={cols === 1 ? 'ml-auto w-[230px]' : ''}>
              <div className="flex h-[56px] items-end justify-center">
                {s.signature && <img src={s.signature} alt="" className="max-h-[52px] max-w-full object-contain" />}
              </div>
              <div className="border-t border-slate-400 pt-1.5 text-center">
                <p className={`font-semibold text-slate-900 ${compact ? 'text-[10.5px]' : 'text-[11.5px]'}`}>{s.name}</p>
                {s.role && <p className={`text-slate-600 ${compact ? 'text-[9.5px]' : 'text-[10.5px]'}`}>{s.role}</p>}
                {(s.email || s.phone) && (
                  <p className={`mt-0.5 leading-snug text-slate-500 ${compact ? 'text-[8.5px]' : 'text-[9.5px]'}`}>
                    {[s.phone, s.email].filter(Boolean).join(compact ? ' ' : ' · ')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
