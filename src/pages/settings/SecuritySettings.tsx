import React, { useState } from 'react';
import { Download, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSession, useCan } from '../../security/sessionState';
import { ROLE_META } from '../../security/permissions';
import { assessPassword } from '../../security/passwordPolicy';
import { signOut, updateMyName, updatePassword, updateSecurityPolicy } from '../../security/session';
import { useAccessStore } from '../../store/useAccessStore';
import { useQuotationsStore } from '../../store/useQuotationsStore';
import { useInvoicesStore } from '../../store/useInvoicesStore';
import { useReceiptsStore } from '../../store/useReceiptsStore';
import { useBillsStore } from '../../store/useBillsStore';
import { useCustomersStore } from '../../store/useCustomersStore';
import { useCompanyStore } from '../../store/useCompanyStore';
import { logAudit } from '../../store/useAuditStore';
import { Avatar } from '../../components/ui/Avatar';
import { Field } from '../../components/documents/editor/FormSection';
import { PasswordInput, PasswordStrength } from '../../components/ui/PasswordField';
import { SettingsCard } from './SettingsPrimitives';
import { PasskeysCard } from './PasskeysCard';

const ProfileCard: React.FC = () => {
  const user = useSession((s) => s.user)!;
  const workspace = useSession((s) => s.workspace);
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== user.name && name.trim().length > 1;

  return (
    <SettingsCard
      title="Your profile"
      description={`How colleagues see you in ${workspace?.name ?? 'the workspace'}.`}
      actions={
        <button type="button" className="btn-secondary" onClick={() => void signOut()}>
          <LogOut size={15} /> Sign out
        </button>
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar name={user.name} size="lg" />
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <div className="flex gap-2">
              <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              {dirty && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const r = await updateMyName(name);
                    setBusy(false);
                    if (r.ok === false) toast.error(r.error);
                    else toast.success('Name updated');
                  }}
                >
                  {busy && <Loader2 size={14} className="animate-spin" />} Save
                </button>
              )}
            </div>
          </Field>
          <Field label="Email">
            <input className="input" value={user.email} disabled />
          </Field>
          <Field label="Role in this workspace">
            <span className={`badge ${ROLE_META[user.role].tone}`}>{ROLE_META[user.role].label}</span>
          </Field>
        </div>
      </div>
    </SettingsCard>
  );
};

const PasswordCard: React.FC = () => {
  const user = useSession((s) => s.user)!;
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = assessPassword(next, [user.name, user.email]).valid && next === confirm;

  return (
    <SettingsCard
      title="Password"
      description="Set or change the password for email sign-in. If you use Google, this adds email sign-in as a backup."
    >
      <form
        className="max-w-md space-y-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid || busy) return;
          setBusy(true);
          const r = await updatePassword(next);
          setBusy(false);
          if (r.ok === false) return toast.error(r.error);
          setNext('');
          setConfirm('');
          toast.success('Password updated');
        }}
      >
        <input type="email" autoComplete="username" value={user.email} readOnly hidden />
        <div>
          <PasswordInput label="New password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <PasswordStrength password={next} personal={[user.name, user.email]} />
        </div>
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirm && confirm !== next ? "Passwords don't match." : ''}
        />
        <button type="submit" className="btn-primary" disabled={!valid || busy}>
          {busy && <Loader2 size={15} className="animate-spin" />} Update password
        </button>
      </form>
    </SettingsCard>
  );
};

const PolicyCard: React.FC = () => {
  const policy = useAccessStore((s) => s.policy);
  const apply = async (patch: Parameters<typeof updateSecurityPolicy>[0]) => {
    try {
      await updateSecurityPolicy(patch);
      toast.success('Session policy updated for everyone');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the policy');
    }
  };
  return (
    <SettingsCard title="Session policy" description="Applies to everyone in this workspace.">
      <div className="divide-y divide-slate-100">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-900">Sign out after inactivity</p>
            <p className="text-xs text-slate-500">People get a 60-second warning first.</p>
          </div>
          <select className="select w-44" value={policy.autoLockMinutes} onChange={(e) => void apply({ autoLockMinutes: Number(e.target.value) })}>
            {[15, 30, 60, 120, 240].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-900">Sign out when the tab is in the background</p>
            <p className="text-xs text-slate-500">Useful on shared or public computers.</p>
          </div>
          <select
            className="select w-44"
            value={policy.lockOnHiddenMinutes}
            onChange={(e) => void apply({ lockOnHiddenMinutes: Number(e.target.value) })}
          >
            <option value={0}>Off</option>
            {[5, 15, 30].map((m) => (
              <option key={m} value={m}>
                After {m} min
              </option>
            ))}
          </select>
        </div>
      </div>
    </SettingsCard>
  );
};

const ExportCard: React.FC = () => {
  const workspace = useSession((s) => s.workspace)!;
  const exportAll = () => {
    const payload = {
      format: 'devcity-workspace-export',
      version: 2,
      exportedAt: new Date().toISOString(),
      workspace,
      company: useCompanyStore.getState().company,
      quotations: useQuotationsStore.getState().quotations,
      invoices: useInvoicesStore.getState().invoices,
      receipts: useReceiptsStore.getState().receipts,
      bills: useBillsStore.getState().bills,
      clients: useCustomersStore.getState().customers,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workspace.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    logAudit('security', 'Exported all workspace data');
    toast.success('Export downloaded');
  };
  return (
    <SettingsCard
      title="Export data"
      description="Download every document, client and the company profile as JSON, for your own records or accounting."
    >
      <button type="button" className="btn-secondary" onClick={exportAll}>
        <Download size={15} /> Download workspace export
      </button>
    </SettingsCard>
  );
};

const PROTECTIONS = [
  ['Isolated workspaces', 'Row Level Security in the database: people can only read or change data in workspaces they belong to.'],
  ['Roles enforced on the server', 'Viewers can’t write, editors can’t delete, and only administrators manage people. The database checks every request.'],
  ['Encrypted connections & storage', 'All traffic uses HTTPS (TLS), and Supabase encrypts the database and backups at rest.'],
  ['Passkeys', 'Phishing-resistant sign-in with Windows Hello, Touch ID or your phone. The private key never leaves your device.'],
  ['Single-use invitations', 'Invite links expire after 7 days, work only for the invited email, and only a hash is stored.'],
  ['Approval for invite codes', 'Anyone using the invite code must be approved by an administrator before seeing anything.'],
  ['Tamper-proof activity log', 'Who did what, and when, stamped by the server. Nobody can edit or delete entries.'],
];

export const SecuritySettings: React.FC = () => {
  const isAdmin = useCan('users.manage');
  return (
    <div className="space-y-6">
      <ProfileCard />
      <PasskeysCard />
      <PasswordCard />
      {isAdmin && <PolicyCard />}
      {isAdmin && <ExportCard />}
      <SettingsCard title="How your data is protected">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PROTECTIONS.map(([title, text]) => (
            <li key={title} className="flex gap-3">
              <ShieldCheck size={17} className="mt-0.5 flex-shrink-0 text-emerald-600" />
              <div>
                <p className="text-[13px] font-medium text-slate-900">{title}</p>
                <p className="text-xs leading-relaxed text-slate-500">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </SettingsCard>
    </div>
  );
};
