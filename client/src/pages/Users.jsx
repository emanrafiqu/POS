import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { api } from '@/services/api';
import { DataTable } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { formatDateTime } from '@/utils/format';

const ROLE_VARIANTS = { admin: 'danger', manager: 'gold', cashier: 'info' };

/** Admin-only user management — all writes go through the Express API (Firebase Admin SDK). */
export default function Users() {
  const { user: me } = useAuth();
  const { data: users, loading, reload } = useAsyncData(() => api.listUsers(), []);

  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const openForm = (user) => {
    setEditTarget(user || {});
    reset(user ? { name: user.name, phone: user.phone, role: user.role, status: user.status } : { name: '', email: '', password: '', phone: '', role: 'cashier' });
  };

  const onSubmit = async (values) => {
    try {
      if (editTarget?.id) {
        await api.updateUser(editTarget.id, values);
        toast.success('User updated.');
      } else {
        await api.createUser(values);
        toast.success(`Account created for ${values.email}.`);
      }
      setEditTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await api.deleteUser(deleteTarget.id);
      toast.success('User deleted.');
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'name', header: 'User', render: (u) => (
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-semibold text-gold">{u.name?.[0]?.toUpperCase()}</span>
        <div><p className="font-medium">{u.name} {u.id === me.uid && <span className="text-xs text-ink/40">(you)</span>}</p><p className="text-xs text-ink/45">{u.email}</p></div>
      </div>
    )},
    { key: 'role', header: 'Role', render: (u) => <Badge variant={ROLE_VARIANTS[u.role]}>{u.role}</Badge> },
    { key: 'phone', header: 'Phone', className: 'hidden md:table-cell', render: (u) => u.phone || '—' },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} /> },
    { key: 'createdAt', header: 'Created', className: 'hidden lg:table-cell', render: (u) => <span className="text-ink/50">{u.createdAt?._seconds ? formatDateTime(new Date(u.createdAt._seconds * 1000)) : '—'}</span> },
    { key: 'actions', header: '', render: (u) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => openForm(u)}><Pencil className="h-4 w-4" /></Button>
        {u.id !== me.uid && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck className="h-5 w-5 text-gold-dark" /> Users & Roles</h1>
          <p className="text-sm text-ink/50">Admin · Manager · Cashier — role decides what each account can access.</p>
        </div>
        <Button variant="gold" onClick={() => openForm(null)}><Plus className="h-4 w-4" /> Create User</Button>
      </div>

      <DataTable columns={columns} rows={users || []} loading={loading} emptyMessage="No users found. Is the API server running?" />

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.id ? `Edit ${editTarget.name}` : 'Create User'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Full name" required error={errors.name?.message}>
            <Input error={errors.name} {...register('name', { required: 'Name is required.' })} />
          </Field>
          {!editTarget?.id && (
            <>
              <Field label="Email" required error={errors.email?.message}>
                <Input type="email" error={errors.email}
                  {...register('email', { required: 'Email is required.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email.' } })} />
              </Field>
              <Field label="Password" required error={errors.password?.message}>
                <Input type="password" error={errors.password}
                  {...register('password', { required: 'Password is required.', minLength: { value: 8, message: 'At least 8 characters.' } })} />
              </Field>
            </>
          )}
          <Field label="Phone">
            <Input {...register('phone')} />
          </Field>
          <Field label="Role" required>
            <Select {...register('role')}>
              <option value="cashier">Cashier — billing & scanning only</option>
              <option value="manager">Manager — inventory, sales, reports</option>
              <option value="admin">Admin — full access</option>
            </Select>
          </Field>
          {editTarget?.id && (
            <Field label="Status">
              <Select {...register('status')}><option value="active">Active</option><option value="disabled">Disabled</option></Select>
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button type="submit" variant="gold" loading={isSubmitting}>{editTarget?.id ? 'Save' : 'Create User'}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={busy}
        title="Delete user?" message={`"${deleteTarget?.name}" (${deleteTarget?.email}) will lose access immediately and their login will be removed.`}
      />
    </div>
  );
}
