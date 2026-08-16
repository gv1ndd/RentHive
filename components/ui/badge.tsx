import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'occupied'
    | 'vacant'
    | 'reserved'
    | 'pending'
    | 'moving_out'
    | 'primary'
    | 'neutral';
  size?: 'sm' | 'md';
}

export function Badge({
  variant = 'neutral',
  size = 'md',
  className,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    occupied: 'bg-status-occupied/15 text-status-occupied font-semibold',
    vacant: 'bg-status-vacant/15 text-status-vacant font-semibold',
    reserved: 'bg-status-reserved/15 text-status-reserved font-bold',
    pending: 'bg-status-pending/15 text-status-pending font-semibold',
    moving_out: 'bg-status-moving-out/15 text-status-moving-out font-semibold',
    primary: 'bg-primary/15 text-primary font-semibold',
    neutral: 'bg-muted/15 text-foreground/80 font-medium',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px] rounded-md',
    md: 'px-2.5 py-1 text-xs rounded-lg',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 leading-none select-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
