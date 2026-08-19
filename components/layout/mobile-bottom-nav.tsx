'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  Users,
  CreditCard,
  Zap,
  MoreHorizontal,
  Building,
  BarChart3,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const MAIN_TABS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/tenants', label: 'Tenants', icon: Users },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/electricity', label: 'Utility', icon: Zap },
];

const MORE_ITEMS = [
  { href: '/buildings', label: 'Buildings & Rooms', icon: Building, desc: 'Manage properties, floors, and bed rates' },
  { href: '/reports', label: 'Reports & Dues', icon: BarChart3, desc: 'Financial summaries and CSV export' },
  { href: '/trash', label: 'Trash & Recovery', icon: Trash2, desc: 'Recover soft-deleted items' },
  { href: '/profile', label: 'Profile & Settings', icon: User, desc: 'Account credentials and theme preferences' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isMoreActive =
    pathname.startsWith('/buildings') ||
    pathname.startsWith('/rooms') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/trash') ||
    pathname.startsWith('/profile');

  return (
    <>
      {/* More Menu Drawer Backdrop & Sheet */}
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="absolute bottom-16 left-3 right-3 bg-surface border-2 border-border rounded-3xl p-4 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">More Navigation</h3>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1 text-muted hover:text-foreground rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer',
                      isActive
                        ? 'bg-primary-container border-primary text-on-primary-container font-semibold shadow-xs'
                        : 'bg-surface-container/60 border-border-subtle text-foreground hover:bg-surface-highest'
                    )}
                  >
                    <div
                      className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                        isActive ? 'bg-primary text-white' : 'bg-surface-highest text-primary'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold block">{item.label}</span>
                      <span className="text-[11px] text-muted block leading-tight">{item.desc}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border-subtle flex items-center justify-around px-1 py-1.5 shadow-lg safe-area-bottom">
        {MAIN_TABS.map((tab) => {
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
                'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px]',
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
                  'text-[10px] mt-0.5 transition-all',
                  isActive ? 'font-bold text-primary' : 'font-medium text-muted'
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* More Drawer Trigger */}
        <button
          onClick={() => setIsMoreOpen(!isMoreOpen)}
          className={cn(
            'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px]',
            isMoreActive || isMoreOpen ? 'text-primary' : 'text-muted hover:text-foreground'
          )}
        >
          <div
            className={cn(
              'p-1 rounded-xl transition-all',
              (isMoreActive || isMoreOpen) && 'bg-primary/15'
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <span
            className={cn(
              'text-[10px] mt-0.5 transition-all',
              isMoreActive || isMoreOpen ? 'font-bold text-primary' : 'font-medium text-muted'
            )}
          >
            More
          </span>
        </button>
      </nav>
    </>
  );
}
