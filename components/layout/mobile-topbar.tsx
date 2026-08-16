'use client';

import React from 'react';
import Link from 'next/link';
import { Search, User, Building2 } from 'lucide-react';
import { useActiveBuilding } from '@/lib/context/active-building-context';

export function MobileTopbar() {
  const { activeBuilding } = useActiveBuilding();

  return (
    <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface border-b border-border-subtle sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm shadow-xs">
          R
        </div>
        <div>
          <h1 className="text-sm font-bold text-foreground leading-tight">Rent-Hive</h1>
          <p className="text-[11px] text-primary font-medium flex items-center gap-1 truncate max-w-[150px]">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{activeBuilding?.name || 'All Properties'}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Link
          href="/search"
          className="p-2 text-muted hover:text-foreground rounded-xl hover:bg-surface-highest transition-colors"
          aria-label="Search Rooms"
        >
          <Search className="w-5 h-5 text-primary" />
        </Link>
        <Link
          href="/profile"
          className="p-2 text-muted hover:text-foreground rounded-xl hover:bg-surface-highest transition-colors"
          aria-label="Profile and Settings"
        >
          <User className="w-5 h-5" />
        </Link>
      </div>
    </header>
  );
}
