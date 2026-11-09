import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Circle,
  Clock,
  FileSignature,
  FileText,
  Info,
  Plus,
  Receipt,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, startOfMonth, subMonths } from 'date-fns';
import { useQuotationsStore } from '../store/useQuotationsStore';
import { useInvoicesStore } from '../store/useInvoicesStore';
import { useBillsStore } from '../store/useBillsStore';
import { useReceiptsStore } from '../store/useReceiptsStore';
import { useCompanyStore } from '../store/useCompanyStore';
import { useAccessStore } from '../store/useAccessStore';
import { useSession, useCan } from '../security/sessionState';
import { StatusBadge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { formatCurrency, formatDate } from '../utils/formatters';
import { buildAlerts, joinRequestAlerts, effectiveBillStatus, effectiveInvoiceStatus, effectiveQuotationStatus, type AlertTone } from '../utils/insights';

const SERIES = { invoiced: '#1F5BFF', collected: '#0d9488', paidOut: '#e8590c' };
const SERIES_LABEL: Record<keyof typeof SERIES, string> = { invoiced: 'Invoiced', collected: 'Collected', paidOut: 'Paid out' };

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const compact = (n: number, sym: string) =>
  `${sym}${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)}`;

const Kpi: React.FC<{
  label: string;
  value: string;
  sub: React.ReactNode;
  icon: React.ElementType;
  tone: string;
  to: string;
}> = ({ label, value, sub, icon: Icon, tone, to }) => (
  <Link to={to} className="card card-hover group p-5">
    <div className="flex items-center justify-between">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
        <Icon size={16} />
      </span>
    </div>
    <p className="mt-3 text-[26px] font-semibold tracking-tight text-slate-900 tabular">{value}</p>
    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
      <span>{sub}</span>
      <ArrowUpRight size={14} className="text-slate-300 transition-colors group-hover:text-primary-600" />
    </div>
  </Link>
);

const ALERT_TONE: Record<AlertTone, { icon: React.ElementType; cls: string }> = {
  danger: { icon: AlertCircle, cls: 'bg-rose-50 text-rose-600' },
  warning: { icon: Clock, cls: 'bg-amber-50 text-amber-600' },
  info: { icon: Info, cls: 'bg-primary-50 text-primary-600' },
};

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number }[];
  sym: string;
}
const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, sym }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-pop">
      <p className="mb-1.5 font-medium text-slate-900">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-sm" style={{ background: SERIES[p.dataKey as keyof typeof SERIES] }} />
          <span className="w-16">{SERIES_LABEL[p.dataKey as keyof typeof SERIES]}</span>
          <span className="font-medium text-slate-900 tabular">{formatCurrency(p.value, sym)}</span>
        </p>
      ))}
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const user = useSession((s) => s.user);
  const quotations = useQuotationsStore((s) => s.quotations);
  const invoices = useInvoicesStore((s) => s.invoices);
  const bills = useBillsStore((s) => s.bills);
  const receipts = useReceiptsStore((s) => s.receipts);
  const company = useCompanyStore((s) => s.company);
  const memberCount = useAccessStore((s) => s.members.length);
  const canCreate = useCan('documents.create');
  const isAdmin = useCan('users.manage');
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const sym = company.currencySymbol;
  const home = company.currency;
  // Totals only combine documents in the company's default currency.
  const inHome = <T extends { currency?: string }>(d: T) => (d.currency || 'USD') === home;
  const foreignCount = [...invoices, ...receipts, ...quotations, ...bills].filter((d) => !inHome(d)).length;

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = format(now, 'yyyy-MM');
    const lastMonth = format(subMonths(now, 1), 'yyyy-MM');
    const live = invoices.filter(inHome).map((i) => ({ i, s: effectiveInvoiceStatus(i) })).filter(({ s }) => s !== 'draft' && s !== 'cancelled');
    const outstanding = live.reduce((t, { i }) => t + (i.balanceDue || 0), 0);
    const overdue = live.filter(({ s }) => s === 'overdue');
    const rec = receipts.filter(inHome);
    const collected = (m: string) => rec.filter((r) => r.date.startsWith(m)).reduce((t, r) => t + r.amount, 0);
    const pipelineQuotes = quotations.filter(inHome).filter((q) => effectiveQuotationStatus(q) === 'sent');
    // Purchase bills: everything not cancelled and not fully paid is still owed (drafts included).
    const openBills = bills
      .filter(inHome)
      .map((b) => ({ b, s: effectiveBillStatus(b) }))
      .filter(({ b, s }) => s !== 'cancelled' && s !== 'paid' && (b.balanceDue ?? b.total) > 0);
    const owed = (b: (typeof bills)[number]) => b.balanceDue ?? Math.max(0, b.total - (b.amountPaid || 0));
    const toPay = openBills.reduce((t, { b }) => t + owed(b), 0);
    const paidOut = (m: string) =>
      bills
        .filter(inHome)
        .filter((b) => b.status !== 'cancelled' && (b.amountPaid || 0) > 0 && (b.paymentDate || b.date).startsWith(m))
        .reduce((t, b) => t + (b.amountPaid || 0), 0);
    return {
      outstanding,
      openCount: live.filter(({ i }) => i.balanceDue > 0).length,
      overdueAmount: overdue.reduce((t, { i }) => t + i.balanceDue, 0),
      overdueCount: overdue.length,
      collectedThis: collected(thisMonth),
      collectedLast: collected(lastMonth),
      pipeline: pipelineQuotes.reduce((t, q) => t + q.total, 0),
      pipelineCount: pipelineQuotes.length,
      payables: toPay,
      billCount: openBills.length,
      billsOverdue: openBills.filter(({ s }) => s === 'overdue').length,
      billDrafts: openBills.filter(({ s }) => s === 'draft').length,
      net: outstanding - toPay,
      paidOutThis: paidOut(thisMonth),
      paidOutLast: paidOut(lastMonth),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, receipts, quotations, bills, home]);

  const monthly = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, k) => startOfMonth(subMonths(new Date(), 5 - k)));
    return months.map((m) => {
      const key = format(m, 'yyyy-MM');
      return {
        month: format(m, 'MMM'),
        invoiced: invoices
          .filter((i) => inHome(i) && i.status !== 'draft' && i.status !== 'cancelled' && i.date.startsWith(key))
          .reduce((t, i) => t + i.total, 0),
        collected: receipts.filter((r) => inHome(r) && r.date.startsWith(key)).reduce((t, r) => t + r.amount, 0),
        paidOut: bills
          .filter((b) => inHome(b) && b.status !== 'cancelled' && (b.amountPaid || 0) > 0 && (b.paymentDate || b.date).startsWith(key))
          .reduce((t, b) => t + (b.amountPaid || 0), 0),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, receipts, bills, home]);

  const joinRequests = useAccessStore((s) => s.joinRequests);
  const alerts = useMemo(
    () => [...(isAdmin ? joinRequestAlerts(joinRequests) : []), ...buildAlerts(invoices, quotations, bills)].slice(0, 6),
    [isAdmin, joinRequests, invoices, quotations, bills]
  );

  const recent = useMemo(
    () =>
      [
        ...quotations.map((q) => ({ id: q.id, type: 'Quotation', icon: FileSignature, number: q.quotationNumber, party: q.customer?.company || q.customer?.name, amount: q.total, sym: q.currencySymbol, status: effectiveQuotationStatus(q), link: `/quotations/${q.id}`, at: q.updatedAt || q.createdAt })),
        ...invoices.map((i) => ({ id: i.id, type: 'Invoice', icon: FileText, number: i.invoiceNumber, party: i.customer?.company || i.customer?.name, amount: i.total, sym: i.currencySymbol, status: effectiveInvoiceStatus(i), link: `/invoices/${i.id}`, at: i.updatedAt || i.createdAt })),
        ...receipts.map((r) => ({ id: r.id, type: 'Receipt', icon: Receipt, number: r.receiptNumber, party: r.customer?.company || r.customer?.name, amount: r.amount, sym: r.currencySymbol, status: 'paid', link: `/receipts/${r.id}`, at: r.updatedAt || r.createdAt })),
        ...bills.map((b) => ({ id: b.id, type: 'Vendor bill', icon: Banknote, number: b.billNumber, party: b.vendorName, amount: b.total, sym: b.currencySymbol, status: effectiveBillStatus(b), link: `/bills/${b.id}`, at: b.updatedAt || b.createdAt })),
      ]
        .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
        .slice(0, 7),
    [quotations, invoices, receipts, bills]
  );

  const checklist = [
    { label: 'Review your company profile', done: !!(company.address.street && company.email), to: '/settings', admin: true },
    { label: 'Add your logo & brand colour', done: !!company.logo, to: '/settings/branding', admin: true },
    { label: 'Send your first quotation', done: quotations.length > 0, to: '/quotations/new' },
    { label: 'Issue an invoice', done: invoices.length > 0, to: '/invoices/new' },
    { label: 'Invite a team member', done: memberCount > 1, to: '/settings/team', admin: true },
  ].filter((c) => !c.admin || isAdmin);
  const doneCount = checklist.filter((c) => c.done).length;
  const showChecklist = canCreate && doneCount < checklist.length;

  const delta = stats.collectedLast > 0 ? ((stats.collectedThis - stats.collectedLast) / stats.collectedLast) * 100 : null;
  const hasChartData = monthly.some((m) => m.invoiced || m.collected || m.paidOut);

  return (
    <div className="page">
      {/* Greeting */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-slate-500">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {greeting()}, {user?.name.split(' ')[0]}
          </h1>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Link to="/quotations/new" className="btn-secondary">
              <FileSignature size={15} /> New quotation
            </Link>
            <Link to="/invoices/new" className="btn-primary">
              <Plus size={16} /> New invoice
            </Link>
          </div>
        )}
      </div>

      {/* KPIs: what's owed to you, what you owe, and the difference */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi
          label="To receive"
          value={formatCurrency(stats.outstanding, sym)}
          sub={
            stats.overdueCount ? (
              <span className="font-medium text-rose-600">
                {formatCurrency(stats.overdueAmount, sym)} overdue · {stats.overdueCount} invoice{stats.overdueCount === 1 ? '' : 's'}
              </span>
            ) : (
              `${stats.openCount} open invoice${stats.openCount === 1 ? '' : 's'} · nothing overdue`
            )
          }
          icon={FileText}
          tone="bg-primary-50 text-primary-600"
          to="/invoices"
        />
        <Kpi
          label="To pay"
          value={formatCurrency(stats.payables, sym)}
          sub={
            stats.billsOverdue ? (
              <span className="font-medium text-rose-600">{stats.billsOverdue} overdue bill{stats.billsOverdue === 1 ? '' : 's'}</span>
            ) : (
              `${stats.billCount} open bill${stats.billCount === 1 ? '' : 's'}${stats.billDrafts ? ` · ${stats.billDrafts} draft` : ''}`
            )
          }
          icon={Banknote}
          tone={stats.billsOverdue ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}
          to="/bills"
        />
        <Kpi
          label="Net position"
          value={`${stats.net < 0 ? '−' : ''}${formatCurrency(Math.abs(stats.net), sym)}`}
          sub={
            <span className={stats.net >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-rose-600'}>
              {stats.net >= 0 ? 'Receivables cover open bills' : 'Open bills exceed receivables'}
            </span>
          }
          icon={AlertCircle}
          tone={stats.net >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}
          to="/"
        />
        <Kpi
          label="Money in this month"
          value={formatCurrency(stats.collectedThis, sym)}
          sub={
            delta === null ? (
              'No payments received last month'
            ) : (
              <span className={delta >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-rose-600'}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% vs last month
              </span>
            )
          }
          icon={CheckCircle2}
          tone="bg-emerald-50 text-emerald-600"
          to="/receipts"
        />
        <Kpi
          label="Money out this month"
          value={formatCurrency(stats.paidOutThis, sym)}
          sub={`${formatCurrency(stats.paidOutLast, sym)} paid out last month`}
          icon={Receipt}
          tone="bg-orange-50 text-orange-600"
          to="/bills"
        />
        <Kpi
          label="Open quotations"
          value={formatCurrency(stats.pipeline, sym)}
          sub={`${stats.pipelineCount} awaiting a decision`}
          icon={FileSignature}
          tone="bg-violet-50 text-violet-600"
          to="/quotations"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Cash flow */}
        <section className="card xl:col-span-2">
          <div className="card-header">
            <div>
              <h2 className="card-title">Cash flow</h2>
              <p className="card-subtitle">Last 6 months · {home}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-4 text-xs text-slate-600 sm:flex">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.invoiced }} /> Invoiced
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.collected }} /> Collected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.paidOut }} /> Paid out
                </span>
              </div>
              <div className="segmented">
                <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>
                  Chart
                </button>
                <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>
                  Table
                </button>
              </div>
            </div>
          </div>
          <div className="px-3 pb-4 pt-5 sm:px-5">
            {!hasChartData ? (
              <div className="flex h-[260px] flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-slate-700">No activity yet</p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">Invoices, payments received and bills paid will appear here month by month.</p>
              </div>
            ) : view === 'chart' ? (
              <div className="h-[260px]" role="img" aria-label="Bar chart of invoiced, collected and paid-out amounts for the last six months">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} barGap={2} barCategoryGap="28%">
                    <CartesianGrid vertical={false} stroke="#eef2f7" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={6} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickFormatter={(v: number) => compact(v, sym)}
                    />
                    <Tooltip cursor={{ fill: 'rgb(148 163 184 / 0.12)' }} content={<ChartTooltip sym={sym} />} />
                    <Bar dataKey="invoiced" fill={SERIES.invoiced} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="collected" fill={SERIES.collected} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="paidOut" fill={SERIES.paidOut} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Invoiced</th>
                    <th className="text-right">Collected</th>
                    <th className="text-right">Paid out</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month}>
                      <td>{m.month}</td>
                      <td className="text-right tabular">{formatCurrency(m.invoiced, sym)}</td>
                      <td className="text-right tabular">{formatCurrency(m.collected, sym)}</td>
                      <td className="text-right tabular">{formatCurrency(m.paidOut, sym)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {foreignCount > 0 && (
              <p className="mt-3 px-1 text-xs text-slate-400">
                {foreignCount} document{foreignCount === 1 ? '' : 's'} in other currencies are excluded from these totals.
              </p>
            )}
          </div>
        </section>

        {/* Attention / onboarding */}
        <div className="space-y-6">
          {showChecklist && (
            <section className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Get set up</h2>
                  <p className="card-subtitle">
                    {doneCount} of {checklist.length} complete
                  </p>
                </div>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-primary-600" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
                </div>
              </div>
              <ul className="p-2">
                {checklist.map((c) => (
                  <li key={c.label}>
                    <Link to={c.to} className="menu-item">
                      {c.done ? (
                        <CheckCircle2 size={17} className="text-emerald-600" />
                      ) : (
                        <Circle size={17} className="text-slate-300" />
                      )}
                      <span className={`flex-1 ${c.done ? 'text-slate-400 line-through' : ''}`}>{c.label}</span>
                      {!c.done && <ArrowRight size={14} className="text-slate-400" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Needs attention</h2>
                <p className="card-subtitle">Join requests, overdue invoices, due bills and expiring quotes</p>
              </div>
            </div>
            {alerts.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle2 size={26} className="mx-auto text-emerald-500" />
                <p className="mt-2.5 text-sm font-medium text-slate-800">All caught up</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {stats.payables > 0 ? `${formatCurrency(stats.payables, sym)} in vendor bills pending, none due this week.` : 'Nothing needs your attention right now.'}
                </p>
              </div>
            ) : (
              <ul className="p-2">
                {alerts.map((a) => {
                  const t = ALERT_TONE[a.tone];
                  return (
                    <li key={a.id}>
                      <Link to={a.link} className="menu-item items-start">
                        <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${t.cls}`}>
                          <t.icon size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-900">{a.title}</span>
                          <span className="block truncate text-xs text-slate-500">{a.detail}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Recent documents */}
      <section className="card overflow-hidden">
        <div className="card-header">
          <div>
            <h2 className="card-title">Recent documents</h2>
            <p className="card-subtitle">Latest changes across quotations, invoices, receipts and bills</p>
          </div>
        </div>
        {recent.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-700">Nothing here yet</p>
            <p className="mt-1 text-xs text-slate-500">Create a quotation or invoice. It'll show up here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <tbody>
                {recent.map((d) => (
                  <tr key={`${d.type}-${d.id}`}>
                    <td className="w-[1%]">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <d.icon size={15} />
                      </span>
                    </td>
                    <td>
                      <Link to={d.link} className="font-mono text-[13px] font-medium text-slate-900 hover:text-primary-700">
                        {d.number}
                      </Link>
                      <p className="text-xs text-slate-500">{d.type}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={d.party || '?'} size="xs" />
                        <span className="truncate text-slate-700">{d.party || '—'}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-slate-500">{formatDate(d.at, 'dd MMM, HH:mm')}</td>
                    <td className="whitespace-nowrap text-right font-medium text-slate-900 tabular">{formatCurrency(d.amount, d.sym || sym)}</td>
                    <td className="w-[1%]">
                      <StatusBadge status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
