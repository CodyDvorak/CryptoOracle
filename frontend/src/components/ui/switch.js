import * as React from 'react';
import { cn } from '../../lib/utils';

export const Switch = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => {
  const handleChange = () => {
    if (onCheckedChange) {
      onCheckedChange(!checked);
    }
  };
  
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={handleChange}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-[var(--primary)]' : 'bg-[var(--panel)]',
        className
      )}
      ref={ref}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
});
Switch.displayName = 'Switch';