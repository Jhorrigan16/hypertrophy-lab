import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  fullWidth?: boolean
  children: ReactNode
}

const styles: Record<Variant, string> = {
  primary:
    'bg-accent text-white active:bg-accent-pressed shadow-[0_8px_24px_rgba(255,116,51,0.25)]',
  secondary: 'bg-card-elevated text-text border border-border',
  ghost: 'bg-transparent text-muted active:bg-card',
  danger: 'bg-danger/15 text-danger border border-danger/30',
  success: 'bg-success/15 text-success border border-success/30',
}

export function Button({
  variant = 'primary',
  fullWidth,
  className = '',
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100',
        styles[variant],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
