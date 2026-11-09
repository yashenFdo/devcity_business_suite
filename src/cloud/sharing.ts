// ============================================================
// Secure, read-only document links (WhatsApp, email, SMS…).
// Tokens are random, only their SHA-256 hash is stored, and every
// rule (membership, expiry, revocation) is enforced in the database.
// ============================================================
import { friendlyError, supabase, supabaseConfigured } from './supabase';
import { rpc } from './team';
import { currentWorkspaceId } from '../security/sessionState';
import { logAudit } from '../store/useAuditStore';
import type { DocumentData } from '../components/documents/documentTypes';
import { companySignatories } from '../components/documents/signOff';
import { DEFAULT_TEMPLATE } from '../components/documents/templateOptions';
import type { TemplateId } from '../types';

export type ShareCollection = 'quotations' | 'invoices' | 'bills' | 'receipts';

export interface ShareLink {
  id: string;
  documentNumber: string;
  createdBy: string | null;
  createdByName?: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
}

export type ShareLinkState = 'active' | 'expired' | 'revoked';

export const shareLinkState = (l: Pick<ShareLink, 'expiresAt' | 'revokedAt'>): ShareLinkState =>
  l.revokedAt ? 'revoked' : l.expiresAt && new Date(l.expiresAt).getTime() < Date.now() ? 'expired' : 'active';

/** Matches the token shape produced by create_share_link (64 hex chars, with some headroom). */
export const SHARE_PATH = /^\/d\/([A-Za-z0-9]{32,128})\/?$/;

const MAX_SNAPSHOT_BYTES = 2_900_000;

const ws = () => {
  const id = currentWorkspaceId();
  if (!id) throw new Error('No workspace selected');
  return id;
};

/**
 * The exact data the template renders, with internal-only details removed:
 * private customer notes and signatories that don't appear on this document.
 */
export const buildShareSnapshot = (data: DocumentData, templateId?: TemplateId): DocumentData => {
  const templateFallback = companySignatories(data.company).slice(0, 1);
  const visibleSignatories = data.signatories ?? templateFallback;
  const company = { ...data.company, signatories: visibleSignatories };
  delete company.defaultSignatoryIds;
  const customer = data.customer ? { ...data.customer } : undefined;
  if (customer) delete customer.notes;
  return {
    ...data,
    customer,
    company,
    templateId: templateId || data.templateId || DEFAULT_TEMPLATE,
  };
};

export const shareUrl = (token: string) => `${window.location.origin}/d/${token}`;

export const createShareLink = async (args: {
  collection: ShareCollection;
  recordId: string;
  number: string;
  snapshot: DocumentData;
  /** 0 or less = never expires. */
  days: number;
}): Promise<string> => {
  const snapshot = JSON.parse(JSON.stringify(args.snapshot)) as DocumentData;
  if (new Blob([JSON.stringify(snapshot)]).size > MAX_SNAPSHOT_BYTES) {
    throw new Error('This document is too large to share (try a smaller logo or signature image).');
  }
  const token = await rpc<string>('create_share_link', {
    p_workspace: ws(),
    p_collection: args.collection,
    p_record_id: args.recordId,
    p_number: args.number,
    p_snapshot: snapshot,
    p_days: args.days > 0 ? Math.min(365, Math.round(args.days)) : 0,
  });
  if (typeof token !== 'string' || !/^[A-Za-z0-9]{32,128}$/.test(token)) throw new Error('Could not create the link. Please try again.');
  logAudit('document', 'Shared via link', args.number);
  return shareUrl(token);
};

interface ShareRow {
  id: string;
  document_number: string;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  creator: { full_name: string | null; email: string | null } | null;
}

export const listShareLinks = async (collection: ShareCollection, recordId: string): Promise<ShareLink[]> => {
  const { data, error } = await supabase
    .from('shared_documents')
    .select(
      'id, document_number, created_by, created_at, expires_at, revoked_at, view_count, last_viewed_at, creator:profiles(full_name, email)'
    )
    .eq('workspace_id', ws())
    .eq('collection', collection)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(friendlyError(error));
  return ((data ?? []) as unknown as ShareRow[]).map((r) => ({
    id: r.id,
    documentNumber: r.document_number,
    createdBy: r.created_by,
    createdByName: r.creator?.full_name || r.creator?.email || undefined,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    viewCount: r.view_count,
    lastViewedAt: r.last_viewed_at,
  }));
};

export const revokeShareLink = async (link: Pick<ShareLink, 'id' | 'documentNumber'>) => {
  await rpc<null>('revoke_share_link', { p_link: link.id });
  logAudit('document', 'Revoked share link', link.documentNumber);
};

// ─── Public side (works signed out) ──────────────────────────

export type SharedDocumentResult =
  | { status: 'active'; snapshot: DocumentData; documentNumber: string; workspaceName: string; expiresAt: string | null }
  | { status: 'expired'; documentNumber: string; workspaceName: string; expiresAt: string | null }
  | { status: 'revoked'; documentNumber: string; workspaceName: string; expiresAt: string | null }
  | { status: 'notFound' };

interface SharedRow {
  snapshot: unknown;
  document_number: string;
  workspace_name: string | null;
  status: 'active' | 'expired' | 'revoked';
  expires_at: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Light shape check so a malformed snapshot never crashes a template. */
const asDocumentData = (v: unknown): DocumentData | null => {
  if (!isRecord(v) || !isRecord(v.company) || !Array.isArray(v.lineItems)) return null;
  if (typeof v.number !== 'string' || typeof v.documentType !== 'string') return null;
  if (!['quotation', 'invoice', 'bill', 'receipt'].includes(v.documentType)) return null;
  return v as unknown as DocumentData;
};

export const openSharedDocument = async (token: string): Promise<SharedDocumentResult> => {
  if (!supabaseConfigured()) return { status: 'notFound' };
  const { data, error } = await supabase.rpc('get_shared_document', { p_token: token });
  if (error) throw new Error(friendlyError(error));
  const row = (Array.isArray(data) ? data[0] : data) as SharedRow | undefined | null;
  if (!row) return { status: 'notFound' };
  const base = { documentNumber: row.document_number, workspaceName: row.workspace_name ?? '', expiresAt: row.expires_at };
  if (row.status !== 'active') return { status: row.status === 'revoked' ? 'revoked' : 'expired', ...base };
  const snapshot = asDocumentData(row.snapshot);
  if (!snapshot) return { status: 'notFound' };
  return { status: 'active', snapshot, ...base };
};
