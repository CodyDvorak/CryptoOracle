import * as React from 'react';
import { cn } from '../../lib/utils';

export const Button = React.forwardRef(({ className, variant = 'default', size = 'default', ...props }, ref) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-[var(--btn-radius)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50';
  
  const variants = {
    default: 'bg-[var(--primary)] text-black hover:bg-[var(--primary-600)]',
    secondary: 'bg-[var(--surface)] text-[var(--text)] hover:bg-[#171c25]',
    ghost: 'text-[var(--text)] hover:bg-white/5',
    danger: 'bg-[var(--danger)] text-white hover:bg-[#ff5555]'
  };
  
  const sizes = {
    default: 'h-10 px-4 text-sm',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-12 px-5 text-base'
  };
  
  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      ref={ref}
      {...props}
    />
  );
});

Button.displayName = 'Button';