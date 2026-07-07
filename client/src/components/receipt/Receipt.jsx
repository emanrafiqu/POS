import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useSettings } from '@/context/SettingsContext';
import { generateQrDataUrl } from '@/utils/qrcode';
import { downloadReceiptPdf } from '@/utils/pdf';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { toast } from 'react-toastify';

/**
 * Receipt preview dialog — thermal-receipt styling, browser printing
 * (via the .print-area CSS in index.css) and PDF download.
 */
export function ReceiptDialog({ sale, open, onClose }) {
  const { settings } = useSettings();
  const [qr, setQr] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (sale) generateQrDataUrl(sale.invoiceNumber, 140).then(setQr).catch(() => {});
  }, [sale]);

  if (!sale) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadReceiptPdf(sale, settings);
    } catch (err) {
      console.error(err);
      toast.error('PDF generation failed.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Receipt" subtitle={sale.invoiceNumber}>
      <div className="print-area mx-auto max-w-xs rounded-xl border border-dashed border-ink/20 bg-white p-5 font-mono text-[11px] leading-relaxed text-ink">
        {/* Header */}
        <div className="text-center">
          {settings.logoUrl && <img src={settings.logoUrl} alt="logo" className="mx-auto mb-2 h-12 w-12 rounded-lg object-cover" />}
          <p className="font-sans text-lg font-bold tracking-widest">{settings.storeName?.toUpperCase() || 'VELOURA'}</p>
          {settings.tagline && <p className="text-ink/60">{settings.tagline}</p>}
          {settings.address && <p className="text-ink/60">{settings.address}</p>}
          {settings.phone && <p className="text-ink/60">{settings.phone}</p>}
        </div>

        <div className="my-2 border-t border-dashed border-ink/30" />
        <div className="flex justify-between"><span>Invoice</span><span className="font-semibold">{sale.invoiceNumber}</span></div>
        <div className="flex justify-between"><span>Date</span><span>{formatDate(sale.createdAt)}</span></div>
        <div className="flex justify-between"><span>Time</span><span>{formatDateTime(sale.createdAt).split(', ')[1]}</span></div>
        <div className="flex justify-between"><span>Cashier</span><span>{sale.cashierName || '—'}</span></div>
        <div className="flex justify-between"><span>Customer</span><span>{sale.customerName}</span></div>
        <div className="my-2 border-t border-dashed border-ink/30" />

        {/* Items */}
        {sale.items.map((it, i) => (
          <div key={i} className="mb-1.5">
            <p className="font-semibold">{it.name}{it.size ? ` (${it.size})` : ''}</p>
            <div className="flex justify-between text-ink/70">
              <span>{it.quantity} × {formatCurrency(it.unitPrice)}</span>
              <span>{formatCurrency(it.lineTotal)}</span>
            </div>
          </div>
        ))}

        <div className="my-2 border-t border-dashed border-ink/30" />
        <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span></div>
        {sale.discount > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>Discount{sale.couponCode ? ` (${sale.couponCode})` : ''}</span>
            <span>-{formatCurrency(sale.discount)}</span>
          </div>
        )}
        <div className="flex justify-between"><span>Tax ({sale.taxRate}%)</span><span>{formatCurrency(sale.taxAmount)}</span></div>
        <div className="mt-1 flex justify-between border-t border-ink/40 pt-1 font-sans text-sm font-bold">
          <span>TOTAL</span><span>{formatCurrency(sale.grandTotal)}</span>
        </div>
        <div className="flex justify-between"><span>Paid</span><span>{formatCurrency(sale.amountPaid)}</span></div>
        {sale.changeDue > 0 && <div className="flex justify-between"><span>Change</span><span>{formatCurrency(sale.changeDue)}</span></div>}
        <div className="flex justify-between text-ink/70">
          <span>Payment</span>
          <span className="capitalize">{(sale.payments || []).map((p) => p.method.replace('_', ' ')).join(' + ')}</span>
        </div>

        {/* QR + footer */}
        <div className="mt-3 text-center">
          {qr && <img src={qr} alt="Invoice QR" className="mx-auto h-20 w-20" />}
          <p className="mt-2 font-semibold">{settings.receiptFooter}</p>
          <p className="mt-1 text-[10px] text-ink/50">{settings.returnPolicy}</p>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={handleDownload} loading={downloading}>
          <Download className="h-4 w-4" /> PDF
        </Button>
        <Button variant="gold" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print Receipt
        </Button>
      </div>
    </Dialog>
  );
}
