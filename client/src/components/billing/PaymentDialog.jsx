import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Select, Label } from '@/components/ui/Input';
import { PAYMENT_METHODS } from '@/constants';
import { formatCurrency } from '@/utils/format';

/**
 * Payment collection dialog — supports a single method or split/mixed
 * payments across several methods. Cash rows compute change automatically.
 */
export function PaymentDialog({ open, onClose, grandTotal, onConfirm, loading }) {
  const [rows, setRows] = useState([{ method: 'cash', amount: grandTotal }]);

  // Re-seed rows whenever the dialog opens with a new total
  const [seenTotal, setSeenTotal] = useState(grandTotal);
  if (open && seenTotal !== grandTotal) {
    setSeenTotal(grandTotal);
    setRows([{ method: 'cash', amount: grandTotal }]);
  }

  const paid = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);
  const remaining = Math.max(0, grandTotal - paid);
  const change = Math.max(0, paid - grandTotal);
  const cashPaid = rows.some((r) => r.method === 'cash');

  const setRow = (i, patch) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleConfirm = () => {
    const payments = rows
      .filter((r) => Number(r.amount) > 0)
      .map((r) => ({ method: r.method, amount: Number(r.amount) }));
    onConfirm({ payments, amountPaid: paid, changeDue: cashPaid ? change : 0 });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Receive Payment" subtitle={`Amount due: ${formatCurrency(grandTotal)}`}>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Method</Label>
              <Select value={row.method} onChange={(e) => setRow(i, { method: e.target.value })}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex-1">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                value={row.amount}
                onChange={(e) => setRow(i, { amount: e.target.value })}
              />
            </div>
            {rows.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} aria-label="Remove payment row">
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>
        ))}

        <Button variant="subtle" size="sm" onClick={() => setRows((p) => [...p, { method: 'credit_card', amount: remaining }])}>
          <Plus className="h-4 w-4" /> Split payment
        </Button>

        <div className="rounded-xl bg-surface p-4 text-sm">
          <div className="flex justify-between"><span className="text-ink/60">Total due</span><span className="font-semibold">{formatCurrency(grandTotal)}</span></div>
          <div className="flex justify-between"><span className="text-ink/60">Receiving</span><span className="font-semibold">{formatCurrency(paid)}</span></div>
          {remaining > 0 && <div className="flex justify-between text-red-600"><span>Remaining</span><span>{formatCurrency(remaining)}</span></div>}
          {change > 0 && cashPaid && <div className="flex justify-between text-emerald-600"><span>Change to return</span><span>{formatCurrency(change)}</span></div>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="gold" onClick={handleConfirm} loading={loading} disabled={remaining > 0}>
            Complete Sale
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
