'use client';

import React from 'react';
import { ActiveBuildingProvider } from '@/lib/context/active-building-context';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { MobileTopbar } from '@/components/layout/mobile-topbar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ActiveBuildingProvider>
      <div className="min-h-screen flex bg-background text-foreground">
        {/* Desktop Fixed Sidebar */}
        <DesktopSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          {/* Mobile Top App Bar */}
          <MobileTopbar />

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
            {children}
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <MobileBottomNav />
        </div>
      </div>
    </ActiveBuildingProvider>
  );
}
