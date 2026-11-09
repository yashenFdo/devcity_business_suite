import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Info, Lock, Mail, Pencil, Phone, Plus, Stamp as StampIcon, Trash2, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCompanyStore } from '../../store/useCompanyStore';
import { deleteStamp, useStampsStore } from '../../store/useStampsStore';
import { useCan, useSession } from '../../security/sessionState';
import { ConfirmModal } from '../../components/ui/Modal';
import { RowActions, type RowAction } from '../../components/ui/RowActions';
import { Avatar } from '../../components/ui/Avatar';
import { PaidStampSVG, StampSVG } from '../../components/documents/stamps/StampSVG';
import { companySignatories, MAX_SIGNATORIES } from '../../components/documents/signOff';
import type { Signatory, Stamp, StampKind } from '../../types';
import { generateId } from '../../utils/documentNumber';
import { today } from '../../utils/formatters';
import { SettingsCard } from './SettingsPrimitives';
import { SignatoryModal } from './signatures/SignatoryModal';
import { StampEditorModal } from './signatures/StampEditorModal';
import { companyStampDraft } from './signatures/stampDefaults';

const MAX_SIGNATORIES_TOTAL = 10;
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

// ─── Building blocks ──────────────────────────────────────────

const CHECKER = 'bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:12px_12px]';
const PAPER = 'bg-white bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[length:14px_14px]';

const SignatureThumb: React.FC<{ signatory: Signatory }> = ({ signatory }) =>
  signatory.signature ? (
    <span className={`flex h-12 w-24 flex-shrink-0 items-center justify-center rounded-lg p-1.5 ring-1 ring-slate-200 ${CHECKER}`}>
      <img src={signatory.signature} alt={`Signature of ${signatory.name}`} className="max-h-full max-w-full object-contain" />
    </span>
  ) : (
    <span className="flex h-12 w-24 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60">
      <Avatar name={signatory.name} size="xs" />
    </span>
  );

const StampTile: React.FC<{ stamp: Stamp; actions?: RowAction[]; busy?: boolean }> = ({ stamp, actions, busy }) => (
  <li className={`card group relative overflow-hidden transition-opacity ${busy ? 'pointer-events-none opacity-50' : ''}`}>
    <div className={`flex h-48 items-center justify-center border-b border-slate-100 ${PAPER}`}>
      <StampSVG
        stamp={stamp}
        ink={stamp.kind === 'company' ? 'company' : 'personal'}
        date={today()}
        size={stamp.shape === 'round' ? 140 : 196}
      />
    </div>
    <div className="flex items-center gap-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-900">{stamp.title}</p>
        <p className="truncate text-xs text-slate-500">
          {stamp.shape === 'round' ? 'Round seal' : 'Rectangle'}
          {stamp.showDate ? ' · Dated' : ''}
          {stamp.subtitle ? ` · ${stamp.subtitle}` : ''}
        </p>
      </div>
      {actions && <RowActions actions={actions} label={`Actions for ${stamp.title} stamp`} />}
    </div>
  </li>
);

const GalleryEmpty: React.FC<{ preview: React.ReactNode; title: string; text: string; action?: React.ReactNode }> = ({
  preview,
  title,
  text,
  action,
}) => (
  <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-8 text-center sm:flex-row sm:text-left">
    <div className="flex h-32 w-44 flex-shrink-0 items-center justify-center opacity-40 grayscale-[30%]" aria-hidden="true">
      {preview}
    </div>
    <div className="flex-1">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-slate-500">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  </div>
);

const ReadOnlyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
    <Lock size={13} className="flex-shrink-0 text-slate-400" /> {children}
  </p>
);

// ─── Page ─────────────────────────────────────────────────────

export const SignaturesSettings: React.FC = () => {
  const company = useCompanyStore((s) => s.company);
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const stamps = useStampsStore((s) => s.stamps);
  const user = useSession((s) => s.user);
  const isAdmin = useCan('settings.manage');
  const canStamp = useCan('documents.create');

  const [editing, setEditing] = useState<Signatory | 'new' | null>(null);
  const [removing, setRemoving] = useState<Signatory | null>(null);
  const [stampEditor, setStampEditor] = useState<{ kind: StampKind; stamp?: Stamp } | null>(null);
  const [stampToDelete, setStampToDelete] = useState<Stamp | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Signatories ──
  const signatories = companySignatories(company);
  const isLegacy = !company.signatories?.length && !!company.signature;
  const defaults = (company.defaultSignatoryIds ?? []).filter((id) => signatories.some((s) => s.id === id));
  const canAdd = signatories.length < MAX_SIGNATORIES_TOTAL;

  /** Save the full list (a legacy-only signature is converted on the first change). */
  const persist = (next: Signatory[], nextDefaults: string[] = defaults, message?: string) => {
    try {
      updateCompany({
        signatories: next,
        defaultSignatoryIds: nextDefaults.filter((id) => next.some((s) => s.id === id)).slice(0, MAX_SIGNATORIES),
      });
      if (message) toast.success(message);
      return true;
    } catch (e) {
      toast.error(errorText(e, 'Could not save signatories.'));
      return false;
    }
  };

  const saveSignatory = (draft: Omit<Signatory, 'id'>) => {
    if (editing === 'new') {
      const created: Signatory = { ...draft, id: generateId() };
      // The very first signatory becomes the default automatically.
      const ok = persist([...signatories, created], signatories.length === 0 ? [created.id] : defaults, `${created.name} added`);
      if (ok) setEditing(null);
    } else if (editing) {
      const ok = persist(signatories.map((s) => (s.id === editing.id ? { ...draft, id: s.id } : s)), defaults, 'Signatory saved');
      if (ok) setEditing(null);
    }
  };

  const convertLegacy = () => {
    const legacy = signatories[0];
    if (legacy && persist([legacy], [legacy.id])) {
      toast.success('Converted — add the signer’s name and title');
      setEditing(legacy);
    }
  };

  const move = (index: number, delta: -1 | 1) => {
    const next = [...signatories];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    persist(next);
  };

  const toggleDefault = (id: string) => {
    const on = defaults.includes(id);
    if (!on && defaults.length >= MAX_SIGNATORIES) {
      toast.error(`Up to ${MAX_SIGNATORIES} default signatories.`);
      return;
    }
    // Keep defaults in list order so documents print them in the same order.
    const set = new Set(on ? defaults.filter((d) => d !== id) : [...defaults, id]);
    persist(signatories, signatories.filter((s) => set.has(s.id)).map((s) => s.id));
  };

  // ── Stamps ──
  const companyStamps = stamps.filter((s) => s.kind === 'company');
  const myStamps = user ? stamps.filter((s) => s.kind === 'personal' && s.ownerId === user.id) : [];

  const confirmDeleteStamp = (stamp: Stamp) => {
    setDeletingId(stamp.id);
    deleteStamp(stamp)
      .then(() => toast.success('Stamp deleted'))
      .catch((e: unknown) => toast.error(errorText(e, 'Could not delete the stamp.')))
      .finally(() => setDeletingId(null));
  };

  const stampActions = (stamp: Stamp): RowAction[] => [
    { label: 'Edit', icon: Pencil, onClick: () => setStampEditor({ kind: stamp.kind, stamp }) },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => setStampToDelete(stamp) },
  ];

  const sampleCompanyStamp = companyStampDraft(company);

  return (
    <div className="space-y-6">
      {/* ── Signatories ─────────────────────────────────────── */}
      <SettingsCard
        title="Signatories"
        description={`People who sign your documents. Each document can show up to ${MAX_SIGNATORIES}.`}
        actions={
          isAdmin &&
          signatories.length > 0 && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setEditing('new')}
              disabled={!canAdd}
              title={canAdd ? undefined : `Up to ${MAX_SIGNATORIES_TOTAL} signatories`}
            >
              <Plus size={14} /> Add signatory
            </button>
          )
        }
      >
        {isLegacy && isAdmin && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-primary-100 bg-primary-50/50 px-4 py-3 sm:flex-row sm:items-center">
            <Wand2 size={17} className="hidden flex-shrink-0 text-primary-600 sm:block" />
            <p className="flex-1 text-[13px] leading-relaxed text-slate-700">
              You have a single signature from <span className="font-medium">Branding</span>. Convert it to a signatory to add a name,
              title and contact details.
            </p>
            <button type="button" className="btn-primary btn-sm flex-shrink-0" onClick={convertLegacy}>
              Convert to signatory
            </button>
          </div>
        )}

        {signatories.length === 0 ? (
          <GalleryEmpty
            preview={
              <div className="w-40 text-center">
                <svg viewBox="0 0 160 50" className="mx-auto h-12 w-36 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 36c10-22 18-26 20-14s-6 18 2 10 12-22 18-12-2 14 6 6 10-12 16-4 8 4 14-2 12-6 20-2" />
                </svg>
                <div className="mt-1 border-t border-slate-400 pt-1 text-[10px] font-semibold text-slate-700">Name Surname</div>
                <div className="text-[9px] text-slate-500">Managing Director</div>
              </div>
            }
            title="No signatories yet"
            text={
              isAdmin
                ? 'Add the people who sign quotations, invoices, receipts and bills — with their title, contact details and signature.'
                : 'An administrator can add the people who sign your documents.'
            }
            action={
              isAdmin && (
                <button type="button" className="btn-primary btn-sm" onClick={() => setEditing('new')}>
                  <Plus size={14} /> Add first signatory
                </button>
              )
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {signatories.map((s, i) => {
                const isDefault = defaults.includes(s.id);
                const implicitDefault = defaults.length === 0 && i === 0;
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
                    <SignatureThumb signatory={s} />
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="flex items-center gap-2 truncate text-[13px] font-medium text-slate-900">
                        {s.name}
                        {isLegacy && <span className="badge border-slate-200 bg-slate-50 text-slate-600">From Branding</span>}
                      </p>
                      <p className="truncate text-xs text-slate-500">{s.role}</p>
                      {(s.email || s.phone) && (
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] text-slate-400">
                          {s.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={11} /> {s.phone}
                            </span>
                          )}
                          {s.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail size={11} /> {s.email}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {isAdmin ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-pressed={isDefault}
                          onClick={() => toggleDefault(s.id)}
                          title="Pre-select on new documents"
                          className={`mr-1 inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:shadow-focus ${
                            isDefault
                              ? 'border-primary-200 bg-primary-50 text-primary-700'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border ${
                              isDefault ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isDefault && <Check size={9} strokeWidth={3.5} />}
                          </span>
                          Default
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-ghost h-7 w-7"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          aria-label={`Move ${s.name} up`}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-ghost h-7 w-7"
                          onClick={() => move(i, 1)}
                          disabled={i === signatories.length - 1}
                          aria-label={`Move ${s.name} down`}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <RowActions
                          label={`Actions for ${s.name}`}
                          actions={[
                            { label: 'Edit', icon: Pencil, onClick: () => setEditing(s) },
                            { label: 'Remove', icon: Trash2, danger: true, onClick: () => setRemoving(s) },
                          ]}
                        />
                      </div>
                    ) : (
                      (isDefault || implicitDefault) && (
                        <span className="badge border-primary-200 bg-primary-50 text-primary-700">
                          <Check size={11} /> Default
                        </span>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="hint flex items-start gap-1.5">
              <Info size={13} className="mt-px flex-shrink-0 text-slate-400" />
              {defaults.length === 0
                ? `No defaults ticked — new documents are signed by ${signatories[0].name}. `
                : `${defaults.length} default ${defaults.length === 1 ? 'signatory is' : 'signatories are'} pre-selected on new documents. `}
              {isAdmin && 'Order here is the order they print in.'}
            </p>
          </>
        )}
        {!isAdmin && signatories.length > 0 && <ReadOnlyNote>Only administrators can change signatories.</ReadOnlyNote>}
      </SettingsCard>

      {/* ── Company stamps ──────────────────────────────────── */}
      <SettingsCard
        title="Company stamps"
        description="Official seals printed in blue ink. Admins manage them; anyone who edits documents can apply them."
        actions={
          isAdmin &&
          companyStamps.length > 0 && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => setStampEditor({ kind: 'company' })}>
              <Plus size={14} /> New company stamp
            </button>
          )
        }
      >
        {companyStamps.length === 0 ? (
          <GalleryEmpty
            preview={<StampSVG stamp={{ ...sampleCompanyStamp, lines: [sampleCompanyStamp.line1] }} ink="company" size={120} plain />}
            title="No company stamp yet"
            text={
              isAdmin
                ? 'Create your official seal — we’ll prefill it from your company profile. Add a round seal, a rectangular stamp, or both.'
                : 'An administrator can create the company seal.'
            }
            action={
              isAdmin && (
                <button type="button" className="btn-primary btn-sm" onClick={() => setStampEditor({ kind: 'company' })}>
                  <StampIcon size={14} /> Create company stamp
                </button>
              )
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {companyStamps.map((s) => (
              <StampTile key={s.id} stamp={s} busy={deletingId === s.id} actions={isAdmin ? stampActions(s) : undefined} />
            ))}
          </ul>
        )}
        {!isAdmin && companyStamps.length > 0 && <ReadOnlyNote>Only administrators can change company stamps.</ReadOnlyNote>}
      </SettingsCard>

      {/* ── My stamps ───────────────────────────────────────── */}
      <SettingsCard
        title="My stamps"
        description="Your personal stamps — APPROVED, CHECKED, RECEIVED and more — printed in black ink. Only you can apply them."
        actions={
          canStamp &&
          myStamps.length > 0 && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => setStampEditor({ kind: 'personal' })}>
              <Plus size={14} /> New stamp
            </button>
          )
        }
      >
        {!canStamp ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-[13px] text-slate-600">
            <Lock size={16} className="flex-shrink-0 text-slate-400" />
            Personal stamps are available to editors and administrators. Ask an admin if you need one.
          </div>
        ) : myStamps.length === 0 ? (
          <GalleryEmpty
            preview={
              <StampSVG
                stamp={{ shape: 'rect', title: 'Approved', subtitle: 'Finance Manager', lines: [user?.name ?? ''], showDate: true }}
                ink="personal"
                date={today()}
                size={170}
                plain
              />
            }
            title="No personal stamps yet"
            text="Pick a preset like APPROVED or VERIFIED, add your title and name, and apply it to any document you work on."
            action={
              <button type="button" className="btn-primary btn-sm" onClick={() => setStampEditor({ kind: 'personal' })}>
                <StampIcon size={14} /> Create my stamp
              </button>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {myStamps.map((s) => (
              <StampTile key={s.id} stamp={s} busy={deletingId === s.id} actions={stampActions(s)} />
            ))}
          </ul>
        )}
      </SettingsCard>

      {/* ── PAID stamp ──────────────────────────────────────── */}
      <SettingsCard title="PAID stamp" description="Built in and printed in green ink — nothing to set up.">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className={`flex h-40 w-full flex-shrink-0 items-center justify-center rounded-xl border border-slate-100 sm:w-60 ${PAPER}`}>
            <PaidStampSVG date={today()} size={180} />
          </div>
          <ul className="space-y-2.5 text-[13px] leading-relaxed text-slate-600">
            {[
              'Applied automatically to invoices and vendor bills once they are fully paid.',
              'Receipts always show it — they confirm a payment.',
              'Override it on any document from the editor: Auto, Always or Never.',
              'It prints the document’s stamp date, so it matches your other stamps.',
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <Check size={15} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </SettingsCard>

      {/* ── Modals ──────────────────────────────────────────── */}
      {editing && (
        <SignatoryModal
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={saveSignatory}
        />
      )}
      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          persist(
            signatories.filter((s) => s.id !== removing.id),
            defaults,
            `${removing.name} removed`
          );
        }}
        title={`Remove ${removing?.name ?? 'signatory'}?`}
        message="They won’t be offered on new documents, and documents that listed them will no longer print their signature."
        confirmLabel="Remove"
      />
      {stampEditor && user && (
        <StampEditorModal
          key={stampEditor.stamp?.id ?? `new-${stampEditor.kind}`}
          kind={stampEditor.kind}
          initial={stampEditor.stamp}
          company={company}
          user={user}
          onClose={() => setStampEditor(null)}
        />
      )}
      <ConfirmModal
        isOpen={!!stampToDelete}
        onClose={() => setStampToDelete(null)}
        onConfirm={() => stampToDelete && confirmDeleteStamp(stampToDelete)}
        title={`Delete the “${stampToDelete?.title ?? ''}” stamp?`}
        message="It will disappear from every document it was applied to. This can’t be undone."
        confirmLabel="Delete stamp"
      />
    </div>
  );
};
