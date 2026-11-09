import React from 'react';
import type { DocumentData } from './documentTypes';
import { StampSVG, PaidStampSVG } from './stamps/StampSVG';

/**
 * Signatures (up to 5: signature, name, role, contact) and applied stamps.
 * Stamps get their own space and never cover a signature:
 *  - 1–2 signatories: signatures on the left, stamps beside them on the right
 *  - 3–5 signatories: signatures across the full width, stamps in a row below
 * Shared by every document template.
 */
export const SignOffBlock: React.FC<{ data: DocumentData; heading?: string; accent?: string }> = ({ data, heading, accent }) => {
  const signatories = data.signatories ?? [];
  const stamps = data.stamps ?? [];
  const showPaid = !!data.showPaidStamp;
  const hasStamps = stamps.length > 0 || showPaid;
  if (!signatories.length && !hasStamps) return null;

  const cols = Math.max(1, Math.min(5, signatories.length));
  const compact = signatories.length >= 4;
  const sideBySide = hasStamps && signatories.length > 0 && signatories.length <= 2;
  const stampCount = stamps.length + (showPaid ? 1 : 0);
  // Smaller stamps when several share the space beside the signatures.
  const shrink = sideBySide && stampCount > 1 ? 0.82 : 1;
  const stampSize = (shape: 'round' | 'rect') => Math.round((shape === 'round' ? 124 : 168) * shrink);

  const stampRow = hasStamps && (
    <div
      className={`pointer-events-none flex flex-wrap items-center gap-4 ${sideBySide ? 'justify-end' : 'mt-6 justify-end'}`}
      aria-hidden="true"
    >
      {stamps.map((s) => (
        <StampSVG key={s.id} stamp={s} ink={s.kind === 'company' ? 'company' : 'personal'} date={data.stampDate} size={stampSize(s.shape)} />
      ))}
      {showPaid && <PaidStampSVG date={data.stampDate} size={Math.round(150 * shrink)} />}
    </div>
  );

  const signatures = signatories.length > 0 && (
    <div
      className="grid gap-x-6 gap-y-6"
      style={{ gridTemplateColumns: `repeat(${sideBySide ? signatories.length : cols}, minmax(0, ${sideBySide ? '210px' : '1fr'}))` }}
    >
      {signatories.map((s) => (
        <div key={s.id} className={!sideBySide && cols === 1 ? 'ml-auto w-[230px]' : ''}>
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
  );

  return (
    <section className="mt-10" style={{ breakInside: 'avoid' }}>
      {heading && (
        <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400" style={accent ? { color: accent } : undefined}>
          {heading}
        </p>
      )}
      {sideBySide ? (
        <div className="flex items-end justify-between gap-8">
          {signatures}
          {stampRow}
        </div>
      ) : (
        <>
          {signatures}
          {stampRow}
        </>
      )}
    </section>
  );
};
