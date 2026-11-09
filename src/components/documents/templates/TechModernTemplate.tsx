import React from 'react';
import type { DocumentData } from '../documentTypes';
import { formatCurrency, formatDate, getStatusLabel } from '../../../utils/formatters';

export const TechModernTemplate: React.FC<{ data: DocumentData }> = ({ data }) => {
  const { company, customer, currencySymbol } = data;
  const isInvoice = data.documentType === 'invoice';
  const isQuotation = data.documentType === 'quotation';
  const isReceipt = data.documentType === 'receipt';
  const isBill = data.documentType === 'bill';

  const docTypeBadge =
    data.documentType === 'quotation' ? 'ENGINEERING QUOTATION' :
    data.documentType === 'invoice' ? 'DIGITAL SERVICES INVOICE' :
    data.documentType === 'bill' ? 'VENDOR DISBURSEMENT' : 'PAYMENT RECEIPT';

  return (
    <div className="font-sans text-slate-800 bg-white p-10 max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div>
        {/* Modern Tech Header Bar */}
        <div className="flex justify-between items-start pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {company.logo ? (
                <img src={company.logo} alt={company.name} className="h-10 max-w-[160px] object-contain" />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-slate-950 text-white rounded-lg flex items-center justify-center font-bold text-base shadow-sm ring-1 ring-primary-500/20">
                    <span className="text-primary-400">#</span>
                  </div>
                  <div>
                    <span className="text-xl font-bold tracking-tight text-slate-950">{company.name}</span>
                    
                  </div>
                </div>
              )}
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 bg-primary-50 text-primary-700 rounded border border-primary-200">
                IT & Software Squads
              </span>
            </div>
            <p className="text-xs text-slate-500">{company.tagline || 'Custom Software Engineering & Dedicated Developer Squads'}</p>
            <div className="text-[11px] text-slate-400 font-mono mt-2 space-y-0.5">
              <p>{company.address.street}, {company.address.city}, {company.address.state} {company.address.zipCode}</p>
              <p className="text-primary-600 font-medium">{company.website} <span className="text-slate-400">·</span> {company.email}</p>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white text-[10px] font-bold tracking-wider rounded uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400"></span>
              {docTypeBadge}
            </div>
            <p className="font-mono text-base font-bold text-slate-900 mt-2">{data.number}</p>
            <div className="text-[11px] text-slate-500 font-mono mt-2 space-y-1">
              <div><span className="text-slate-400">ISSUED: </span>{formatDate(data.date)}</div>
              {data.dueDateOrExpiry && (
                <div>
                  <span className="text-slate-400">{isQuotation ? 'EXPIRY: ' : 'DUE: '}</span>
                  <span className="font-semibold text-slate-800">{formatDate(data.dueDateOrExpiry)}</span>
                </div>
              )}
              <div><span className="text-slate-400">STATUS: </span><span className="font-bold text-slate-900 uppercase">{getStatusLabel(data.status)}</span></div>
            </div>
          </div>
        </div>

        {/* Client & Technical Project Metadata */}
        <div className="grid grid-cols-12 gap-6 py-6 border-b border-slate-100 text-xs">
          <div className="col-span-6">
            <span className="text-[10px] font-mono uppercase font-bold text-primary-600 tracking-wider block mb-1">
              // {isBill ? 'VENDOR_INFO' : 'CLIENT_DETAILS'}
            </span>
            {isBill ? (
              <div>
                <p className="text-sm font-bold text-slate-900">{data.vendorName || 'Vendor'}</p>
                {data.vendorEmail && <p className="text-slate-500 font-mono text-[11px]">{data.vendorEmail}</p>}
                {data.vendorPhone && <p className="text-slate-500 font-mono text-[11px]">{data.vendorPhone}</p>}
                {data.vendorAddress && <p className="text-slate-400 mt-1">{data.vendorAddress}</p>}
              </div>
            ) : customer ? (
              <div>
                <p className="text-sm font-bold text-slate-900">{customer.name}</p>
                {customer.company && <p className="font-semibold text-slate-700">{customer.company}</p>}
                <p className="text-slate-500 mt-0.5">
                  {[customer.address.street, customer.address.city, customer.address.state, customer.address.country].filter(Boolean).join(', ')}
                </p>
                {customer.email && <p className="text-slate-500 font-mono text-[11px] mt-0.5">{customer.email}</p>}
                {customer.taxNumber && <p className="text-slate-400 font-mono text-[10px]">{customer.taxNumber}</p>}
              </div>
            ) : (
              <p className="text-slate-400 italic">No client designated</p>
            )}
          </div>

          <div className="col-span-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-[10px] font-mono uppercase font-bold text-primary-600 tracking-wider block mb-1">
              // PROJECT_SPECIFICATION
            </span>
            <p className="text-slate-700 leading-relaxed font-sans text-xs">
              {data.projectDescription || 'Custom software development, cloud infrastructure automation, and engineering squad sprint deliverables.'}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>TERMS: {data.paymentTerms || 'Sprint Net-30'}</span>
              <span>CURRENCY: {company.currency || 'USD'} ({currencySymbol})</span>
            </div>
          </div>
        </div>

        {/* Deliverables / Line Items Table */}
        {!isReceipt ? (
          <div className="py-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 rounded-l-lg w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Service Deliverable & Engineering Scope</th>
                  <th className="py-2.5 px-3 text-center w-20">Metrics</th>
                  <th className="py-2.5 px-3 text-right w-24">Rate</th>
                  <th className="py-2.5 px-3 rounded-r-lg text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.lineItems.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900">{item.description}</p>
                      {item.unit && (
                        <span className="inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                          unit: {item.unit}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-700">{item.quantity}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">{formatCurrency(item.unitPrice, currencySymbol)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(item.amount, currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Calculations & Grand Total Pill */}
            <div className="flex justify-end mt-4">
              <div className="w-72 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                <div className="flex justify-between text-slate-600 font-mono">
                  <span>SUBTOTAL:</span>
                  <span>{formatCurrency(data.subtotal, currencySymbol)}</span>
                </div>
                {(data.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-rose-600 font-mono">
                    <span>DISCOUNT {data.discountPercent ? `(${data.discountPercent}%)` : ''}:</span>
                    <span>-{formatCurrency(data.discountAmount || 0, currencySymbol)}</span>
                  </div>
                )}
                {(data.taxAmount || 0) > 0 && (
                  <div className="flex justify-between text-slate-600 font-mono">
                    <span>TAX ({data.taxPercent || 0}%):</span>
                    <span>+{formatCurrency(data.taxAmount || 0, currencySymbol)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-mono text-sm font-bold text-slate-950">
                  <span>TOTAL DUE:</span>
                  <span className="text-xl text-primary-600">{formatCurrency(data.total, currencySymbol)}</span>
                </div>
                {data.amountPaid !== undefined && data.amountPaid > 0 && (
                  <div className="flex justify-between text-emerald-600 font-mono pt-1">
                    <span>PAID:</span>
                    <span>{formatCurrency(data.amountPaid, currencySymbol)}</span>
                  </div>
                )}
                {data.balanceDue !== undefined && (
                  <div className="flex justify-between font-mono font-bold text-xs pt-1 border-t border-slate-200">
                    <span>BALANCE REMAINING:</span>
                    <span className={data.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {formatCurrency(data.balanceDue, currencySymbol)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Receipt Block */
          <div className="py-8">
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <span className="text-xs font-mono text-primary-400 font-bold uppercase tracking-wider">// PAYMENT_CONFIRMATION_LOG</span>
                <span className="font-mono text-xs text-slate-400">{data.number}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 my-4 font-mono text-xs text-slate-300">
                <div>INVOICE REF: <span className="text-white font-bold">{data.linkedInvoiceNumber || 'DIRECT'}</span></div>
                <div>METHOD: <span className="text-white font-bold capitalize">{data.paymentMethod?.replace('_', ' ') || 'WIRE'}</span></div>
                <div>TIMESTAMP: <span className="text-white">{formatDate(data.date)}</span></div>
                {data.referenceNumber && <div>TRANSACTION: <span className="text-primary-300">{data.referenceNumber}</span></div>}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-baseline">
                <span className="font-mono text-xs text-slate-400">SETTLED AMOUNT:</span>
                <span className="font-mono text-3xl font-extrabold text-primary-400">{formatCurrency(data.amountPaid || data.total, currencySymbol)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Wire & Bank Instructions */}
        {(isInvoice || isBill) && company.bankDetails && (
          <div className="mt-4 p-4 bg-slate-900 text-slate-300 rounded-xl font-mono text-xs border border-slate-800">
            <span className="text-[10px] text-primary-400 font-bold uppercase tracking-wider block mb-1">
              // WIRE_SETTLEMENT_COORDINATES
            </span>
            <p className="text-slate-400 mb-2 font-sans">{data.paymentInstructions || `Transfer to ${company.bankDetails.bankName} quoting invoice ${data.number}.`}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-white">
              <div><span className="text-slate-500">BANK: </span>{company.bankDetails.bankName}</div>
              <div><span className="text-slate-500">ACC: </span>{company.bankDetails.accountNumber}</div>
              <div><span className="text-slate-500">SWIFT: </span>{company.bankDetails.swiftCode || 'N/A'}</div>
              <div><span className="text-slate-500">ROUTING: </span>{company.bankDetails.routingNumber || company.bankDetails.ifscCode}</div>
            </div>
          </div>
        )}

        {/* Quotation Acceptance Block */}
        {isQuotation && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="text-[10px] font-mono font-bold text-primary-600 uppercase tracking-widest block mb-1">
              // ACCEPTANCE_OF_SCOPE_AND_COMMENCEMENT
            </span>
            <p className="text-slate-600 mb-6">
              Client approves this scope of work, technical milestone schedule, and financial terms.
            </p>
            <div className="flex justify-between items-end pt-3 border-t border-slate-200 font-mono text-[11px]">
              <div>
                <p className="text-slate-400 uppercase text-[9px]">CLIENT AUTHORIZED REPRESENTATIVE</p>
                <p className="font-bold text-slate-800 mt-1">{data.clientSignerName || customer?.name || 'Signer'}</p>
              </div>
              <div className="text-right">
                <div className="w-48 border-b border-slate-400 pb-1 text-center text-slate-400">
                  {data.acceptanceSignature ? 'SIGNED' : 'SIGNATURE'}
                </div>
                <p className="text-[9px] text-slate-400 mt-1">DATE: {data.acceptedDate || 'YYYY-MM-DD'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Notes & Terms */}
        <div className="mt-4 text-xs text-slate-500 space-y-1">
          {data.terms && <p><span className="font-mono text-slate-700 font-semibold">TERMS: </span>{data.terms}</p>}
          {data.notes && <p><span className="font-mono text-slate-700 font-semibold">NOTES: </span>{data.notes}</p>}
        </div>
      </div>

      {/* Footer with Digital Verification Seal */}
      <div className="pt-6 border-t border-slate-200 mt-8 flex justify-between items-end text-xs text-slate-400">
        <div>
          <p className="font-medium text-slate-700">{company.footer || company.name}</p>
          <p className="font-mono text-[10px] text-slate-400 mt-0.5">{data.number} · {(company.website || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toUpperCase()}</p>
        </div>
        <div className="text-right">
          {company.signature ? (
            <img src={company.signature} alt="Authorised signature" className="h-10 max-w-[140px] object-contain mb-1 ml-auto" />
          ) : (
            <div className="h-8"></div>
          )}
          <p className="font-mono text-[10px] text-slate-700 border-t border-slate-200 pt-1 w-44 ml-auto text-center font-bold">
            {company.name.toUpperCase()} AUTHORISED SIGN-OFF
          </p>
        </div>
      </div>
    </div>
  );
};
