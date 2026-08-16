'use client';

import React from 'react';
import { useActiveBuilding } from '@/lib/context/active-building-context';
import { Building2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function BuildingSelector({ className }: { className?: string }) {
  const { buildings, activeBuildingId, setActiveBuildingId, isLoading } = useActiveBuilding();

  if (isLoading) {
    return (
      <div className={cn('h-10 bg-surface-highest/60 rounded-xl animate-pulse', className)} />
    );
  }

  if (buildings.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-xs text-muted bg-surface-container rounded-xl border border-border-subtle',
          className
        )}
      >
        <Building2 className="w-4 h-4 text-primary" />
        <span>No properties added</span>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center gap-2.5 px-3 py-2 bg-surface border border-border-subtle rounded-xl shadow-xs focus-within:ring-2 focus-within:ring-primary/40">
        <Building2 className="w-4 h-4 text-primary shrink-0" />
        <select
          value={activeBuildingId || ''}
          onChange={(e) => setActiveBuildingId(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold text-foreground focus:outline-none appearance-none cursor-pointer pr-6"
          aria-label="Select active property"
        >
          {buildings.map((b) => (
            <option key={b.id} value={b.id} className="bg-surface text-foreground font-normal">
              {b.name}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-3 pointer-events-none" />
      </div>
    </div>
  );
}
