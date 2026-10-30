import { ChevronDown } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  invalid?: boolean;
  /** Taller counter-mode variant (merchant portal). */
  size?: 'md' | 'lg';
}

/** Native <select> with an inset chevron (the browser's own arrow sits flush against the edge). */
export function Select({ invalid, size = 'md', className, children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        {...rest}
        aria-invalid={invalid || undefined}
        className={`w-full appearance-none rounded-chip bg-surface-1 pr-11 pl-3 text-text-1 ring-1 outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-2 ${
          size === 'lg' ? 'min-h-12 text-base' : 'min-h-11'
        } ${invalid ? 'ring-danger-500' : 'ring-line'} ${className ?? ''}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4.5 -translate-y-1/2 text-text-2" aria-hidden />
    </div>
  );
}
