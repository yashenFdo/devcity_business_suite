import toast from 'react-hot-toast';
import { today } from '../../../utils/formatters';
import { plural } from './plural';

export type CsvCell = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvCell;
}

/** Cells that spreadsheet apps would evaluate as formulas (CSV injection). */
const FORMULA_START = /^[\s]*[=+\-@]|^[\t\r]/;

const cell = (v: CsvCell): string => {
  if (v === null || v === undefined) return '';
  // Numbers are written raw so spreadsheets can sum them (a negative number is not a formula).
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Money as a plain number rounded to 2 decimals. */
export const csvMoney = (n: number | undefined): number => Math.round((Number.isFinite(n) ? (n as number) : 0) * 100) / 100;

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(','));
  return lines.join('\r\n');
}

/**
 * Downloads rows as `devcity-<name>-<yyyy-mm-dd>.csv` (UTF-8 with BOM so Excel
 * reads non-ASCII text correctly) and confirms with a toast.
 */
export function exportCsv<T>({
  name,
  noun,
  rows,
  columns,
}: {
  name: string;
  noun: string;
  rows: readonly T[];
  columns: readonly CsvColumn<T>[];
}) {
  if (rows.length === 0) {
    toast.error(`No ${noun}s to export.`);
    return;
  }
  try {
    const blob = new Blob(['﻿', toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devcity-${name}-${today()}.csv`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Exported ${plural(rows.length, noun)}`);
  } catch {
    toast.error('Could not create the export file.');
  }
}
