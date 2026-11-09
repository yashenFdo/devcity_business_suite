import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, PenLine, Settings2, Stamp as StampIcon, X } from 'lucide-react';
import { useCompanyStore } from '../../../store/useCompanyStore';
import { useStampsStore } from '../../../store/useStampsStore';
import { useSession } from '../../../security/sessionState';
import type { DocumentType, SignOffOptions, Stamp } from '../../../types';
import { formatDate } from '../../../utils/formatters';
import { Avatar } from '../../ui/Avatar';
import { StampSVG } from '../stamps/StampSVG';
import { companySignatories, defaultSignOff, MAX_SIGNATORIES } from '../signOff';
import { FormSection } from './FormSection';

interface SignOffSectionProps {
  step?: number;
  value: SignOffOptions;
  onChange: (value: SignOffOptions) => void;
  documentType: DocumentType;
  /** Document date: the default date printed in stamps. */
  documentDate: string;
  /** Is the document fully paid right now? Drives the "Auto" PAID stamp. */
  isPaid: boolean;
}

const SubHeading: React.FC<{ id?: string; children: React.ReactNode; aside?: React.ReactNode }> = ({ id, children, aside }) => (
  <div className="mb-2 flex items-baseline justify-between gap-3">
    <h3 id={id} className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </h3>
    {aside && <span className="text-[11px] text-slate-400">{aside}</span>}
  </div>
);

const PAID_OPTIONS: { label: string; value: boolean | undefined }[] = [
  { label: 'Auto', value: undefined },
  { label: 'Always', value: true },
  { label: 'Never', value: false },
];

/** Per-document choice of signatories, stamps, the PAID stamp and the stamp date. */
export const SignOffSection: React.FC<SignOffSectionProps> = ({ step, value, onChange, documentType, documentDate, isPaid }) => {
  const company = useCompanyStore((s) => s.company);
  const stamps = useStampsStore((s) => s.stamps);
  const userId = useSession((s) => s.user?.id);
  const ids = useId();
  // Stamps already on the document when the editor opened (a colleague's personal stamp stays listed).
  const [initiallyApplied] = useState<string[]>(() => value.stampIds ?? []);

  const all = companySignatories(company);
  const selected = (value.signatoryIds ?? defaultSignOff(company).signatoryIds ?? []).filter((id) => all.some((s) => s.id === id));
  const full = selected.length >= MAX_SIGNATORIES;

  const toggleSignatory = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (!full) next.add(id);
    onChange({ ...value, signatoryIds: all.filter((s) => next.has(s.id)).map((s) => s.id) });
  };

  const applied = value.stampIds ?? [];
  const available: { stamp: Stamp; note: string }[] = [
    ...stamps.filter((s) => s.kind === 'company').map((stamp) => ({ stamp, note: 'Company' })),
    ...stamps.filter((s) => s.kind === 'personal' && s.ownerId === userId).map((stamp) => ({ stamp, note: 'Yours' })),
    ...stamps
      .filter((s) => s.kind === 'personal' && s.ownerId !== userId && initiallyApplied.includes(s.id))
      .map((stamp) => ({ stamp, note: 'A colleague’s' })),
  ];
  const toggleStamp = (id: string) =>
    onChange({ ...value, stampIds: applied.includes(id) ? applied.filter((s) => s !== id) : [...applied, id] });

  const showPaidControl = documentType !== 'quotation';
  const paidHint =
    value.paidStamp === undefined
      ? isPaid
        ? 'Shown — this document is fully paid.'
        : 'Appears automatically once the document is fully paid.'
      : value.paidStamp
        ? 'Always shown on this document.'
        : 'Never shown on this document.';

  return (
    <FormSection
      step={step}
      title="Signatures & stamps"
      description="Who signs this document and which stamps are applied."
      actions={
        <Link to="/settings/signatures" className="btn-ghost btn-sm text-slate-500" title="Manage signatories and stamps">
          <Settings2 size={14} /> <span className="hidden sm:inline">Manage</span>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Signatories */}
        <div role="group" aria-labelledby={`${ids}-sig`}>
          <SubHeading id={`${ids}-sig`} aside={all.length > 0 ? `${selected.length} of up to ${MAX_SIGNATORIES}` : undefined}>
            Signed by
          </SubHeading>
          {all.length === 0 ? (
            <EmptyHint icon={PenLine} text="No signatories yet. An admin can add them in Settings → Signatures & stamps." />
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {all.map((s) => {
                const position = selected.indexOf(s.id);
                const checked = position >= 0;
                const disabled = !checked && full;
                return (
                  <li key={s.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-all ${
                        checked ? 'border-primary-300 bg-primary-50/40 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300'
                      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleSignatory(s.id)}
                      />
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border text-[10px] font-semibold ${
                          checked ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checked && position + 1}
                      </span>
                      {s.signature ? (
                        <span className="flex h-9 w-14 flex-shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-slate-200">
                          <img src={s.signature} alt="" className="max-h-7 max-w-[48px] object-contain" />
                        </span>
                      ) : (
                        <Avatar name={s.name} />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-slate-900">{s.name}</span>
                        <span className="block truncate text-xs text-slate-500">{s.role}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {full && all.length > MAX_SIGNATORIES && (
            <p className="hint">A document can carry up to {MAX_SIGNATORIES} signatories. Untick one to choose another.</p>
          )}
        </div>

        {/* Stamps */}
        <div role="group" aria-labelledby={`${ids}-stamps`}>
          <SubHeading id={`${ids}-stamps`} aside={applied.length ? `${applied.length} applied` : undefined}>
            Stamps
          </SubHeading>
          {available.length === 0 ? (
            <EmptyHint icon={StampIcon} text="No stamps yet. Create a company stamp or your own stamp in Settings → Signatures & stamps." />
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {available.map(({ stamp, note }) => {
                const on = applied.includes(stamp.id);
                return (
                  <li key={stamp.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleStamp(stamp.id)}
                      className={`group relative flex w-full flex-col items-center gap-1.5 rounded-xl border px-2 pb-2.5 pt-3 text-center transition-all focus-visible:outline-none focus-visible:shadow-focus ${
                        on ? 'border-primary-300 bg-primary-50/40 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full border ${
                          on ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {on && <Check size={10} strokeWidth={3} />}
                      </span>
                      <span className="flex h-[72px] items-center justify-center" aria-hidden="true">
                        <StampSVG
                          stamp={stamp}
                          ink={stamp.kind === 'company' ? 'company' : 'personal'}
                          date={value.stampDate || documentDate}
                          size={stamp.shape === 'round' ? 68 : 104}
                          rotate={0}
                          plain
                        />
                      </span>
                      <span className="w-full truncate text-xs font-medium text-slate-800">{stamp.title}</span>
                      <span className="-mt-1 text-[10.5px] text-slate-400">{note}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* PAID stamp & stamp date */}
        <div className={`grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 ${showPaidControl ? 'sm:grid-cols-2' : ''}`}>
          {showPaidControl && (
            <div role="group" aria-labelledby={`${ids}-paid`}>
              <p id={`${ids}-paid`} className="label">
                Green PAID stamp
              </p>
              <div className="segmented">
                {PAID_OPTIONS.map((o) => (
                  <button key={o.label} type="button" aria-pressed={value.paidStamp === o.value} onClick={() => onChange({ ...value, paidStamp: o.value })}>
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="hint">{paidHint}</p>
            </div>
          )}
          <div>
            <label htmlFor={`${ids}-date`} className="label">
              Date on stamps
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`${ids}-date`}
                type="date"
                className="input sm:w-48"
                value={value.stampDate ?? ''}
                onChange={(e) => onChange({ ...value, stampDate: e.target.value || undefined })}
              />
              {value.stampDate && (
                <button
                  type="button"
                  className="btn-icon btn-ghost"
                  aria-label="Use the document date"
                  title="Use the document date"
                  onClick={() => onChange({ ...value, stampDate: undefined })}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <p className="hint">
              {value.stampDate ? 'Custom date.' : `Uses the document date${documentDate ? ` (${formatDate(documentDate)})` : ''}.`}
            </p>
          </div>
        </div>
      </div>
    </FormSection>
  );
};

const EmptyHint: React.FC<{ icon: React.ElementType; text: string }> = ({ icon: Icon, text }) => (
  <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3.5">
    <Icon size={17} className="flex-shrink-0 text-slate-400" />
    <p className="flex-1 text-xs leading-relaxed text-slate-500">{text}</p>
    <Link to="/settings/signatures" className="btn-secondary btn-sm flex-shrink-0">
      Set up
    </Link>
  </div>
);
