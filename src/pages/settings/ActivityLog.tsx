import React, { useMemo, useState } from 'react';
import { Download, FileText, History, KeyRound, Settings, ShieldCheck, Users, UserRound } from 'lucide-react';
import { useAuditStore, type AuditCategory, type AuditEntry } from '../../store/useAuditStore';
import { logAudit } from '../../store/useAuditStore';
import { FilterTabs, SearchInput } from '../../components/ui/ListControls';
import { EmptyState } from '../../components/ui/States';
import { Avatar } from '../../components/ui/Avatar';
import { formatDate } from '../../utils/formatters';

type Filter = 'all' | AuditCategory;

const CATEGORY: Record<AuditCategory, { label: string; icon: React.ElementType; cls: string }> = {
  auth: { label: 'Sign-in', icon: KeyRound, cls: 'bg-slate-100 text-slate-600' },
  document: { label: 'Documents', icon: FileText, cls: 'bg-primary-50 text-primary-600' },
  customer: { label: 'Clients', icon: UserRound, cls: 'bg-violet-50 text-violet-600' },
  settings: { label: 'Settings', icon: Settings, cls: 'bg-amber-50 text-amber-600' },
  team: { label: 'Team', icon: Users, cls: 'bg-cyan-50 text-cyan-700' },
  security: { label: 'Security', icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-600' },
};

const csvCell = (v: string) => `"${v.replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`;

const exportCsv = (entries: AuditEntry[]) => {
  const rows = [
    ['Timestamp', 'User', 'Category', 'Action', 'Target'],
    ...entries.map((e) => [e.at, e.actorName, e.category, e.action, e.target ?? '']),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `devcity-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  logAudit('security', 'Exported activity log');
};

export const ActivityLog: React.FC = () => {
  const entries = useAuditStore((s) => s.entries);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (filter === 'all' || e.category === filter) &&
        (!q || `${e.actorName} ${e.action} ${e.target ?? ''}`.toLowerCase().includes(q))
    );
  }, [entries, filter, search]);

  const groups = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const e of filtered.slice(0, 500)) {
      const day = e.at.slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), e]);
    }
    return [...map.entries()];
  }, [filtered]);

  const count = (c: Filter) => (c === 'all' ? entries.length : entries.filter((e) => e.category === c).length);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Activity log</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">
            A tamper-proof record of sign-ins, document changes and team events, stamped by the server (latest 1,000).
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => exportCsv(filtered)} disabled={!filtered.length}>
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 pt-3 md:flex-row md:items-end md:justify-between">
        <FilterTabs<Filter>
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'All', count: count('all') },
            ...(Object.keys(CATEGORY) as AuditCategory[]).map((c) => ({ value: c, label: CATEGORY[c].label, count: count(c) })),
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search activity" className="pb-3 md:w-64" />
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={History} title="No activity found" description="Actions taken in the workspace will appear here." />
      ) : (
        <div className="divide-y divide-slate-100">
          {groups.map(([day, list]) => (
            <div key={day}>
              <p className="sticky top-0 bg-slate-50/95 px-6 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur">
                {formatDate(day, 'EEEE, dd MMMM yyyy')}
              </p>
              <ul>
                {list.map((e) => {
                  const cat = CATEGORY[e.category];
                  return (
                    <li key={e.id} className="flex items-center gap-3.5 px-6 py-3 hover:bg-slate-50/60">
                      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cat.cls}`}>
                        <cat.icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-slate-800">
                          {e.action}
                          {e.target && <span className="ml-1 font-mono text-[12px] font-medium text-slate-900">{e.target}</span>}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Avatar name={e.actorName} size="xs" className="h-4 w-4 text-[8px]" /> {e.actorName}
                        </p>
                      </div>
                      <time className="flex-shrink-0 text-xs text-slate-400 tabular" dateTime={e.at}>
                        {formatDate(e.at, 'HH:mm')}
                      </time>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
