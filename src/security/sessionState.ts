// In-memory session state (the Supabase auth session itself is managed by supabase-js).
import { create } from 'zustand';
import toast from 'react-hot-toast';
import { roleCan, type Permission, type Role } from './permissions';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  /** Role in the active workspace. */
  role: Role;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: Role;
}

export type SessionStatus =
  | 'loading' // starting up / switching workspace
  | 'unconfigured' // Supabase keys missing
  | 'signedOut'
  | 'recovery' // arrived from a password-reset email
  | 'onboarding' // signed in, no workspace selected yet
  | 'ready';

interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  workspace: { id: string; name: string } | null;
  workspaces: WorkspaceSummary[];
}

export const useSession = create<SessionState>()(() => ({
  status: 'loading',
  user: null,
  workspace: null,
  workspaces: [],
}));

export const currentUser = () => useSession.getState().user;
export const currentWorkspaceId = () => useSession.getState().workspace?.id ?? null;

export const can = (permission: Permission) => roleCan(currentUser()?.role, permission);

/** React hook: does the signed-in user hold this permission in the active workspace? */
export const useCan = (permission: Permission) => useSession((s) => roleCan(s.user?.role, permission));

export class PermissionError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = 'PermissionError';
  }
}

/** Fast client-side check; the database enforces the same rules with Row Level Security. */
export const assertCan = (permission: Permission) => {
  if (!can(permission)) {
    toast.error("You don't have permission to do that.");
    throw new PermissionError(permission);
  }
};
