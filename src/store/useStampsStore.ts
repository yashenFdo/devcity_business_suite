// Company & personal stamps (Supabase table `stamps`, protected by RLS).
import { create } from 'zustand';
import type { Stamp, StampKind } from '../types';
import { friendlyError, supabase } from '../cloud/supabase';
import { currentUser, currentWorkspaceId } from '../security/sessionState';
import { logAudit } from './useAuditStore';

interface StampsStore {
  stamps: Stamp[];
}

export const useStampsStore = create<StampsStore>()(() => ({ stamps: [] }));

type StampRow = { id: string; kind: StampKind; owner_id: string | null; data: Omit<Stamp, 'id' | 'kind' | 'ownerId'> };

const toStamp = (r: StampRow): Stamp => ({ ...r.data, id: r.id, kind: r.kind, ownerId: r.owner_id ?? undefined });

export const loadStamps = async (ws = currentWorkspaceId()) => {
  if (!ws) return;
  const { data, error } = await supabase.from('stamps').select('id, kind, owner_id, data').eq('workspace_id', ws).order('created_at');
  if (error) return; // table may not exist until migration 0003 is run
  useStampsStore.setState({ stamps: (data as StampRow[]).map(toStamp) });
};

const payload = (s: Omit<Stamp, 'id' | 'kind' | 'ownerId'>) => ({
  shape: s.shape,
  title: s.title.trim().slice(0, 60),
  subtitle: s.subtitle?.trim().slice(0, 80) || undefined,
  lines: (s.lines ?? []).map((l) => l.trim().slice(0, 90)).filter(Boolean).slice(0, 2),
  showDate: !!s.showDate,
});

/** Admins create company stamps; editors & admins create their own personal stamps. */
export const saveStamp = async (stamp: Omit<Stamp, 'id' | 'ownerId'> & { id?: string }) => {
  const ws = currentWorkspaceId();
  const me = currentUser();
  if (!ws || !me) throw new Error('Not signed in');
  const data = payload(stamp);
  const { error } = stamp.id
    ? await supabase.from('stamps').update({ data }).eq('id', stamp.id)
    : await supabase.from('stamps').insert({
        workspace_id: ws,
        kind: stamp.kind,
        owner_id: stamp.kind === 'personal' ? me.id : null,
        data,
      });
  if (error) throw new Error(friendlyError(error, 'Could not save the stamp.'));
  logAudit('settings', `${stamp.id ? 'Updated' : 'Created'} ${stamp.kind} stamp`, data.title);
  await loadStamps(ws);
};

export const deleteStamp = async (stamp: Stamp) => {
  const { error } = await supabase.from('stamps').delete().eq('id', stamp.id);
  if (error) throw new Error(friendlyError(error, 'Could not delete the stamp.'));
  logAudit('settings', `Deleted ${stamp.kind} stamp`, stamp.title);
  await loadStamps();
};
