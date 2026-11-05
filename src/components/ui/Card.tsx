import type { HTMLAttributes, ReactNode } from 'react'

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padded?: boolean
}

export function Card({ children, padded = true, className = '', ...rest }: Props) {
  return (
    <div
      className={[
        'rounded-3xl bg-card border border-border/60',
        padded ? 'p-4' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}
