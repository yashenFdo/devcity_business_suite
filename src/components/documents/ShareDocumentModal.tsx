import React, { useEffect, useId, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Check,
  Copy,
  Eye,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquareText,
  Share,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Modal } from '../ui/Modal';
import { useSession } from '../../security/sessionState';
import {
  buildShareSnapshot,
  createShareLink,
  listShareLinks,
  revokeShareLink,
  shareLinkState,
  type ShareCollection,
  type ShareLink,
} from '../../cloud/sharing';
import type { DocumentData } from './documentTypes';
import type { TemplateId } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

export interface ShareContact {
  name?: string;
  email?: string;
  phone?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  collection: ShareCollection;
  recordId: string;
  /** The same data the page renders with DocumentPreviewRenderer. */
  data: DocumentData;
  templateId?: TemplateId;
  /** Client (or vendor, for bills) to prefill the channels with. */
  contact?: ShareContact;
}

const TYPE_LABEL: Record<DocumentData['documentType'], string> = {
  quotation: 'Quotation',
  invoice: 'Invoice',
  bill: 'Bill',
  receipt: 'Receipt',
};

const EXPIRY_OPTIONS: { days: number; label: string; hint: string }[] = [
  { days: 7, label: '7 days', hint: 'Short-lived' },
  { days: 30, label: '30 days', hint: 'Recommended' },
  { days: 90, label: '90 days', hint: 'Long-running' },
  { days: 0, label: 'Never', hint: 'Until revoked' },
];

// ─── Helpers ─────────────────────────────────────────────────

/** Digits only, plus whether the number carries a country code (wa.me needs one). */
const normalisePhone = (raw: string) => {
  const t = raw.trim();
  let digits = t.replace(/\D/g, '');
  const prefixed = t.startsWith('+') || t.startsWith('00');
  if (!t.startsWith('+') && t.startsWith('00')) digits = digits.slice(2);
  const international = digits.length >= 8 && digits.length <= 15 && (prefixed || (digits.length >= 11 && !digits.startsWith('0')));
  return { digits, international };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const firstName = (name?: string) => (name ?? '').trim().split(/\s+/)[0] ?? '';

const buildMessage = (data: DocumentData, link: string, contact: ShareContact | undefined, sender: string) => {
  const company = data.company.name || 'our team';
  const money = (n?: number) => formatCurrency(n ?? 0, data.currencySymbol);
  const until = data.dueDateOrExpiry ? formatDate(data.dueDateOrExpiry) : '';
  const isBill = data.documentType === 'bill';
  const who = isBill ? (contact?.name || data.vendorName || '').trim() : firstName(contact?.name || data.customer?.name || data.customer?.company);
  const greeting = who ? `Hi ${who},` : 'Hello,';

  let body: string;
  switch (data.documentType) {
    case 'quotation':
      body = `Please find quotation ${data.number} from ${company} for ${money(data.total)}${until ? `, valid until ${until}` : ''}.`;
      break;
    case 'receipt':
      body = `Thank you, we have received your payment of ${money(data.amountPaid ?? data.total)}. Please find receipt ${data.number} from ${company} for your records.`;
      break;
    case 'bill':
      body = `Please find bill ${data.number} for ${money(data.total)} as recorded by ${company}${until ? `, due ${until}` : ''}.`;
      break;
    default: {
      const balance = data.balanceDue ?? data.total;
      if (data.status === 'paid' || balance <= 0) {
        body = `Please find invoice ${data.number} from ${company} for ${money(data.total)}, paid in full. Thank you!`;
      } else if (balance < data.total) {
        body = `Please find invoice ${data.number} from ${company} for ${money(data.total)} (balance due ${money(balance)})${until ? `, due ${until}` : ''}.`;
      } else {
        body = `Please find invoice ${data.number} from ${company} for ${money(data.total)}${until ? `, due ${until}` : ''}.`;
      }
    }
  }

  const signOff = [sender, sender && sender === company ? '' : company].filter(Boolean).join('\n');
  return `${greeting}\n\n${body}\n\nView and download: ${link}\n\nKind regards,\n${signOff}`;
};

const ago = (iso: string | null) => {
  if (!iso) return '';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '';
  }
};

// ─── Component ───────────────────────────────────────────────

/** Create a secure read-only link and send it by WhatsApp, email or SMS. */
export const ShareDocumentModal: React.FC<Props> = (props) => (props.isOpen ? <ShareDialog {...props} /> : null);

const ShareDialog: React.FC<Props> = ({ onClose, collection, recordId, data, templateId, contact }) => {
  const user = useSession((s) => s.user);
  const typeLabel = TYPE_LABEL[data.documentType];
  const ids = useId();

  const [days, setDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [linksError, setLinksError] = useState('');
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listShareLinks(collection, recordId)
      .then((l) => {
        if (alive) setLinks(l);
      })
      .catch((e: Error) => {
        if (alive) setLinksError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [collection, recordId]);

  const refreshLinks = () =>
    listShareLinks(collection, recordId)
      .then((l) => {
        setLinks(l);
        setLinksError('');
      })
      .catch((e: Error) => setLinksError(e.message));

  const create = async () => {
    setCreating(true);
    try {
      const link = await createShareLink({
        collection,
        recordId,
        number: data.number,
        snapshot: buildShareSnapshot(data, templateId),
        days,
      });
      setUrl(link);
      setExpiresAt(days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null);
      setMessage(buildMessage(data, link, contact, user?.name ?? ''));
      setCopied(false);
      void refreshLinks();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.');
    }
  };

  const revoke = async (link: ShareLink) => {
    setRevoking(link.id);
    try {
      await revokeShareLink(link);
      toast.success('Link revoked');
      setConfirmRevoke(null);
      await refreshLinks();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRevoking(null);
    }
  };

  const shareNative = async () => {
    if (!url) return;
    try {
      await navigator.share({ title: `${typeLabel} ${data.number}`, text: message, url });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error('Sharing is not available on this device.');
    }
  };

  const { digits, international } = normalisePhone(phone);
  const text = encodeURIComponent(message);
  const whatsappHref = `https://wa.me/${international ? digits : ''}?text=${text}`;
  const smsTarget = digits ? (international ? `+${digits}` : phone.replace(/[^\d+]/g, '')) : '';
  const smsHref = `sms:${smsTarget}?&body=${text}`;
  const company = data.company.name || 'DevCity';
  const emailTarget = EMAIL_RE.test(email.trim()) ? encodeURIComponent(email.trim()).replace(/%40/g, '@') : '';
  const mailHref = `mailto:${emailTarget}?subject=${encodeURIComponent(`${typeLabel} ${data.number} from ${company}`)}&body=${text}`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const amount = data.documentType === 'receipt' ? (data.amountPaid ?? data.total) : data.total;
  const recipientName = contact?.name || (data.documentType === 'bill' ? data.vendorName : data.customer?.company || data.customer?.name);
  const isAdmin = user?.role === 'admin';

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={`Share ${typeLabel.toLowerCase()}`}
      description={url ? 'Your secure link is ready. Send it any way you like.' : 'Create a secure, read-only link to send by WhatsApp, email or SMS.'}
      footer={
        url ? (
          <>
            <button type="button" className="btn-ghost mr-auto" onClick={() => setUrl(null)}>
              <ArrowLeft size={15} /> New link
            </button>
            <button type="button" className="btn-primary" onClick={onClose}>
              Done
            </button>
          </>
        ) : undefined
      }
    >
      {/* Document summary */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-primary-600 shadow-xs ring-1 ring-slate-200">
          <Link2 size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[13px] font-semibold text-slate-900">{data.number}</p>
          <p className="truncate text-xs text-slate-500">
            {typeLabel}
            {recipientName ? ` · ${recipientName}` : ''}
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-900 tabular">{formatCurrency(amount, data.currencySymbol)}</p>
      </div>

      {!url ? (
        <div className="mt-5">
          <fieldset>
            <legend className="label">Link expires after</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {EXPIRY_OPTIONS.map((o) => {
                const active = days === o.days;
                return (
                  <label
                    key={o.days}
                    className={`relative flex cursor-pointer flex-col rounded-xl border px-3 py-2.5 transition-all focus-within:shadow-focus ${
                      active ? 'border-primary-500 bg-primary-50/60 ring-1 ring-primary-500' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${ids}-expiry`}
                      value={o.days}
                      checked={active}
                      onChange={() => setDays(o.days)}
                      className="sr-only"
                    />
                    <span className={`text-[13px] font-semibold ${active ? 'text-primary-700' : 'text-slate-900'}`}>{o.label}</span>
                    <span className="text-[11px] text-slate-500">{o.hint}</span>
                    {active && <Check size={14} className="absolute right-2.5 top-2.5 text-primary-600" aria-hidden="true" />}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <p className="mt-4 flex gap-2 text-xs leading-relaxed text-slate-500">
            <ShieldCheck size={15} className="mt-px flex-shrink-0 text-emerald-600" />
            Anyone with the link can view and download this document until it expires or you revoke it. Later edits won't change what
            they see; create a new link after updating it.
          </p>

          <button type="button" className="btn-primary btn-lg mt-5 w-full" onClick={create} disabled={creating}>
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
            {creating ? 'Creating link…' : 'Create secure link'}
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {/* Link */}
          <div>
            <label htmlFor={`${ids}-url`} className="label">
              Secure link
            </label>
            <div className="flex gap-2">
              <input
                id={`${ids}-url`}
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="input h-11 flex-1 bg-slate-50 font-mono text-[12px] text-slate-700"
              />
              <button type="button" className="btn-secondary h-11 min-w-[96px]" onClick={copy}>
                {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="hint">
              {expiresAt ? `Expires ${formatDate(expiresAt)}.` : 'Never expires.'} The full link is only shown now; you can always create a new one.
            </p>
          </div>

          {/* Channels */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ChannelLink href={whatsappHref} external label="WhatsApp" tone="bg-[#25D366] text-white" icon={MessageCircle} />
            <ChannelLink href={mailHref} label="Email" tone="bg-primary-600 text-white" icon={Mail} />
            <ChannelLink href={smsHref} label="SMS" tone="bg-violet-600 text-white" icon={MessageSquareText} />
            {canNativeShare ? (
              <ChannelButton onClick={shareNative} label="More…" tone="bg-slate-800 text-white" icon={Share} />
            ) : (
              <ChannelButton
                onClick={() =>
                  navigator.clipboard
                    .writeText(message)
                    .then(() => toast.success('Message copied'))
                    .catch(() => toast.error('Could not copy the message.'))
                }
                label="Copy message"
                tone="bg-slate-800 text-white"
                icon={Copy}
              />
            )}
          </div>

          {/* Recipient */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${ids}-phone`} className="label">
                Phone (WhatsApp &amp; SMS)
              </label>
              <input
                id={`${ids}-phone`}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+94 77 123 4567"
                className="input"
              />
              <p className="hint">
                {!phone.trim()
                  ? "Leave empty to pick a contact in WhatsApp."
                  : international
                    ? 'Opens a chat with this number.'
                    : 'Add the country code (e.g. +94) to open the chat directly.'}
              </p>
            </div>
            <div>
              <label htmlFor={`${ids}-email`} className="label">
                Email
              </label>
              <input
                id={`${ids}-email`}
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@company.com"
                className={`input ${email.trim() && !emailTarget ? 'input-error' : ''}`}
              />
              <p className="hint">{email.trim() && !emailTarget ? 'This email address looks incomplete.' : 'Opens your email app with the message ready.'}</p>
            </div>
          </div>

          {/* Message */}
          <div>
            <label htmlFor={`${ids}-msg`} className="label">
              Message
            </label>
            <textarea
              id={`${ids}-msg`}
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="textarea text-[13px]"
            />
            {!message.includes(url) && <p className="hint text-amber-600">The link is no longer in the message. Recipients won't be able to open the document.</p>}
          </div>
        </div>
      )}

      {/* Existing links */}
      <section className="mt-6 border-t border-slate-100 pt-5" aria-labelledby={`${ids}-links`}>
        <h3 id={`${ids}-links`} className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Links for this document{links && links.length > 0 ? ` (${links.length})` : ''}
        </h3>
        {links === null && !linksError ? (
          <div className="flex items-center gap-2 py-4 text-[13px] text-slate-400">
            <Loader2 size={15} className="animate-spin" /> Loading links…
          </div>
        ) : linksError ? (
          <p className="py-3 text-[13px] text-rose-600">{linksError}</p>
        ) : links && links.length === 0 ? (
          <p className="py-3 text-[13px] text-slate-500">No links yet. Links you create appear here so you can track views or revoke them.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {(links ?? []).map((l) => {
              const state = shareLinkState(l);
              const mine = !!user && l.createdBy === user.id;
              const canRevoke = state === 'active' && (mine || isAdmin);
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13px] text-slate-800">
                      <span>Created {formatDate(l.createdAt, 'dd MMM yyyy, HH:mm')}</span>
                      <LinkStateBadge state={state} />
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {l.createdByName ? `${mine ? 'You' : l.createdByName} · ` : ''}
                      {state === 'revoked'
                        ? `Revoked ${formatDate(l.revokedAt ?? undefined)}`
                        : l.expiresAt
                          ? `${state === 'expired' ? 'Expired' : 'Expires'} ${formatDate(l.expiresAt)}`
                          : 'Never expires'}
                      {' · '}
                      <span className="inline-flex items-center gap-1">
                        <Eye size={12} className="text-slate-400" /> {l.viewCount} {l.viewCount === 1 ? 'view' : 'views'}
                      </span>
                      {l.lastViewedAt ? ` · last ${ago(l.lastViewedAt)}` : ''}
                    </p>
                  </div>
                  {canRevoke &&
                    (confirmRevoke === l.id ? (
                      <span className="flex items-center gap-1.5">
                        <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmRevoke(null)} disabled={revoking === l.id}>
                          Keep
                        </button>
                        <button type="button" className="btn-danger btn-sm" onClick={() => revoke(l)} disabled={revoking === l.id}>
                          {revoking === l.id ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />} Revoke now
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => setConfirmRevoke(l.id)}
                        aria-label={`Revoke link created ${formatDate(l.createdAt)}`}
                      >
                        <Ban size={13} /> Revoke
                      </button>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Modal>
  );
};

const LinkStateBadge: React.FC<{ state: ReturnType<typeof shareLinkState> }> = ({ state }) => {
  const styles = {
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    expired: 'border-amber-200 bg-amber-50 text-amber-700',
    revoked: 'border-slate-200 bg-slate-100 text-slate-600',
  }[state];
  return <span className={`badge ${styles}`}>{state === 'active' ? 'Active' : state === 'expired' ? 'Expired' : 'Revoked'}</span>;
};

interface ChannelProps {
  label: string;
  tone: string;
  icon: React.ElementType;
}

const channelClass =
  'group flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-3.5 text-[13px] font-medium text-slate-700 shadow-xs transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card focus-visible:outline-none focus-visible:shadow-focus';

const ChannelIcon: React.FC<Pick<ChannelProps, 'tone' | 'icon'>> = ({ tone, icon: Icon }) => (
  <span className={`flex h-10 w-10 items-center justify-center rounded-full ${tone}`}>
    <Icon size={19} aria-hidden="true" />
  </span>
);

const ChannelLink: React.FC<ChannelProps & { href: string; external?: boolean }> = ({ href, external, label, tone, icon }) => (
  <a href={href} className={channelClass} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
    <ChannelIcon tone={tone} icon={icon} />
    {label}
  </a>
);

const ChannelButton: React.FC<ChannelProps & { onClick: () => void }> = ({ onClick, label, tone, icon }) => (
  <button type="button" onClick={onClick} className={channelClass}>
    <ChannelIcon tone={tone} icon={icon} />
    {label}
  </button>
);
