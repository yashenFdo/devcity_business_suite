import { format, parseISO, isValid } from 'date-fns';

export const formatCurrency = (
  amount: number,
  symbolOrCode: string = '$'
): string => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  
  // Detect if passed a symbol or code
  let prefix = symbolOrCode;

  if (symbolOrCode === 'USD' || symbolOrCode === '$') {
    prefix = '$';
  } else if (symbolOrCode === 'LKR' || symbolOrCode === 'Rs' || symbolOrCode === 'Rs.') {
    prefix = 'Rs. ';
  } else if (symbolOrCode === 'EUR' || symbolOrCode === '€') {
    prefix = '€';
  } else if (symbolOrCode === 'GBP' || symbolOrCode === '£') {
    prefix = '£';
  }

  const formattedNum = safeAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${prefix}${formattedNum}`;
};

export const formatDate = (dateStr?: string, fmt: string = 'dd MMM yyyy'): string => {
  if (!dateStr) return '-';
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, fmt);
  } catch {
    return dateStr;
  }
};

export const formatDateInput = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return '';
    return format(date, 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

export const today = (): string => {
  return format(new Date(), 'yyyy-MM-dd');
};

export const addDays = (dateStr: string, days: number): string => {
  try {
    const date = parseISO(dateStr);
    date.setDate(date.getDate() + days);
    return format(date, 'yyyy-MM-dd');
  } catch {
    return dateStr;
  }
};

export const isOverdue = (dueDateStr: string): boolean => {
  try {
    const dueDate = parseISO(dueDateStr);
    return dueDate < new Date();
  } catch {
    return false;
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'sent': return 'bg-primary-50 text-primary-700 border-primary-200';
    case 'accepted': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'rejected': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'cancelled': return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'expired': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'overdue': return 'bg-red-50 text-red-700 border-red-200';
    case 'partially_paid': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'unpaid': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'draft': return 'Draft';
    case 'sent': return 'Sent';
    case 'accepted': return 'Accepted';
    case 'paid': return 'Paid';
    case 'rejected': return 'Declined';
    case 'cancelled': return 'Cancelled';
    case 'expired': return 'Expired';
    case 'overdue': return 'Overdue';
    case 'partially_paid': return 'Partially Paid';
    case 'unpaid': return 'Unpaid';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

export const truncate = (str: string, maxLen: number = 30): string => {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
};
