import React from 'react';
import type { DocumentData } from '../documentTypes';
import { formatCurrency, formatDate, getStatusLabel } from '../../../utils/formatters';
import { SignOffBlock } from '../SignOffBlock';
import { withSignOffFallbacks } from '../signOff';


export const ModernMinimalTemplate: React.FC<{ data: DocumentData }> = ({ data }) => {
  const { company, customer, currencySymbol } = data;
  const isInvoice = data.documentType === 'invoice';
  const isQuotation = data.documentType === 'quotation';
  const isReceipt = data.documentType === 'receipt';
  const isBill = data.documentType === 'bill';
  const signOff = withSignOffFallbacks(data);

  const docTitle =
    data.documentType === 'quotation' ? 'QUOTATION' :
    data.documentType === 'invoice' ? 'INVOICE' :
    data.documentType === 'bill' ? 'VENDOR BILL' : 'PAYMENT RECEIPT';

  return (
    <div className="font-sans text-slate-800 bg-white p-10 max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div>
        {/* Top Header */}
        <div className="flex justify-between items-start pb-8 border-b border-slate-200">
          <div>
            {company.logo ? (
              <img src={company.logo} alt={company.name} className="h-10 max-w-[160px] object-contain mb-3" />
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-sm">
                  {company.name.charAt(0)}
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-900">{company.name}</span>
              </div>
            )}
            <p className="text-xs text-slate-500">{company.tagline || 'Custom Software Engineering'}</p>
            <div className="text-xs text-slate-400 mt-2 space-y-0.5">
              <p>{company.address.street}, {company.address.city}, {company.address.state} {company.address.zipCode}</p>
              <p>{company.email} · {company.website}</p>
              {company.taxNumber && <p>{company.taxNumber}</p>}
            </div>
          </div>

          <div className="text-right">
            <h1 className="text-2xl font-light tracking-widest text-slate-900 mb-2">{docTitle}</h1>
            <p className="text-sm font-semibold text-slate-900">{data.number}</p>
            <div className="mt-3 text-xs text-slate-500 space-y-1">
              <div className="flex justify-end gap-3">
                <span className="text-slate-400">Date:</span>
                <span className="font-medium text-slate-700">{formatDate(data.date)}</span>
              </div>
              {data.dueDateOrExpiry && (
                <div className="flex justify-end gap-3">
                  <span className="text-slate-400">{isQuotation ? 'Valid Until:' : 'Due Date:'}</span>
                  <span className="font-medium text-slate-700">{formatDate(data.dueDateOrExpiry)}</span>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <span className="text-slate-400">Status:</span>
                <span className="font-medium text-slate-800">{getStatusLabel(data.status)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To / Vendor Info */}
        <div className="grid grid-cols-2 gap-8 py-6 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              {isBill ? 'Vendor / Payee' : 'Client / Bill To'}
            </span>
            {isBill ? (
              <div>
                <p className="text-sm font-semibold text-slate-900">{data.vendorName || 'Vendor'}</p>
                {data.vendorEmail && <p className="text-xs text-slate-500">{data.vendorEmail}</p>}
                {data.vendorPhone && <p className="text-xs text-slate-500">{data.vendorPhone}</p>}
                {data.vendorAddress && <p className="text-xs text-slate-400">{data.vendorAddress}</p>}
              </div>
            ) : customer ? (
              <div>
                <p className="text-sm font-semibold text-slate-900">{customer.name}</p>
                {customer.company && <p className="text-xs font-medium text-slate-700">{customer.company}</p>}
                <p className="text-xs text-slate-500 mt-1">
                  {[customer.address.street, customer.address.city, customer.address.state, customer.address.country]
                    .filter(Boolean).join(', ')}
                </p>
                {customer.email && <p className="text-xs text-slate-400">{customer.email}</p>}
                {customer.taxNumber && <p className="text-xs text-slate-400 mt-0.5">{customer.taxNumber}</p>}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No client selected</p>
            )}
          </div>

          {/* Project description if present */}
          {data.projectDescription && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Project / Scope
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">{data.projectDescription}</p>
            </div>
          )}
        </div>

        {/* Line Items Table (or Receipt Summary) */}
        {!isReceipt ? (
          <div className="py-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-2 w-8">#</th>
                  <th className="py-3 px-2">Service / Description</th>
                  <th className="py-3 px-2 text-center w-16">Qty</th>
                  <th className="py-3 px-2 text-right w-24">Rate</th>
                  <th className="py-3 px-2 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.lineItems.map((item, index) => (
                  <tr key={item.id || index}>
                    <td className="py-3 px-2 text-slate-400 font-mono text-[11px]">{index + 1}</td>
                    <td className="py-3 px-2">
                      <div className="font-medium text-slate-800">{item.description}</div>
                      {item.unit && <span className="text-[10px] text-slate-400">Unit: {item.unit}</span>}
                    </td>
                    <td className="py-3 px-2 text-center text-slate-600">{item.quantity}</td>
                    <td className="py-3 px-2 text-right text-slate-600">{formatCurrency(item.unitPrice, currencySymbol)}</td>
                    <td className="py-3 px-2 text-right font-medium text-slate-900">{formatCurrency(item.amount, currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Receipt Block */
          <div className="py-8 bg-slate-50/70 rounded-xl p-6 my-4 border border-slate-100">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Related Invoice:</span>
                <span className="font-semibold text-slate-800">{data.linkedInvoiceNumber || 'Direct Payment'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Payment Method:</span>
                <span className="font-semibold text-slate-800 capitalize">{data.paymentMethod?.replace('_', ' ') || 'Bank Transfer'}</span>
              </div>
              {data.referenceNumber && (
                <div>
                  <span className="text-slate-400 block mb-1">Transaction Ref:</span>
                  <span className="font-mono text-slate-700">{data.referenceNumber}</span>
                </div>
              )}
            </div>
            <div className="mt-6 pt-6 border-t border-slate-200 flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600">Total Paid Amount:</span>
              <span className="text-2xl font-bold text-slate-900">{formatCurrency(data.amountPaid || data.total, currencySymbol)}</span>
            </div>
          </div>
        )}

        {/* Totals Section */}
        {!isReceipt && (
          <div className="flex justify-end pt-4">
            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-medium">{formatCurrency(data.subtotal, currencySymbol)}</span>
              </div>
              {(data.discountAmount || 0) > 0 && (
                <div className="flex justify-between text-rose-600">
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
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-semibold text-slate-900">
                <span>Total:</span>
                <span>{formatCurrency(data.total, currencySymbol)}</span>
              </div>
              {data.amountPaid !== undefined && data.amountPaid > 0 && (
                <div className="flex justify-between text-emerald-600 pt-1">
                  <span>Amount Paid:</span>
                  <span>{formatCurrency(data.amountPaid, currencySymbol)}</span>
                </div>
              )}
              {data.balanceDue !== undefined && (
                <div className="flex justify-between pt-1 border-t border-slate-200 text-xs font-bold text-slate-900">
                  <span>Balance Due:</span>
                  <span className={data.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                    {formatCurrency(data.balanceDue, currencySymbol)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Banking Coordinates & Payment Instructions */}
        {(isInvoice || isBill) && company.bankDetails && (
          <div className="mt-8 p-4 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-100">
            <p className="font-semibold text-slate-800 mb-1">Payment Instructions & Banking</p>
            <p>{data.paymentInstructions || `Please transfer funds to ${company.bankDetails.bankName}.`}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 font-mono text-[11px] text-slate-700">
              <div><span className="text-slate-400">Account: </span>{company.bankDetails.accountNumber}</div>
              <div><span className="text-slate-400">SWIFT: </span>{company.bankDetails.swiftCode || '-'}</div>
              <div><span className="text-slate-400">Routing/IFSC: </span>{company.bankDetails.routingNumber || company.bankDetails.ifscCode}</div>
              <div><span className="text-slate-400">Beneficiary: </span>{company.bankDetails.accountName}</div>
            </div>
          </div>
        )}

        {/* Quotation Acceptance Block */}
        {isQuotation && (
          <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <p className="font-semibold text-slate-800 mb-1">Client Acceptance & Approval</p>
            <p className="text-slate-500 mb-6">
              By signing below, the client agrees to the scope of work, pricing, and terms outlined in this quotation.
            </p>
            <div className="flex justify-between items-end pt-4 border-t border-slate-200">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Client Representative</p>
                <p className="font-medium text-slate-800 mt-1">{data.clientSignerName || customer?.name || 'Authorized Signatory'}</p>
              </div>
              <div className="text-right">
                <div className="w-48 border-b border-slate-400 pb-1 text-center font-mono text-xs text-slate-400">
                  {data.acceptanceSignature ? 'Signed Electrically' : 'Signature / Stamp'}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Date: {data.acceptedDate || '____ / ____ / 2026'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Notes & Terms */}
        <div className="mt-6 text-xs text-slate-500 space-y-2">
          {data.notes && (
            <div>
              <span className="font-semibold text-slate-700">Notes: </span>
              <span>{data.notes}</span>
            </div>
          )}
          {data.terms && (
            <div>
              <span className="font-semibold text-slate-700">Terms & Conditions: </span>
              <span>{data.terms}</span>
            </div>
          )}
        </div>

        {/* Sign-off: signatories and stamps */}
        <SignOffBlock data={signOff} heading={`For ${company.name}`} />
      </div>

      {/* Footer */}
      <div className="pt-6 border-t border-slate-200 mt-8 flex justify-between items-end text-xs text-slate-400">
        <p>{company.footer || 'Thank you for your business!'}</p>
        <p className="text-[10px] text-slate-300">{data.number}</p>
      </div>
    </div>
  );
};
