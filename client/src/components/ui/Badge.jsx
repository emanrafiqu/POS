import { cn } from '@/utils/cn';

const VARIANTS = {
  default: 'bg-ink/8 text-ink/70',
  gold: 'bg-gold-faint text-gold-dark border border-gold/30',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-red-50 text-red-600 border border-red-200',
  info: 'bg-sky-50 text-sky-700 border border-sky-200',
};

export function Badge({ variant = 'default', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        VARIANTS[variant] || VARIANTS.default,
        className
      )}
    >
      {children}
    </span>
  );
}

/** Maps common status strings to badge variants. */
export function StatusBadge({ status }) {
  const map = {
    active: ['success', 'Active'],
    out_of_stock: ['danger', 'Out of Stock'],
    disabled: ['danger', 'Disabled'],
    completed: ['success', 'Completed'],
    refunded: ['danger', 'Refunded'],
    partially_refunded: ['warning', 'Partial Refund'],
    exchanged: ['info', 'Exchanged'],
  };
  const [variant, label] = map[status] || ['default', status || '—'];
  return <Badge variant={variant}>{label}</Badge>;
}
