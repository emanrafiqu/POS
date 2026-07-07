import { Loader2 } from 'lucide-react';

export function Spinner({ className = 'h-6 w-6' }) {
  return <Loader2 className={`animate-spin text-gold ${className}`} />;
}

/** Full-page centered loader used while auth / routes resolve. */
export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Spinner className="h-8 w-8" />
      <p className="text-sm text-ink/50">{label}</p>
    </div>
  );
}
