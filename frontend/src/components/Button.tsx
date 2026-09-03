import type { ButtonHTMLAttributes } from 'react';

type Props = {
  variant?: 'primary' | 'secondary';
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  const base = 'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const styles =
    variant === 'primary'
      ? 'bg-accent text-white hover:bg-[#195849]'
      : 'border border-hairline bg-surface text-ink hover:bg-accent-muted';
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
