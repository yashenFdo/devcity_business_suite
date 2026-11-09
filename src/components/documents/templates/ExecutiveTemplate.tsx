import React from 'react';
import type { DocumentData } from '../documentTypes';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { amountInWords } from '../../../utils/amountInWords';

// ============================================================
// Executive — the flagship DevCity template.
// Clean hierarchy, generous whitespace, one accent colour taken
// from Company Settings → Branding. Designed for A4 print.
// ============================================================

const TITLES: Record<DocumentData['documentType'], string> = {
  quotation: 'Quotation',
  invoice: 'Invoice',
  bill: 'Vendor Bill',
  receipt: 'Payment Receipt',
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  stripe: 'Stripe',
  paypal: 'PayPal',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
};

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  unpaid: { label: 'Unpaid', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  partially_paid: { label: 'Part paid', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  overdue: { label: 'Overdue', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  accepted: { label: 'Accepted', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  rejected: { label: 'Declined', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  expired: { label: 'Expired', cls: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
  cancelled: { label: 'Void', cls: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
};

const Label: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 ${className}`}>{children}</p>
);

const MetaCell: React.FC<{ label: string; value: React.ReactNode; strong?: boolean; accent?: string }> = ({
  label,
  value,
  strong,
  accent,
}) => (
  <div className="min-w-0">
    <Label>{label}</Label>
    <p
      className={`mt-1.5 truncate ${strong ? 'text-[15px] font-semibold' : 'text-[12.5px] font-medium text-slate-800'}`}
      style={strong ? { color: accent } : undefined}
    >
      {value}
    </p>
  </div>
);

const joinAddress = (parts: (string | undefined)[]) => parts.map((p) => p?.trim()).filter(Boolean).join(', ');

export const ExecutiveTemplate: React.FC<{ data: DocumentData }> = ({ data }) => {
  const { company, customer, currencySymbol: cur } = data;
  const accent = company.brandColor || '#2549eb';
  const tint = `color-mix(in srgb, ${accent} 7%, white)`;
  const type = data.documentType;
  const isQuote = type === 'quotation';
  const isInvoice = type === 'invoice';
  const isBill = type === 'bill';
  const isReceipt = type === 'receipt';
  const money = (n: number | undefined) => formatCurrency(n ?? 0, cur);

  const items = data.lineItems.filter((i) => i.description?.trim() || i.unitPrice);
  const showDiscount = items.some((i) => i.discount > 0);
  const showTax = items.some((i) => i.tax > 0);
  const amountPaid = data.amountPaid ?? 0;
  const amountDue = isReceipt ? data.amountPaid ?? data.total : data.balanceDue ?? data.total;
  const status = STATUS_STYLES[data.status];
  const isPaid = data.status === 'paid' || isReceipt;

  const companyAddress = joinAddress([
    company.address.street,
    company.address.city,
    joinAddress([company.address.state, company.address.zipCode]).replace(',', ''),
    company.address.country,
  ]);
  const partyLabel = isBill ? 'Vendor' : isReceipt ? 'Received from' : isQuote ? 'Prepared for' : 'Bill to';
  const dateLabel = isQuote ? 'Valid until' : 'Due date';

  return (
    <div
      className="doc-paper relative flex flex-col overflow-hidden"
      style={{ fontFamily: '"Inter Variable", Inter, system-ui, sans-serif' }}
    >
      {/* Draft watermark */}
      {data.status === 'draft' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="rotate-[-28deg] select-none text-[150px] font-black tracking-[0.12em] text-slate-900/[0.035]">
            DRAFT
          </span>
        </div>
      )}

      <div className="h-[6px] w-full" style={{ background: accent }} />

      <div className="relative flex flex-1 flex-col px-[56px] pb-[40px] pt-[44px]">
        {/* ── Header ───────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            {company.logo ? (
              <img src={company.logo} alt={company.name} className="mb-3 max-h-[46px] max-w-[190px] object-contain" />
            ) : (
              <div className="mb-3 flex items-center gap-2.5">
                <span
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-[9px] text-[17px] font-bold text-white"
                  style={{ background: accent }}
                >
                  {company.name.charAt(0)}
                </span>
                <span className="text-[19px] font-semibold tracking-tight text-slate-900">{company.name}</span>
              </div>
            )}
            {company.tagline && <p className="max-w-[300px] text-[11px] leading-relaxed text-slate-500">{company.tagline}</p>}
          </div>

          <div className="text-right">
            <h1 className="text-[30px] font-light leading-none tracking-tight text-slate-900">{TITLES[type]}</h1>
            <p className="mt-2.5 font-mono text-[11.5px] font-medium text-slate-500">{data.number}</p>
            {status && data.status !== 'draft' && !isReceipt && (
              <span className={`mt-2.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${status.cls}`}>
                {status.label}
              </span>
            )}
          </div>
        </header>

        {/* ── Key facts ────────────────────────────────────── */}
        <section className="mt-9 grid grid-cols-4 gap-6 border-y border-slate-200 py-4">
          <MetaCell label={isReceipt ? 'Payment date' : 'Issue date'} value={formatDate(data.date)} />
          {isReceipt ? (
            <MetaCell label="Method" value={METHOD_LABELS[data.paymentMethod ?? ''] ?? 'Bank transfer'} />
          ) : (
            <MetaCell label={dateLabel} value={formatDate(data.dueDateOrExpiry)} />
          )}
          {isReceipt ? (
            <MetaCell label="Reference" value={data.referenceNumber || '—'} />
          ) : (
            <MetaCell label={isQuote ? 'Payment terms' : 'Terms'} value={data.paymentTerms || (isQuote ? 'As agreed' : 'Net 30')} />
          )}
          <MetaCell
            label={isReceipt ? 'Amount received' : isQuote ? 'Total' : 'Amount due'}
            value={money(isQuote ? data.total : amountDue)}
            strong
            accent={accent}
          />
        </section>

        {/* ── Parties ──────────────────────────────────────── */}
        <section className="mt-8 grid grid-cols-2 gap-12">
          <div>
            <Label>{isBill ? 'Billed to' : 'From'}</Label>
            <p className="mt-2 text-[13px] font-semibold text-slate-900">{company.name}</p>
            <div className="mt-1 space-y-0.5 text-[11.5px] leading-relaxed text-slate-600">
              {companyAddress && <p>{companyAddress}</p>}
              <p>{[company.email, company.phone].filter(Boolean).join(' · ')}</p>
              {company.taxNumber && <p className="text-slate-500">{company.taxNumber}</p>}
            </div>
          </div>
          <div>
            <Label>{partyLabel}</Label>
            {isBill ? (
              <>
                <p className="mt-2 text-[13px] font-semibold text-slate-900">{data.vendorName || '—'}</p>
                <div className="mt-1 space-y-0.5 text-[11.5px] leading-relaxed text-slate-600">
                  {data.vendorAddress && <p>{data.vendorAddress}</p>}
                  <p>{[data.vendorEmail, data.vendorPhone].filter(Boolean).join(' · ')}</p>
                </div>
              </>
            ) : customer?.name || customer?.company ? (
              <>
                <p className="mt-2 text-[13px] font-semibold text-slate-900">{customer.company || customer.name}</p>
                <div className="mt-1 space-y-0.5 text-[11.5px] leading-relaxed text-slate-600">
                  {customer.company && customer.name && <p className="font-medium text-slate-700">Attn: {customer.name}</p>}
                  {joinAddress([customer.address?.street, customer.address?.city, customer.address?.state, customer.address?.country]) && (
                    <p>
                      {joinAddress([customer.address?.street, customer.address?.city, customer.address?.state, customer.address?.country])}
                    </p>
                  )}
                  <p>{[customer.email, customer.phone].filter(Boolean).join(' · ')}</p>
                  {customer.taxNumber && <p className="text-slate-500">Tax ID: {customer.taxNumber}</p>}
                </div>
              </>
            ) : (
              <p className="mt-2 text-[12px] italic text-slate-400">Client not specified</p>
            )}
          </div>
        </section>

        {/* ── Project scope ────────────────────────────────── */}
        {data.projectDescription?.trim() && !isReceipt && (
          <section className="mt-8 rounded-r-md border-l-[3px] py-2.5 pl-4 pr-3" style={{ borderColor: accent, background: tint }}>
            <Label>{isQuote ? 'Scope of work' : 'Project'}</Label>
            <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-slate-700">{data.projectDescription}</p>
          </section>
        )}

        {/* ── Line items ───────────────────────────────────── */}
        {!isReceipt && (
          <section className="mt-8">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-[1.5px] border-slate-900 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <th className="w-8 pb-2.5 pr-2 font-semibold">#</th>
                  <th className="pb-2.5 pr-4 font-semibold">Description</th>
                  <th className="w-14 pb-2.5 text-right font-semibold">Qty</th>
                  <th className="w-24 pb-2.5 text-right font-semibold">Rate</th>
                  {showDiscount && <th className="w-14 pb-2.5 text-right font-semibold">Disc.</th>}
                  {showTax && <th className="w-14 pb-2.5 text-right font-semibold">Tax</th>}
                  <th className="w-28 pb-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[12px] italic text-slate-400">
                      No line items yet
                    </td>
                  </tr>
                )}
                {items.map((item, i) => (
                  <tr key={item.id || i} className="border-b border-slate-100 align-top" style={{ breakInside: 'avoid' }}>
                    <td className="py-3 pr-2 font-mono text-[10.5px] text-slate-400">{String(i + 1).padStart(2, '0')}</td>
                    <td className="py-3 pr-4">
                      <p className="whitespace-pre-line text-[12.5px] font-medium leading-snug text-slate-900">{item.description}</p>
                    </td>
                    <td className="py-3 text-right text-[12px] text-slate-700">
                      {item.quantity}
                      {item.unit && <span className="block text-[10px] text-slate-400">{item.unit}</span>}
                    </td>
                    <td className="py-3 text-right text-[12px] text-slate-700">{money(item.unitPrice)}</td>
                    {showDiscount && <td className="py-3 text-right text-[12px] text-slate-500">{item.discount ? `${item.discount}%` : '—'}</td>}
                    {showTax && <td className="py-3 text-right text-[12px] text-slate-500">{item.tax ? `${item.tax}%` : '—'}</td>}
                    <td className="py-3 text-right text-[12.5px] font-semibold text-slate-900">{money(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-5 flex items-start justify-between gap-10" style={{ breakInside: 'avoid' }}>
              <div className="max-w-[300px] pt-1">
                {(isInvoice || isQuote) && data.total > 0 && (
                  <>
                    <Label>Amount in words</Label>
                    <p className="mt-1.5 text-[11px] italic leading-relaxed text-slate-600">
                      {amountInWords(isInvoice ? amountDue : data.total, cur)}
                    </p>
                  </>
                )}
              </div>
              <div className="relative w-[290px] text-[12px]">
                {isPaid && isInvoice && (
                  <span
                    className="absolute -left-[110px] top-2 rotate-[-12deg] rounded-md border-[2.5px] border-emerald-600/70 px-3 py-1 text-[18px] font-black tracking-[0.2em] text-emerald-600/70"
                    aria-hidden="true"
                  >
                    PAID
                  </span>
                )}
                <div className="flex justify-between py-1.5 text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-slate-800">{money(data.subtotal)}</span>
                </div>
                {(data.discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between py-1.5 text-slate-600">
                    <span>
                      Discount{data.discountType === 'percent' && data.discountPercent ? ` (${data.discountPercent}%)` : ''}
                    </span>
                    <span className="font-medium text-slate-800">−{money(data.discountAmount)}</span>
                  </div>
                )}
                {(data.taxAmount ?? 0) > 0 && (
                  <div className="flex justify-between py-1.5 text-slate-600">
                    <span>Tax{data.taxPercent ? ` (${data.taxPercent}%)` : ''}</span>
                    <span className="font-medium text-slate-800">{money(data.taxAmount)}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t border-slate-300 pt-2.5 text-[13px] font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{money(data.total)}</span>
                </div>
                {!isQuote && amountPaid > 0 && (
                  <div className="flex justify-between py-1.5 text-slate-600">
                    <span>Paid to date</span>
                    <span className="font-medium text-emerald-700">−{money(amountPaid)}</span>
                  </div>
                )}
                {!isQuote && (
                  <div
                    className="mt-2 flex items-center justify-between rounded-md px-3.5 py-3"
                    style={{ background: tint, color: accent }}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                      {isBill ? 'Balance payable' : 'Amount due'}
                    </span>
                    <span className="text-[17px] font-bold">{money(amountDue)}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Receipt body ─────────────────────────────────── */}
        {isReceipt && (
          <section className="mt-9" style={{ breakInside: 'avoid' }}>
            <div className="relative overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between px-6 py-6" style={{ background: tint }}>
                <div>
                  <Label>Amount received</Label>
                  <p className="mt-2 text-[34px] font-semibold leading-none tracking-tight" style={{ color: accent }}>
                    {money(amountDue)}
                  </p>
                  <p className="mt-2.5 max-w-[420px] text-[11px] italic text-slate-600">{amountInWords(amountDue, cur)}</p>
                </div>
                <span
                  className="rotate-[-10deg] rounded-md border-[2.5px] border-emerald-600/70 px-3 py-1 text-[20px] font-black tracking-[0.2em] text-emerald-600/70"
                  aria-hidden="true"
                >
                  PAID
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-10 gap-y-4 px-6 py-5 text-[12px]">
                <div>
                  <dt><Label>Payment for</Label></dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {data.linkedInvoiceNumber ? `Invoice ${data.linkedInvoiceNumber}` : 'Services rendered'}
                  </dd>
                </div>
                <div>
                  <dt><Label>Payment method</Label></dt>
                  <dd className="mt-1 font-medium text-slate-800">{METHOD_LABELS[data.paymentMethod ?? ''] ?? 'Bank transfer'}</dd>
                </div>
                {data.total > 0 && data.linkedInvoiceNumber && (
                  <div>
                    <dt><Label>Invoice total</Label></dt>
                    <dd className="mt-1 font-medium text-slate-800">{money(data.total)}</dd>
                  </div>
                )}
                {data.balanceDue !== undefined && data.linkedInvoiceNumber && (
                  <div>
                    <dt><Label>Balance remaining</Label></dt>
                    <dd className={`mt-1 font-semibold ${data.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {data.balanceDue > 0 ? money(data.balanceDue) : 'Settled in full'}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </section>
        )}

        {/* ── Payment details (invoices) ───────────────────── */}
        {isInvoice && company.bankDetails?.accountNumber && (data.balanceDue ?? 1) > 0 && (
          <section className="mt-8 rounded-lg border border-slate-200 px-5 py-4" style={{ breakInside: 'avoid' }}>
            <div className="flex items-baseline justify-between">
              <Label>Payment details</Label>
              <p className="text-[10.5px] text-slate-500">
                Please quote <span className="font-mono font-medium text-slate-700">{data.number}</span> as the reference
              </p>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-x-6 gap-y-2.5 text-[11.5px]">
              {[
                ['Bank', company.bankDetails.bankName],
                ['Account name', company.bankDetails.accountName],
                ['Account number', company.bankDetails.accountNumber],
                ['SWIFT / BIC', company.bankDetails.swiftCode],
                ['Routing / Branch', company.bankDetails.routingNumber || company.bankDetails.ifscCode],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] text-slate-400">{k}</dt>
                    <dd className="font-mono font-medium text-slate-800">{v}</dd>
                  </div>
                ))}
            </dl>
            {data.paymentInstructions && (
              <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-600">
                {data.paymentInstructions}
              </p>
            )}
          </section>
        )}

        {isBill && data.paymentInstructions && (
          <section className="mt-8 rounded-lg border border-slate-200 px-5 py-4">
            <Label>Payment details</Label>
            <p className="mt-2 text-[11.5px] leading-relaxed text-slate-600">{data.paymentInstructions}</p>
          </section>
        )}

        {/* ── Notes & terms ────────────────────────────────── */}
        {(data.notes?.trim() || data.terms?.trim()) && (
          <section className="mt-8 grid grid-cols-2 gap-12" style={{ breakInside: 'avoid' }}>
            {data.notes?.trim() ? (
              <div>
                <Label>Notes</Label>
                <p className="mt-2 whitespace-pre-line text-[11.5px] leading-relaxed text-slate-600">{data.notes}</p>
              </div>
            ) : (
              <div />
            )}
            {data.terms?.trim() && (
              <div>
                <Label>Terms & conditions</Label>
                <p className="mt-2 whitespace-pre-line text-[11.5px] leading-relaxed text-slate-600">{data.terms}</p>
              </div>
            )}
          </section>
        )}

        {/* ── Sign-off ─────────────────────────────────────── */}
        {isQuote ? (
          <section className="mt-10 grid grid-cols-2 gap-12" style={{ breakInside: 'avoid' }}>
            <div>
              <Label>For {company.name}</Label>
              <div className="flex h-[54px] items-end">
                {company.signature && <img src={company.signature} alt="" className="max-h-[48px] max-w-[160px] object-contain" />}
              </div>
              <div className="border-t border-slate-300 pt-1.5 text-[10.5px] text-slate-500">Authorised signatory</div>
            </div>
            <div>
              <Label>Accepted by {customer?.company || customer?.name || 'client'}</Label>
              <div className="flex h-[54px] items-end">
                {data.acceptanceSignature && (
                  <img src={data.acceptanceSignature} alt="" className="max-h-[48px] max-w-[160px] object-contain" />
                )}
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1.5 text-[10.5px] text-slate-500">
                <span>{data.clientSignerName || 'Name & signature'}</span>
                <span>Date: {data.acceptedDate ? formatDate(data.acceptedDate) : '____________'}</span>
              </div>
            </div>
          </section>
        ) : (
          (isInvoice || isReceipt) && company.signature && (
            <section className="mt-10 flex justify-end" style={{ breakInside: 'avoid' }}>
              <div className="w-[200px] text-center">
                <img src={company.signature} alt="" className="mx-auto max-h-[48px] max-w-[160px] object-contain" />
                <div className="mt-1 border-t border-slate-300 pt-1.5 text-[10.5px] text-slate-500">
                  Authorised signatory · {company.name}
                </div>
              </div>
            </section>
          )
        )}

        <div className="flex-1" />

        {/* ── Footer ───────────────────────────────────────── */}
        <footer className="mt-10 border-t border-slate-200 pt-4 text-[10px] leading-relaxed text-slate-500">
          {company.footer && <p className="mb-2 text-[11px] text-slate-600">{company.footer}</p>}
          <div className="flex items-center justify-between gap-6">
            <p>
              {[company.name, company.registrationNumber && `Reg. ${company.registrationNumber}`, company.taxNumber]
                .filter(Boolean)
                .join('  ·  ')}
            </p>
            <p className="text-right">
              {[company.website?.replace(/^https?:\/\//, '').replace(/\/$/, ''), company.email, company.phone]
                .filter(Boolean)
                .join('  ·  ')}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};
