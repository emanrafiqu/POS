import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { findProductByCode } from '@/services/productService';
import { playSuccessSound, playErrorSound } from '@/utils/sound';
import { formatCurrency } from '@/utils/format';

const READER_ID = 'veloura-qr-reader';
const SCAN_COOLDOWN_MS = 1500; // ignore repeat frames of the same label

/**
 * Laptop-webcam QR scanner for the billing page (html5-qrcode).
 *
 * - Live camera preview inside a modal
 * - Continuous scanning; a decoded code is looked up in Firestore by SKU/ID
 * - Found → onProductScanned(product), success beep, toast, brief image flash
 * - Not found → error beep, "Product Not Found.", camera stays live
 * - "Stop after scan" toggle pauses after each successful scan (configurable)
 */
export function QRScannerModal({ open, onClose, onProductScanned }) {
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ code: null, at: 0 });
  const processingRef = useRef(false);
  const stopAfterScanRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopAfterScan, setStopAfterScan] = useState(false);
  const [lastProduct, setLastProduct] = useState(null); // visual confirmation card
  const [cameraError, setCameraError] = useState(null);

  stopAfterScanRef.current = stopAfterScan;

  /* ---------------- Camera lifecycle ---------------- */
  const startScanner = async () => {
    if (scannerRef.current?.isScanning) return;
    setStarting(true);
    setCameraError(null);
    try {
      scannerRef.current = scannerRef.current || new Html5Qrcode(READER_ID);
      await scannerRef.current.start(
        { facingMode: 'environment' }, // falls back to the laptop webcam automatically
        { fps: 10, qrbox: { width: 240, height: 240 } },
        handleDecoded,
        () => {} // per-frame decode misses — noise, ignore
      );
      setRunning(true);
    } catch (err) {
      console.error('[QRScanner] start failed:', err);
      setCameraError(
        'Could not access the camera. Please allow camera permission in your browser and make sure no other app is using the webcam.'
      );
    } finally {
      setStarting(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    } catch { /* already stopped */ }
    setRunning(false);
  };

  useEffect(() => {
    if (open) {
      // let the modal render the reader div first
      const t = setTimeout(startScanner, 150);
      return () => {
        clearTimeout(t);
        stopScanner();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ---------------- Decode handling ---------------- */
  async function handleDecoded(decodedText) {
    const now = Date.now();
    const { code, at } = lastScanRef.current;
    // Debounce: same label sitting in front of the camera fires many frames
    if (processingRef.current || (decodedText === code && now - at < SCAN_COOLDOWN_MS)) return;
    processingRef.current = true;
    lastScanRef.current = { code: decodedText, at: now };

    try {
      const product = await findProductByCode(decodedText);

      if (!product || product.archived) {
        playErrorSound();
        toast.error('Product Not Found.');
        return; // camera stays active for the next attempt
      }
      if ((Number(product.stockQuantity) || 0) <= 0) {
        playErrorSound();
        toast.warn(`"${product.name}" is out of stock.`);
        return;
      }

      onProductScanned(product);
      playSuccessSound();
      toast.success('Product Added Successfully.');

      // Brief visual confirmation of what was just scanned
      setLastProduct(product);
      setTimeout(() => setLastProduct((p) => (p?.id === product.id ? null : p)), 2500);

      if (stopAfterScanRef.current) await stopScanner();
    } catch (err) {
      console.error('[QRScanner] lookup failed:', err);
      playErrorSound();
      toast.error('Scan failed — check your connection and try again.');
    } finally {
      processingRef.current = false;
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Scan Product"
      subtitle="Point the webcam at a Veloura QR label"
    >
      {/* Live preview */}
      <div className="relative overflow-hidden rounded-2xl bg-ink">
        <div id={READER_ID} className="mx-auto w-full [&_video]:!rounded-2xl" />
        {!running && !starting && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-white/60">
            <CameraOff className="h-10 w-10" />
            <p className="max-w-xs px-4 text-center text-sm">{cameraError || 'Camera is paused.'}</p>
          </div>
        )}
        {starting && (
          <div className="flex h-64 items-center justify-center text-white/60">
            <Camera className="mr-2 h-5 w-5 animate-pulse" /> Starting camera…
          </div>
        )}

        {/* Scanned product flash card */}
        {lastProduct && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-xl glass-dark p-3 text-white animate-fade-in">
            {lastProduct.images?.[0] ? (
              <img src={lastProduct.images[0]} alt={lastProduct.name} className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold/20 text-gold">✓</div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{lastProduct.name}</p>
              <p className="text-xs text-white/60">
                {lastProduct.sku} · {formatCurrency(lastProduct.discountPrice || lastProduct.sellingPrice)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={stopAfterScan}
            onChange={(e) => setStopAfterScan(e.target.checked)}
            className="h-4 w-4 rounded accent-gold"
          />
          Stop after each successful scan
        </label>
        <div className="flex gap-2">
          {running ? (
            <Button variant="outline" onClick={stopScanner}>
              <CameraOff className="h-4 w-4" /> Pause
            </Button>
          ) : (
            <Button variant="gold" onClick={startScanner} loading={starting}>
              <RefreshCw className="h-4 w-4" /> Resume Scanning
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Dialog>
  );
}
