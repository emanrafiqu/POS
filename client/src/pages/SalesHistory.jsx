import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, RotateCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { getRecentSales, refundSale } from '@/services/saleService';
import { DataTable } from '@/components/ui/Table';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ReceiptDialog } from '@/components/receipt/Receipt';
import { formatCurrency, formatDateTime } from '@/utils/format';

export default function SalesHistory() {
  const { user, hasRole } = useAuth();
  const [params] = useSearchParams();
  const { data: sales, loading, reload } = useAsyncData(() => getRecentSales(300), []);

  const [search, setSearch] = useState(params.get('invoice') || '');
  const [status, setStatus] = useState('all');
  const debounced = useDebounce(search, 250);

  const [receiptSale, setReceiptSale] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundItems, setRefundItems] = useState({}); // productId -> qty
  const [refunding, setRefunding] = useState(false);

  const filtered = useMemo(() => {
    const q = debounced.toLowerCase();
    return (sales || [])
      .filter((s) => status === 'all' || s.status === status)
      .filter(
        (s) =>
          !q ||
          s.invoiceNumber?.toLowerCase().includes(q) ||
          s.customerName?.toLowerCase().includes(q) ||
          s.cashierName?.toLowerCase().includes(q)
      );
  }, [sales, debounced, status]);

  const pagination = usePagination(filtered, 15);

  const openRefund = (sale) => {
    setRefundTarget(sale);
    setRefundReason('');
    setRefundItems(Object.fromEntries(sale.items.map((i) => [i.productId, i.quantity])));
  };

  const handleRefund = async () => {
    const itemsToRefund = refundTarget.items
      .map((i) => ({ ...i, quantity: Number(refundItems[i.productId]) || 0 }))
      .filter((i) => i.quantity > 0);
    if (itemsToRefund.length === 0) {
      toast.error('Select at least one item to refund.');
      return;
    }
    setRefunding(true);
    try {
      const amount = await refundSale(refundTarget, itemsToRefund, refundReason, { uid: user.uid, name: user.name });
      toast.success(`Refunded ${formatCurrency(amount)} — stock restored.`);
      setRefundTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'Refund failed.');
    } finally {
      setRefunding(false);
    }
  };

  const columns = [
    { key: 'invoiceNumber', header: 'Invoice', render: (s) => <span className="font-medium">{s.invoiceNumber}</span> },
    { key: 'customerName', header: 'Customer' },
    { key: 'cashierName', header: 'Cashier', className: 'hidden md:table-cell' },
    { key: 'items', header: 'Items', render: (s) => s.items?.length || 0 },
    { key: 'grandTotal', header: 'Total', render: (s) => <span className="font-semibold">{formatCurrency(s.grandTotal)}</span> },
    { key: 'paymentMethod', header: 'Payment', className: 'hidden lg:table-cell', render: (s) => <span className="capitalize">{(s.paymentMethod || '').replace('_', ' ')}</span> },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
    { key: 'createdAt', header: 'Date', className: 'hidden sm:table-cell', render: (s) => <span className="text-ink/50">{formatDateTime(s.createdAt)}</span> },
    {
      key: 'actions', header: '', render: (s) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => setReceiptSale(s)} title="View / print receipt">
            <Printer className="h-4 w-4" />
          </Button>
          {hasRole('admin', 'manager') && s.status === 'completed' && (
            <Button variant="ghost" size="icon" onClick={() => openRefund(s)} title="Refund / exchange">
              <RotateCcw className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Sales History</h1>
          <p className="text-sm text-ink/50">{filtered.length} transactions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Invoice, customer, cashier…" className="w-64" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partial refund</option>
          </Select>
        </div>
      </div>

      <DataTable columns={columns} rows={pagination.pageItems} loading={loading} pagination={pagination} onRowClick={setReceiptSale} />

      <ReceiptDialog sale={receiptSale} open={!!receiptSale} onClose={() => setReceiptSale(null)} />

      {/* Refund dialog */}
      <Dialog open={!!refundTarget} onClose={() => setRefundTarget(null)} title="Refund / Exchange" subtitle={refundTarget?.invoiceNumber}>
        {refundTarget && (
          <div className="space-y-4">
            <p className="text-xs text-ink/50">Set the quantity to refund for each item (0 = keep). Stock is restored automatically. For an exchange, refund here and ring up the replacement as a new sale.</p>
            <div className="space-y-2">
              {refundTarget.items.map((it) => (
                <div key={it.productId} className="flex items-center justify-between gap-3 rounded-xl border border-ink/5 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-ink/45">Sold: {it.quantity} × {formatCurrency(it.unitPrice)}</p>
                  </div>
                  <input
                    type="number" min="0" max={it.quantity}
                    value={refundItems[it.productId] ?? 0}
                    onChange={(e) => setRefundItems((p) => ({ ...p, [it.productId]: Math.min(it.quantity, Math.max(0, Number(e.target.value))) }))}
                    className="h-9 w-20 rounded-xl border border-ink/15 px-2 text-center text-sm focus:border-gold focus:outline-none"
                    aria-label={`Refund quantity for ${it.name}`}
                  />
                </div>
              ))}
            </div>
            <input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Reason (size issue, defect, exchange…)"
              className="h-10 w-full rounded-xl border border-ink/15 px-3 text-sm focus:border-gold focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRefundTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleRefund} loading={refunding}>Process Refund</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
