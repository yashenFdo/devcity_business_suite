import React, { useEffect, useState } from 'react';
import { ArrowRight, Building2, Clock, KeyRound, Loader2, LogOut, Mail, RefreshCw, UsersRound, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Logo } from '../../components/brand/Logo';
import { DevCityFooterCompact } from '../../components/brand/DevCityFooter';
import { Avatar } from '../../components/ui/Avatar';
import { useSession } from '../../security/sessionState';
import { ROLE_META } from '../../security/permissions';
import { acceptInvitationById, createWorkspace, enterWorkspace, refreshMyWorkspaces, signOut } from '../../security/session';
import { cancelJoinRequest, myInvitations, myJoinRequests, requestToJoin, type MyInvitation, type MyJoinRequest } from '../../cloud/team';
import { formatDate } from '../../utils/formatters';

const Panel: React.FC<{ icon: React.ElementType; title: string; text: string; children: React.ReactNode; tone: string }> = ({
  icon: Icon,
  title,
  text,
  children,
  tone,
}) => (
  <section className="card flex flex-col p-6">
    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
      <Icon size={20} />
    </span>
    <h2 className="mt-4 text-base font-semibold text-slate-900">{title}</h2>
    <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{text}</p>
    <div className="mt-5 flex-1">{children}</div>
  </section>
);

export const OnboardingScreen: React.FC = () => {
  const user = useSession((s) => s.user)!;
  const workspaces = useSession((s) => s.workspaces);
  const [invites, setInvites] = useState<MyInvitation[]>([]);
  const [requests, setRequests] = useState<MyJoinRequest[]>([]);
  const [wsName, setWsName] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([myInvitations(), myJoinRequests(), refreshMyWorkspaces()])
      .then(([inv, req]) => {
        if (!alive) return;
        setInvites(inv);
        setRequests(req);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not load your invitations.'))
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const load = () => setReloadKey((k) => k + 1);

  // While a join request is pending, check every 20 seconds for approval.
  const hasPending = requests.some((r) => r.status === 'pending');
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(() => setReloadKey((k) => k + 1), 20_000);
    return () => clearInterval(t);
  }, [hasPending]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const first = user.name.split(' ')[0];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white px-6">
        <Logo />
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-[13px] font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <Avatar name={user.name} />
          <button type="button" className="btn-ghost btn-sm" onClick={() => void signOut()}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 animate-slide-up">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
          {workspaces.length ? 'Your workspaces' : `Welcome, ${first}!`}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {workspaces.length
            ? 'Open a workspace, create a new one, or join your team.'
            : 'Create a workspace for your company, or join one your team already uses.'}
        </p>

        {workspaces.length > 0 && (
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {workspaces.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => void run(`open-${w.id}`, () => enterWorkspace(w.id))}
                className="card card-hover flex items-center gap-4 p-4 text-left"
              >
                <Avatar name={w.name} size="md" className="rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{w.name}</span>
                  <span className="text-xs text-slate-500">{ROLE_META[w.role].label}</span>
                </span>
                {busy === `open-${w.id}` ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <ArrowRight size={16} className="text-slate-400" />}
              </button>
            ))}
          </div>
        )}

        {invites.length > 0 && (
          <section className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Invitations for you</h2>
            {invites.map((inv) => (
              <div key={inv.id} className="card flex flex-col gap-4 border-primary-200 bg-primary-50/40 p-4 sm:flex-row sm:items-center">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 ring-1 ring-primary-100">
                  <Mail size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900">
                    <span className="font-semibold">{inv.inviter_name}</span> invited you to <span className="font-semibold">{inv.workspace_name}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    As {ROLE_META[inv.role].label} · {formatDate(inv.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!!busy}
                  onClick={() =>
                    void run(`inv-${inv.id}`, async () => {
                      await acceptInvitationById(inv.id);
                      toast.success(`Welcome to ${inv.workspace_name}!`);
                    })
                  }
                >
                  {busy === `inv-${inv.id}` && <Loader2 size={15} className="animate-spin" />} Accept & join
                </button>
              </div>
            ))}
          </section>
        )}

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Panel
            icon={Building2}
            tone="bg-primary-50 text-primary-600"
            title="Create a workspace"
            text="For your company or team. You'll be the administrator and can invite colleagues."
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (wsName.trim().length < 2) return toast.error('Enter your company or team name.');
                void run('create', async () => {
                  await createWorkspace(wsName);
                  toast.success(`${wsName.trim()} is ready`);
                });
              }}
              className="space-y-3"
            >
              <label htmlFor="ws-name" className="label">
                Company or team name
              </label>
              <input id="ws-name" className="input h-10" placeholder="e.g. DevCity" maxLength={80} value={wsName} onChange={(e) => setWsName(e.target.value)} />
              <button type="submit" className="btn-primary w-full" disabled={!!busy}>
                {busy === 'create' && <Loader2 size={15} className="animate-spin" />} Create workspace
              </button>
            </form>
          </Panel>

          <Panel
            icon={KeyRound}
            tone="bg-violet-50 text-violet-600"
            title="Join with an invite code"
            text="Ask an administrator for your company's code. They'll approve your request."
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim().length < 6) return toast.error('Enter the invite code.');
                void run('join', async () => {
                  const name = await requestToJoin(code, message);
                  toast.success(`Request sent to ${name}. You'll get access once an admin approves it.`);
                  setCode('');
                  setMessage('');
                  load();
                });
              }}
              className="space-y-3"
            >
              <label htmlFor="join-code" className="label">
                Invite code
              </label>
              <input
                id="join-code"
                className="input h-10 font-mono uppercase tracking-wider"
                placeholder="DEV-XXXXX-XXXXX"
                autoComplete="off"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <input
                className="input"
                placeholder="Optional note, e.g. “New QA engineer”"
                maxLength={300}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button type="submit" className="btn-dark w-full" disabled={!!busy}>
                {busy === 'join' && <Loader2 size={15} className="animate-spin" />} Request to join
              </button>
            </form>
          </Panel>
        </div>

        {requests.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Your join requests</h2>
              <button
                type="button"
                className="btn-ghost btn-sm"
                disabled={checking}
                onClick={() => {
                  setChecking(true);
                  load();
                }}
              >
                <RefreshCw size={14} className={checking ? 'animate-spin' : ''} /> Check again
              </button>
            </div>
            <div className="card divide-y divide-slate-100">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  {r.status === 'pending' ? <Clock size={17} className="text-amber-500" /> : <XCircle size={17} className="text-rose-500" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-900">{r.workspace_name}</p>
                    <p className="text-xs text-slate-500">
                      {r.status === 'pending' ? 'Waiting for an administrator to approve' : 'Declined by an administrator'} · {formatDate(r.created_at)}
                    </p>
                  </div>
                  {r.status === 'pending' && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() =>
                        void run(`cancel-${r.id}`, async () => {
                          await cancelJoinRequest(r.id);
                          load();
                        })
                      }
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-400">
          <UsersRound size={14} /> Got an email invitation? Open its link and it joins you automatically.
        </p>
        <div className="mt-12">
          <DevCityFooterCompact />
        </div>
      </main>
    </div>
  );
};
