import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'inverse';

const VARIANT: Record<Variant, string> = {
  // Flat GCash blue, GCash's own hover (#003C96). White text 5.7:1 (light) / dark text on #5A9BFF (dark).
  primary: 'bg-brand text-on-brand hover:bg-brand-strong disabled:bg-surface-2 disabled:text-text-2',
  secondary: 'bg-surface-1 text-brand ring-1 ring-line hover:bg-brand-soft disabled:text-text-2',
  ghost: 'text-brand hover:bg-brand-soft disabled:text-text-2',
  // Translucent white: only on hero (navy) surfaces
  inverse: 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/16 disabled:opacity-50',
};

const SIZE = { md: 'min-h-11 px-4 text-sm', lg: 'min-h-12 px-5 text-base' };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZE;
  fullWidth?: boolean;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = 'primary', size = 'md', fullWidth, icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition duration-150 active:scale-[.98] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className ?? ''}`}
    >
      {icon}
      {children}
    </button>
  );
}
