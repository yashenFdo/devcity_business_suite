import React from 'react';
import type { DocumentData } from '../documentTypes';
import { formatCurrency, formatDate, getStatusLabel } from '../../../utils/formatters';

export const CorporateProTemplate: React.FC<{ data: DocumentData }> = ({ data }) => {
  const { company, customer, currencySymbol } = data;
  const isInvoice = data.documentType === 'invoice';
  const isQuotation = data.documentType === 'quotation';
  const isReceipt = data.documentType === 'receipt';
  const isBill = data.documentType === 'bill';

  const docTitle =
    data.documentType === 'quotation' ? 'COMMERCIAL QUOTATION' :
    data.documentType === 'invoice' ? 'TAX INVOICE' :
    data.documentType === 'bill' ? 'VENDOR DISBURSEMENT BILL' : 'OFFICIAL PAYMENT RECEIPT';

  return (
    <div className="font-sans text-slate-800 bg-white max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between shadow-sm" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div>
        {/* Top Corporate Navy Bar */}
        <div className="bg-slate-900 text-white p-8">
          <div className="flex justify-between items-start">
            <div>
              {company.logo ? (
                <img src={company.logo} alt={company.name} className="h-12 max-w-[180px] object-contain mb-2 brightness-200" />
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 bg-primary-500 text-white rounded-lg flex items-center justify-center font-bold text-lg">
                    {company.name.charAt(0)}
                  </div>
                  <span className="text-2xl font-bold tracking-tight text-white">{company.name}</span>
                </div>
              )}
              <p className="text-xs text-slate-300 font-medium">{company.tagline || 'Enterprise Software Engineering'}</p>
              <p className="text-[11px] text-slate-400 mt-1">{company.website} · {company.email}</p>
            </div>

            <div className="text-right">
              <span className="inline-block bg-primary-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded mb-2">
                {docTitle}
              </span>
              <p className="text-xl font-mono font-bold tracking-tight text-white">{data.number}</p>
              <p className="text-xs text-slate-300 mt-1">Status: <span className="font-semibold text-white uppercase">{getStatusLabel(data.status)}</span></p>
            </div>
          </div>
        </div>

        {/* Corporate Metadata Strip */}
        <div className="bg-slate-100 px-8 py-3 grid grid-cols-4 gap-4 text-xs border-b border-slate-200">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Issue Date</span>
            <span className="font-semibold text-slate-800">{formatDate(data.date)}</span>
          </div>
          {data.dueDateOrExpiry && (
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">{isQuotation ? 'Valid Until' : 'Payment Due'}</span>
              <span className="font-semibold text-slate-800">{formatDate(data.dueDateOrExpiry)}</span>
            </div>
          )}
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payment Terms</span>
            <span className="font-semibold text-slate-800">{data.paymentTerms || 'Net 30 Days'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Currency</span>
            <span className="font-semibold text-slate-800">{company.currency || 'USD'} ({currencySymbol})</span>
          </div>
        </div>

        {/* Addresses Box */}
        <div className="p-8 grid grid-cols-2 gap-8 border-b border-slate-200">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              From Service Provider
            </span>
            <p className="text-sm font-bold text-slate-900">{company.name}</p>
            <p className="text-xs text-slate-600 mt-0.5">{company.address.street}</p>
            <p className="text-xs text-slate-600">{company.address.city}, {company.address.state} {company.address.zipCode}</p>
            <p className="text-xs text-slate-500 mt-1">{company.taxNumber || 'EIN / Corporate Tax ID'}</p>
            <p className="text-xs text-slate-500">{company.phone}</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              {isBill ? 'Vendor / Supplier' : 'Client / Invoiced To'}
            </span>
            {isBill ? (
              <div>
                <p className="text-sm font-bold text-slate-900">{data.vendorName || 'Vendor'}</p>
                {data.vendorEmail && <p className="text-xs text-slate-600">{data.vendorEmail}</p>}
                {data.vendorPhone && <p className="text-xs text-slate-600">{data.vendorPhone}</p>}
                {data.vendorAddress && <p className="text-xs text-slate-500 mt-1">{data.vendorAddress}</p>}
              </div>
            ) : customer ? (
              <div>
                <p className="text-sm font-bold text-slate-900">{customer.name}</p>
                {customer.company && <p className="text-xs font-semibold text-primary-700">{customer.company}</p>}
                <p className="text-xs text-slate-600 mt-0.5">{customer.address.street}</p>
                <p className="text-xs text-slate-600">{customer.address.city}, {customer.address.state} {customer.address.country}</p>
                {customer.taxNumber && <p className="text-xs text-slate-500 mt-1">{customer.taxNumber}</p>}
                {customer.email && <p className="text-xs text-slate-500">{customer.email}</p>}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No client details provided</p>
            )}
          </div>
        </div>

        {/* Project Scope Description */}
        {data.projectDescription && (
          <div className="px-8 py-3 bg-primary-50/40 border-b border-primary-100 flex items-center gap-3">
            <span className="text-[11px] font-bold text-primary-900 uppercase tracking-wider">Project:</span>
            <span className="text-xs text-slate-700 font-medium">{data.projectDescription}</span>
          </div>
        )}

        {/* Items Table */}
        {!isReceipt ? (
          <div className="p-8">
            <table className="w-full text-left border border-slate-200">
              <thead className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">Item</th>
                  <th className="py-2.5 px-3">Deliverable & Scope Details</th>
                  <th className="py-2.5 px-3 text-center w-16">Qty</th>
                  <th className="py-2.5 px-3 text-right w-24">Unit Rate</th>
                  <th className="py-2.5 px-3 text-right w-28">Total Amount</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-200">
                {data.lineItems.map((item, index) => (
                  <tr key={item.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">{index + 1}</td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900">{item.description}</p>
                      {item.unit && <p className="text-[10px] text-slate-400">Unit Type: {item.unit}</p>}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-700">{item.quantity}</td>
                    <td className="py-3 px-3 text-right text-slate-700">{formatCurrency(item.unitPrice, currencySymbol)}</td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900">{formatCurrency(item.amount, currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals Box */}
            <div className="flex justify-end mt-4">
              <div className="w-72 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                <div className="p-3 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-medium text-slate-800">{formatCurrency(data.subtotal, currencySymbol)}</span>
                  </div>
                  {(data.discountAmount || 0) > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Discount {data.discountPercent ? `(${data.discountPercent}%)` : ''}:</span>
                      <span className="font-medium">-{formatCurrency(data.discountAmount || 0, currencySymbol)}</span>
                    </div>
                  )}
                  {(data.taxAmount || 0) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Tax ({data.taxPercent || 0}%):</span>
                      <span className="font-medium">+{formatCurrency(data.taxAmount || 0, currencySymbol)}</span>
                    </div>
                  )}
                </div>
                <div className="bg-slate-900 text-white p-3 flex justify-between items-center text-sm font-bold">
                  <span>Grand Total:</span>
                  <span className="text-lg text-primary-300">{formatCurrency(data.total, currencySymbol)}</span>
                </div>
                {data.amountPaid !== undefined && data.amountPaid > 0 && (
                  <div className="p-3 bg-emerald-50 border-t border-emerald-200 text-xs flex justify-between text-emerald-800 font-semibold">
                    <span>Paid to Date:</span>
                    <span>{formatCurrency(data.amountPaid, currencySymbol)}</span>
                  </div>
                )}
                {data.balanceDue !== undefined && (
                  <div className="p-3 bg-white border-t border-slate-200 text-xs flex justify-between font-bold text-slate-900">
                    <span>Net Balance Due:</span>
                    <span className={data.balanceDue > 0 ? 'text-rose-600 text-sm' : 'text-emerald-600 text-sm'}>
                      {formatCurrency(data.balanceDue, currencySymbol)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Receipt Block */
          <div className="p-8">
            <div className="bg-slate-50 border-2 border-emerald-500 rounded-xl p-6 text-xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <span className="text-sm font-bold text-emerald-800 uppercase tracking-wide">✓ Verification of Settled Funds</span>
                <span className="font-mono text-slate-500">{data.number}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div><span className="text-slate-400">Invoice Reference: </span><span className="font-bold text-slate-800">{data.linkedInvoiceNumber || 'Direct Payment'}</span></div>
                <div><span className="text-slate-400">Method: </span><span className="font-semibold text-slate-800 capitalize">{data.paymentMethod?.replace('_', ' ') || 'Bank Wire'}</span></div>
                <div><span className="text-slate-400">Payment Date: </span><span className="font-semibold text-slate-800">{formatDate(data.date)}</span></div>
                {data.referenceNumber && <div><span className="text-slate-400">Transaction ID: </span><span className="font-mono text-slate-700">{data.referenceNumber}</span></div>}
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center text-slate-900">
                <span className="text-sm font-semibold">Verified Amount Received:</span>
                <span className="text-2xl font-black text-emerald-600 font-mono">{formatCurrency(data.amountPaid || data.total, currencySymbol)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Banking and Instructions */}
        {(isInvoice || isBill) && company.bankDetails && (
          <div className="mx-8 p-4 bg-slate-50 border border-slate-200 rounded text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Wire Transfer & Settlement Instructions
            </span>
            <p className="text-slate-600">{data.paymentInstructions || `Remit full invoiced balance to ${company.bankDetails.bankName}.`}</p>
            <div className="grid grid-cols-4 gap-2 mt-2 font-mono text-[11px] text-slate-800">
              <div><span className="text-slate-400">Bank: </span>{company.bankDetails.bankName}</div>
              <div><span className="text-slate-400">Account: </span>{company.bankDetails.accountNumber}</div>
              <div><span className="text-slate-400">SWIFT: </span>{company.bankDetails.swiftCode || 'N/A'}</div>
              <div><span className="text-slate-400">Routing: </span>{company.bankDetails.routingNumber || company.bankDetails.ifscCode}</div>
            </div>
          </div>
        )}

        {/* Quotation Acceptance Block */}
        {isQuotation && (
          <div className="mx-8 p-4 bg-slate-50 border border-slate-300 rounded text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
              Contract Acceptance & Notice to Proceed
            </span>
            <p className="text-slate-600 mb-6">
              Client confirms that the pricing, deliverables schedule, and terms stated herein are approved and authorize {company.name} to commence project execution.
            </p>
            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Authorized Client Signature</p>
                <div className="h-10 border-b border-slate-400 mt-2 flex items-end">
                  <span className="font-mono text-xs text-slate-700">{data.clientSignerName || customer?.name}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Designation & Date</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{company.name} Authorization</p>
                <div className="h-10 border-b border-slate-400 mt-2 flex items-end">
                  {company.signature ? (
                    <img src={company.signature} alt="Authorised signature" className="max-h-8 object-contain" />
                  ) : (
                    <span className="font-mono text-xs text-slate-700">Authorised Signatory</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Date: {formatDate(data.date)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Terms */}
        <div className="px-8 py-4 text-xs text-slate-500 space-y-1">
          {data.terms && <p><span className="font-semibold text-slate-700">Terms:</span> {data.terms}</p>}
          {data.notes && <p><span className="font-semibold text-slate-700">Special Notes:</span> {data.notes}</p>}
        </div>
      </div>

      {/* Footer */}
      <div className="p-8 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-400">
        <span>{company.footer || company.name}</span>
        <span className="font-mono text-[10px]">REF: {data.number}</span>
      </div>
    </div>
  );
};
