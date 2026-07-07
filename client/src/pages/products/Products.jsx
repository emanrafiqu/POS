import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive, ArchiveRestore, Copy, Download, Eye, History, MoreVertical,
  Pencil, Plus, Printer, QrCode, Trash2, Upload,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import {
  getProducts, deleteProduct, duplicateProduct, setArchived, importProducts,
} from '@/services/productService';
import { getProductHistory } from '@/services/inventoryService';
import { DataTable } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { exportCsv, exportExcel, parseCsvFile, parseExcelFile } from '@/utils/exportData';
import { generateQrDataUrl, printQrLabels } from '@/utils/qrcode';
import { formatCurrency, formatDateTime } from '@/utils/format';

const SORTS = {
  newest: { label: 'Newest first', fn: (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0) },
  name: { label: 'Name A–Z', fn: (a, b) => a.name.localeCompare(b.name) },
  price_asc: { label: 'Price: low → high', fn: (a, b) => a.sellingPrice - b.sellingPrice },
  price_desc: { label: 'Price: high → low', fn: (a, b) => b.sellingPrice - a.sellingPrice },
  stock: { label: 'Stock: low → high', fn: (a, b) => (a.stockQuantity || 0) - (b.stockQuantity || 0) },
  bestselling: { label: 'Best selling', fn: (a, b) => (b.totalSold || 0) - (a.totalSold || 0) },
};

export default function Products() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { settings } = useSettings();
  const canManage = hasRole('admin', 'manager');
  const { data: products, loading, reload } = useAsyncData(getProducts, []);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [showArchived, setShowArchived] = useState(false);
  const debounced = useDebounce(search, 250);

  const [preview, setPreview] = useState(null);          // product preview dialog
  const [qrProduct, setQrProduct] = useState(null);       // QR view dialog
  const [qrUrl, setQrUrl] = useState(null);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const categories = useMemo(
    () => ['all', ...new Set((products || []).map((p) => p.category).filter(Boolean))],
    [products]
  );

  const filtered = useMemo(() => {
    const q = debounced.toLowerCase();
    return (products || [])
      .filter((p) => (showArchived ? p.archived : !p.archived))
      .filter((p) => category === 'all' || p.category === category)
      .filter((p) => {
        if (stockFilter === 'low') return p.stockQuantity > 0 && p.stockQuantity <= (p.minStock || 10);
        if (stockFilter === 'out') return (p.stockQuantity || 0) <= 0;
        return true;
      })
      .filter((p) => !q || [p.name, p.sku, p.brand, p.color].some((f) => (f || '').toLowerCase().includes(q)))
      .sort(SORTS[sort].fn);
  }, [products, debounced, category, stockFilter, sort, showArchived]);

  const pagination = usePagination(filtered, 12);

  /* ---------------- Actions ---------------- */
  const showQr = async (product) => {
    setQrProduct(product);
    setQrUrl(await generateQrDataUrl(product.sku || product.id, 300));
  };

  const showHistory = async (product) => {
    setHistoryProduct(product);
    try {
      setHistory(await getProductHistory(product.id));
    } catch {
      toast.error('Could not load inventory history.');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProduct(deleteTarget.id, deleteTarget.name);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      reload();
    } catch {
      toast.error('Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (product) => {
    try {
      await duplicateProduct(product);
      toast.success('Product duplicated — a new SKU and QR code were generated.');
      reload();
    } catch {
      toast.error('Duplicate failed.');
    }
  };

  const handleArchive = async (product) => {
    try {
      await setArchived(product.id, !product.archived);
      toast.success(product.archived ? 'Product restored.' : 'Product archived.');
      reload();
    } catch {
      toast.error('Operation failed.');
    }
  };

  const handleExport = (type) => {
    const rows = filtered.map((p) => ({
      name: p.name, sku: p.sku, category: p.category, subCategory: p.subCategory,
      brand: p.brand, size: p.size, color: p.color, gender: p.gender, material: p.material,
      purchasePrice: p.purchasePrice, sellingPrice: p.sellingPrice, discountPrice: p.discountPrice || '',
      tax: p.tax, stockQuantity: p.stockQuantity, minStock: p.minStock,
      status: p.status, totalSold: p.totalSold || 0,
    }));
    if (type === 'csv') exportCsv(rows, 'veloura-products.csv');
    else exportExcel(rows, 'veloura-products.xlsx', 'Products');
    toast.success(`Exported ${rows.length} products.`);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const rows = file.name.endsWith('.csv') ? await parseCsvFile(file) : await parseExcelFile(file);
      const { imported, skipped } = await importProducts(rows);
      toast.success(`Imported ${imported} products${skipped ? ` (${skipped} rows skipped)` : ''}.`);
      reload();
    } catch (err) {
      toast.error(err.message || 'Import failed — check the file format.');
    } finally {
      setImporting(false);
    }
  };

  const handlePrintLabels = async () => {
    try {
      await printQrLabels(pagination.pageItems, settings.currencySymbol);
    } catch (err) {
      toast.error(err.message);
    }
  };

  /* ---------------- Table ---------------- */
  const columns = [
    {
      key: 'name', header: 'Product', render: (p) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">
            {p.images?.[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" /> : <QrCode className="h-4 w-4 text-ink/20" />}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{p.name}</p>
            <p className="text-xs text-ink/45">{p.sku}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', className: 'hidden md:table-cell', render: (p) => <Badge>{p.category}</Badge> },
    { key: 'size', header: 'Size / Color', className: 'hidden lg:table-cell', render: (p) => `${p.size || '—'} · ${p.color || '—'}` },
    {
      key: 'sellingPrice', header: 'Price', render: (p) => (
        <div>
          <span className="font-semibold">{formatCurrency(p.discountPrice || p.sellingPrice)}</span>
          {p.discountPrice && <span className="ml-1.5 text-xs text-ink/40 line-through">{formatCurrency(p.sellingPrice)}</span>}
        </div>
      ),
    },
    {
      key: 'stockQuantity', header: 'Stock', render: (p) => (
        <span className={p.stockQuantity <= 0 ? 'font-semibold text-red-600' : p.stockQuantity <= (p.minStock || 10) ? 'font-semibold text-amber-600' : ''}>
          {p.stockQuantity ?? 0}
        </span>
      ),
    },
    { key: 'status', header: 'Status', className: 'hidden sm:table-cell', render: (p) => p.archived ? <Badge variant="warning">Archived</Badge> : <StatusBadge status={p.status} /> },
    {
      key: 'actions', header: '', render: (p) => (
        <div className="relative flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} aria-label="Product actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
          {menuFor === p.id && (
            <div className="absolute right-0 top-9 z-20 w-48 rounded-xl border border-ink/10 bg-white py-1 shadow-2xl animate-scale-in" onMouseLeave={() => setMenuFor(null)}>
              <MenuItem icon={Eye} label="Preview" onClick={() => { setPreview(p); setMenuFor(null); }} />
              <MenuItem icon={QrCode} label="View QR code" onClick={() => { showQr(p); setMenuFor(null); }} />
              <MenuItem icon={History} label="Inventory history" onClick={() => { showHistory(p); setMenuFor(null); }} />
              {canManage && (
                <>
                  <MenuItem icon={Pencil} label="Edit" onClick={() => navigate(`/products/${p.id}/edit`)} />
                  <MenuItem icon={Copy} label="Duplicate" onClick={() => { handleDuplicate(p); setMenuFor(null); }} />
                  <MenuItem icon={p.archived ? ArchiveRestore : Archive} label={p.archived ? 'Restore' : 'Archive'} onClick={() => { handleArchive(p); setMenuFor(null); }} />
                  <MenuItem icon={Trash2} label="Delete" danger onClick={() => { setDeleteTarget(p); setMenuFor(null); }} />
                </>
              )}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="text-sm text-ink/50">{filtered.length} products{showArchived ? ' (archived)' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrintLabels}><Printer className="h-4 w-4" /> Print QR Labels</Button>
          {canManage && (
            <>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} loading={importing}><Upload className="h-4 w-4" /> Import</Button>
              <Button variant="outline" onClick={() => handleExport('csv')}><Download className="h-4 w-4" /> CSV</Button>
              <Button variant="outline" onClick={() => handleExport('excel')}><Download className="h-4 w-4" /> Excel</Button>
              <Link to="/products/new"><Button variant="gold"><Plus className="h-4 w-4" /> Add Product</Button></Link>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Name, SKU, brand, color…" className="w-64" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
          {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </Select>
        <Select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="w-36">
          <option value="all">All stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-44">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 text-sm text-ink/60">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 accent-gold" />
          Archived
        </label>
      </div>

      <DataTable columns={columns} rows={pagination.pageItems} loading={loading} pagination={pagination} onRowClick={setPreview} />

      {/* Product preview */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} title={preview?.name} subtitle={preview?.sku} wide>
        {preview && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-surface">
                {preview.images?.[0] ? <img src={preview.images[0]} alt={preview.name} className="h-full w-full object-cover" /> : <QrCode className="h-12 w-12 text-ink/15" />}
              </div>
              {preview.images?.length > 1 && (
                <div className="mt-2 flex gap-2">
                  {preview.images.slice(1, 5).map((url, i) => (
                    <img key={i} src={url} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Category', `${preview.category}${preview.subCategory ? ` / ${preview.subCategory}` : ''}`],
                ['Brand', preview.brand], ['Size', preview.size], ['Color', preview.color],
                ['Gender', preview.gender], ['Material', preview.material],
                ['Purchase price', canManage ? formatCurrency(preview.purchasePrice) : '—'],
                ['Selling price', formatCurrency(preview.sellingPrice)],
                ['Discount price', preview.discountPrice ? formatCurrency(preview.discountPrice) : '—'],
                ['Tax', `${preview.tax || 0}%`],
                ['Stock', `${preview.stockQuantity ?? 0} (min ${preview.minStock ?? 10})`],
                ['Total sold', preview.totalSold || 0],
                ['Added', formatDateTime(preview.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-ink/5 pb-1.5">
                  <span className="text-ink/50">{label}</span>
                  <span className="font-medium">{value || '—'}</span>
                </div>
              ))}
              {preview.description && <p className="pt-1 text-xs text-ink/60">{preview.description}</p>}
            </div>
          </div>
        )}
      </Dialog>

      {/* QR dialog */}
      <Dialog open={!!qrProduct} onClose={() => { setQrProduct(null); setQrUrl(null); }} title="Product QR Code" subtitle={qrProduct?.name}>
        <div className="flex flex-col items-center gap-3">
          {qrUrl && <img src={qrUrl} alt="QR code" className="h-56 w-56 rounded-xl border border-ink/10" />}
          <p className="font-mono text-sm font-semibold">{qrProduct?.sku}</p>
          <p className="text-center text-xs text-ink/50">This QR encodes only the SKU — scanning fetches live product data from the database.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { const a = document.createElement('a'); a.href = qrUrl; a.download = `${qrProduct.sku}-qr.png`; a.click(); }}>
              <Download className="h-4 w-4" /> PNG
            </Button>
            <Button variant="gold" onClick={() => printQrLabels([qrProduct], settings.currencySymbol)}>
              <Printer className="h-4 w-4" /> Print Label
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Inventory history */}
      <Dialog open={!!historyProduct} onClose={() => setHistoryProduct(null)} title="Inventory History" subtitle={historyProduct?.name} wide>
        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/40">No inventory movements recorded.</p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-xl border border-ink/5 p-3 text-sm">
                <div>
                  <p className="font-medium capitalize">{h.type.replace('_', ' ')} {h.reason ? <span className="text-ink/50">— {h.reason}</span> : null}</p>
                  <p className="text-xs text-ink/45">{h.userName} · {formatDateTime(h.createdAt)}</p>
                </div>
                <span className={`font-semibold ${h.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {h.quantity > 0 ? '+' : ''}{h.quantity}
                </span>
              </div>
            ))}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete product?"
        message={`"${deleteTarget?.name}" will be permanently removed. Past sales keep their records. Consider archiving instead if you might restock it.`}
      />
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-surface ${danger ? 'text-red-600' : 'text-ink/80'}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
