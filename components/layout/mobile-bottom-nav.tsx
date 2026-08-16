'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Search, Users, CreditCard, Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const TABS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/tenants', label: 'Tenants', icon: Users },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/electricity', label: 'Utility', icon: Zap },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border-subtle flex items-center justify-around px-2 py-1.5 shadow-lg safe-area-bottom">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          tab.href === '/'
            ? pathname === '/' || pathname.startsWith('/dashboard')
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex flex-col items-center justify-center py-1 px-4 rounded-xl transition-all cursor-pointer min-w-[72px]',
              isActive ? 'text-primary' : 'text-muted hover:text-foreground'
            )}
          >
            <div
              className={cn(
                'p-1 rounded-xl transition-all',
                isActive && 'bg-primary/15'
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span
              className={cn(
                'text-[11px] mt-0.5 transition-all',
                isActive ? 'font-bold text-primary' : 'font-medium text-muted'
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
