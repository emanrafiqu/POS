import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/utils/cn';

/** Dashboard KPI card with optional trend indicator. */
export function StatCard({ label, value, icon: Icon, trend, trendLabel, tone = 'default', loading }) {
  const tones = {
    default: 'bg-white',
    dark: 'bg-ink text-white',
    gold: 'bg-gradient-to-br from-gold to-gold-dark text-ink',
  };
  return (
    <div className={cn('rounded-2xl border border-ink/5 p-5 shadow-soft transition-transform hover:-translate-y-0.5', tones[tone])}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className={cn('text-xs font-medium', tone === 'default' ? 'text-ink/50' : 'opacity-70')}>{label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-24 animate-pulse rounded bg-ink/10" />
          ) : (
            <p className="mt-1 truncate text-2xl font-semibold">{value}</p>
          )}
          {trend !== undefined && !loading && (
            <p className={cn('mt-1.5 flex items-center gap-1 text-xs font-medium', trend >= 0 ? 'text-emerald-600' : 'text-red-500', tone !== 'default' && 'text-inherit opacity-80')}>
              {trend >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(trend)}% {trendLabel}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('rounded-xl p-2.5', tone === 'default' ? 'bg-gold-faint text-gold-dark' : 'bg-white/15')}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
