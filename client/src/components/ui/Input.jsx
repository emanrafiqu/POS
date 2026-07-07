import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export const Input = forwardRef(function Input({ className, type = 'text', error, ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-10 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm transition-colors',
        'placeholder:text-ink/35 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-red-400 focus:border-red-400 focus:ring-red-200',
        className
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, error, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm transition-colors',
        'placeholder:text-ink/35 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30',
        error && 'border-red-400',
        className
      )}
      rows={3}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, error, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm transition-colors',
        'focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30',
        error && 'border-red-400',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({ className, children, required, ...props }) {
  return (
    <label className={cn('mb-1.5 block text-xs font-medium text-ink/70', className)} {...props}>
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

export function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

/** Standard form field wrapper: label + control + validation message. */
export function Field({ label, required, error, children, className }) {
  return (
    <div className={className}>
      {label && <Label required={required}>{label}</Label>}
      {children}
      <FieldError message={error} />
    </div>
  );
}
