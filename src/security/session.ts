// ============================================================
// Authentication & workspace session (Supabase)
// ============================================================
import type { User } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { friendlyError, supabase, supabaseConfigured } from '../cloud/supabase';
import { flushSync, loadAllRecords, resetAllCollections, subscribeWorkspace, unsubscribeWorkspace } from '../cloud/sync';
import { loadAdminData, loadMembers, rpc } from '../cloud/team';
import { useSession, type WorkspaceSummary } from './sessionState';
import type { Role } from './permissions';
import { useCompanyStore, companyFromWorkspace } from '../store/useCompanyStore';
import { DEFAULT_POLICY, useAccessStore, type SecurityPolicy } from '../store/useAccessStore';
import { loadAuditLog, logAudit, useAuditStore } from '../store/useAuditStore';

const ACTIVE_WS_KEY = 'devcity-active-workspace';
const LAST_EMAIL_KEY = 'devcity-last-email';
const INVITE_KEY = 'devcity-pending-invite';

// ─── Helpers ──────────────────────────────────────────────────
export const getLastEmail = () => localStorage.getItem(LAST_EMAIL_KEY) ?? '';
export const rememberInviteToken = (token: string) => sessionStorage.setItem(INVITE_KEY, token);
const takeInviteToken = () => {
  const t = sessionStorage.getItem(INVITE_KEY);
  sessionStorage.removeItem(INVITE_KEY);
  return t;
};

const profileOf = (u: User) => ({
  id: u.id,
  email: (u.email ?? '').toLowerCase(),
  name: String(u.user_metadata?.full_name || u.user_metadata?.name || (u.email ?? '').split('@')[0]),
  avatarUrl: (u.user_metadata?.avatar_url as string | undefined) ?? undefined,
});

const resetWorkspaceState = () => {
  unsubscribeWorkspace();
  resetAllCollections();
  useCompanyStore.setState(useCompanyStore.getInitialState(), true);
  useAccessStore.setState(useAccessStore.getInitialState(), true);
  useAuditStore.setState(useAuditStore.getInitialState(), true);
};

// ─── Workspaces ───────────────────────────────────────────────
export const fetchMyWorkspaces = async (userId: string): Promise<WorkspaceSummary[]> => {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, employment_status, workspace:workspaces(id, name)')
    .eq('user_id', userId)
    .neq('employment_status', 'left');
  if (error) throw new Error(friendlyError(error));
  type Row = { role: Role; workspace: { id: string; name: string } | null };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.workspace)
    .map((r) => ({ id: r.workspace!.id, name: r.workspace!.name, role: r.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const loadWorkspaceRow = async (wsId: string) => {
  const { data, error } = await supabase.from('workspaces').select('id, name, company, policy').eq('id', wsId).single();
  if (error) throw new Error(friendlyError(error));
  useCompanyStore.setState({ company: companyFromWorkspace(data.name, data.company) });
  useAccessStore.setState({ policy: { ...DEFAULT_POLICY, ...(data.policy as Partial<SecurityPolicy>) } });
  return data as { id: string; name: string };
};

const leaveToOnboarding = async (notice?: string) => {
  const s = useSession.getState();
  resetWorkspaceState();
  localStorage.removeItem(ACTIVE_WS_KEY);
  const workspaces = s.user ? await fetchMyWorkspaces(s.user.id).catch(() => []) : [];
  useSession.setState({ status: 'onboarding', workspace: null, workspaces });
  if (notice) toast.error(notice);
};

/** Membership changed in realtime: refresh the directory and my own role. */
const onMembersChanged = async () => {
  const s = useSession.getState();
  if (!s.user || !s.workspace) return;
  const members = await loadMembers().catch(() => null);
  if (!members) return;
  const me = members.find((m) => m.id === s.user!.id);
  if (!me || me.status === 'left') {
    await leaveToOnboarding('Your access to this workspace was removed.');
    return;
  }
  if (me.role !== s.user.role) {
    useSession.setState({ user: { ...s.user, role: me.role } });
    toast(`Your role is now ${me.role}.`, { icon: 'ℹ️' });
  }
  if (me.role === 'admin') await loadAdminData().catch(() => undefined);
};

/** Admins: reload the join queue; announce brand-new requests. */
export const refreshJoinQueue = async (announce = false) => {
  if (useSession.getState().user?.role !== 'admin') return;
  const before = new Set(useAccessStore.getState().joinRequests.map((r) => r.id));
  await loadAdminData().catch(() => undefined);
  if (!announce) return;
  const fresh = useAccessStore.getState().joinRequests.filter((r) => !before.has(r.id));
  for (const r of fresh) {
    toast(`${r.name} wants to join. Review in Settings → Team & access.`, { icon: '👋', duration: 8000 });
  }
};

export const enterWorkspace = async (wsId: string) => {
  const s = useSession.getState();
  if (!s.user) return;
  const summary = s.workspaces.find((w) => w.id === wsId);
  if (!summary) throw new Error('You are not a member of this workspace.');
  await flushSync();
  resetWorkspaceState();
  useSession.setState({
    status: 'loading',
    workspace: { id: summary.id, name: summary.name },
    user: { ...s.user, role: summary.role },
  });
  try {
    const [row] = await Promise.all([loadWorkspaceRow(wsId), loadMembers(wsId), loadAllRecords(wsId)]);
    if (summary.role === 'admin') await Promise.all([loadAdminData(wsId), loadAuditLog(wsId)]);
    localStorage.setItem(ACTIVE_WS_KEY, wsId);
    subscribeWorkspace(wsId, {
      onMembersChanged: () => void onMembersChanged(),
      onWorkspaceChanged: () => void loadWorkspaceRow(wsId).catch(() => undefined),
      onJoinRequestsChanged: (isNew) => void refreshJoinQueue(isNew),
    });
    void supabase.rpc('touch_last_seen', { p_workspace: wsId });
    useSession.setState({ status: 'ready', workspace: { id: row.id, name: row.name } });
    const marker = `devcity-signin-logged:${s.user.id}:${wsId}`;
    if (!sessionStorage.getItem(marker)) {
      sessionStorage.setItem(marker, '1');
      logAudit('auth', 'Signed in');
    }
  } catch (err) {
    await leaveToOnboarding(friendlyError(err, 'Could not open the workspace.'));
  }
};

/** After sign-in: accept a pending invite link, then open the last-used workspace (or onboarding). */
const bootstrap = async (u: User) => {
  const profile = profileOf(u);
  localStorage.setItem(LAST_EMAIL_KEY, profile.email);
  useSession.setState({ status: 'loading', user: { ...profile, role: 'viewer' } });

  let preferred = localStorage.getItem(ACTIVE_WS_KEY);
  const token = takeInviteToken();
  let inviteError: string | null = null;
  if (token) {
    try {
      preferred = await rpc<string>('accept_invitation', { p_token: token });
      toast.success('Invitation accepted. Welcome aboard!');
    } catch (e) {
      inviteError = e instanceof Error ? e.message : 'Could not accept the invitation.';
    }
  }

  try {
    const workspaces = await fetchMyWorkspaces(u.id);
    useSession.setState({ workspaces });
    if (inviteError) toast.error(inviteError);
    const target = workspaces.find((w) => w.id === preferred) ?? (workspaces.length === 1 ? workspaces[0] : undefined);
    if (target) await enterWorkspace(target.id);
    else useSession.setState({ status: 'onboarding' });
  } catch (err) {
    useSession.setState({ status: 'onboarding' });
    toast.error(friendlyError(err));
  }
};

/**
 * OAuth / email-link failures come back as ?error_description=… (or in the #hash).
 * Show them instead of silently landing on the sign-in screen, then tidy the address bar.
 */
const reportAuthErrorFromUrl = () => {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const description = query.get('error_description') ?? hash.get('error_description');
  if (!description && !query.get('error') && !hash.get('error')) return;
  window.history.replaceState(null, '', window.location.pathname);
  const text = (description ?? '').replace(/\+/g, ' ');
  const message = /exchange external code/i.test(text)
    ? 'Google sign-in failed: the Google client secret configured in Supabase is not valid. An administrator needs to update it under Authentication → Providers → Google.'
    : /expired|invalid/i.test(text) && /link|otp|token/i.test(text)
      ? 'That sign-in link has expired or was already used. Please request a new one.'
      : /access_denied|cancel/i.test(text + (query.get('error') ?? ''))
        ? 'Sign-in was cancelled.'
        : `Sign-in failed: ${text || 'unknown error'}`;
  toast.error(message, { duration: 10_000 });
};

let started = false;
let bootedFor: string | null = null;

export const initSession = async () => {
  if (started) return;
  started = true;
  if (!supabaseConfigured()) {
    useSession.setState({ status: 'unconfigured' });
    return;
  }
  reportAuthErrorFromUrl();
  supabase.auth.onAuthStateChange((event, session) => {
    // Deferred: supabase-js recommends not awaiting other Supabase calls inside this callback.
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') {
        bootedFor = session?.user.id ?? null;
        useSession.setState({ status: 'recovery' });
        return;
      }
      if (event === 'SIGNED_OUT' || !session) {
        bootedFor = null;
        resetWorkspaceState();
        useSession.setState({ status: 'signedOut', user: null, workspace: null, workspaces: [] });
        return;
      }
      if (event === 'USER_UPDATED') {
        const s = useSession.getState();
        if (s.user) useSession.setState({ user: { ...s.user, ...profileOf(session.user), role: s.user.role } });
        return;
      }
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && bootedFor !== session.user.id) {
        bootedFor = session.user.id;
        void bootstrap(session.user);
      }
    }, 0);
  });
};

// ─── Auth actions ─────────────────────────────────────────────
export type AuthResult = { ok: true; message?: string } | { ok: false; error: string };

export const signInWithEmail = async (email: string, password: string): Promise<AuthResult> => {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  return error ? { ok: false, error: friendlyError(error) } : { ok: true };
};

export const signUpWithEmail = async (name: string, email: string, password: string): Promise<AuthResult> => {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin },
  });
  if (error) return { ok: false, error: friendlyError(error) };
  if (!data.session) {
    return { ok: true, message: `We sent a confirmation link to ${email.trim()}. Open it to activate your account.` };
  }
  return { ok: true };
};

export const signInWithGoogle = async (): Promise<AuthResult> => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
  });
  return error ? { ok: false, error: friendlyError(error) } : { ok: true };
};

export const sendPasswordReset = async (email: string): Promise<AuthResult> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/`,
  });
  return error ? { ok: false, error: friendlyError(error) } : { ok: true };
};

export const updatePassword = async (password: string): Promise<AuthResult> => {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: friendlyError(error) };
  logAudit('security', 'Changed password');
  return { ok: true };
};

export const updateMyName = async (name: string): Promise<AuthResult> => {
  const s = useSession.getState();
  if (!s.user) return { ok: false, error: 'Not signed in' };
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.auth.updateUser({ data: { full_name: name.trim() } }),
    supabase.from('profiles').update({ full_name: name.trim() }).eq('id', s.user.id),
  ]);
  if (e1 || e2) return { ok: false, error: friendlyError(e1 ?? e2) };
  useSession.setState({ user: { ...s.user, name: name.trim() } });
  await loadMembers().catch(() => undefined);
  return { ok: true };
};

/** Password reset finished: continue into the app. */
export const finishRecovery = async () => {
  const { data } = await supabase.auth.getUser();
  if (data.user) await bootstrap(data.user);
};

export const signOut = async (reason: 'manual' | 'idle' | 'hidden' = 'manual') => {
  if (useSession.getState().status === 'ready') {
    logAudit(
      'auth',
      reason === 'idle' ? 'Signed out after inactivity' : reason === 'hidden' ? 'Signed out (tab hidden)' : 'Signed out'
    );
    await flushSync();
  }
  await supabase.auth.signOut({ scope: 'local' });
};

/** Lock button & idle timer: ends the session; signing in again resumes where you were. */
export const lockWorkspace = (reason: 'manual' | 'idle' | 'hidden' = 'manual') => signOut(reason);

// ─── Workspace actions ────────────────────────────────────────
export const createWorkspace = async (name: string) => {
  const s = useSession.getState();
  if (!s.user) throw new Error('Not signed in');
  const id = await rpc<string>('create_workspace', {
    p_name: name.trim(),
    p_company: { name: name.trim(), email: s.user.email },
  });
  useSession.setState({ workspaces: await fetchMyWorkspaces(s.user.id) });
  await enterWorkspace(id);
  logAudit('settings', 'Created workspace', name.trim());
};

export const switchWorkspace = (id: string) => enterWorkspace(id);

export const openOnboarding = async () => {
  await flushSync();
  await leaveToOnboarding();
};

export const acceptInvitationById = async (id: string) => {
  const s = useSession.getState();
  if (!s.user) return;
  const wsId = await rpc<string>('accept_invitation_by_id', { p_invitation: id });
  useSession.setState({ workspaces: await fetchMyWorkspaces(s.user.id) });
  await enterWorkspace(wsId);
  logAudit('team', 'Joined the workspace');
};

export const refreshMyWorkspaces = async () => {
  const s = useSession.getState();
  if (!s.user) return [];
  const workspaces = await fetchMyWorkspaces(s.user.id);
  useSession.setState({ workspaces });
  return workspaces;
};

export const leaveWorkspace = async () => {
  const s = useSession.getState();
  if (!s.user || !s.workspace) return;
  logAudit('team', 'Left the workspace');
  await flushSync();
  await rpc('remove_member', { p_workspace: s.workspace.id, p_user: s.user.id });
  await leaveToOnboarding();
};

export const updateSecurityPolicy = async (patch: Partial<SecurityPolicy>) => {
  const ws = useSession.getState().workspace;
  if (!ws) return;
  const policy = { ...useAccessStore.getState().policy, ...patch };
  const { error } = await supabase.from('workspaces').update({ policy }).eq('id', ws.id);
  if (error) throw new Error(friendlyError(error));
  useAccessStore.setState({ policy });
  logAudit('security', `Updated session policy (sign out after ${policy.autoLockMinutes} min idle)`);
};
