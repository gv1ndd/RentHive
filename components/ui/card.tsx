import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
}

export function Card({ className, children, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface border border-border-subtle rounded-2xl p-4 shadow-xs transition-colors',
        interactive && 'hover:border-primary/40 cursor-pointer active:scale-[0.99]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
