// ============================================================
// Record sync: optimistic local updates, ordered background writes,
// automatic renumbering on number clashes, and live updates from
// colleagues via Supabase Realtime.
// ============================================================
import { create } from 'zustand';
import toast from 'react-hot-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { friendlyError, supabase } from './supabase';
import { currentWorkspaceId } from '../security/sessionState';

export type Collection = 'quotations' | 'invoices' | 'bills' | 'receipts' | 'customers';

interface Identified {
  id: string;
}

interface CollectionAdapter {
  /** Replace the whole list (initial load). */
  replaceAll: (items: Identified[]) => void;
  /** Insert or replace one item coming from the server. */
  applyRemote: (item: Identified) => void;
  /** Remove one item deleted elsewhere. */
  removeRemote: (id: string) => void;
}

const adapters = new Map<Collection, CollectionAdapter>();

/** Each store registers how remote changes are applied to it. */
export const registerCollection = (name: Collection, adapter: CollectionAdapter) => adapters.set(name, adapter);

// ─── Save status (shown in the header) ────────────────────────
interface SyncStatus {
  pending: number;
  error: string | null;
  lastSavedAt: number | null;
}
export const useSyncStatus = create<SyncStatus>()(() => ({ pending: 0, error: null, lastSavedAt: null }));
const begin = () => useSyncStatus.setState((s) => ({ pending: s.pending + 1, error: null }));
const end = (error?: string) =>
  useSyncStatus.setState((s) => ({
    pending: Math.max(0, s.pending - 1),
    error: error ?? null,
    lastSavedAt: error ? s.lastSavedAt : Date.now(),
  }));

// ─── Ordered writes per record ────────────────────────────────
const queues = new Map<string, Promise<void>>();
const pendingIds = new Set<string>();

const enqueue = (key: string, job: () => Promise<void>) => {
  pendingIds.add(key);
  const next = (queues.get(key) ?? Promise.resolve()).then(job).finally(() => {
    if (queues.get(key) === next) {
      queues.delete(key);
      pendingIds.delete(key);
    }
  });
  queues.set(key, next);
};

export const flushSync = () => Promise.allSettled([...queues.values()]);

const isNumberClash = (err: { code?: string; message?: string } | null) =>
  err?.code === '23505' && /records_number_unique/.test(err.message ?? '');

/**
 * Documents keep a snapshot of the company details at save time, but branding
 * images always come from the current settings, so they aren't stored per document.
 */
const slim = (data: object): object => {
  const d = data as { companySnapshot?: Record<string, unknown> };
  if (!d.companySnapshot) return data;
  const { logo: _logo, signature: _signature, ...snapshot } = d.companySnapshot;
  void _logo;
  void _signature;
  return { ...data, companySnapshot: snapshot };
};

export interface Renumbered {
  number: string;
  data: object;
}

/**
 * Save a record. `renumber` is called if a colleague took the same document
 * number at the same moment; it must assign a new number locally and return it.
 */
export const pushRecord = (
  collection: Collection,
  id: string,
  number: string | null,
  data: object,
  renumber?: () => Renumbered
) => {
  const ws = currentWorkspaceId();
  if (!ws) return;
  begin();
  enqueue(`${collection}:${id}`, async () => {
    let row = { workspace_id: ws, collection, id, number, data: slim(data) };
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase.from('records').upsert(row, { onConflict: 'workspace_id,collection,id' });
      if (!error) {
        end();
        return;
      }
      if (isNumberClash(error) && renumber) {
        const next = renumber();
        toast(`${number} was just used by a colleague. Saved as ${next.number}.`, { icon: 'ℹ️' });
        row = { ...row, number: next.number, data: slim(next.data) };
        number = next.number;
        continue;
      }
      const message = friendlyError(error, 'Could not save your change.');
      end(message);
      toast.error(`${message} Reloading the latest data.`);
      void reloadCollection(collection);
      return;
    }
    end('Could not save your change.');
  });
};

export const deleteRecord = (collection: Collection, id: string) => {
  const ws = currentWorkspaceId();
  if (!ws) return;
  begin();
  enqueue(`${collection}:${id}`, async () => {
    const { error } = await supabase.from('records').delete().match({ workspace_id: ws, collection, id });
    if (error) {
      const message = friendlyError(error, 'Could not delete.');
      end(message);
      toast.error(message);
      void reloadCollection(collection);
    } else end();
  });
};

// ─── Loading ──────────────────────────────────────────────────
const PAGE = 1000;

const fetchRecords = async (ws: string, collection?: Collection) => {
  const rows: { collection: Collection; data: Identified }[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('records')
      .select('collection, data')
      .eq('workspace_id', ws)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (collection) q = q.eq('collection', collection);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data as { collection: Collection; data: Identified }[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
};

export const loadAllRecords = async (ws: string) => {
  const rows = await fetchRecords(ws);
  const grouped = new Map<Collection, Identified[]>();
  for (const r of rows) grouped.set(r.collection, [...(grouped.get(r.collection) ?? []), r.data]);
  for (const [name, adapter] of adapters) adapter.replaceAll(grouped.get(name) ?? []);
};

export const reloadCollection = async (collection: Collection) => {
  const ws = currentWorkspaceId();
  if (!ws) return;
  try {
    const rows = await fetchRecords(ws, collection);
    adapters.get(collection)?.replaceAll(rows.map((r) => r.data));
  } catch {
    /* the error toast was already shown */
  }
};

export const resetAllCollections = () => {
  for (const adapter of adapters.values()) adapter.replaceAll([]);
};

// ─── Realtime ─────────────────────────────────────────────────
let channel: RealtimeChannel | null = null;

interface RealtimeHandlers {
  onMembersChanged: () => void;
  onWorkspaceChanged: () => void;
}

export const subscribeWorkspace = (ws: string, handlers: RealtimeHandlers) => {
  unsubscribeWorkspace();
  channel = supabase
    .channel(`ws:${ws}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `workspace_id=eq.${ws}` }, (payload) => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as {
        workspace_id?: string;
        collection?: Collection;
        id?: string;
        data?: Identified;
      };
      if (!row?.collection || !row.id || (row.workspace_id && row.workspace_id !== ws)) return;
      if (pendingIds.has(`${row.collection}:${row.id}`)) return; // our own write is still in flight
      const adapter = adapters.get(row.collection);
      if (!adapter) return;
      if (payload.eventType === 'DELETE') adapter.removeRemote(row.id);
      else if (row.data) adapter.applyRemote(row.data);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${ws}` }, () =>
      handlers.onMembersChanged()
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workspaces', filter: `id=eq.${ws}` }, () =>
      handlers.onWorkspaceChanged()
    )
    .subscribe();
};

export const unsubscribeWorkspace = () => {
  if (channel) void supabase.removeChannel(channel);
  channel = null;
};
