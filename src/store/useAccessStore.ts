// Team members, employee directory, invitations and workspace policy (loaded from Supabase).
import { create } from 'zustand';
import type { Role } from '../security/permissions';

export type EmploymentStatus = 'active' | 'on_leave' | 'left';

export interface TeamMember {
  /** auth user id */
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: Role;
  jobTitle?: string;
  department?: string;
  phone?: string;
  startDate?: string;
  status: EmploymentStatus;
  joinedAt: string;
  lastSeenAt?: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
  invitedByName?: string;
}

export interface JoinRequest {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  message?: string;
  createdAt: string;
}

export interface SecurityPolicy {
  /** Sign out after this many idle minutes. */
  autoLockMinutes: number;
  /** Sign out when the tab stays hidden this many minutes (0 = off). */
  lockOnHiddenMinutes: number;
}

export const DEFAULT_POLICY: SecurityPolicy = {
  autoLockMinutes: 30,
  lockOnHiddenMinutes: 0,
};

interface AccessStore {
  members: TeamMember[];
  policy: SecurityPolicy;
  /** Admin-only data */
  invitations: Invitation[];
  joinRequests: JoinRequest[];
  joinCode: string | null;
  joinCodeEnabled: boolean;
}

export const useAccessStore = create<AccessStore>()(() => ({
  members: [],
  policy: DEFAULT_POLICY,
  invitations: [],
  joinRequests: [],
  joinCode: null,
  joinCodeEnabled: true,
}));

export const DEPARTMENT_SUGGESTIONS = ['Engineering', 'Design', 'Product', 'QA', 'DevOps', 'Sales', 'Finance', 'Operations', 'HR', 'Management'];

export const EMPLOYMENT_STATUS_META: Record<EmploymentStatus, { label: string; tone: string }> = {
  active: { label: 'Active', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  on_leave: { label: 'On leave', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  left: { label: 'Left', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
};
