import React, { useId, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../../../components/ui/Modal';
import { Field } from '../../../components/documents/editor/FormSection';
import { StampSVG } from '../../../components/documents/stamps/StampSVG';
import { STAMP_INK } from '../../../components/documents/stamps/stampInk';
import { saveStamp } from '../../../store/useStampsStore';
import type { Company, Stamp, StampKind, StampShape } from '../../../types';
import { today } from '../../../utils/formatters';
import { companyStampDraft, companyStampLines, PERSONAL_PRESETS, personalStampDraft, type StampDraft } from './stampDefaults';

const fromStamp = (s: Stamp): StampDraft => ({
  shape: s.shape,
  title: s.title,
  subtitle: s.subtitle ?? '',
  line1: s.lines?.[0] ?? '',
  line2: s.lines?.[1] ?? '',
  showDate: !!s.showDate,
});

const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; labelledBy: string }> = ({ checked, onChange, labelledBy }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={labelledBy}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:shadow-focus ${
      checked ? 'bg-primary-600' : 'bg-slate-300'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-slate-900/5 transition-transform ${
        checked ? 'translate-x-[22px]' : 'translate-x-0.5'
      }`}
    />
  </button>
);

const ShapeOption: React.FC<{ shape: StampShape; active: boolean; onSelect: () => void }> = ({ shape, active, onSelect }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onSelect}
    className={`flex flex-1 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:shadow-focus ${
      active ? 'border-primary-400 bg-primary-50/40 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300'
    }`}
  >
    <span
      aria-hidden="true"
      className={`flex-shrink-0 border-2 ${active ? 'border-primary-600' : 'border-slate-400'} ${
        shape === 'round' ? 'h-7 w-7 rounded-full' : 'h-6 w-9 rounded-[5px]'
      }`}
    />
    <span>
      <span className="block text-[13px] font-medium text-slate-900">{shape === 'round' ? 'Round seal' : 'Rectangle'}</span>
      <span className="block text-xs text-slate-500">{shape === 'round' ? 'Classic company seal' : 'Text block, room for more lines'}</span>
    </span>
  </button>
);

/** Create or edit a company stamp (blue) or a personal stamp (black), with a large live preview. */
export const StampEditorModal: React.FC<{
  kind: StampKind;
  initial?: Stamp;
  company: Company;
  user: { name: string; email: string };
  onClose: () => void;
}> = ({ kind, initial, company, user, onClose }) => {
  const ids = useId();
  const isCompany = kind === 'company';
  const [draft, setDraft] = useState<StampDraft>(() =>
    initial ? fromStamp(initial) : isCompany ? companyStampDraft(company) : personalStampDraft(user, company.signatories ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof StampDraft>(key: K, value: StampDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const setShape = (shape: StampShape) =>
    setDraft((d) => {
      if (d.shape === shape) return d;
      // Company stamps: swap in the profile lines that suit the new shape, unless they were edited.
      const [a, b] = companyStampLines(company, d.shape);
      if (isCompany && d.line1 === a && d.line2 === b) {
        const [line1, line2] = companyStampLines(company, shape);
        return { ...d, shape, line1, line2 };
      }
      return { ...d, shape };
    });

  const titleError = !draft.title.trim() ? 'Stamp text is required.' : '';
  const preview = {
    shape: draft.shape,
    title: draft.title || (isCompany ? 'Company name' : 'Stamp'),
    subtitle: draft.subtitle,
    lines: (draft.shape === 'round' ? [draft.line1] : [draft.line1, draft.line2]).filter((l) => l.trim()),
    showDate: draft.showDate,
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (titleError) return;
    setSaving(true);
    try {
      await saveStamp({
        id: initial?.id,
        kind,
        shape: draft.shape,
        title: draft.title,
        subtitle: draft.subtitle,
        lines: preview.lines,
        showDate: draft.showDate,
      });
      toast.success(initial ? 'Stamp updated' : 'Stamp created');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the stamp.');
      setSaving(false);
    }
  };

  const ink = isCompany ? 'company' : 'personal';
  const isPreset = (PERSONAL_PRESETS as readonly string[]).includes(draft.title.trim().toUpperCase());

  return (
    <Modal
      isOpen
      onClose={saving ? () => undefined : onClose}
      size="full"
      title={`${initial ? 'Edit' : 'New'} ${isCompany ? 'company stamp' : 'personal stamp'}`}
      description={
        isCompany
          ? 'Your official seal, printed in blue ink. Any admin or editor can apply it to documents.'
          : 'Your own stamp, printed in black ink. Only you can apply, edit or delete it.'
      }
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form={`${ids}-form`} className="btn-primary" disabled={saving}>
            {saving && <Loader2 size={15} className="animate-spin" />} {initial ? 'Save stamp' : 'Create stamp'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
        {/* Live preview */}
        <div className="md:order-2">
          <div className="sticky top-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200">
            <div className="flex min-h-[280px] items-center justify-center bg-white bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[length:14px_14px] p-6">
              <StampSVG stamp={preview} ink={ink} date={today()} size={draft.shape === 'round' ? 220 : 280} rotate={-4} />
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STAMP_INK[ink] }} aria-hidden="true" />
              {isCompany ? 'Blue ink — always used for company stamps' : 'Black ink — always used for personal stamps'}
            </div>
          </div>
        </div>

        {/* Form */}
        <form id={`${ids}-form`} onSubmit={(e) => void save(e)} noValidate className="space-y-4 md:order-1">
          <div>
            <p className="label">Shape</p>
            <div className="flex flex-col gap-2 sm:flex-row" role="group" aria-label="Stamp shape">
              <ShapeOption shape="round" active={draft.shape === 'round'} onSelect={() => setShape('round')} />
              <ShapeOption shape="rect" active={draft.shape === 'rect'} onSelect={() => setShape('rect')} />
            </div>
          </div>

          {!isCompany && (
            <div>
              <p className="label">Quick presets</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Stamp text presets">
                {PERSONAL_PRESETS.map((p) => {
                  const active = draft.title.trim().toUpperCase() === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set('title', p)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors ${
                        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={!isPreset}
                  onClick={() => {
                    if (isPreset) set('title', '');
                    document.getElementById(`${ids}-title`)?.focus();
                  }}
                  className={`rounded-full border border-dashed px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors ${
                    !isPreset ? 'border-slate-900 text-slate-900' : 'border-slate-300 text-slate-500 hover:border-slate-400'
                  }`}
                >
                  Custom…
                </button>
              </div>
            </div>
          )}

          <Field
            label={isCompany ? 'Company name' : 'Stamp text'}
            htmlFor={`${ids}-title`}
            required
            error={submitted ? titleError : ''}
          >
            <input
              id={`${ids}-title`}
              className={`input ${submitted && titleError ? 'input-error' : ''}`}
              value={draft.title}
              maxLength={isCompany ? 60 : 30}
              placeholder={isCompany ? company.name || 'Company name' : 'e.g. PAYMENT RELEASED'}
              onChange={(e) => set('title', e.target.value)}
            />
          </Field>

          <Field
            label={isCompany ? 'Second line' : 'Role / title'}
            htmlFor={`${ids}-sub`}
            hint={isCompany ? 'Usually your registration number.' : undefined}
          >
            <input
              id={`${ids}-sub`}
              className="input"
              value={draft.subtitle}
              maxLength={80}
              placeholder={isCompany ? 'Reg. No PV 00000' : 'e.g. Finance Manager'}
              onChange={(e) => set('subtitle', e.target.value)}
            />
          </Field>

          <div className={`grid grid-cols-1 gap-3.5 ${draft.shape === 'rect' ? 'sm:grid-cols-2' : ''}`}>
            <Field
              label={draft.shape === 'round' ? 'Bottom arc text' : isCompany ? 'Line 1' : 'Name'}
              htmlFor={`${ids}-l1`}
              hint={draft.shape === 'round' ? 'Short works best, e.g. city and country.' : undefined}
            >
              <input
                id={`${ids}-l1`}
                className="input"
                value={draft.line1}
                maxLength={90}
                placeholder={isCompany ? 'Colombo, Sri Lanka' : user.name}
                onChange={(e) => set('line1', e.target.value)}
              />
            </Field>
            {draft.shape === 'rect' && (
              <Field label={isCompany ? 'Line 2' : 'Extra line'} htmlFor={`${ids}-l2`}>
                <input
                  id={`${ids}-l2`}
                  className="input"
                  value={draft.line2}
                  maxLength={90}
                  placeholder={isCompany ? 'Phone · email' : 'Optional'}
                  onChange={(e) => set('line2', e.target.value)}
                />
              </Field>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
            <div>
              <p id={`${ids}-date`} className="text-[13px] font-medium text-slate-900">
                Print the date
              </p>
              <p className="text-xs text-slate-500">Uses the document’s stamp date when applied.</p>
            </div>
            <Switch checked={draft.showDate} onChange={(v) => set('showDate', v)} labelledBy={`${ids}-date`} />
          </div>

          {isCompany && (
            <button
              type="button"
              className="btn-ghost btn-sm -ml-2 text-slate-500"
              onClick={() => setDraft((d) => ({ ...companyStampDraft(company, d.shape), showDate: d.showDate }))}
            >
              <RotateCcw size={13} /> Refill from company profile
            </button>
          )}
        </form>
      </div>
    </Modal>
  );
};
