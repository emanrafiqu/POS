import { format } from 'date-fns';

let currencySymbol = 'Rs.';

/** SettingsContext calls this once settings load so all formatting stays in sync. */
export function setCurrencySymbol(symbol) {
  if (symbol) currencySymbol = symbol;
}

export function formatCurrency(amount) {
  const n = Number(amount) || 0;
  return `${currencySymbol} ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

/** Accepts Firestore Timestamp, Date, ISO string or millis. */
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
}

export function formatDate(value, pattern = 'dd MMM yyyy') {
  const d = toDate(value);
  return d && !isNaN(d) ? format(d, pattern) : '—';
}

export function formatDateTime(value) {
  return formatDate(value, 'dd MMM yyyy, hh:mm a');
}

export function formatNumber(n) {
  return (Number(n) || 0).toLocaleString('en-PK');
}

/** Generates a human-friendly invoice number, e.g. INV-240705-4821 */
export function generateInvoiceNumber() {
  const d = new Date();
  const ymd = format(d, 'yyMMdd');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${ymd}-${rand}`;
}

/** Generates a SKU from category, e.g. VLR-TSH-8342 */
export function generateSku(category = 'GEN') {
  const prefix = category.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'GEN';
  return `VLR-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}
