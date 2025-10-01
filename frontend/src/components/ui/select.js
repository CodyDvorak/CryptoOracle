import * as React from 'react';
import { cn } from '../../lib/utils';

export const Select = React.forwardRef(({ className, children, value, onValueChange, ...props }, ref) => {
  return (
    <select
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--card-border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      value={value}
      onChange={(e) => onValueChange && onValueChange(e.target.value)}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = 'Select';

export const SelectOption = ({ children, ...props }) => {
  return <option {...props}>{children}</option>;
};