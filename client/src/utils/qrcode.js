import QRCode from 'qrcode';

/**
 * Generates a QR code data-URL for a product.
 * The QR encodes ONLY the SKU / product ID — full details are always
 * fetched from Firestore at scan time so labels never go stale.
 */
export async function generateQrDataUrl(text, size = 256) {
  return QRCode.toDataURL(String(text), {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0c0c0e', light: '#ffffff' },
  });
}

/**
 * Opens a print-ready window with QR labels for the given products.
 * Each label shows the QR, product name, SKU and price — sized for
 * standard 38x25mm-ish clothing tag stickers (3 per row on A4).
 */
export async function printQrLabels(products, currencySymbol = 'Rs.') {
  const labels = await Promise.all(
    products.map(async (p) => {
      const qr = await generateQrDataUrl(p.sku || p.id, 220);
      const price = (p.discountPrice || p.sellingPrice || 0).toLocaleString();
      return `
        <div class="label">
          <img src="${qr}" alt="${p.sku}" />
          <div class="info">
            <div class="name">${p.name}</div>
            <div class="sku">${p.sku}</div>
            <div class="price">${currencySymbol} ${price}</div>
          </div>
        </div>`;
    })
  );

  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) throw new Error('Popup blocked — allow popups to print labels.');
  win.document.write(`<!doctype html>
<html><head><title>Veloura — QR Labels</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Poppins', Arial, sans-serif; padding: 10mm; }
  .sheet { display: flex; flex-wrap: wrap; gap: 4mm; }
  .label { width: 60mm; border: 1px dashed #bbb; border-radius: 3mm; padding: 3mm;
           display: flex; gap: 3mm; align-items: center; page-break-inside: avoid; }
  .label img { width: 22mm; height: 22mm; }
  .name { font-size: 8pt; font-weight: 600; line-height: 1.2; }
  .sku { font-size: 7pt; color: #555; margin-top: 1mm; }
  .price { font-size: 9pt; font-weight: 700; margin-top: 1mm; }
  @media print { .label { border-color: #eee; } }
</style></head>
<body><div class="sheet">${labels.join('')}</div>
<script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
</body></html>`);
  win.document.close();
}
