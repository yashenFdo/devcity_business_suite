import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, MailOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthLayout } from './AuthLayout';
import { SignInScreen } from './SignInScreen';
import { useSession } from '../../security/sessionState';
import { ROLE_META } from '../../security/permissions';
import { enterWorkspace, refreshMyWorkspaces, rememberInviteToken, signOut } from '../../security/session';
import { getInvitationPreview, rpc, type InvitationPreview } from '../../cloud/team';

const InviteCard: React.FC<{ preview: InvitationPreview }> = ({ preview }) => (
  <div className="flex gap-3 rounded-xl border border-primary-200 bg-primary-50/50 p-4">
    <MailOpen size={20} className="mt-0.5 flex-shrink-0 text-primary-600" />
    <p className="text-[13px] leading-relaxed text-slate-700">
      <span className="font-semibold text-slate-900">{preview.inviter_name}</span> invited{' '}
      <span className="font-medium text-slate-900">{preview.email}</span> to join{' '}
      <span className="font-semibold text-slate-900">{preview.workspace_name}</span> as {ROLE_META[preview.role].label.toLowerCase()}.
    </p>
  </div>
);

/** /invite/:token — preview the invitation, sign in or sign up, then join. */
export const InviteScreen: React.FC<{ token: string }> = ({ token }) => {
  const navigate = useNavigate();
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const [preview, setPreview] = useState<InvitationPreview | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getInvitationPreview(token)
      .then((p) => alive && setPreview(p))
      .catch(() => alive && setPreview(null));
    return () => {
      alive = false;
    };
  }, [token]);

  const pending = preview?.status === 'pending';
  useEffect(() => {
    // Signed out: keep the token so it's accepted automatically right after sign-in / sign-up.
    if (!user && pending) rememberInviteToken(token);
  }, [user, pending, token]);

  const alreadyJoined = !!user && preview?.status === 'accepted';
  useEffect(() => {
    // Accepted automatically during sign-in: go straight into the workspace.
    if (alreadyJoined) navigate('/', { replace: true });
  }, [alreadyJoined, navigate]);

  if (preview === undefined) {
    return (
      <AuthLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-slate-300" size={24} />
        </div>
      </AuthLayout>
    );
  }

  if (!preview || preview.status !== 'pending') {
    const msg = !preview
      ? 'This invitation link is not valid.'
      : preview.status === 'expired'
        ? 'This invitation has expired.'
        : preview.status === 'accepted'
          ? 'This invitation has already been used.'
          : 'This invitation was withdrawn.';
    return (
      <AuthLayout>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-100">
          <AlertTriangle size={20} className="text-amber-600" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{msg}</h1>
        <p className="mt-2 text-sm text-slate-500">Ask an administrator of the workspace to send you a new invitation.</p>
        <button type="button" className="btn-secondary mt-8 w-full" onClick={() => navigate('/', { replace: true })}>
          Continue to DevCity
        </button>
      </AuthLayout>
    );
  }

  // Not signed in: remember the token, then sign in / sign up. It's accepted automatically afterwards.
  if (!user) {
    return <SignInScreen initialMode="signup" context={<InviteCard preview={preview} />} />;
  }

  const wrongAccount = user.email !== preview.email;

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      const wsId = await rpc<string>('accept_invitation', { p_token: token });
      await refreshMyWorkspaces();
      await enterWorkspace(wsId);
      toast.success(`Welcome to ${preview.workspace_name}!`);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept the invitation.');
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Join {preview.workspace_name}</h1>
      <p className="mt-1.5 text-sm text-slate-500">Signed in as {user.email}</p>
      <div className="mt-6">
        <InviteCard preview={preview} />
      </div>
      {wrongAccount ? (
        <div className="mt-6 space-y-3">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
            This invitation is for <b>{preview.email}</b>. Sign out and sign in with that email to accept it.
          </p>
          <button
            type="button"
            className="btn-primary btn-lg w-full"
            onClick={async () => {
              rememberInviteToken(token);
              await signOut();
            }}
          >
            Sign out & switch account
          </button>
        </div>
      ) : (
        <>
          {error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700">{error}</p>}
          <button type="button" className="btn-primary btn-lg mt-6 w-full" onClick={accept} disabled={busy || status === 'loading'}>
            {busy && <Loader2 size={16} className="animate-spin" />} Accept invitation
          </button>
        </>
      )}
      <button type="button" className="btn-ghost mt-3 w-full" onClick={() => navigate('/', { replace: true })}>
        Not now
      </button>
    </AuthLayout>
  );
};
