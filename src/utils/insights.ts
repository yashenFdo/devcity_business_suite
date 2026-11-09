import { differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import type { Bill, Invoice, Quotation } from '../types';
import type { JoinRequest } from '../store/useAccessStore';

const daysUntil = (dateStr?: string): number | null => {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  return isValid(d) ? differenceInCalendarDays(d, new Date()) : null;
};

/** Invoice status taking the due date into account (overdue is derived, not just stored). */
export const effectiveInvoiceStatus = (inv: Invoice): Invoice['status'] => {
  if (inv.status === 'draft' || inv.status === 'cancelled' || inv.status === 'paid') return inv.status;
  if ((inv.balanceDue ?? 0) <= 0 && inv.total > 0) return 'paid';
  const d = daysUntil(inv.dueDate);
  return d !== null && d < 0 ? 'overdue' : inv.status;
};

export const effectiveQuotationStatus = (q: Quotation): Quotation['status'] => {
  if (q.status !== 'sent' && q.status !== 'draft') return q.status;
  const d = daysUntil(q.validUntil);
  return q.status === 'sent' && d !== null && d < 0 ? 'expired' : q.status;
};

export const effectiveBillStatus = (b: Bill): Bill['status'] => {
  if (b.status !== 'unpaid') return b.status;
  const d = daysUntil(b.dueDate);
  return d !== null && d < 0 ? 'overdue' : b.status;
};

export type AlertTone = 'danger' | 'warning' | 'info';

export interface WorkspaceAlert {
  id: string;
  tone: AlertTone;
  title: string;
  detail: string;
  link: string;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export const buildAlerts = (invoices: Invoice[], quotations: Quotation[], bills: Bill[]): WorkspaceAlert[] => {
  const alerts: WorkspaceAlert[] = [];

  for (const inv of invoices) {
    if (effectiveInvoiceStatus(inv) !== 'overdue') continue;
    const d = Math.abs(daysUntil(inv.dueDate) ?? 0);
    alerts.push({
      id: `inv-${inv.id}`,
      tone: 'danger',
      title: `${inv.invoiceNumber} is overdue`,
      detail: `${inv.customer?.company || inv.customer?.name || 'Client'} · ${plural(d, 'day')} late`,
      link: `/invoices/${inv.id}`,
    });
  }

  for (const b of bills) {
    if (b.status !== 'unpaid' && b.status !== 'overdue') continue;
    const d = daysUntil(b.dueDate);
    if (d === null || d > 7) continue;
    alerts.push({
      id: `bill-${b.id}`,
      tone: d < 0 ? 'danger' : 'warning',
      title: d < 0 ? `Bill ${b.billNumber} is overdue` : `Bill ${b.billNumber} due ${d === 0 ? 'today' : `in ${plural(d, 'day')}`}`,
      detail: b.vendorName || 'Vendor',
      link: `/bills/${b.id}`,
    });
  }

  for (const q of quotations) {
    if (q.status !== 'sent') continue;
    const d = daysUntil(q.validUntil);
    if (d === null || d < 0 || d > 7) continue;
    alerts.push({
      id: `quo-${q.id}`,
      tone: 'info',
      title: `${q.quotationNumber} expires ${d === 0 ? 'today' : `in ${plural(d, 'day')}`}`,
      detail: `Awaiting ${q.customer?.company || q.customer?.name || 'client'}`,
      link: `/quotations/${q.id}`,
    });
  }

  const rank: Record<AlertTone, number> = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.tone] - rank[b.tone]);
};

/** Human-friendly due-date phrase, e.g. "Due in 5 days", "3 days overdue". */
export const dueLabel = (dateStr?: string): { text: string; tone: 'muted' | 'warning' | 'danger' } => {
  const d = daysUntil(dateStr);
  if (d === null) return { text: '—', tone: 'muted' };
  if (d < 0) return { text: `${plural(-d, 'day')} overdue`, tone: 'danger' };
  if (d === 0) return { text: 'Due today', tone: 'warning' };
  if (d <= 7) return { text: `Due in ${plural(d, 'day')}`, tone: 'warning' };
  return { text: `Due in ${plural(d, 'day')}`, tone: 'muted' };
};

/** Admin alerts for people waiting to join the workspace. */
export const joinRequestAlerts = (requests: JoinRequest[]): WorkspaceAlert[] =>
  requests.map((r) => ({
    id: `join-${r.id}`,
    tone: 'warning' as const,
    title: `${r.name} wants to join`,
    detail: r.message ? `“${r.message}”` : `${r.email} · approve or decline`,
    link: '/settings/team#join-requests',
  }));
