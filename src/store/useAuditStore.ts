import { create } from 'zustand';
import { currentUser, currentWorkspaceId } from '../security/sessionState';
import { randomId } from '../security/crypto';
import { supabase } from '../cloud/supabase';

export type AuditCategory = 'auth' | 'document' | 'customer' | 'settings' | 'team' | 'security';

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  category: AuditCategory;
  action: string;
  target?: string;
}

interface AuditStore {
  entries: AuditEntry[];
}

export const useAuditStore = create<AuditStore>()(() => ({ entries: [] }));

const MAX_ENTRIES = 1000;

/**
 * Append to the workspace activity log. The server stamps the real
 * author and time; only administrators can read the log.
 */
export const logAudit = (category: AuditCategory, action: string, target?: string) => {
  const ws = currentWorkspaceId();
  const user = currentUser();
  if (!ws || !user) return;
  const entry: AuditEntry = {
    id: randomId(),
    at: new Date().toISOString(),
    actorId: user.id,
    actorName: user.name,
    category,
    action: action.slice(0, 300),
    target: target?.slice(0, 200),
  };
  if (user.role === 'admin') {
    useAuditStore.setState((s) => ({ entries: [entry, ...s.entries].slice(0, MAX_ENTRIES) }));
  }
  void supabase
    .from('audit_log')
    .insert({ workspace_id: ws, actor_name: user.name, category, action: entry.action, target: entry.target ?? null })
    .then(({ error }) => {
      if (error) console.warn('[audit] could not record entry', error.message);
    });
};

export const loadAuditLog = async (ws: string) => {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, at, actor_id, actor_name, category, action, target')
    .eq('workspace_id', ws)
    .order('at', { ascending: false })
    .limit(MAX_ENTRIES);
  if (error) return;
  useAuditStore.setState({
    entries: (data ?? []).map((r) => ({
      id: String(r.id),
      at: r.at,
      actorId: r.actor_id ?? '',
      actorName: r.actor_name,
      category: r.category as AuditCategory,
      action: r.action,
      target: r.target ?? undefined,
    })),
  });
};
