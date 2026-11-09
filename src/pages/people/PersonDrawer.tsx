import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Briefcase, Building2, CalendarDays, Clock, Loader2, Mail, Pencil, Phone, ShieldCheck, UserRound, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateMember, type MemberPatch } from '../../cloud/team';
import { EMPLOYMENT_STATUS_META, useAccessStore, type EmploymentStatus, type TeamMember } from '../../store/useAccessStore';
import { ROLE_META } from '../../security/permissions';
import { Field } from '../../components/documents/editor/FormSection';
import { formatDate } from '../../utils/formatters';
import { PersonAvatar } from './PersonAvatar';
import { EmploymentBadge, RoleBadge, YouTag } from './PeopleBadges';
import { departmentOptions, errorMessage, jobTitleOptions, lastActiveLabel, telHref, tenure } from './peopleUtils';

interface PersonDrawerProps {
  member: TeamMember;
  isMe: boolean;
  isAdmin: boolean;
  onClose: () => void;
}

interface FormState {
  jobTitle: string;
  department: string;
  phone: string;
  startDate: string;
  status: EmploymentStatus;
}

const STATUSES: EmploymentStatus[] = ['active', 'on_leave', 'left'];
const PHONE_RE = /^[+\d][\d\s().-]{4,30}$/;

const toForm = (m: TeamMember): FormState => ({
  jobTitle: m.jobTitle ?? '',
  department: m.department ?? '',
  phone: m.phone ?? '',
  startDate: m.startDate?.slice(0, 10) ?? '',
  status: m.status,
});

const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="px-6 py-5">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const Detail: React.FC<{ icon: React.ElementType; label: string; children: React.ReactNode }> = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3">
    <span className="mt-px flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-white text-slate-400 ring-1 ring-slate-200/80">
      <Icon size={14} aria-hidden="true" />
    </span>
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-slate-900">{children}</dd>
    </div>
  </div>
);

const Muted: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="text-slate-400">{children}</span>;

/** Right-hand slide-over with a person's full profile and (when allowed) an edit form. */
export const PersonDrawer: React.FC<PersonDrawerProps> = ({ member, isMe, isAdmin, onClose }) => {
  const titleId = useId();
  const formId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const members = useAccessStore((s) => s.members);

  const canEditAll = isAdmin;
  const canEditPhone = isAdmin || isMe;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(member));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  const departments = useMemo(() => departmentOptions(members), [members]);
  const titles = useMemo(() => jobTitleOptions(members), [members]);

  const startEditing = () => {
    setForm(toForm(member));
    setErrors({});
    setEditing(true);
  };

  // Escape cancels editing first, then closes the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (editing && !saving) setEditing(false);
      else if (!editing) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing, saving, onClose]);

  // Slide in from the right, and hand focus back to whatever opened the drawer.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = panelRef.current;
    if (el && typeof el.animate === 'function' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.animate(
        [
          { transform: 'translateX(24px)', opacity: 0 },
          { transform: 'translateX(0)', opacity: 1 },
        ],
        { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
    }
    return () => opener?.focus();
  }, []);

  const original = toForm(member);
  const patch: MemberPatch = {};
  if (canEditPhone && form.phone.trim() !== original.phone) patch.phone = form.phone.trim();
  if (canEditAll) {
    if (form.jobTitle.trim() !== original.jobTitle) patch.jobTitle = form.jobTitle.trim();
    if (form.department.trim() !== original.department) patch.department = form.department.trim();
    if (form.startDate !== original.startDate) patch.startDate = form.startDate;
    if (!isMe && form.status !== original.status) patch.status = form.status;
  }
  const dirty = Object.keys(patch).length > 0;

  const validate = () => {
    const next: typeof errors = {};
    const phone = form.phone.trim();
    if (phone && !PHONE_RE.test(phone)) next.phone = 'Enter a valid phone number, e.g. +94 77 123 4567.';
    if (form.jobTitle.trim().length > 80) next.jobTitle = 'Keep the job title under 80 characters.';
    if (form.department.trim().length > 60) next.department = 'Keep the department under 60 characters.';
    if (original.startDate && !form.startDate) next.startDate = 'A start date can be changed but not removed.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || saving || !validate()) return;
    setSaving(true);
    try {
      await updateMember(member.id, patch, member.name);
      toast.success(patch.status === 'left' ? `${member.name} marked as left. Their access has been revoked.` : 'Profile updated');
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const memberTenure = tenure(member.startDate);
  const editLabel = canEditAll ? 'Edit profile' : 'Edit phone';

  return (
    <div className="no-print fixed inset-0 z-[45] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] animate-fade-in" onMouseDown={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-md flex-col bg-slate-50 shadow-modal ring-1 ring-slate-900/5"
      >
        {/* Header */}
        <div className="border-b border-slate-200/80 bg-white px-6 pb-5 pt-5">
          <div className="flex items-start gap-3.5">
            <PersonAvatar name={member.name} url={member.avatarUrl} size="lg" />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-2">
                <h2 id={titleId} className="truncate text-base font-semibold text-slate-900">
                  {member.name}
                </h2>
                {isMe && <YouTag />}
              </div>
              <p className="truncate text-[13px] text-slate-600">
                {member.jobTitle || <Muted>No job title</Muted>}
                {member.department && <span className="text-slate-400"> · {member.department}</span>}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <EmploymentBadge status={member.status} />
                <RoleBadge role={member.role} />
              </div>
            </div>
            <button type="button" autoFocus onClick={onClose} className="btn-icon btn-ghost -mr-2 -mt-1" aria-label="Close profile">
              <X size={17} />
            </button>
          </div>

          {!editing && (
            <div className="mt-4 flex flex-wrap gap-2">
              {member.email && (
                <a href={`mailto:${member.email}`} className="btn-secondary btn-sm">
                  <Mail size={14} /> Email
                </a>
              )}
              {member.phone && (
                <a href={telHref(member.phone)} className="btn-secondary btn-sm">
                  <Phone size={14} /> Call
                </a>
              )}
              {canEditPhone && (
                <button type="button" className="btn-secondary btn-sm" onClick={startEditing}>
                  <Pencil size={14} /> {editLabel}
                </button>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <form id={formId} onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {!canEditAll && (
                <p className="rounded-lg bg-white px-3.5 py-2.5 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-200/80">
                  You can update your phone number. Ask an administrator to change your job title, department or start date.
                </p>
              )}
              {canEditAll && (
                <>
                  <Field label="Job title" htmlFor={`${formId}-title`} error={errors.jobTitle}>
                    <input
                      id={`${formId}-title`}
                      className={`input ${errors.jobTitle ? 'input-error' : ''}`}
                      list={`${formId}-titles`}
                      value={form.jobTitle}
                      maxLength={80}
                      placeholder="e.g. Software Engineer"
                      onChange={(e) => set('jobTitle', e.target.value)}
                      autoFocus
                    />
                    <datalist id={`${formId}-titles`}>
                      {titles.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Department" htmlFor={`${formId}-dept`} error={errors.department}>
                    <input
                      id={`${formId}-dept`}
                      className={`input ${errors.department ? 'input-error' : ''}`}
                      list={`${formId}-depts`}
                      value={form.department}
                      maxLength={60}
                      placeholder="e.g. Engineering"
                      onChange={(e) => set('department', e.target.value)}
                    />
                    <datalist id={`${formId}-depts`}>
                      {departments.map((d) => (
                        <option key={d} value={d} />
                      ))}
                    </datalist>
                  </Field>
                </>
              )}
              <Field label="Phone" htmlFor={`${formId}-phone`} error={errors.phone} hint="Visible to everyone in the workspace.">
                <input
                  id={`${formId}-phone`}
                  type="tel"
                  inputMode="tel"
                  autoComplete={isMe ? 'tel' : 'off'}
                  className={`input ${errors.phone ? 'input-error' : ''}`}
                  value={form.phone}
                  maxLength={32}
                  placeholder="+94 77 123 4567"
                  onChange={(e) => set('phone', e.target.value)}
                  autoFocus={!canEditAll}
                />
              </Field>
              {canEditAll && (
                <>
                  <Field label="Start date" htmlFor={`${formId}-start`} error={errors.startDate}>
                    <input
                      id={`${formId}-start`}
                      type="date"
                      className={`input ${errors.startDate ? 'input-error' : ''}`}
                      value={form.startDate}
                      onChange={(e) => set('startDate', e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Employment status"
                    htmlFor={`${formId}-status`}
                    hint={isMe ? "You can't change your own status." : undefined}
                  >
                    <select
                      id={`${formId}-status`}
                      className="select"
                      value={form.status}
                      disabled={isMe}
                      onChange={(e) => set('status', e.target.value as EmploymentStatus)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {EMPLOYMENT_STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {!isMe && form.status === 'left' && original.status !== 'left' && (
                    <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200">
                      {member.name} will lose access to this workspace as soon as you save. Their profile stays in the directory as a former
                      team member.
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 bg-white px-6 py-3.5">
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!dirty || saving}>
                {saving && <Loader2 size={15} className="animate-spin" />} Save changes
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 divide-y divide-slate-200/70 overflow-y-auto">
            <Section title="Contact">
              <dl className="space-y-3.5">
                <Detail icon={Mail} label="Email">
                  {member.email ? (
                    <a href={`mailto:${member.email}`} className="break-all hover:text-primary-700 hover:underline">
                      {member.email}
                    </a>
                  ) : (
                    <Muted>Not available</Muted>
                  )}
                </Detail>
                <Detail icon={Phone} label="Phone">
                  {member.phone ? (
                    <a href={telHref(member.phone)} className="hover:text-primary-700 hover:underline">
                      {member.phone}
                    </a>
                  ) : (
                    <Muted>{isMe ? 'Add your phone number so colleagues can reach you' : 'Not provided'}</Muted>
                  )}
                </Detail>
              </dl>
            </Section>

            <Section title="Employment">
              <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <Detail icon={Briefcase} label="Job title">
                  {member.jobTitle || <Muted>Not set</Muted>}
                </Detail>
                <Detail icon={Building2} label="Department">
                  {member.department || <Muted>Not set</Muted>}
                </Detail>
                <Detail icon={CalendarDays} label="Start date">
                  {member.startDate ? formatDate(member.startDate) : <Muted>Not set</Muted>}
                </Detail>
                <Detail icon={Clock} label="Tenure">
                  {member.status === 'left' ? <Muted>Former team member</Muted> : memberTenure || <Muted>Not available</Muted>}
                </Detail>
                <Detail icon={UserRound} label="Status">
                  {EMPLOYMENT_STATUS_META[member.status].label}
                </Detail>
              </dl>
            </Section>

            <Section title="Workspace access">
              <dl className="space-y-3.5">
                <Detail icon={ShieldCheck} label="Role">
                  {ROLE_META[member.role].label}
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {member.status === 'left' ? 'No access — this person has left.' : ROLE_META[member.role].description}
                  </span>
                </Detail>
                <div className="grid grid-cols-2 gap-3.5">
                  <Detail icon={CalendarDays} label="Joined workspace">
                    {formatDate(member.joinedAt)}
                  </Detail>
                  <Detail icon={Clock} label="Last active">
                    {isMe ? 'Active now' : lastActiveLabel(member.lastSeenAt)}
                  </Detail>
                </div>
              </dl>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
};
