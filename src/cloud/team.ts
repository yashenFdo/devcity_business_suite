// ============================================================
// Team & employee directory operations (Supabase RPCs).
// All permission checks are enforced again in the database.
// ============================================================
import { friendlyError, supabase } from './supabase';
import { currentWorkspaceId, useSession } from '../security/sessionState';
import type { Role } from '../security/permissions';
import { useAccessStore, type EmploymentStatus, type TeamMember } from '../store/useAccessStore';
import { logAudit } from '../store/useAuditStore';

const ws = () => {
  const id = currentWorkspaceId();
  if (!id) throw new Error('No workspace selected');
  return id;
};

/** Run an RPC and throw a friendly Error on failure. */
export const rpc = async <T>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(friendlyError(error));
  return data as T;
};

interface MemberRow {
  user_id: string;
  role: Role;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  start_date: string | null;
  employment_status: EmploymentStatus;
  joined_at: string;
  last_seen_at: string | null;
  profile: { full_name: string; email: string; avatar_url: string | null } | null;
}

export const loadMembers = async (workspaceId = ws()) => {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(
      'user_id, role, job_title, department, phone, start_date, employment_status, joined_at, last_seen_at, profile:profiles(full_name, email, avatar_url)'
    )
    .eq('workspace_id', workspaceId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(friendlyError(error));
  const members: TeamMember[] = ((data ?? []) as unknown as MemberRow[]).map((r) => ({
    id: r.user_id,
    name: r.profile?.full_name || r.profile?.email || 'Unknown',
    email: r.profile?.email ?? '',
    avatarUrl: r.profile?.avatar_url ?? undefined,
    role: r.role,
    jobTitle: r.job_title ?? undefined,
    department: r.department ?? undefined,
    phone: r.phone ?? undefined,
    startDate: r.start_date ?? undefined,
    status: r.employment_status,
    joinedAt: r.joined_at,
    lastSeenAt: r.last_seen_at ?? undefined,
  }));
  useAccessStore.setState({ members });
  return members;
};

/** Invitations, join requests and the invite code — administrators only. */
export const loadAdminData = async (workspaceId = ws()) => {
  const [inv, req, wsRow] = await Promise.all([
    supabase
      .from('workspace_invitations')
      .select('id, email, role, created_at, expires_at, inviter:profiles(full_name)')
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('join_requests')
      .select('id, user_id, message, created_at, requester:profiles(full_name, email, avatar_url)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase.from('workspaces').select('join_code, join_code_enabled').eq('id', workspaceId).single(),
  ]);
  if (inv.error || req.error || wsRow.error) throw new Error(friendlyError(inv.error ?? req.error ?? wsRow.error));
  type InvRow = { id: string; email: string; role: Role; created_at: string; expires_at: string; inviter: { full_name: string } | null };
  type ReqRow = {
    id: string;
    user_id: string;
    message: string | null;
    created_at: string;
    requester: { full_name: string; email: string; avatar_url: string | null } | null;
  };
  useAccessStore.setState({
    invitations: (inv.data as unknown as InvRow[]).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
      invitedByName: i.inviter?.full_name,
    })),
    joinRequests: (req.data as unknown as ReqRow[]).map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.requester?.full_name || r.requester?.email || 'Unknown',
      email: r.requester?.email ?? '',
      avatarUrl: r.requester?.avatar_url ?? undefined,
      message: r.message ?? undefined,
      createdAt: r.created_at,
    })),
    joinCode: wsRow.data?.join_code ?? null,
    joinCodeEnabled: wsRow.data?.join_code_enabled ?? true,
  });
};

const refresh = async () => {
  await loadMembers();
  if (useSession.getState().user?.role === 'admin') await loadAdminData();
};

export const inviteLink = (token: string) => `${window.location.origin}/invite/${token}`;

// ─── Invitations ──────────────────────────────────────────────
/** Creates an invitation and returns the link to share. */
export const inviteMember = async (email: string, role: Role): Promise<string> => {
  const token = await rpc<string>('invite_member', { p_workspace: ws(), p_email: email, p_role: role });
  logAudit('team', `Invited (${role})`, email.trim().toLowerCase());
  await loadAdminData();
  return inviteLink(token);
};

export const revokeInvitation = async (id: string, email: string) => {
  await rpc('revoke_invitation', { p_invitation: id });
  logAudit('team', 'Revoked invitation for', email);
  await loadAdminData();
};

// ─── Invite code & join requests ──────────────────────────────
export const regenerateJoinCode = async () => {
  const code = await rpc<string>('regenerate_join_code', { p_workspace: ws() });
  logAudit('team', 'Generated a new invite code (old code disabled)');
  useAccessStore.setState({ joinCode: code });
  return code;
};

export const setJoinCodeEnabled = async (enabled: boolean) => {
  const { error } = await supabase.from('workspaces').update({ join_code_enabled: enabled }).eq('id', ws());
  if (error) throw new Error(friendlyError(error));
  logAudit('team', enabled ? 'Enabled the invite code' : 'Disabled the invite code');
  useAccessStore.setState({ joinCodeEnabled: enabled });
};

export const decideJoinRequest = async (id: string, approve: boolean, role: Role, who: string) => {
  await rpc('decide_join_request', { p_request: id, p_approve: approve, p_role: role });
  logAudit('team', approve ? `Approved join request (${role})` : 'Declined join request', who);
  await refresh();
};

// ─── Members / employee directory ─────────────────────────────
export interface MemberPatch {
  role?: Role;
  jobTitle?: string;
  department?: string;
  phone?: string;
  startDate?: string;
  status?: EmploymentStatus;
}

/** Empty strings clear a field; undefined leaves it unchanged. */
export const updateMember = async (userId: string, patch: MemberPatch, label?: string) => {
  await rpc('update_member', {
    p_workspace: ws(),
    p_user: userId,
    p_role: patch.role ?? null,
    p_job_title: patch.jobTitle ?? null,
    p_department: patch.department ?? null,
    p_phone: patch.phone ?? null,
    p_start_date: patch.startDate || null,
    p_status: patch.status ?? null,
  });
  if (patch.role) logAudit('team', `Changed role to ${patch.role}`, label);
  else if (patch.status) logAudit('team', `Set employment status to ${patch.status.replace('_', ' ')}`, label);
  else logAudit('team', 'Updated employee profile', label);
  await refresh();
};

export const removeMember = async (userId: string, label: string) => {
  await rpc('remove_member', { p_workspace: ws(), p_user: userId });
  logAudit('team', 'Removed from workspace', label);
  await refresh();
};

// ─── For the signed-in user (onboarding) ──────────────────────
export interface MyInvitation {
  id: string;
  workspace_name: string;
  role: Role;
  inviter_name: string;
  created_at: string;
}
export interface MyJoinRequest {
  id: string;
  workspace_name: string;
  status: 'pending' | 'declined';
  created_at: string;
}
export interface InvitationPreview {
  workspace_name: string;
  email: string;
  role: Role;
  inviter_name: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

export const myInvitations = () => rpc<MyInvitation[]>('my_invitations');
export const myJoinRequests = () => rpc<MyJoinRequest[]>('my_join_requests');
export const requestToJoin = (code: string, message?: string) =>
  rpc<string>('request_to_join', { p_code: code, p_message: message ?? null });
export const cancelJoinRequest = (id: string) => rpc('cancel_join_request', { p_request: id });
export const getInvitationPreview = async (token: string): Promise<InvitationPreview | null> => {
  const rows = await rpc<InvitationPreview[]>('get_invitation', { p_token: token });
  return rows?.[0] ?? null;
};
