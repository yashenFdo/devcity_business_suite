import React, { useEffect, useId, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  Copy,
  Eye,
  Inbox,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Mail,
  MailPlus,
  Palmtree,
  RefreshCw,
  RotateCw,
  Send,
  UserCheck,
  UserMinus,
  UserX,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  decideJoinRequest,
  inviteMember,
  regenerateJoinCode,
  removeMember,
  revokeInvitation,
  setJoinCodeEnabled,
  updateMember,
} from '../../cloud/team';
import { leaveWorkspace, refreshJoinQueue } from '../../security/session';
import { useCan, useSession } from '../../security/sessionState';
import { ROLE_META, type Role } from '../../security/permissions';
import { useAccessStore, type EmploymentStatus, type Invitation, type TeamMember } from '../../store/useAccessStore';
import { Field } from '../../components/documents/editor/FormSection';
import { ConfirmModal, Modal } from '../../components/ui/Modal';
import { RowActions, type RowAction } from '../../components/ui/RowActions';
import { formatDate } from '../../utils/formatters';
import { PersonAvatar } from '../people/PersonAvatar';
import { EmploymentBadge, RoleBadge, YouTag } from '../people/PeopleBadges';
import { activeAdminCount, copyText, errorMessage, lastActiveLabel, relativeTime } from '../people/peopleUtils';
import { SettingsCard } from './SettingsPrimitives';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: Role[] = ['admin', 'editor', 'viewer'];
const INVITE_VALID_DAYS = 7;

// ─── Small building blocks ────────────────────────────────────

const CopyButton: React.FC<{ text: string; label?: string; className?: string }> = ({ text, label = 'Copy', className = 'btn-secondary' }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } else {
          toast.error("Couldn't access the clipboard. Select the text and copy it manually.");
        }
      }}
    >
      {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
};

const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }> = ({
  checked,
  onChange,
  disabled,
  label,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-50 ${
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

const InlineEmpty: React.FC<{ icon: React.ElementType; title: string; text: string }> = ({ icon: Icon, title, text }) => (
  <div className="flex items-center gap-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5">
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200">
      <Icon size={17} />
    </span>
    <div>
      <p className="text-[13px] font-medium text-slate-700">{title}</p>
      <p className="text-xs text-slate-500">{text}</p>
    </div>
  </div>
);

const CountBadge: React.FC<{ count: number; label: string }> = ({ count, label }) =>
  count > 0 ? <span className="badge border-primary-200 bg-primary-50 text-primary-700 tabular">{`${count} ${label}`}</span> : null;

const RolePicker: React.FC<{ value: Role; onChange: (r: Role) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const name = useId();
  return (
    <fieldset disabled={disabled}>
      <legend className="label">Role</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {ROLES.map((r) => {
          const checked = value === r;
          return (
            <label
              key={r}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all focus-within:ring-2 focus-within:ring-primary-200 ${
                checked ? 'border-primary-400 bg-primary-50/50 ring-1 ring-primary-400' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={r}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary-600"
                checked={checked}
                onChange={() => onChange(r)}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-slate-900">{ROLE_META[r].label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{ROLE_META[r].description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

interface CreatedInvite {
  email: string;
  role: Role;
  link: string;
}

const mailtoFor = ({ email, role, link }: CreatedInvite, inviter: string, workspace: string) => {
  const subject = `${inviter} invited you to join ${workspace} on DevCity`;
  const body = [
    'Hi,',
    '',
    `${inviter} has invited you to join the ${workspace} workspace on DevCity Business Suite as ${ROLE_META[role].label === 'Administrator' ? 'an' : 'a'} ${ROLE_META[role].label}.`,
    '',
    'Accept the invitation here:',
    link,
    '',
    `Please open the link while signed in with ${email}, or create an account with that address. If it's a Google account, you can simply choose "Continue with Google".`,
    '',
    `The link expires in ${INVITE_VALID_DAYS} days.`,
  ].join('\n');
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

/** Success panel showing a freshly created invitation link. */
const InvitationLinkPanel: React.FC<{ invite: CreatedInvite }> = ({ invite }) => {
  const inviter = useSession((s) => s.user?.name) ?? 'A colleague';
  const workspace = useSession((s) => s.workspace?.name) ?? 'our';
  const inputId = useId();
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-slate-900">
            Invitation ready for <span className="break-all">{invite.email}</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            Joins as <span className="font-medium">{ROLE_META[invite.role].label}</span>. Send them this link. It's shown only once.
          </p>
        </div>
      </div>
      <label htmlFor={inputId} className="sr-only">
        Invitation link
      </label>
      <div className="mt-3.5 flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          readOnly
          value={invite.link}
          onFocus={(e) => e.currentTarget.select()}
          className="input flex-1 bg-white font-mono text-xs"
          spellCheck={false}
        />
        <div className="flex gap-2">
          <CopyButton text={invite.link} label="Copy link" className="btn-secondary flex-1 sm:flex-none" />
          <a href={mailtoFor(invite, inviter, workspace)} className="btn-primary flex-1 sm:flex-none">
            <Mail size={15} /> Open email
          </a>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-xs leading-relaxed text-slate-600">
        <li>• The link expires in {INVITE_VALID_DAYS} days and works only once.</li>
        <li>
          • It must be opened while signed in with <span className="font-medium text-slate-800">{invite.email}</span>.
        </li>
      </ul>
    </div>
  );
};

// ─── 1. Invite people ─────────────────────────────────────────

const InviteCard: React.FC = () => {
  const members = useAccessStore((s) => s.members);
  const invitations = useAccessStore((s) => s.invitations);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const emailId = useId();

  const normalized = email.trim().toLowerCase();
  const pendingForEmail = invitations.some((i) => i.email.toLowerCase() === normalized);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!EMAIL_RE.test(normalized)) {
      setError('Enter a valid email address.');
      return;
    }
    const existing = members.find((m) => m.email.toLowerCase() === normalized);
    if (existing) {
      setError(
        existing.status === 'left'
          ? `${existing.name} has left this workspace. To restore access, set their status back to Active in the members list.`
          : `${existing.name} is already a member of this workspace.`
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const link = await inviteMember(normalized, role);
      setCreated({ email: normalized, role, link });
      setEmail('');
      toast.success('Invitation created');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      title="Invite people"
      description="Send a personal invitation link. They'll join with the role you choose."
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field
          label="Email address"
          htmlFor={emailId}
          error={error}
          hint={
            pendingForEmail
              ? 'This person already has a pending invitation. Sending a new one replaces it.'
              : 'Tip: use their Google address so they can simply "Continue with Google".'
          }
        >
          <input
            id={emailId}
            type="email"
            autoComplete="off"
            spellCheck={false}
            className={`input max-w-md ${error ? 'input-error' : ''}`}
            placeholder="name@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            disabled={busy}
          />
        </Field>
        <RolePicker value={role} onChange={setRole} disabled={busy} />
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy || !email.trim()}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Create invitation
          </button>
          <p className="text-xs text-slate-500">Links expire after {INVITE_VALID_DAYS} days.</p>
        </div>
      </form>

      {created && (
        <div className="mt-5 animate-slide-up">
          <InvitationLinkPanel invite={created} />
          <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => setCreated(null)}>
            <X size={14} /> Dismiss
          </button>
        </div>
      )}
    </SettingsCard>
  );
};

// ─── 2. Invite code ───────────────────────────────────────────

const InviteCodeCard: React.FC = () => {
  const joinCode = useAccessStore((s) => s.joinCode);
  const enabled = useAccessStore((s) => s.joinCodeEnabled);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [toggling, setToggling] = useState(false);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      await regenerateJoinCode();
      toast.success('New invite code generated. The old code no longer works.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRegenerating(false);
    }
  };

  const toggle = async (next: boolean) => {
    setToggling(true);
    try {
      await setJoinCodeEnabled(next);
      toast.success(next ? 'Invite code enabled' : 'Invite code disabled');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setToggling(false);
    }
  };

  return (
    <SettingsCard
      title="Invite code"
      description="Anyone with this code can ask to join. They're only let in after an administrator approves the request."
      actions={
        <label className="flex items-center gap-2.5 text-[13px] font-medium text-slate-700">
          {toggling && <Loader2 size={14} className="animate-spin text-slate-400" />}
          {enabled ? 'Enabled' : 'Disabled'}
          <Switch checked={enabled} onChange={(v) => void toggle(v)} disabled={toggling} label="Allow join requests with the invite code" />
        </label>
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className={`flex min-h-[64px] flex-1 items-center justify-center rounded-xl border border-dashed px-4 py-3 ${
            enabled ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-slate-50/50'
          }`}
        >
          {joinCode ? (
            <span
              className={`select-all break-all text-center font-mono text-2xl font-semibold tracking-[0.18em] ${
                enabled ? 'text-slate-900' : 'text-slate-400 line-through decoration-slate-300'
              }`}
              aria-label={`Invite code ${joinCode.split('').join(' ')}`}
            >
              {joinCode}
            </span>
          ) : (
            <span className="text-[13px] text-slate-500">No invite code yet</span>
          )}
        </div>
        <div className="flex gap-2 sm:flex-col">
          {joinCode && <CopyButton text={joinCode} label="Copy code" className="btn-secondary flex-1" />}
          <button type="button" className="btn-secondary flex-1" onClick={() => (joinCode ? setConfirmOpen(true) : void regenerate())} disabled={regenerating}>
            {regenerating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {joinCode ? 'Generate new code' : 'Generate code'}
          </button>
        </div>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <KeyRound size={14} className="mt-px flex-shrink-0 text-slate-400" />
        {enabled
          ? 'Share it in your team chat. New people enter it after signing in, then wait for approval below.'
          : 'The code is turned off. Nobody can send new join requests until you enable it again.'}
      </p>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        variant="primary"
        title="Generate a new invite code?"
        message="The current code stops working immediately. Anyone you've shared it with will need the new one."
        confirmLabel="Generate new code"
        onConfirm={() => void regenerate()}
      />
    </SettingsCard>
  );
};

// ─── 3. Join requests ─────────────────────────────────────────

const JoinRequestsCard: React.FC = () => {
  const requests = useAccessStore((s) => s.joinRequests);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [busy, setBusy] = useState<{ id: string; approve: boolean } | null>(null);

  const decide = async (id: string, name: string, approve: boolean) => {
    const role = roles[id] ?? 'viewer';
    setBusy({ id, approve });
    try {
      await decideJoinRequest(id, approve, role, name);
      toast.success(approve ? `${name} joined as ${ROLE_META[role].label}` : `Declined ${name}'s request`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsCard
      title="Join requests"
      description="People who used the invite code and are waiting for approval."
      actions={<CountBadge count={requests.length} label="pending" />}
    >
      {requests.length === 0 ? (
        <InlineEmpty icon={Inbox} title="No pending requests" text="When someone uses your invite code, their request appears here." />
      ) : (
        <ul className="-my-1 divide-y divide-slate-100">
          {requests.map((r) => {
            const rowBusy = busy?.id === r.id;
            return (
              <li key={r.id} className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 md:flex-row md:items-start">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <PersonAvatar name={r.name} url={r.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-900">{r.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {r.email} · <time dateTime={r.createdAt} title={formatDate(r.createdAt, 'dd MMM yyyy, HH:mm')}>requested {relativeTime(r.createdAt)}</time>
                    </p>
                    {r.message && (
                      <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200/70">
                        “{r.message}”
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:pl-4">
                  <select
                    className="select h-8 w-32 text-xs"
                    aria-label={`Role for ${r.name}`}
                    value={roles[r.id] ?? 'viewer'}
                    onChange={(e) => setRoles((s) => ({ ...s, [r.id]: e.target.value as Role }))}
                    disabled={rowBusy}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_META[role].label}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn-primary btn-sm" disabled={rowBusy} onClick={() => void decide(r.id, r.name, true)}>
                    {rowBusy && busy?.approve ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
                  </button>
                  <button type="button" className="btn-secondary btn-sm" disabled={rowBusy} onClick={() => void decide(r.id, r.name, false)}>
                    {rowBusy && !busy?.approve ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Decline
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SettingsCard>
  );
};

// ─── 4. Pending invitations ───────────────────────────────────

const expiresSoon = (iso: string) => new Date(iso).getTime() - Date.now() < 24 * 60 * 60 * 1000;

const PendingInvitationsCard: React.FC = () => {
  const invitations = useAccessStore((s) => s.invitations);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [resent, setResent] = useState<CreatedInvite | null>(null);

  const resend = async (inv: Invitation) => {
    setBusyId(inv.id);
    try {
      const link = await inviteMember(inv.email, inv.role);
      setResent({ email: inv.email, role: inv.role, link });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (inv: Invitation) => {
    setBusyId(inv.id);
    try {
      await revokeInvitation(inv.id, inv.email);
      toast.success(`Invitation for ${inv.email} revoked`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SettingsCard
      title="Pending invitations"
      description="Invitations that haven't been accepted yet. Links are stored securely and can't be shown again, so resend to get a fresh one."
      actions={<CountBadge count={invitations.length} label="pending" />}
    >
      {invitations.length === 0 ? (
        <InlineEmpty icon={MailPlus} title="No pending invitations" text="Invitations you send appear here until they're accepted." />
      ) : (
        <ul className="-my-1 divide-y divide-slate-100">
          {invitations.map((inv) => {
            const rowBusy = busyId === inv.id;
            const soon = expiresSoon(inv.expiresAt);
            return (
              <li key={inv.id} className="flex flex-col gap-3 py-3.5 first:pt-1 last:pb-1 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Mail size={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13px] font-medium text-slate-900">{inv.email}</p>
                      <RoleBadge role={inv.role} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {inv.invitedByName ? `Invited by ${inv.invitedByName}` : 'Invited'} {relativeTime(inv.createdAt)} ·{' '}
                      <time
                        dateTime={inv.expiresAt}
                        title={formatDate(inv.expiresAt, 'dd MMM yyyy, HH:mm')}
                        className={soon ? 'font-medium text-amber-700' : undefined}
                      >
                        expires {relativeTime(inv.expiresAt)}
                      </time>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pl-11 sm:pl-0">
                  <button type="button" className="btn-secondary btn-sm" disabled={rowBusy} onClick={() => void resend(inv)}>
                    {rowBusy ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />} Resend
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    disabled={rowBusy}
                    onClick={() => setRevoking(inv)}
                  >
                    Revoke
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        isOpen={!!revoking}
        onClose={() => setRevoking(null)}
        title="Revoke this invitation?"
        message={`The link sent to ${revoking?.email ?? ''} will stop working. You can invite them again at any time.`}
        confirmLabel="Revoke invitation"
        onConfirm={() => {
          if (revoking) void revoke(revoking);
        }}
      />
      <Modal
        isOpen={!!resent}
        onClose={() => setResent(null)}
        title="New invitation link"
        description="The previous link for this person no longer works."
        size="lg"
      >
        {resent && <InvitationLinkPanel invite={resent} />}
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-secondary" onClick={() => setResent(null)}>
            Done
          </button>
        </div>
      </Modal>
    </SettingsCard>
  );
};

// ─── 5. Members ───────────────────────────────────────────────

type PendingAction =
  | { kind: 'promote'; member: TeamMember }
  | { kind: 'left'; member: TeamMember }
  | { kind: 'remove'; member: TeamMember };

const statusOrder: Record<EmploymentStatus, number> = { active: 0, on_leave: 1, left: 2 };

const MembersCard: React.FC = () => {
  const navigate = useNavigate();
  const meId = useSession((s) => s.user?.id);
  const canManage = useCan('users.manage');
  const members = useAccessStore((s) => s.members);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const sorted = useMemo(
    () =>
      [...members].sort(
        (a, b) => Number(b.id === meId) - Number(a.id === meId) || statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name)
      ),
    [members, meId]
  );
  const currentCount = members.filter((m) => m.status !== 'left').length;
  const admins = activeAdminCount(members);

  const run = async (member: TeamMember, fn: () => Promise<void>, success: string) => {
    setBusyId(member.id);
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = (m: TeamMember, role: Role) =>
    run(m, () => updateMember(m.id, { role }, m.name), `${m.name} is now ${ROLE_META[role].label === 'Administrator' ? 'an' : 'a'} ${ROLE_META[role].label}`);

  const changeStatus = (m: TeamMember, status: EmploymentStatus) =>
    run(
      m,
      () => updateMember(m.id, { status }, m.name),
      status === 'left' ? `${m.name} marked as left. Their access has been revoked.` : `${m.name} is now ${status === 'active' ? 'active' : 'on leave'}`
    );

  const confirmCopy = (p: PendingAction) => {
    const n = p.member.name;
    switch (p.kind) {
      case 'promote':
        return {
          title: `Make ${n} an administrator?`,
          message: `${n} will get full access, including inviting and removing people, company settings, backups and the activity log.`,
          confirmLabel: 'Make administrator',
          variant: 'primary' as const,
        };
      case 'left':
        return {
          title: `Mark ${n} as left?`,
          message: `${n} loses access to this workspace immediately. Their profile stays in the People directory as a former team member, and you can restore them later.`,
          confirmLabel: 'Mark as left',
          variant: 'danger' as const,
        };
      case 'remove':
        return {
          title: `Remove ${n} from the workspace?`,
          message: `${n} loses access immediately and is removed from the People directory. Documents they created are kept. To bring them back, you'll need to invite them again.`,
          confirmLabel: 'Remove',
          variant: 'danger' as const,
        };
    }
  };
  const copy = pending ? confirmCopy(pending) : null;

  return (
    <SettingsCard
      title="Members"
      description={`${currentCount} ${currentCount === 1 ? 'person has' : 'people have'} access · ${admins} administrator${admins === 1 ? '' : 's'}`}
      actions={
        <Link to="/people" className="btn-secondary btn-sm">
          <Eye size={14} /> People directory
        </Link>
      }
    >
      <div className="-mx-6 -my-5 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="!pl-6">Member</th>
              <th>Role</th>
              <th className="hidden sm:table-cell">Status</th>
              <th className="hidden md:table-cell">Last active</th>
              <th className="w-10 !pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const isMe = m.id === meId;
              const rowBusy = busyId === m.id;
              const actions: RowAction[] = [
                { label: 'View profile', icon: Eye, onClick: () => navigate(`/people?person=${encodeURIComponent(m.id)}`) },
                { label: 'Set as active', icon: UserCheck, onClick: () => void changeStatus(m, 'active'), hidden: !canManage || isMe || m.status === 'active' },
                { label: 'Set on leave', icon: Palmtree, onClick: () => void changeStatus(m, 'on_leave'), hidden: !canManage || isMe || m.status === 'on_leave' },
                { label: 'Mark as left', icon: UserX, onClick: () => setPending({ kind: 'left', member: m }), hidden: !canManage || isMe || m.status === 'left' },
                { label: 'Remove from workspace', icon: UserMinus, danger: true, onClick: () => setPending({ kind: 'remove', member: m }), hidden: !canManage || isMe },
              ];
              return (
                <tr key={m.id} className={m.status === 'left' ? 'bg-slate-50/50' : undefined}>
                  <td className="!pl-6">
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={m.name} url={m.avatarUrl} size="sm" className={m.status === 'left' ? 'opacity-60' : ''} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`max-w-[200px] truncate font-medium ${m.status === 'left' ? 'text-slate-500' : 'text-slate-900'}`}>{m.name}</p>
                          {isMe && <YouTag />}
                        </div>
                        <p className="max-w-[220px] truncate text-xs text-slate-500">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    {isMe || !canManage ? (
                      <RoleBadge role={m.role} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          className="select h-8 w-[136px] text-xs"
                          aria-label={`Role for ${m.name}`}
                          value={m.role}
                          disabled={rowBusy}
                          onChange={(e) => {
                            const role = e.target.value as Role;
                            if (role === 'admin') setPending({ kind: 'promote', member: m });
                            else void changeRole(m, role);
                          }}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_META[r].label}
                            </option>
                          ))}
                        </select>
                        {rowBusy && <Loader2 size={14} className="animate-spin text-slate-400" aria-label="Saving" />}
                      </div>
                    )}
                  </td>
                  <td className="hidden sm:table-cell">
                    <EmploymentBadge status={m.status} />
                  </td>
                  <td className="hidden whitespace-nowrap text-slate-600 md:table-cell">
                    {isMe ? (
                      'Active now'
                    ) : (
                      <span title={m.lastSeenAt ? formatDate(m.lastSeenAt, 'dd MMM yyyy, HH:mm') : undefined}>{lastActiveLabel(m.lastSeenAt)}</span>
                    )}
                  </td>
                  <td className="!pr-6 text-right">
                    <RowActions label={`Actions for ${m.name}`} actions={actions} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pending && copy && (
        <ConfirmModal
          isOpen
          onClose={() => setPending(null)}
          title={copy.title}
          message={copy.message}
          confirmLabel={copy.confirmLabel}
          variant={copy.variant}
          onConfirm={() => {
            const { kind, member } = pending;
            if (kind === 'promote') void changeRole(member, 'admin');
            else if (kind === 'left') void changeStatus(member, 'left');
            else void run(member, () => removeMember(member.id, member.name), `${member.name} was removed from the workspace`);
          }}
        />
      )}
    </SettingsCard>
  );
};

// ─── Danger zone ──────────────────────────────────────────────

const LeaveCard: React.FC = () => {
  const me = useSession((s) => s.user);
  const workspace = useSession((s) => s.workspace?.name) ?? 'this workspace';
  const members = useAccessStore((s) => s.members);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const lastAdmin = me?.role === 'admin' && activeAdminCount(members) <= 1;

  const leave = async () => {
    setLeaving(true);
    try {
      await leaveWorkspace();
    } catch (err) {
      toast.error(errorMessage(err));
      setLeaving(false);
    }
  };

  return (
    <SettingsCard tone="danger" title="Leave workspace" description={`Remove yourself from ${workspace}.`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-lg text-[13px] leading-relaxed text-slate-600">
          {lastAdmin
            ? "You're the only administrator. Make someone else an administrator before you leave, so the workspace can still be managed."
            : "You'll lose access to all documents and clients here straight away. An administrator will need to invite you again to rejoin."}
        </p>
        <button type="button" className="btn-danger flex-shrink-0" disabled={lastAdmin || leaving} onClick={() => setConfirmOpen(true)}>
          {leaving ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />} Leave workspace
        </button>
      </div>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Leave ${workspace}?`}
        message="You'll lose access immediately. This can't be undone without a new invitation."
        confirmLabel="Leave workspace"
        onConfirm={() => void leave()}
      />
    </SettingsCard>
  );
};

// ─── Page ─────────────────────────────────────────────────────

export const TeamSettings: React.FC = () => {
  const isAdmin = useCan('users.manage');
  const requestCount = useAccessStore((s) => s.joinRequests.length);
  const { hash } = useLocation();

  // Always show the latest queue when the page opens.
  useEffect(() => {
    void refreshJoinQueue();
  }, []);

  // Links like /settings/team#join-requests (from notifications) scroll to the queue.
  useEffect(() => {
    if (hash !== '#join-requests') return;
    const t = setTimeout(() => document.getElementById('join-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => clearTimeout(t);
  }, [hash, requestCount]);

  const requestsCard = isAdmin && (
    <div id="join-requests" className="scroll-mt-6">
      <JoinRequestsCard />
    </div>
  );

  return (
    <div className="space-y-6">
      {isAdmin && requestCount > 0 && (
        <button
          type="button"
          onClick={() => document.getElementById('join-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="flex w-full items-center gap-3 rounded-xl border border-primary-200 bg-primary-50/60 px-4 py-3 text-left text-[13px] text-primary-800 transition-colors hover:bg-primary-50"
        >
          <Link2 size={16} className="flex-shrink-0" />
          <span className="flex-1">
            <span className="font-medium">
              {requestCount} {requestCount === 1 ? 'person is' : 'people are'} waiting to join.
            </span>{' '}
            Review the request{requestCount === 1 ? '' : 's'} below.
          </span>
        </button>
      )}
      {requestCount > 0 && requestsCard}
      {isAdmin && <InviteCard />}
      {isAdmin && <InviteCodeCard />}
      {requestCount === 0 && requestsCard}
      {isAdmin && <PendingInvitationsCard />}
      <MembersCard />
      <LeaveCard />
    </div>
  );
};
