export type Role = 'admin' | 'editor' | 'viewer';

export type Permission =
  | 'documents.create'
  | 'documents.edit'
  | 'documents.delete'
  | 'payments.record'
  | 'customers.manage'
  | 'customers.delete'
  | 'settings.manage'
  | 'users.manage'
  | 'audit.view'
  | 'backup.manage';

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    'documents.create',
    'documents.edit',
    'documents.delete',
    'payments.record',
    'customers.manage',
    'customers.delete',
    'settings.manage',
    'users.manage',
    'audit.view',
    'backup.manage',
  ],
  editor: ['documents.create', 'documents.edit', 'payments.record', 'customers.manage'],
  viewer: [],
};

export const ROLE_META: Record<Role, { label: string; description: string; tone: string }> = {
  admin: {
    label: 'Administrator',
    description: 'Full access, including team members, company settings, backups and the activity log.',
    tone: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  editor: {
    label: 'Editor',
    description: 'Create and edit documents and clients, and record payments. Cannot delete or change settings.',
    tone: 'bg-primary-50 text-primary-700 border-primary-200',
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only. Can view, print and export documents.',
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export const roleCan = (role: Role | undefined | null, permission: Permission): boolean =>
  !!role && ROLE_PERMISSIONS[role].includes(permission);
