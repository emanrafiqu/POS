import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { BadgePercent, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAsyncData } from '@/hooks/useAsyncData';
import { getDiscounts, saveDiscount, deleteDiscount } from '@/services/discountService';
import { getAll, orderBy } from '@/services/firestore';
import { DataTable } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/utils/format';

const SCOPES = [
  { value: 'all', label: 'All products (store-wide / festival / season sale)' },
  { value: 'category', label: 'Specific category' },
  { value: 'members', label: 'Members only' },
];

export default function Discounts() {
  const { data: discounts, loading, reload } = useAsyncData(getDiscounts, []);
  const { data: categories } = useAsyncData(() => getAll('categories', orderBy('name')), []);

  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm();
  const watchedScope = watch('scope');
  const watchedType = watch('type');

  const openForm = (discount) => {
    setEditTarget(discount || {});
    reset(discount || { code: '', type: 'percentage', value: '', scope: 'all', category: '', minPurchase: 0, description: '', active: true });
  };

  const onSubmit = async (values) => {
    if (values.type === 'percentage' && (values.value <= 0 || values.value > 100)) {
      toast.error('Percentage must be between 1 and 100.');
      return;
    }
    try {
      await saveDiscount(values, !editTarget?.id);
      toast.success(`Coupon ${values.code.toUpperCase()} saved.`);
      setEditTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'Save failed.');
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteDiscount(deleteTarget.id);
      toast.success('Discount deleted.');
      setDeleteTarget(null);
      reload();
    } catch {
      toast.error('Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (d) => {
    try {
      await saveDiscount({ ...d, active: !d.active }, false);
      reload();
    } catch {
      toast.error('Update failed.');
    }
  };

  const columns = [
    { key: 'code', header: 'Code', render: (d) => <span className="font-mono font-semibold text-gold-dark">{d.code}</span> },
    { key: 'description', header: 'Description', className: 'hidden md:table-cell' },
    { key: 'value', header: 'Discount', render: (d) => (
      <span className="font-semibold">{d.type === 'percentage' ? `${d.value}%` : formatCurrency(d.value)}</span>
    )},
    { key: 'scope', header: 'Scope', className: 'hidden sm:table-cell', render: (d) => (
      <Badge variant="info">{d.scope === 'category' ? `Category: ${d.category}` : d.scope === 'members' ? 'Members' : 'All products'}</Badge>
    )},
    { key: 'minPurchase', header: 'Min. purchase', className: 'hidden lg:table-cell', render: (d) => (d.minPurchase ? formatCurrency(d.minPurchase) : '—') },
    { key: 'usedCount', header: 'Used', className: 'hidden sm:table-cell', render: (d) => d.usedCount || 0 },
    { key: 'active', header: 'Status', render: (d) => (
      <button onClick={(e) => { e.stopPropagation(); toggleActive(d); }}>
        <Badge variant={d.active ? 'success' : 'danger'}>{d.active ? 'Active' : 'Inactive'}</Badge>
      </button>
    )},
    { key: 'actions', header: '', render: (d) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" onClick={() => openForm(d)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(d)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Discounts & Coupons</h1>
          <p className="text-sm text-ink/50">Percentage, flat, category, member and seasonal discounts — cashiers apply them at checkout.</p>
        </div>
        <Button variant="gold" onClick={() => openForm(null)}><Plus className="h-4 w-4" /> New Discount</Button>
      </div>

      <DataTable columns={columns} rows={discounts || []} loading={loading} emptyMessage="No discounts yet — create your first coupon." />

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.id ? `Edit ${editTarget.code}` : 'New Discount'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Coupon code" required error={errors.code?.message}>
            <Input placeholder="EIDSALE" className="font-mono uppercase" disabled={!!editTarget?.id} error={errors.code}
              {...register('code', { required: 'Code is required.', pattern: { value: /^[A-Za-z0-9]{3,20}$/, message: '3–20 letters/numbers, no spaces.' } })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select {...register('type')}>
                <option value="percentage">Percentage %</option>
                <option value="flat">Flat amount</option>
              </Select>
            </Field>
            <Field label={watchedType === 'flat' ? 'Amount' : 'Percent (1–100)'} required error={errors.value?.message}>
              <Input type="number" min="1" error={errors.value} {...register('value', { required: 'Required.', min: { value: 1, message: 'Must be > 0.' } })} />
            </Field>
          </div>
          <Field label="Applies to">
            <Select {...register('scope')}>{SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
          </Field>
          {watchedScope === 'category' && (
            <Field label="Category" required>
              <Select {...register('category', { required: watchedScope === 'category' })}>
                <option value="">Select…</option>
                {(categories || []).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Minimum purchase (0 = none)">
            <Input type="number" min="0" {...register('minPurchase')} />
          </Field>
          <Field label="Description">
            <Input placeholder="e.g. Eid festival sale — 20% off" {...register('description')} />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-gold" {...register('active')} /> Active
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button type="submit" variant="gold" loading={isSubmitting}><BadgePercent className="h-4 w-4" /> Save Discount</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={busy}
        title="Delete discount?" message={`Coupon "${deleteTarget?.code}" will stop working immediately.`}
      />
    </div>
  );
}
