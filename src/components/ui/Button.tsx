import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantStyles = {
  primary:   'bg-[#0A1628] text-white hover:bg-[#1a2f4a] disabled:opacity-50 tracking-[0.15em] uppercase',
  secondary: 'bg-[#F8F9FA] text-[#0A1628] hover:bg-[#E2E8F0] border border-[#E2E8F0]',
  ghost:     'text-[#4A5568] hover:bg-[#F8F9FA]',
  danger:    'bg-[#C41E3A] text-white hover:bg-[#a01830] disabled:opacity-50 tracking-[0.15em] uppercase',
};

const sizeStyles = {
  sm: 'px-4 py-1.5 text-[11px]',
  md: 'px-5 py-2 text-[11px]',
  lg: 'px-6 py-3 text-xs',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0A1628]/30 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading && (
          <span className="h-3.5 w-3.5 animate-spin border border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
