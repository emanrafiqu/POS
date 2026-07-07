import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-ink text-white shadow-card hover:bg-ink-soft',
        gold: 'bg-gold text-ink font-semibold shadow-gold hover:bg-gold-light',
        outline: 'border border-ink/15 bg-white text-ink hover:border-gold hover:text-gold-dark',
        ghost: 'text-ink/70 hover:bg-ink/5 hover:text-ink',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        subtle: 'bg-ink/5 text-ink hover:bg-ink/10',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs rounded-lg',
        lg: 'h-12 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export const Button = forwardRef(function Button(
  { className, variant, size, loading, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
