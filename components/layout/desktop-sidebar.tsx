'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  Users,
  Zap,
  CreditCard,
  Building,
  BarChart3,
  Trash2,
  User,
  Sun,
  Moon,
  Laptop,
  LogOut,
} from 'lucide-react';
import { BuildingSelector } from './building-selector';
import { useTheme } from '@/lib/context/theme-context';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/tenants', label: 'Tenants', icon: Users },
  { href: '/electricity', label: 'Electricity', icon: Zap },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/buildings', label: 'Buildings & Rooms', icon: Building },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/trash', label: 'Trash', icon: Trash2 },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-surface border-r border-border-subtle shrink-0 sticky top-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-border-subtle flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-base shadow-xs">
          R
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground">Rent-Hive</h1>
          <p className="text-[11px] text-muted font-medium">Property Manager</p>
        </div>
      </div>

      {/* Global Building Context */}
      <div className="p-3 border-b border-border-subtle">
        <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 px-1">
          Active Property
        </label>
        <BuildingSelector />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/'
              ? pathname === '/' || pathname.startsWith('/dashboard')
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-container text-on-primary-container font-semibold'
                  : 'text-foreground/75 hover:bg-surface-highest hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  isActive ? 'text-on-primary-container' : 'text-muted'
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Footer: Theme Switcher & Sign Out */}
      <div className="p-3 border-t border-border-subtle space-y-2 bg-surface-container/30">
        {/* Theme mode segmented control */}
        <div className="flex items-center justify-between p-1 bg-surface-highest/80 rounded-xl border border-border-subtle text-xs">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              'flex-1 flex items-center justify-center py-1 rounded-lg transition-all cursor-pointer',
              theme === 'light' ? 'bg-surface text-foreground shadow-xs font-semibold' : 'text-muted hover:text-foreground'
            )}
            title="Light Mode"
          >
            <Sun className="w-3.5 h-3.5 mr-1" />
            <span>Light</span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              'flex-1 flex items-center justify-center py-1 rounded-lg transition-all cursor-pointer',
              theme === 'dark' ? 'bg-surface text-foreground shadow-xs font-semibold' : 'text-muted hover:text-foreground'
            )}
            title="Dark Mode"
          >
            <Moon className="w-3.5 h-3.5 mr-1" />
            <span>Dark</span>
          </button>
          <button
            onClick={() => setTheme('system')}
            className={cn(
              'flex-1 flex items-center justify-center py-1 rounded-lg transition-all cursor-pointer',
              theme === 'system' ? 'bg-surface text-foreground shadow-xs font-semibold' : 'text-muted hover:text-foreground'
            )}
            title="System Theme"
          >
            <Laptop className="w-3.5 h-3.5 mr-1" />
            <span>Auto</span>
          </button>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-status-pending hover:bg-status-pending/10 rounded-xl transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
