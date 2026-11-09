import React, { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, LayoutGrid, List, Mail, Phone, UserPlus, Users } from 'lucide-react';
import { useAccessStore, type TeamMember } from '../../store/useAccessStore';
import { useCan, useSession } from '../../security/sessionState';
import { PageHeader } from '../../components/ui/PageHeader';
import { FilterTabs, MetricTile, SearchInput, type FilterTab } from '../../components/ui/ListControls';
import { EmptyState } from '../../components/ui/States';
import { formatDate } from '../../utils/formatters';
import { PersonAvatar } from './PersonAvatar';
import { PersonDrawer } from './PersonDrawer';
import { EmploymentBadge, RoleBadge, YouTag } from './PeopleBadges';
import { telHref, tenure } from './peopleUtils';

type StatusFilter = 'current' | 'active' | 'on_leave' | 'left';
type View = 'grid' | 'table';

const NO_DEPT = '__none__';
const VIEW_KEY = 'devcity.people.view';

const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
};

const matchesStatus = (m: TeamMember, f: StatusFilter) => (f === 'current' ? m.status !== 'left' : m.status === f);

const Started: React.FC<{ member: TeamMember }> = ({ member }) => {
  if (!member.startDate) return <span className="text-slate-400">No start date</span>;
  const t = member.status === 'left' ? null : tenure(member.startDate);
  return (
    <span>
      Since {formatDate(member.startDate, 'MMM yyyy')}
      {t && <span className="text-slate-400"> · {t}</span>}
    </span>
  );
};

const DeptChip: React.FC<{ department?: string }> = ({ department }) =>
  department ? (
    <span className="inline-flex max-w-full items-center truncate rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {department}
    </span>
  ) : null;

const PersonCard: React.FC<{ member: TeamMember; isMe: boolean; onOpen: () => void }> = ({ member, isMe, onOpen }) => (
  <li
    className={`card card-hover group relative flex flex-col p-5 focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-100 ${
      member.status === 'left' ? 'opacity-75' : ''
    }`}
  >
    <div className="flex items-start gap-3.5">
      <PersonAvatar name={member.name} url={member.avatarUrl} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {/* Stretched button: the whole card opens the profile, while contact links stay clickable. */}
          <button
            type="button"
            onClick={onOpen}
            className="truncate text-left text-sm font-semibold text-slate-900 after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none group-hover:text-primary-700"
          >
            {member.name}
          </button>
          {isMe && <YouTag />}
        </div>
        <p className="truncate text-[13px] text-slate-500">{member.jobTitle || 'No job title'}</p>
      </div>
      {member.status !== 'active' && <EmploymentBadge status={member.status} className="flex-shrink-0" />}
    </div>

    <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
      <DeptChip department={member.department} />
      <RoleBadge role={member.role} />
    </div>

    <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3.5 text-[13px]">
      <li className="flex min-w-0 items-center gap-2.5">
        <Mail size={14} className="flex-shrink-0 text-slate-400" aria-hidden="true" />
        {member.email ? (
          <a href={`mailto:${member.email}`} className="relative z-10 truncate text-slate-700 hover:text-primary-700 hover:underline">
            {member.email}
          </a>
        ) : (
          <span className="text-slate-400">No email</span>
        )}
      </li>
      <li className="flex items-center gap-2.5">
        <Phone size={14} className="flex-shrink-0 text-slate-400" aria-hidden="true" />
        {member.phone ? (
          <a href={telHref(member.phone)} className="relative z-10 text-slate-700 hover:text-primary-700 hover:underline">
            {member.phone}
          </a>
        ) : (
          <span className="text-slate-400">No phone</span>
        )}
      </li>
      <li className="flex items-center gap-2.5 text-slate-600">
        <CalendarDays size={14} className="flex-shrink-0 text-slate-400" aria-hidden="true" />
        <Started member={member} />
      </li>
    </ul>
  </li>
);

const PeopleTable: React.FC<{ people: TeamMember[]; meId?: string; onOpen: (id: string) => void }> = ({ people, meId, onOpen }) => (
  <div className="overflow-x-auto">
    <table className="table">
      <thead>
        <tr>
          <th>Person</th>
          <th className="hidden md:table-cell">Department</th>
          <th className="hidden lg:table-cell">Contact</th>
          <th className="hidden sm:table-cell">Started</th>
          <th>Status</th>
          <th className="hidden xl:table-cell">Role</th>
        </tr>
      </thead>
      <tbody>
        {people.map((m) => (
          <tr key={m.id} className={`cursor-pointer ${m.status === 'left' ? 'text-slate-500' : ''}`} onClick={() => onOpen(m.id)}>
            <td>
              <div className="flex items-center gap-3">
                <PersonAvatar name={m.name} url={m.avatarUrl} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(m.id);
                      }}
                      className="block max-w-[220px] truncate text-left font-medium text-slate-900 hover:text-primary-700 focus-visible:text-primary-700 focus-visible:outline-none"
                    >
                      {m.name}
                    </button>
                    {m.id === meId && <YouTag />}
                  </div>
                  <p className="max-w-[220px] truncate text-xs text-slate-500">{m.jobTitle || 'No job title'}</p>
                </div>
              </div>
            </td>
            <td className="hidden md:table-cell">{m.department ? <DeptChip department={m.department} /> : <span className="text-slate-400">—</span>}</td>
            <td className="hidden lg:table-cell">
              <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                <a href={`mailto:${m.email}`} className="block max-w-[240px] truncate text-slate-700 hover:text-primary-700 hover:underline">
                  {m.email}
                </a>
                {m.phone && (
                  <a href={telHref(m.phone)} className="text-xs text-slate-500 hover:text-primary-700 hover:underline">
                    {m.phone}
                  </a>
                )}
              </div>
            </td>
            <td className="hidden whitespace-nowrap text-slate-600 sm:table-cell">
              {m.startDate ? (
                <>
                  <p>{formatDate(m.startDate)}</p>
                  {m.status !== 'left' && <p className="text-xs text-slate-400">{tenure(m.startDate)}</p>}
                </>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </td>
            <td>
              <EmploymentBadge status={m.status} />
            </td>
            <td className="hidden xl:table-cell">
              <RoleBadge role={m.role} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const PeopleDirectory: React.FC = () => {
  const members = useAccessStore((s) => s.members);
  const me = useSession((s) => s.user);
  const workspaceName = useSession((s) => s.workspace?.name);
  const isAdmin = useCan('users.manage');

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('current');
  const [dept, setDept] = useState('all');
  const [view, setViewState] = useState<View>(readView);

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage unavailable — keep the in-memory choice */
    }
  };

  // The open profile lives in the URL (?person=<id>) so it can be linked from Team settings.
  const openId = searchParams.get('person');
  const openMember = openId ? members.find((m) => m.id === openId) : undefined;
  const openPerson = (id: string) =>
    setSearchParams((p) => {
      p.set('person', id);
      return p;
    });
  const closePerson = useCallback(
    () =>
      setSearchParams(
        (p) => {
          p.delete('person');
          return p;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  const current = useMemo(() => members.filter((m) => m.status !== 'left'), [members]);
  const counts = useMemo(
    () => ({
      current: current.length,
      active: members.filter((m) => m.status === 'active').length,
      on_leave: members.filter((m) => m.status === 'on_leave').length,
      left: members.filter((m) => m.status === 'left').length,
    }),
    [members, current]
  );

  const departments = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of current) if (m.department?.trim()) map.set(m.department.trim(), (map.get(m.department.trim()) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [current]);
  const withoutDept = current.filter((m) => !m.department?.trim()).length;

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      members
        .filter((m) => matchesStatus(m, status))
        .filter((m) => (dept === 'all' ? true : dept === NO_DEPT ? !m.department?.trim() : m.department?.trim() === dept))
        .filter(
          (m) =>
            !q ||
            [m.name, m.email, m.jobTitle, m.department, m.phone].some((v) => v?.toLowerCase().includes(q))
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members, status, dept, q]
  );

  const tabs: FilterTab<StatusFilter>[] = [
    { value: 'current', label: 'Current team', count: counts.current },
    { value: 'active', label: 'Active', count: counts.active },
    { value: 'on_leave', label: 'On leave', count: counts.on_leave },
    ...(counts.left > 0 ? [{ value: 'left' as const, label: 'Former', count: counts.left }] : []),
  ];

  const clearFilters = () => {
    setSearch('');
    setDept('all');
    setStatus('current');
  };

  const inviteButton = isAdmin && (
    <Link to="/settings/team" className="btn-primary">
      <UserPlus size={16} /> Invite people
    </Link>
  );

  const topDept = departments[0];

  return (
    <div className="page">
      <PageHeader
        title="People"
        description={`Everyone in ${workspaceName ?? 'your workspace'}: roles, departments and how to reach them.`}
        actions={inviteButton}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Total people"
          value={String(counts.current)}
          hint={counts.left ? `${counts.left} former member${counts.left === 1 ? '' : 's'}` : 'Current team'}
          onClick={() => setStatus('current')}
          active={status === 'current'}
        />
        <MetricTile
          label="Active"
          value={String(counts.active)}
          hint="Working now"
          tone="success"
          onClick={() => setStatus('active')}
          active={status === 'active'}
        />
        <MetricTile
          label="On leave"
          value={String(counts.on_leave)}
          hint={counts.on_leave ? 'Currently away' : 'Nobody is away'}
          tone={counts.on_leave ? 'warning' : 'default'}
          onClick={() => setStatus('on_leave')}
          active={status === 'on_leave'}
        />
        <MetricTile
          label="Departments"
          value={String(departments.length)}
          hint={topDept ? `Largest: ${topDept[0]} (${topDept[1]})` : 'None assigned yet'}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 pt-3 lg:flex-row lg:items-end lg:justify-between">
          <FilterTabs<StatusFilter> value={status} onChange={setStatus} tabs={tabs} />
          <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="Search name, title, email or phone" className="sm:w-64" />
            <div className="flex items-center gap-2">
              <select className="select h-9 min-w-0 flex-1 sm:w-48 sm:flex-none" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Filter by department">
                <option value="all">All departments</option>
                {departments.map(([d, n]) => (
                  <option key={d} value={d}>
                    {d} ({n})
                  </option>
                ))}
                {withoutDept > 0 && <option value={NO_DEPT}>No department ({withoutDept})</option>}
              </select>
              <div className="segmented flex-shrink-0" role="group" aria-label="Layout">
                <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')} aria-label="Card view" title="Card view">
                  <LayoutGrid size={14} />
                </button>
                <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')} aria-label="List view" title="List view">
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No people yet"
            description="Invite your colleagues to the workspace. They'll appear here with their role, department and contact details."
            action={inviteButton || undefined}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No matching people"
            description={
              q
                ? `Nobody matches “${search.trim()}”. Try a name, job title, email or phone number.`
                : 'Nobody matches these filters.'
            }
            action={
              <button type="button" className="btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            }
          />
        ) : view === 'grid' ? (
          <ul className="grid grid-cols-1 gap-4 bg-slate-50/60 p-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="People">
            {filtered.map((m) => (
              <PersonCard key={m.id} member={m} isMe={m.id === me?.id} onOpen={() => openPerson(m.id)} />
            ))}
          </ul>
        ) : (
          <PeopleTable people={filtered} meId={me?.id} onOpen={openPerson} />
        )}

        {filtered.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            Showing <span className="font-medium text-slate-700 tabular">{filtered.length}</span> of{' '}
            <span className="tabular">{counts[status]}</span> {counts[status] === 1 ? 'person' : 'people'}
          </div>
        )}
      </div>

      {openMember && (
        <PersonDrawer key={openMember.id} member={openMember} isMe={openMember.id === me?.id} isAdmin={isAdmin} onClose={closePerson} />
      )}
    </div>
  );
};
