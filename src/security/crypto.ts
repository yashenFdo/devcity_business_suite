// Small randomness helpers (Web Crypto).

export const randomBytes = (n: number): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(n));

export const randomId = (prefix = ''): string => {
  const hex = Array.from(randomBytes(10), (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}_${hex}` : hex;
};
