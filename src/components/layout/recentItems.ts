// Recently opened documents (IDs only — no document content is stored).
export type RecentKind = 'invoices' | 'quotations' | 'bills' | 'receipts';
export interface RecentItem {
  kind: RecentKind;
  id: string;
  at: number;
}

const key = (ws: string) => `devcity:recent:${ws}`;
const MAX = 8;

export const getRecent = (ws: string | undefined): RecentItem[] => {
  if (!ws) return [];
  try {
    const list = JSON.parse(localStorage.getItem(key(ws)) || '[]') as RecentItem[];
    return Array.isArray(list) ? list.slice(0, MAX) : [];
  } catch {
    return [];
  }
};

/** Called on navigation: /invoices/:id etc. */
export const recordVisit = (ws: string | undefined, pathname: string) => {
  const m = pathname.match(/^\/(invoices|quotations|bills|receipts)\/([^/]+)$/);
  if (!ws || !m || m[2] === 'new') return;
  const item: RecentItem = { kind: m[1] as RecentKind, id: m[2], at: Date.now() };
  try {
    const next = [item, ...getRecent(ws).filter((r) => !(r.kind === item.kind && r.id === item.id))].slice(0, MAX);
    localStorage.setItem(key(ws), JSON.stringify(next));
  } catch {
    /* storage unavailable — ignore */
  }
};
