import React from 'react';
import type { DocumentData } from '../documentTypes';
import { formatCurrency, formatDate, getStatusLabel } from '../../../utils/formatters';

export const ElegantBusinessTemplate: React.FC<{ data: DocumentData }> = ({ data }) => {
  const { company, customer, currencySymbol } = data;
  const isInvoice = data.documentType === 'invoice';
  const isQuotation = data.documentType === 'quotation';
  const isReceipt = data.documentType === 'receipt';
  const isBill = data.documentType === 'bill';

  const docTitle =
    data.documentType === 'quotation' ? 'Project Quotation' :
    data.documentType === 'invoice' ? 'Statement of Account & Invoice' :
    data.documentType === 'bill' ? 'Vendor Billing Statement' : 'Payment Receipt Voucher';

  return (
    <div className="font-sans text-slate-800 bg-white p-12 max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between border-t-8 border-emerald-800" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
      <div>
        {/* Centered Crest Header */}
        <div className="text-center pb-8 border-b border-slate-200">
          {company.logo ? (
            <img src={company.logo} alt={company.name} className="h-12 max-w-[180px] object-contain mx-auto mb-3" />
          ) : (
            <div className="w-12 h-12 bg-emerald-900 text-amber-100 rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-3 shadow-sm">
              {company.name.charAt(0)}
            </div>
          )}
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{company.name}</h2>
          <p className="text-xs italic text-slate-500 mt-0.5">{company.tagline || 'Custom Software Engineering & Dedicated Squads'}</p>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-center gap-4">
            <span>{company.address.street}, {company.address.city}, {company.address.state}</span>
            <span>·</span>
            <span>{company.email}</span>
            <span>·</span>
            <span>{company.website}</span>
          </div>
        </div>

        {/* Title & Document Numbers */}
        <div className="flex justify-between items-center py-6 border-b border-slate-200 font-sans">
          <div>
            <span className="text-xs uppercase tracking-widest text-emerald-800 font-bold block mb-1">Official Business Record</span>
            <h1 className="text-xl font-bold text-slate-900">{docTitle}</h1>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-emerald-900 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
              {data.number}
            </span>
            <div className="text-xs text-slate-500 mt-1 flex justify-end gap-3">
              <span>Date: <strong>{formatDate(data.date)}</strong></span>
              {data.dueDateOrExpiry && (
                <span>{isQuotation ? 'Valid to:' : 'Due:'} <strong>{formatDate(data.dueDateOrExpiry)}</strong></span>
              )}
            </div>
          </div>
        </div>

        {/* Parties Box */}
        <div className="grid grid-cols-2 gap-8 py-6 border-b border-slate-200 font-sans text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-900 block mb-2">
              {isBill ? 'Payable to Vendor:' : 'Prepared For Client:'}
            </span>
            {isBill ? (
              <div>
                <p className="text-sm font-bold text-slate-900">{data.vendorName || 'Vendor'}</p>
                {data.vendorEmail && <p className="text-slate-500">{data.vendorEmail}</p>}
                {data.vendorPhone && <p className="text-slate-500">{data.vendorPhone}</p>}
                {data.vendorAddress && <p className="text-slate-400 mt-1">{data.vendorAddress}</p>}
              </div>
            ) : customer ? (
              <div>
                <p className="text-sm font-bold text-slate-900">{customer.name}</p>
                {customer.company && <p className="font-semibold text-emerald-800">{customer.company}</p>}
                <p className="text-slate-600 mt-1">
                  {[customer.address.street, customer.address.city, customer.address.state, customer.address.country].filter(Boolean).join(', ')}
                </p>
                {customer.email && <p className="text-slate-500">{customer.email}</p>}
                {customer.taxNumber && <p className="text-slate-400">{customer.taxNumber}</p>}
              </div>
            ) : (
              <p className="text-slate-400 italic">No recipient details selected</p>
            )}
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-900 block mb-2">
              Document Status & Terms:
            </span>
            <div className="space-y-1">
              <p><span className="text-slate-400">Current Status: </span><span className="font-semibold text-slate-800">{getStatusLabel(data.status)}</span></p>
              {data.paymentTerms && <p><span className="text-slate-400">Terms of Settlement: </span><span className="font-semibold text-slate-800">{data.paymentTerms}</span></p>}
              {data.projectDescription && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Project Scope:</span>
                  <span className="italic text-slate-700 leading-snug">{data.projectDescription}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items */}
        {!isReceipt ? (
          <div className="py-6 font-sans">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-emerald-900 text-emerald-900 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-2">#</th>
                  <th className="py-3 px-2">Description of Services & Deliverables</th>
                  <th className="py-3 px-2 text-center w-16">Quantity</th>
                  <th className="py-3 px-2 text-right w-28">Rate</th>
                  <th className="py-3 px-2 text-right w-32">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.lineItems.map((item, index) => (
                  <tr key={item.id || index}>
                    <td className="py-3 px-2 text-slate-400">{index + 1}</td>
                    <td className="py-3 px-2">
                      <p className="font-medium text-slate-900">{item.description}</p>
                      {item.unit && <p className="text-[10px] text-slate-400">Unit: {item.unit}</p>}
                    </td>
                    <td className="py-3 px-2 text-center text-slate-600">{item.quantity}</td>
                    <td className="py-3 px-2 text-right text-slate-600">{formatCurrency(item.unitPrice, currencySymbol)}</td>
                    <td className="py-3 px-2 text-right font-medium text-slate-900">{formatCurrency(item.amount, currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Elegant Totals */}
            <div className="flex justify-end mt-6">
              <div className="w-72 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(data.subtotal, currencySymbol)}</span>
                </div>
                {(data.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>Discount {data.discountPercent ? `(${data.discountPercent}%)` : ''}:</span>
                    <span>-{formatCurrency(data.discountAmount || 0, currencySymbol)}</span>
                  </div>
                )}
                {(data.taxAmount || 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax ({data.taxPercent || 0}%):</span>
                    <span>+{formatCurrency(data.taxAmount || 0, currencySymbol)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t-2 border-emerald-900 text-sm font-bold text-emerald-950">
                  <span>Grand Total:</span>
                  <span className="text-xl">{formatCurrency(data.total, currencySymbol)}</span>
                </div>
                {data.amountPaid !== undefined && data.amountPaid > 0 && (
                  <div className="flex justify-between text-emerald-700 pt-1">
                    <span>Amount Paid:</span>
                    <span>{formatCurrency(data.amountPaid, currencySymbol)}</span>
                  </div>
                )}
                {data.balanceDue !== undefined && (
                  <div className="flex justify-between text-xs font-bold pt-1 border-t border-slate-200">
                    <span>Balance Outstanding:</span>
                    <span className={data.balanceDue > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                      {formatCurrency(data.balanceDue, currencySymbol)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Receipt Block */
          <div className="py-8 font-sans">
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-6 text-xs text-center">
              <span className="text-xs uppercase tracking-widest text-emerald-800 font-bold block mb-1">Receipt of Payment</span>
              <p className="text-3xl font-bold text-emerald-950 my-2">{formatCurrency(data.amountPaid || data.total, currencySymbol)}</p>
              <p className="text-slate-500">Method: {data.paymentMethod?.replace('_', ' ') || 'Bank Wire'} · Ref: {data.referenceNumber || 'N/A'}</p>
            </div>
          </div>
        )}

        {/* Banking and Sign-off */}
        {(isInvoice || isBill) && company.bankDetails && (
          <div className="mt-4 p-4 border border-slate-200 rounded font-sans text-xs bg-slate-50/50">
            <p className="font-bold text-emerald-900 mb-1">Banking Settlement Details</p>
            <p className="text-slate-600 mb-2">{data.paymentInstructions || `Kindly transfer via SWIFT / Wire to ${company.bankDetails.bankName}.`}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div><span className="text-slate-400">Account: </span>{company.bankDetails.accountNumber}</div>
              <div><span className="text-slate-400">SWIFT: </span>{company.bankDetails.swiftCode || 'N/A'}</div>
              <div><span className="text-slate-400">Beneficiary: </span>{company.bankDetails.accountName}</div>
              <div><span className="text-slate-400">Routing: </span>{company.bankDetails.routingNumber || company.bankDetails.ifscCode}</div>
            </div>
          </div>
        )}

        {/* Quotation Acceptance Block */}
        {isQuotation && (
          <div className="mt-6 p-4 border border-emerald-800 rounded font-sans text-xs bg-emerald-50/30">
            <p className="font-bold text-emerald-900 mb-1">Authorization & Sign-off Seal</p>
            <p className="text-slate-600 mb-6">
              Client confirms agreement to the deliverables and budget stipulated herein.
            </p>
            <div className="flex justify-between items-end pt-3 border-t border-emerald-200">
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Client Signatory</p>
                <p className="font-bold text-slate-800 mt-1">{data.clientSignerName || customer?.name || 'Representative'}</p>
              </div>
              <div className="text-right">
                <div className="w-44 border-b border-slate-400 pb-1 text-center text-[10px] text-slate-400">
                  {data.acceptanceSignature ? 'Signed' : 'Signature / Stamp'}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Date: {data.acceptedDate || '____ / ____ / 2026'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Notes & Terms */}
        <div className="mt-4 font-sans text-xs text-slate-500 space-y-1">
          {data.terms && <p><span className="font-semibold text-slate-700">Terms: </span>{data.terms}</p>}
          {data.notes && <p><span className="font-semibold text-slate-700">Notes: </span>{data.notes}</p>}
        </div>
      </div>

      {/* Signature & Seal Footer */}
      <div className="pt-8 border-t border-slate-200 mt-8 flex justify-between items-end font-sans text-xs text-slate-400">
        <div>
          <p>{company.footer || 'Thank you for your patronage.'}</p>
          <p className="text-[10px] text-slate-300 mt-0.5">{company.website}</p>
        </div>
        <div className="text-right">
          {company.signature ? (
            <img src={company.signature} alt="Signature" className="h-10 max-w-[140px] object-contain mb-1 ml-auto" />
          ) : (
            <div className="h-8"></div>
          )}
          <p className="font-semibold text-slate-800 border-t border-slate-300 pt-1 w-44 ml-auto text-center">
            {company.name} Authorized Signatory
          </p>
        </div>
      </div>
    </div>
  );
};
