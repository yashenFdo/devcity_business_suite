// ─── DevCity Document Number Generators ──────────────────────
// Numbers are DEV-<TYPE>-<YEAR>-<SEQ>. The sequence continues from the
// highest number already used this year, so deleting a document never
// causes a duplicate number to be issued.
import { randomId } from '../security/crypto';

const nextNumber = (type: string, existing: readonly string[]): string => {
  const year = new Date().getFullYear();
  const prefix = `DEV-${type}-${year}-`;
  const max = existing.reduce((acc, n) => {
    if (!n?.startsWith(prefix)) return acc;
    const seq = parseInt(n.slice(prefix.length), 10);
    return Number.isFinite(seq) && seq > acc ? seq : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
};

export const generateQuotationNumber = (existing: readonly string[]) => nextNumber('QUO', existing);
export const generateInvoiceNumber = (existing: readonly string[]) => nextNumber('INV', existing);
export const generateBillNumber = (existing: readonly string[]) => nextNumber('BILL', existing);
export const generateReceiptNumber = (existing: readonly string[]) => nextNumber('RCP', existing);

export const generateCustomerId = (): string => `CUST-${randomId().slice(0, 10).toUpperCase()}`;

export const generateId = (): string => randomId();
