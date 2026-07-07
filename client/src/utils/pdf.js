import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateQrDataUrl } from './qrcode';
import { formatDateTime, toDate } from './format';

const GOLD = [201, 162, 39];
const INK = [12, 12, 14];

/** Downloads a thermal-style PDF receipt for a completed sale. */
export async function downloadReceiptPdf(sale, settings) {
  const lineHeight = 4.5;
  const height = 120 + (sale.items?.length || 0) * lineHeight + 40;
  const doc = new jsPDF({ unit: 'mm', format: [80, Math.max(height, 150)] });
  const cx = 40;
  let y = 10;

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...INK);
  doc.text(settings?.storeName || 'Veloura', cx, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(120);
  if (settings?.tagline) { doc.text(settings.tagline, cx, y, { align: 'center' }); y += 4; }
  if (settings?.address) { doc.text(settings.address, cx, y, { align: 'center' }); y += 4; }
  if (settings?.phone) { doc.text(settings.phone, cx, y, { align: 'center' }); y += 4; }

  y += 1;
  doc.setDrawColor(...GOLD).setLineWidth(0.4).line(6, y, 74, y);
  y += 5;

  doc.setFontSize(7.5).setTextColor(...INK);
  doc.text(`Invoice: ${sale.invoiceNumber}`, 6, y);
  doc.text(formatDateTime(sale.createdAt), 74, y, { align: 'right' });
  y += 4;
  doc.text(`Cashier: ${sale.cashierName || '—'}`, 6, y);
  y += 4;
  doc.text(`Customer: ${sale.customerName || 'Walk-in Customer'}`, 6, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: 6, right: 6 },
    head: [['Item', 'Qty', 'Price', 'Total']],
    body: (sale.items || []).map((it) => [
      `${it.name}${it.size ? ` (${it.size})` : ''}`,
      it.quantity,
      it.unitPrice.toLocaleString(),
      it.lineTotal.toLocaleString(),
    ]),
    styles: { fontSize: 6.5, cellPadding: 1 },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 6.5 },
    columnStyles: { 0: { cellWidth: 32 }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    theme: 'plain',
  });
  y = doc.lastAutoTable.finalY + 3;

  const sym = settings?.currencySymbol || 'Rs.';
  const row = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 9 : 7.5);
    doc.text(label, 6, y);
    doc.text(`${sym} ${Number(value).toLocaleString()}`, 74, y, { align: 'right' });
    y += bold ? 5 : 4;
  };
  row('Subtotal', sale.subtotal);
  if (sale.discount > 0) row(`Discount${sale.couponCode ? ` (${sale.couponCode})` : ''}`, -sale.discount);
  row(`Tax (${sale.taxRate || 0}%)`, sale.taxAmount);
  doc.setDrawColor(...GOLD).line(6, y - 2, 74, y - 2);
  y += 1;
  row('GRAND TOTAL', sale.grandTotal, true);
  row('Paid', sale.amountPaid);
  if (sale.changeDue > 0) row('Change', sale.changeDue);
  doc.setFont('helvetica', 'normal').setFontSize(7);
  doc.text(`Payment: ${(sale.payments || []).map((p) => `${p.method} ${sym}${p.amount.toLocaleString()}`).join(', ')}`, 6, y);
  y += 5;

  // QR of invoice number for quick lookup
  const qr = await generateQrDataUrl(sale.invoiceNumber, 128);
  doc.addImage(qr, 'PNG', cx - 9, y, 18, 18);
  y += 21;

  doc.setFontSize(7).setTextColor(120);
  doc.text(settings?.receiptFooter || 'Thank you for shopping!', cx, y, { align: 'center' });
  y += 4;
  if (settings?.returnPolicy) {
    const lines = doc.splitTextToSize(settings.returnPolicy, 62);
    doc.text(lines, cx, y, { align: 'center' });
  }

  doc.save(`${sale.invoiceNumber}.pdf`);
}

/** Generic tabular report export used by the Reports page. */
export function downloadReportPdf({ title, subtitle, columns, rows, summaryRows = [], fileName }) {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });

  doc.setFillColor(...INK).rect(0, 0, doc.internal.pageSize.getWidth(), 24, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...GOLD);
  doc.text('VELOURA', 14, 11);
  doc.setFontSize(10).setTextColor(255);
  doc.text(title, 14, 18);
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text(subtitle || `Generated ${new Date().toLocaleString()}`, doc.internal.pageSize.getWidth() - 14, 18, { align: 'right' });

  autoTable(doc, {
    startY: 30,
    head: [columns],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: INK, textColor: GOLD },
    alternateRowStyles: { fillColor: [247, 247, 245] },
  });

  let y = doc.lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...INK);
  for (const [label, value] of summaryRows) {
    doc.text(`${label}: ${value}`, 14, y);
    y += 6;
  }

  doc.save(`${fileName || title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

/** Helper used by report builders to bucket sales by day. */
export function groupByDay(records, dateField = 'createdAt') {
  const map = new Map();
  for (const r of records) {
    const d = toDate(r[dateField]);
    if (!d) continue;
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}
