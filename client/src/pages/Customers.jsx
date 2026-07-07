import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Download, Pencil, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/services/customerService';
import { getSalesByCustomer } from '@/services/saleService';
import { DataTable } from '@/components/ui/Table';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { exportCsv } from '@/utils/exportData';
import { MEMBERSHIP_LEVELS } from '@/constants';
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format';

const LEVEL_VARIANTS = { Bronze: 'default', Silver: 'info', Gold: 'gold', Platinum: 'success' };

export default function Customers() {
  const { hasRole } = useAuth();
  const canDelete = hasRole('admin', 'manager');
  const { data: customers, loading, reload } = useAsyncData(getCustomers, []);

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 250);
  const [editTarget, setEditTarget] = useState(null);     // null | {} (new) | customer
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historySales, setHistorySales] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const filtered = useMemo(() => {
    const q = debounced.toLowerCase();
    return (customers || []).filter(
      (c) => !q || [c.name, c.phone, c.email].some((f) => (f || '').toLowerCase().includes(q))
    );
  }, [customers, debounced]);

  const pagination = usePagination(filtered, 12);

  const openForm = (customer) => {
    setEditTarget(customer || {});
    reset(customer || { name: '', phone: '', email: '', address: '', gender: '', birthday: '', membershipLevel: 'Bronze', notes: '' });
  };

  const onSubmit = async (values) => {
    try {
      if (editTarget?.id) {
        await updateCustomer(editTarget.id, values);
        toast.success('Customer updated.');
      } else {
        await createCustomer(values);
        toast.success('Customer added.');
      }
      setEditTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'Save failed.');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCustomer(deleteTarget.id, deleteTarget.name);
      toast.success('Customer deleted.');
      setDeleteTarget(null);
      reload();
    } catch {
      toast.error('Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  const showHistory = async (customer) => {
    setHistoryTarget(customer);
    setHistorySales(null);
    try {
      setHistorySales(await getSalesByCustomer(customer.id));
    } catch {
      toast.error('Could not load purchase history.');
      setHistorySales([]);
    }
  };

  const handleExport = () => {
    exportCsv(
      filtered.map((c) => ({
        name: c.name, phone: c.phone, email: c.email, address: c.address,
        membershipLevel: c.membershipLevel, rewardPoints: c.rewardPoints,
        totalSpent: c.totalSpent, totalOrders: c.totalOrders, walletBalance: c.walletBalance,
      })),
      'veloura-customers.csv'
    );
    toast.success('Customer report exported.');
  };

  const columns = [
    { key: 'name', header: 'Customer', render: (c) => (
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-semibold text-gold">{c.name?.[0]?.toUpperCase()}</span>
        <div><p className="font-medium">{c.name}</p><p className="text-xs text-ink/45">{c.phone}</p></div>
      </div>
    )},
    { key: 'email', header: 'Email', className: 'hidden lg:table-cell', render: (c) => c.email || '—' },
    { key: 'membershipLevel', header: 'Membership', render: (c) => <Badge variant={LEVEL_VARIANTS[c.membershipLevel] || 'default'}>{c.membershipLevel || 'Bronze'}</Badge> },
    { key: 'rewardPoints', header: 'Points', className: 'hidden sm:table-cell', render: (c) => formatNumber(c.rewardPoints || 0) },
    { key: 'walletBalance', header: 'Wallet', className: 'hidden md:table-cell', render: (c) => formatCurrency(c.walletBalance || 0) },
    { key: 'totalSpent', header: 'Total spent', render: (c) => <span className="font-semibold">{formatCurrency(c.totalSpent || 0)}</span> },
    { key: 'totalOrders', header: 'Orders', className: 'hidden sm:table-cell', render: (c) => c.totalOrders || 0 },
    { key: 'actions', header: '', render: (c) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" onClick={() => showHistory(c)} title="Purchase history"><ShoppingBag className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => openForm(c)} title="Edit"><Pencil className="h-4 w-4" /></Button>
        {canDelete && (
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)} title="Delete"><Trash2 className="h-4 w-4 text-red-500" /></Button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="text-sm text-ink/50">{filtered.length} customers · reward points accrue automatically at checkout</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4" /> Export</Button>
          <Button variant="gold" onClick={() => openForm(null)}><Plus className="h-4 w-4" /> Add Customer</Button>
        </div>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Name, phone, or email…" className="w-72" />

      <DataTable columns={columns} rows={pagination.pageItems} loading={loading} pagination={pagination} onRowClick={showHistory} />

      {/* Add / edit dialog */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.id ? 'Edit Customer' : 'Add Customer'} wide>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Full name" required error={errors.name?.message}>
            <Input error={errors.name} {...register('name', { required: 'Name is required.' })} />
          </Field>
          <Field label="Phone" required error={errors.phone?.message}>
            <Input placeholder="+92 3xx xxxxxxx" error={errors.phone}
              {...register('phone', { required: 'Phone is required.', minLength: { value: 7, message: 'Enter a valid phone number.' } })} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" error={errors.email}
              {...register('email', { pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email.' } })} />
          </Field>
          <Field label="Gender">
            <Select {...register('gender')}><option value="">—</option><option>Female</option><option>Male</option><option>Other</option></Select>
          </Field>
          <Field label="Birthday">
            <Input type="date" {...register('birthday')} />
          </Field>
          <Field label="Membership level">
            <Select {...register('membershipLevel')}>{MEMBERSHIP_LEVELS.map((l) => <option key={l}>{l}</option>)}</Select>
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input {...register('address')} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} {...register('notes')} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button type="submit" variant="gold" loading={isSubmitting}>{editTarget?.id ? 'Save' : 'Add Customer'}</Button>
          </div>
        </form>
      </Dialog>

      {/* Purchase history */}
      <Dialog open={!!historyTarget} onClose={() => setHistoryTarget(null)} title="Purchase History" subtitle={historyTarget?.name} wide>
        {historySales === null ? (
          <p className="py-8 text-center text-sm text-ink/40">Loading…</p>
        ) : historySales.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/40">No purchases yet.</p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {historySales.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-ink/5 p-3 text-sm">
                <div>
                  <p className="font-medium">{s.invoiceNumber}</p>
                  <p className="text-xs text-ink/45">{s.items?.length} items · {formatDateTime(s.createdAt)}</p>
                </div>
                <span className="font-semibold">{formatCurrency(s.grandTotal)}</span>
              </div>
            ))}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete customer?" message={`"${deleteTarget?.name}" and their loyalty data will be removed. Past sales keep their records.`}
      />
    </div>
  );
}
