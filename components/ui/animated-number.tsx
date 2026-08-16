'use client';

import React, { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils/currency';

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  isCurrency?: boolean;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 500,
  isCurrency = false,
  className,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const endValue = value;

    if (startValue === endValue) return;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeProgress;

      setDisplayValue(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    const animId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animId);
  }, [value, duration]);

  return (
    <span className={className}>
      {isCurrency ? formatCurrency(displayValue) : Math.round(displayValue).toLocaleString('en-IN')}
    </span>
  );
}
