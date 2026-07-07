import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CalendarCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, markAttendance } from '@/services/employeeService';
import { DataTable } from '@/components/ui/Table';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/utils/format';

const PERMISSION_OPTIONS = ['sales', 'inventory', 'reports', 'customers', 'suppliers', 'expenses'];

export default function Employees() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const { data: employees, loading, reload } = useAsyncData(getEmployees, []);

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 250);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [attendanceTarget, setAttendanceTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const filtered = useMemo(() => {
    const q = debounced.toLowerCase();
    return (employees || []).filter((e) => !q || [e.name, e.email, e.phone, e.role].some((f) => (f || '').toLowerCase().includes(q)));
  }, [employees, debounced]);

  const pagination = usePagination(filtered, 12);

  const openForm = (employee) => {
    setEditTarget(employee || {});
    reset(employee
      ? { ...employee, permissions: employee.permissions || [] }
      : { name: '', role: 'cashier', phone: '', email: '', salary: '', joinDate: new Date().toISOString().slice(0, 10), permissions: ['sales'] });
  };

  const onSubmit = async (values) => {
    const data = { ...values, salary: Number(values.salary) || 0, permissions: values.permissions || [] };
    try {
      if (editTarget?.id) {
        await updateEmployee(editTarget.id, data);
        toast.success('Employee updated.');
      } else {
        await createEmployee(data);
        toast.success('Employee added. Create their login from the Users page (admin).');
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
      await deleteEmployee(deleteTarget.id, deleteTarget.name);
      toast.success('Employee removed.');
      setDeleteTarget(null);
      reload();
    } catch {
      toast.error('Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleAttendance = async (status) => {
    try {
      await markAttendance(attendanceTarget, status);
      toast.success(`${attendanceTarget.name} marked ${status}.`);
      setAttendanceTarget(null);
      reload();
    } catch {
      toast.error('Failed to mark attendance.');
    }
  };

  const columns = [
    { key: 'name', header: 'Employee', render: (e) => (
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-semibold text-gold">{e.name?.[0]?.toUpperCase()}</span>
        <div><p className="font-medium">{e.name}</p><p className="text-xs text-ink/45">{e.email}</p></div>
      </div>
    )},
    { key: 'role', header: 'Role', render: (e) => <Badge variant={e.role === 'manager' ? 'gold' : 'default'}>{e.role}</Badge> },
    { key: 'phone', header: 'Phone', className: 'hidden md:table-cell' },
    { key: 'salary', header: 'Salary', className: 'hidden sm:table-cell', render: (e) => (isAdmin ? formatCurrency(e.salary || 0) : '•••') },
    { key: 'attendance', header: 'Attendance (P/A/L)', className: 'hidden lg:table-cell', render: (e) => {
      const a = e.attendance || {};
      return <span className="text-xs"><span className="text-emerald-600 font-semibold">{a.present || 0}</span> / <span className="text-red-500 font-semibold">{a.absent || 0}</span> / <span className="text-amber-600 font-semibold">{a.leave || 0}</span></span>;
    }},
    { key: 'permissions', header: 'Permissions', className: 'hidden xl:table-cell', render: (e) => (e.permissions || []).join(', ') || '—' },
    { key: 'actions', header: '', render: (e) => (
      <div className="flex justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
        <Button variant="ghost" size="icon" onClick={() => setAttendanceTarget(e)} title="Mark attendance"><CalendarCheck className="h-4 w-4 text-emerald-600" /></Button>
        {isAdmin && (
          <>
            <Button variant="ghost" size="icon" onClick={() => openForm(e)} title="Edit"><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(e)} title="Delete"><Trash2 className="h-4 w-4 text-red-500" /></Button>
          </>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Employees</h1>
          <p className="text-sm text-ink/50">{filtered.length} team members</p>
        </div>
        {isAdmin && <Button variant="gold" onClick={() => openForm(null)}><Plus className="h-4 w-4" /> Add Employee</Button>}
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Name, role, phone…" className="w-72" />
      <DataTable columns={columns} rows={pagination.pageItems} loading={loading} pagination={pagination} />

      {/* Add / edit */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.id ? 'Edit Employee' : 'Add Employee'} wide>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Full name" required error={errors.name?.message}>
            <Input error={errors.name} {...register('name', { required: 'Name is required.' })} />
          </Field>
          <Field label="Role" required>
            <Select {...register('role')}><option value="cashier">Cashier</option><option value="manager">Manager</option></Select>
          </Field>
          <Field label="Phone" required error={errors.phone?.message}>
            <Input error={errors.phone} {...register('phone', { required: 'Phone is required.' })} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" error={errors.email} {...register('email', { pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email.' } })} />
          </Field>
          <Field label="Monthly salary" error={errors.salary?.message}>
            <Input type="number" min="0" error={errors.salary} {...register('salary', { min: { value: 0, message: 'Must be ≥ 0.' } })} />
          </Field>
          <Field label="Join date">
            <Input type="date" {...register('joinDate')} />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-ink/70">Module permissions</p>
            <div className="flex flex-wrap gap-3">
              {PERMISSION_OPTIONS.map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-1.5 text-sm capitalize">
                  <input type="checkbox" value={p} className="h-4 w-4 accent-gold" {...register('permissions')} /> {p}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button type="submit" variant="gold" loading={isSubmitting}>{editTarget?.id ? 'Save' : 'Add Employee'}</Button>
          </div>
        </form>
      </Dialog>

      {/* Attendance */}
      <Dialog open={!!attendanceTarget} onClose={() => setAttendanceTarget(null)} title="Mark Attendance" subtitle={attendanceTarget?.name}>
        <div className="grid grid-cols-3 gap-3">
          <Button variant="outline" className="border-emerald-300 text-emerald-700" onClick={() => handleAttendance('present')}>Present</Button>
          <Button variant="outline" className="border-red-300 text-red-600" onClick={() => handleAttendance('absent')}>Absent</Button>
          <Button variant="outline" className="border-amber-300 text-amber-700" onClick={() => handleAttendance('leave')}>Leave</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={busy}
        title="Remove employee?" message={`"${deleteTarget?.name}" will be removed from the employee register. Their login account (if any) must be deleted separately from Users.`}
      />
    </div>
  );
}
