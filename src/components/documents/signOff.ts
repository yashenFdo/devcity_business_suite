import type { Company, Signatory, SignOffOptions, Stamp } from '../../types';

export const MAX_SIGNATORIES = 5;

/** Company signatories, falling back to the single legacy signature image. */
export const companySignatories = (company: Company): Signatory[] => {
  if (company.signatories?.length) return company.signatories;
  if (company.signature) {
    return [{ id: 'legacy', name: company.name, role: 'Authorised signatory', signature: company.signature }];
  }
  return [];
};

/** Sign-off choices for a brand-new document. */
export const defaultSignOff = (company: Company): SignOffOptions => {
  const all = companySignatories(company);
  const ids = (company.defaultSignatoryIds ?? []).filter((id) => all.some((s) => s.id === id));
  return { signatoryIds: (ids.length ? ids : all.slice(0, 1).map((s) => s.id)).slice(0, MAX_SIGNATORIES), stampIds: [] };
};

/**
 * Resolve a document's stored choices into what the template renders.
 * `isPaid` drives the automatic green PAID stamp.
 */
export const resolveSignOff = (
  options: SignOffOptions,
  company: Company,
  stamps: Stamp[],
  isPaid: boolean,
  documentDate?: string
) => {
  const all = companySignatories(company);
  const ids = options.signatoryIds ?? defaultSignOff(company).signatoryIds ?? [];
  return {
    signatories: ids
      .map((id) => all.find((s) => s.id === id))
      .filter((s): s is Signatory => !!s)
      .slice(0, MAX_SIGNATORIES),
    stamps: (options.stampIds ?? []).map((id) => stamps.find((s) => s.id === id)).filter((s): s is Stamp => !!s),
    showPaidStamp: options.paidStamp ?? isPaid,
    stampDate: options.stampDate || documentDate,
  };
};
