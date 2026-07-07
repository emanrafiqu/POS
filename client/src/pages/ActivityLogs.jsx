import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { getRecentLogs } from '@/services/activityLogService';
import { DataTable } from '@/components/ui/Table';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/utils/format';

const MODULE_VARIANTS = {
  auth: 'info', sales: 'success', products: 'gold', inventory: 'warning',
  users: 'danger', backup: 'info', expenses: 'danger',
};

export default function ActivityLogs() {
  const { data: logs, loading } = useAsyncData(() => getRecentLogs(300), []);
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('all');
  const debounced = useDebounce(search, 250);

  const modules = useMemo(() => ['all', ...new Set((logs || []).map((l) => l.module).filter(Boolean))], [logs]);

  const filtered = useMemo(() => {
    const q = debounced.toLowerCase();
    return (logs || [])
      .filter((l) => module === 'all' || l.module === module)
      .filter((l) => !q || [l.action, l.details, l.userEmail].some((f) => (f || '').toLowerCase().includes(q)));
  }, [logs, debounced, module]);

  const pagination = usePagination(filtered, 20);

  const columns = [
    { key: 'createdAt', header: 'When', render: (l) => <span className="whitespace-nowrap text-ink/60">{formatDateTime(l.createdAt)}</span> },
    { key: 'userEmail', header: 'User', render: (l) => <span className="font-medium">{l.userEmail}</span> },
    { key: 'module', header: 'Module', render: (l) => <Badge variant={MODULE_VARIANTS[l.module] || 'default'}>{l.module}</Badge> },
    { key: 'action', header: 'Action', render: (l) => <span className="font-mono text-xs">{l.action}</span> },
    { key: 'details', header: 'Details', className: 'hidden md:table-cell', render: (l) => <span className="text-ink/70">{l.details}</span> },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold"><History className="h-5 w-5 text-gold-dark" /> Activity Logs</h1>
        <p className="text-sm text-ink/50">Immutable audit trail — entries can never be edited or deleted.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Action, user, details…" className="w-72" />
        <Select value={module} onChange={(e) => setModule(e.target.value)} className="w-40">
          {modules.map((m) => <option key={m} value={m}>{m === 'all' ? 'All modules' : m}</option>)}
        </Select>
      </div>
      <DataTable columns={columns} rows={pagination.pageItems} loading={loading} pagination={pagination} emptyMessage="No activity recorded yet." />
    </div>
  );
}
