import type { Company, Signatory, StampShape } from '../../../types';

export interface StampDraft {
  shape: StampShape;
  title: string;
  subtitle: string;
  line1: string;
  line2: string;
  showDate: boolean;
}

export const PERSONAL_PRESETS = ['APPROVED', 'CHECKED', 'RECEIVED', 'VERIFIED', 'AUTHORISED'] as const;

const join = (parts: (string | undefined)[], sep: string) => parts.map((p) => p?.trim()).filter(Boolean).join(sep);

/** Small lines for a company stamp, from the company profile. Round seals have room for one. */
export const companyStampLines = (company: Company, shape: StampShape): [string, string] =>
  shape === 'round'
    ? [join([company.address.city, company.address.country], ', ') || join([company.phone], ''), '']
    : [join([company.address.street, company.address.city, company.address.country], ', '), join([company.phone, company.email], ' · ')];

export const companyStampDraft = (company: Company, shape: StampShape = 'round'): StampDraft => {
  const [line1, line2] = companyStampLines(company, shape);
  return {
    shape,
    title: company.name,
    subtitle: company.registrationNumber ? `Reg. No ${company.registrationNumber}` : '',
    line1,
    line2,
    showDate: shape === 'rect',
  };
};

/** A new personal stamp: preset title, the person's job title (if they're a signatory) and name. */
export const personalStampDraft = (user: { name: string; email: string }, signatories: Signatory[]): StampDraft => {
  const me = signatories.find((s) => s.email && s.email.toLowerCase() === user.email.toLowerCase());
  return {
    shape: 'rect',
    title: 'APPROVED',
    subtitle: me?.role ?? '',
    line1: me?.name ?? user.name,
    line2: '',
    showDate: true,
  };
};
