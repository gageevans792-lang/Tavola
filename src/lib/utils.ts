import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as USD currency: $1,234.56 */
export function formatCurrency(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return '$–';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format a number as a percentage with sign: +12.3% or -4.5% */
export function formatPct(n: number | null | undefined, decimals = 1): string {
  if (n == null || isNaN(n)) return '–%';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
}
