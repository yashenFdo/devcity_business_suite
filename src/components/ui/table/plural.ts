/** `plural(1, 'invoice')` → "1 invoice", `plural(3, 'invoice')` → "3 invoices". */
export const plural = (n: number, word: string, pluralWord = `${word}s`) => `${n} ${n === 1 ? word : pluralWord}`;
