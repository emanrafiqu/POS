import { useMemo, useState } from 'react';
import { AlertTriangle, PackageMinus, PackagePlus, PackageX } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { getProducts } from '@/services/productService';
import { getInventoryHistory, adjustStock } from '@/services/inventoryService';
import { getSuppliers } from '@/services/supplierService';
import { DataTable } from '@/components/ui/Table';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field, Textarea } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { INVENTORY_TYPES } from '@/constants';
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format';

export default function Inventory() {
  const { user } = useAuth();
  const { data: products, loading, reload } = useAsyncData(getProducts, []);
  const { data: history, reload: reloadHistory } = useAsyncData(() => getInventoryHistory(150), []);
  const { data: suppliers } = useAsyncData(getSuppliers, []);

  const [tab, setTab] = useState('stock'); // stock | history
  const [search, setSearch] = useState('');
  const [alertFilter, setAlertFilter] = useState('all');
  const debounced = useDebounce(search, 250);

  const [adjustTarget, setAdjustTarget] = useState(null);
  const [form, setForm] = useState({ type: 'stock_in', quantity: '', reason: '', supplierId: '' });
  const [saving, setSaving] = useState(false);

  const active = useMemo(() => (products || []).filter((p) => !p.archived), [products]);

  const stats = useMemo(() => ({
    totalUnits: active.reduce((s, p) => s + (p.stockQuantity || 0), 0),
    value: active.reduce((s, p) => s + (p.purchasePrice || 0) * (p.stockQuantity || 0), 0),
    low: active.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= (p.minStock || 10)).length,
    out: active.filter((p) => (p.stockQuantity || 0) <= 0).length,
  }), [active]);

  const filteredStock = useMemo(() => {
    const q = debounced.toLowerCase();
    return active
      .filter((p) => {
        if (alertFilter === 'low') return p.stockQuantity > 0 && p.stockQuantity <= (p.minStock || 10);
        if (alertFilter === 'out') return (p.stockQuantity || 0) <= 0;
        return true;
      })
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .sort((a, b) => (a.stockQuantity || 0) - (b.stockQuantity || 0));
  }, [active, debounced, alertFilter]);

  const stockPagination = usePagination(filteredStock, 15);
  const historyPagination = usePagination(history || [], 15);

  const openAdjust = (product, type = 'stock_in') => {
    setAdjustTarget(product);
    setForm({ type, quantity: '', reason: '', supplierId: '' });
  };

  const handleAdjust = async () => {
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) {
      toast.error('Enter a quantity greater than zero.');
      return;
    }
    // Damaged / stock_out remove stock; others add it
    const signed = ['stock_out', 'damaged'].includes(form.type) ? -qty : qty;
    setSaving(true);
    try {
      const newQty = await adjustStock({
        product: adjustTarget,
        type: form.type,
        quantity: signed,
        reason: form.reason,
        supplierId: form.supplierId || null,
        user: { uid: user.uid, name: user.name },
      });
      toast.success(`Stock updated — "${adjustTarget.name}" now has ${newQty} units.`);
      setAdjustTarget(null);
      reload();
      reloadHistory();
    } catch (err) {
      toast.error(err.message || 'Adjustment failed.');
    } finally {
      setSaving(false);
    }
  };

  const stockColumns = [
    { key: 'name', header: 'Product', render: (p) => (
      <div><p className="font-medium">{p.name}</p><p className="text-xs text-ink/45">{p.sku}</p></div>
    )},
    { key: 'category', header: 'Category', className: 'hidden md:table-cell', render: (p) => <Badge>{p.category}</Badge> },
    { key: 'stockQuantity', header: 'In Stock', render: (p) => {
      const low = p.stockQuantity > 0 && p.stockQuantity <= (p.minStock || 10);
      const out = (p.stockQuantity || 0) <= 0;
      return (
        <span className={`flex items-center gap-1.5 font-semibold ${out ? 'text-red-600' : low ? 'text-amber-600' : ''}`}>
          {p.stockQuantity ?? 0}
          {out && <PackageX className="h-4 w-4" />}
          {low && <AlertTriangle className="h-4 w-4" />}
        </span>
      );
    }},
    { key: 'minStock', header: 'Min', className: 'hidden sm:table-cell', render: (p) => p.minStock ?? 10 },
    { key: 'value', header: 'Stock value', className: 'hidden lg:table-cell', render: (p) => formatCurrency((p.purchasePrice || 0) * (p.stockQuantity || 0)) },
    { key: 'actions', header: '', render: (p) => (
      <div className="flex justify-end gap-1.5">
        <Button variant="subtle" size="sm" onClick={() => openAdjust(p, 'stock_in')}><PackagePlus className="h-4 w-4" /> In</Button>
        <Button variant="subtle" size="sm" onClick={() => openAdjust(p, 'stock_out')} disabled={(p.stockQuantity || 0) <= 0}><PackageMinus className="h-4 w-4" /> Out</Button>
      </div>
    )},
  ];

  const historyColumns = [
    { key: 'productName', header: 'Product', render: (h) => (
      <div><p className="font-medium">{h.productName}</p><p className="text-xs text-ink/45">{h.sku}</p></div>
    )},
    { key: 'type', header: 'Type', render: (h) => {
      const variants = { stock_in: 'success', purchase: 'success', returned: 'info', stock_out: 'danger', damaged: 'danger', adjustment: 'warning' };
      return <Badge variant={variants[h.type] || 'default'}>{h.type.replace('_', ' ')}</Badge>;
    }},
    { key: 'quantity', header: 'Qty', render: (h) => (
      <span className={`font-semibold ${h.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{h.quantity > 0 ? '+' : ''}{h.quantity}</span>
    )},
    { key: 'reason', header: 'Reason', className: 'hidden md:table-cell', render: (h) => h.reason || '—' },
    { key: 'userName', header: 'By', className: 'hidden sm:table-cell' },
    { key: 'createdAt', header: 'Date', render: (h) => <span className="text-ink/50">{formatDateTime(h.createdAt)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Inventory</h1>
        <p className="text-sm text-ink/50">Stock levels update automatically after every sale and refund.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total units in stock" value={formatNumber(stats.totalUnits)} icon={PackagePlus} />
        <StatCard label="Inventory value (cost)" value={formatCurrency(stats.value)} icon={PackagePlus} tone="dark" />
        <StatCard label="Low stock items" value={stats.low} icon={AlertTriangle} />
        <StatCard label="Out of stock" value={stats.out} icon={PackageX} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-ink/5 p-1 w-fit">
        {[['stock', 'Stock Levels'], ['history', 'Movement History']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${tab === key ? 'bg-white shadow-card' : 'text-ink/50 hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'stock' ? (
        <>
          <div className="flex flex-wrap gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Product name or SKU…" className="w-64" />
            <Select value={alertFilter} onChange={(e) => setAlertFilter(e.target.value)} className="w-40">
              <option value="all">All products</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
          </div>
          <DataTable columns={stockColumns} rows={stockPagination.pageItems} loading={loading} pagination={stockPagination} />
        </>
      ) : (
        <DataTable columns={historyColumns} rows={historyPagination.pageItems} loading={!history} pagination={historyPagination} emptyMessage="No inventory movements yet." />
      )}

      {/* Adjust dialog */}
      <Dialog open={!!adjustTarget} onClose={() => setAdjustTarget(null)} title="Inventory Adjustment" subtitle={adjustTarget ? `${adjustTarget.name} — currently ${adjustTarget.stockQuantity ?? 0} units` : ''}>
        <div className="space-y-3">
          <Field label="Movement type">
            <Select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
              {INVENTORY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Quantity" required>
            <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} placeholder="Units" />
          </Field>
          {['purchase', 'stock_in'].includes(form.type) && (
            <Field label="Supplier (for purchase entries)">
              <Select value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}>
                <option value="">—</option>
                {(suppliers || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Reason / notes">
            <Textarea rows={2} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} placeholder="e.g. New shipment from supplier, damaged in storage…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>Cancel</Button>
            <Button variant="gold" onClick={handleAdjust} loading={saving}>Apply Adjustment</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
