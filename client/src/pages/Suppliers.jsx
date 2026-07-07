import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Banknote, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, recordSupplierPayment } from '@/services/supplierService';
import { DataTable } from '@/components/ui/Table';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { PAYMENT_METHODS } from '@/constants';
import { formatCurrency } from '@/utils/format';

export default function Suppliers() {
  const { data: suppliers, loading, reload } = useAsyncData(getSuppliers, []);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 250);

  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [payment, setPayment] = useState({ amount: '', method: 'bank_transfer', notes: '' });
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const filtered = useMemo(() => {
    const q = debounced.toLowerCase();
    return (suppliers || []).filter((s) => !q || [s.name, s.contactPerson, s.phone].some((f) => (f || '').toLowerCase().includes(q)));
  }, [suppliers, debounced]);

  const pagination = usePagination(filtered, 12);

  const openForm = (supplier) => {
    setEditTarget(supplier || {});
    reset(supplier || { name: '', contactPerson: '', phone: '', email: '', address: '', productsSupplied: '' });
  };

  const onSubmit = async (values) => {
    const data = {
      ...values,
      productsSupplied: typeof values.productsSupplied === 'string'
        ? values.productsSupplied.split(',').map((s) => s.trim()).filter(Boolean)
        : values.productsSupplied || [],
    };
    try {
      if (editTarget?.id) {
        await updateSupplier(editTarget.id, data);
        toast.success('Supplier updated.');
      } else {
        await createSupplier(data);
        toast.success('Supplier added.');
      }
      setEditTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'Save failed.');
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteSupplier(deleteTarget.id, deleteTarget.name);
      toast.success('Supplier deleted.');
      setDeleteTarget(null);
      reload();
    } catch {
      toast.error('Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const handlePayment = async () => {
    const amount = Number(payment.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }
    setBusy(true);
    try {
      await recordSupplierPayment(payTarget, amount, payment.method, payment.notes);
      toast.success(`Payment of ${formatCurrency(amount)} recorded.`);
      setPayTarget(null);
      setPayment({ amount: '', method: 'bank_transfer', notes: '' });
      reload();
    } catch (err) {
      toast.error(err.message || 'Payment failed.');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'name', header: 'Supplier', render: (s) => (
      <div><p className="font-medium">{s.name}</p><p className="text-xs text-ink/45">{s.contactPerson}</p></div>
    )},
    { key: 'phone', header: 'Contact', className: 'hidden md:table-cell', render: (s) => (
      <div><p>{s.phone}</p><p className="text-xs text-ink/45">{s.email}</p></div>
    )},
    { key: 'productsSupplied', header: 'Supplies', className: 'hidden lg:table-cell', render: (s) => (s.productsSupplied || []).slice(0, 3).join(', ') || '—' },
    { key: 'totalPurchases', header: 'Purchases', className: 'hidden sm:table-cell', render: (s) => formatCurrency(s.totalPurchases || 0) },
    { key: 'outstandingBalance', header: 'Outstanding', render: (s) => (
      <span className={`font-semibold ${s.outstandingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(s.outstandingBalance || 0)}</span>
    )},
    { key: 'actions', header: '', render: (s) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" onClick={() => setPayTarget(s)} title="Record payment"><Banknote className="h-4 w-4 text-emerald-600" /></Button>
        <Button variant="ghost" size="icon" onClick={() => openForm(s)} title="Edit"><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)} title="Delete"><Trash2 className="h-4 w-4 text-red-500" /></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Suppliers</h1>
          <p className="text-sm text-ink/50">{filtered.length} suppliers · total outstanding {formatCurrency(filtered.reduce((a, s) => a + (s.outstandingBalance || 0), 0))}</p>
        </div>
        <Button variant="gold" onClick={() => openForm(null)}><Plus className="h-4 w-4" /> Add Supplier</Button>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Supplier, contact person, phone…" className="w-72" />
      <DataTable columns={columns} rows={pagination.pageItems} loading={loading} pagination={pagination} />

      {/* Add / edit */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.id ? 'Edit Supplier' : 'Add Supplier'} wide>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Supplier name" required error={errors.name?.message}>
            <Input error={errors.name} {...register('name', { required: 'Name is required.' })} />
          </Field>
          <Field label="Contact person">
            <Input {...register('contactPerson')} />
          </Field>
          <Field label="Phone" required error={errors.phone?.message}>
            <Input error={errors.phone} {...register('phone', { required: 'Phone is required.' })} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" error={errors.email} {...register('email', { pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email.' } })} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input {...register('address')} />
          </Field>
          <Field label="Products supplied (comma-separated)" className="sm:col-span-2">
            <Textarea rows={2} placeholder="T-Shirts, Jeans, Jackets" {...register('productsSupplied')} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button type="submit" variant="gold" loading={isSubmitting}>{editTarget?.id ? 'Save' : 'Add Supplier'}</Button>
          </div>
        </form>
      </Dialog>

      {/* Payment */}
      <Dialog open={!!payTarget} onClose={() => setPayTarget(null)} title="Record Supplier Payment" subtitle={payTarget ? `${payTarget.name} — outstanding ${formatCurrency(payTarget.outstandingBalance || 0)}` : ''}>
        <div className="space-y-3">
          <Field label="Amount" required>
            <Input type="number" min="1" value={payment.amount} onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))} />
          </Field>
          <Field label="Payment method">
            <Select value={payment.method} onChange={(e) => setPayment((p) => ({ ...p, method: e.target.value }))}>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Notes">
            <Input value={payment.notes} onChange={(e) => setPayment((p) => ({ ...p, notes: e.target.value }))} placeholder="Invoice ref, remarks…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPayTarget(null)}>Cancel</Button>
            <Button variant="gold" onClick={handlePayment} loading={busy}>Record Payment</Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={busy}
        title="Delete supplier?" message={`"${deleteTarget?.name}" will be removed. Products linked to this supplier keep working.`}
      />
    </div>
  );
}
