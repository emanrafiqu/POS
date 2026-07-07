import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** ShadCN-style class combiner: clsx + tailwind-merge. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
