import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Download, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePagination } from '@/hooks/usePagination';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '@/services/expenseService';
import { DataTable } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { exportCsv } from '@/utils/exportData';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/constants';
import { formatCurrency, formatDate } from '@/utils/format';

export default function Expenses() {
  const { hasRole } = useAuth();
  const { data: expenses, loading, reload } = useAsyncData(getExpenses, []);

  const [category, setCategory] = useState('all');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const filtered = useMemo(
    () => (expenses || [])
      .filter((e) => category === 'all' || e.category === category)
      .filter((e) => !month || (e.date || '').startsWith(month)),
    [expenses, category, month]
  );

  const monthTotal = filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const byCategory = useMemo(() => {
    const map = {};
    filtered.forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const pagination = usePagination(filtered, 12);

  const openForm = (expense) => {
    setEditTarget(expense || {});
    reset(expense || { category: 'Electricity', title: '', amount: '', date: new Date().toISOString().slice(0, 10), paymentMethod: 'cash', notes: '' });
  };

  const onSubmit = async (values) => {
    try {
      if (editTarget?.id) {
        await updateExpense(editTarget.id, values);
        toast.success('Expense updated.');
      } else {
        await createExpense(values);
        toast.success('Expense added.');
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
      await deleteExpense(deleteTarget.id, deleteTarget.title);
      toast.success('Expense deleted.');
      setDeleteTarget(null);
      reload();
    } catch {
      toast.error('Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    exportCsv(filtered.map((e) => ({ date: e.date, category: e.category, title: e.title, amount: e.amount, paymentMethod: e.paymentMethod, notes: e.notes })), `veloura-expenses-${month || 'all'}.csv`);
    toast.success('Expense report exported.');
  };

  const columns = [
    { key: 'date', header: 'Date', render: (e) => formatDate(e.date) },
    { key: 'category', header: 'Category', render: (e) => <Badge>{e.category}</Badge> },
    { key: 'title', header: 'Description', render: (e) => <span className="font-medium">{e.title}</span> },
    { key: 'paymentMethod', header: 'Paid via', className: 'hidden md:table-cell', render: (e) => <span className="capitalize">{(e.paymentMethod || '').replace('_', ' ')}</span> },
    { key: 'amount', header: 'Amount', render: (e) => <span className="font-semibold text-red-600">{formatCurrency(e.amount)}</span> },
    { key: 'actions', header: '', render: (e) => (
      <div className="flex justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
        <Button variant="ghost" size="icon" onClick={() => openForm(e)}><Pencil className="h-4 w-4" /></Button>
        {hasRole('admin') && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(e)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Expenses</h1>
          <p className="text-sm text-ink/50">Track operating costs — they feed directly into profit reports.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4" /> Export</Button>
          <Button variant="gold" onClick={() => openForm(null)}><Plus className="h-4 w-4" /> Add Expense</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={`Total (${month || 'all time'})`} value={formatCurrency(monthTotal)} icon={Wallet} tone="dark" />
        {byCategory.slice(0, 2).map(([cat, amt]) => (
          <StatCard key={cat} label={`Top: ${cat}`} value={formatCurrency(amt)} icon={Wallet} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" aria-label="Filter month" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44">
          <option value="all">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
        {month && <Button variant="ghost" size="sm" onClick={() => setMonth('')}>Show all months</Button>}
      </div>

      <DataTable columns={columns} rows={pagination.pageItems} loading={loading} pagination={pagination} />

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.id ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Category" required>
            <Select {...register('category', { required: true })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
          </Field>
          <Field label="Description" required error={errors.title?.message}>
            <Input error={errors.title} {...register('title', { required: 'Description is required.' })} placeholder="e.g. July electricity bill" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" required error={errors.amount?.message}>
              <Input type="number" min="1" error={errors.amount} {...register('amount', { required: 'Amount is required.', min: { value: 1, message: 'Must be > 0.' } })} />
            </Field>
            <Field label="Date" required>
              <Input type="date" {...register('date', { required: true })} />
            </Field>
          </div>
          <Field label="Payment method">
            <Select {...register('paymentMethod')}>{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>
          </Field>
          <Field label="Notes">
            <Textarea rows={2} {...register('notes')} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button type="submit" variant="gold" loading={isSubmitting}>{editTarget?.id ? 'Save' : 'Add Expense'}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={busy}
        title="Delete expense?" message={`"${deleteTarget?.title}" (${formatCurrency(deleteTarget?.amount || 0)}) will be removed from expense records.`}
      />
    </div>
  );
}
