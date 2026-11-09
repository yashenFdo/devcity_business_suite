/** DevCity Pvt Ltd — the company that builds and supports this product. */
export const DEVCITY = {
  company: 'DevCity Pvt Ltd',
  website: 'https://devcity.us',
  websiteLabel: 'devcity.us',
  email: 'hello@devcity.us',
  phones: ['+94 72 223 3196', '+94 71 197 4973'],
  address: '10/3 Matara Road, Habaraduwa, Galle, Sri Lanka',
} as const;

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
