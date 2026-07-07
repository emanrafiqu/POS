import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

/**
 * Data table with loading skeleton, empty state and pagination footer.
 * columns: [{ key, header, className, render?(row) }]
 */
export function DataTable({ columns, rows, loading, emptyMessage = 'No records found.', onRowClick, pagination }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink/5 bg-surface/70">
              {columns.map((col) => (
                <th key={col.key} className={cn('whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/50', col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-ink/5">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-ink/8" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  <Inbox className="mx-auto mb-2 h-8 w-8 text-ink/20" />
                  <p className="text-sm text-ink/40">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn('border-b border-ink/5 transition-colors last:border-0', onRowClick && 'cursor-pointer hover:bg-gold-faint/50')}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3', col.className)}>
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-ink/5 px-4 py-2.5">
          <span className="text-xs text-ink/50">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={pagination.prev} disabled={pagination.page <= 1} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={pagination.next} disabled={pagination.page >= pagination.totalPages} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
