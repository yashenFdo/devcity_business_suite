/** Ink colours are fixed by stamp type. */
export const STAMP_INK = {
  company: '#1d3fbf', // blue ink
  personal: '#1c1f26', // black ink
  paid: '#13853f', // green ink
} as const;

export type StampInk = keyof typeof STAMP_INK;
