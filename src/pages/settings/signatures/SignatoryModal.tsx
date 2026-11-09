import React, { useState } from 'react';
import { PenLine, Upload } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { ImageSlot } from '../../../components/ui/ImageSlot';
import { Field } from '../../../components/documents/editor/FormSection';
import type { Signatory } from '../../../types';
import { SignaturePad } from './SignaturePad';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Draft = Omit<Signatory, 'id'>;

/** Add or edit a signatory: name, role, contact and signature (upload or draw). */
export const SignatoryModal: React.FC<{
  initial?: Signatory;
  onClose: () => void;
  onSave: (draft: Draft) => void;
}> = ({ initial, onClose, onSave }) => {
  const [draft, setDraft] = useState<Draft>({
    name: initial?.name ?? '',
    role: initial?.role ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    signature: initial?.signature,
  });
  const [mode, setMode] = useState<'upload' | 'draw'>('upload');
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const errors = {
    name: !draft.name.trim() ? 'Name is required.' : '',
    role: !draft.role.trim() ? 'Role or title is required.' : '',
    email: draft.email?.trim() && !EMAIL.test(draft.email.trim()) ? 'Enter a valid email address.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (invalid) return;
    onSave({
      name: draft.name.trim(),
      role: draft.role.trim(),
      email: draft.email?.trim() || undefined,
      phone: draft.phone?.trim() || undefined,
      signature: draft.signature,
    });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      title={initial ? 'Edit signatory' : 'Add signatory'}
      description="Signatories appear under the sign-off on your documents."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="signatory-form" className="btn-primary">
            {initial ? 'Save changes' : 'Add signatory'}
          </button>
        </>
      }
    >
      <form id="signatory-form" onSubmit={submit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="sig-name" required error={submitted ? errors.name : ''}>
            <input
              id="sig-name"
              className={`input ${submitted && errors.name ? 'input-error' : ''}`}
              value={draft.name}
              maxLength={80}
              autoFocus
              placeholder="e.g. Nimal Perera"
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>
          <Field label="Role / title" htmlFor="sig-role" required error={submitted ? errors.role : ''}>
            <input
              id="sig-role"
              className={`input ${submitted && errors.role ? 'input-error' : ''}`}
              value={draft.role}
              maxLength={80}
              placeholder="e.g. Managing Director"
              onChange={(e) => set('role', e.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="sig-email" error={submitted ? errors.email : ''} hint="Optional — printed under the name.">
            <input
              id="sig-email"
              type="email"
              className={`input ${submitted && errors.email ? 'input-error' : ''}`}
              value={draft.email ?? ''}
              maxLength={120}
              placeholder="name@company.com"
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <Field label="Phone" htmlFor="sig-phone" hint="Optional.">
            <input
              id="sig-phone"
              type="tel"
              className="input"
              value={draft.phone ?? ''}
              maxLength={40}
              placeholder="+94 77 123 4567"
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-700">Signature</p>
            {!draft.signature && (
              <div className="segmented" role="group" aria-label="How to add the signature">
                <button type="button" aria-pressed={mode === 'upload'} onClick={() => setMode('upload')}>
                  <Upload size={12} className="mr-1 inline" /> Upload
                </button>
                <button type="button" aria-pressed={mode === 'draw'} onClick={() => setMode('draw')}>
                  <PenLine size={12} className="mr-1 inline" /> Draw
                </button>
              </div>
            )}
          </div>
          {draft.signature || mode === 'upload' ? (
            <ImageSlot
              label="Signature"
              hideLabel
              hint="PNG with a transparent background works best · up to 512 KB"
              icon={PenLine}
              value={draft.signature}
              onChange={(v) => set('signature', v)}
            />
          ) : (
            <SignaturePad onUse={(url) => set('signature', url)} onCancel={() => setMode('upload')} />
          )}
          <p className="hint">Optional. Without a signature, a blank line is printed for a wet signature.</p>
        </div>
      </form>
    </Modal>
  );
};
