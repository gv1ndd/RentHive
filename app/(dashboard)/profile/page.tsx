'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/context/theme-context';
import { useActiveBuilding } from '@/lib/context/active-building-context';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Mail,
  Shield,
  Sun,
  Moon,
  Laptop,
  LogOut,
  Building2,
  FileText,
  Lock,
} from 'lucide-react';

export default function ProfileSettingsPage() {
  const { theme, setTheme } = useTheme();
  const { activeBuilding } = useActiveBuilding();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserEmail(user.email || null);
        setUserId(user.id);
      }
    };
    fetchUser();
  }, [supabase]);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Sign out error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Profile & Settings</h1>
        <p className="text-xs text-muted">
          Manage your account credentials, preferences, and workspace settings.
        </p>
      </div>

      {/* Account Profile Card */}
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-xl">
            {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              {userEmail || 'Landlord / Property Owner'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="primary" size="sm">
                Property Admin
              </Badge>
              {userId && (
                <span className="text-[11px] text-muted font-mono truncate max-w-[200px]">
                  ID: {userId}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-surface-container/60 border border-border-subtle flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-muted shrink-0" />
            <div>
              <span className="text-muted block text-[11px]">Registered Email</span>
              <span className="font-semibold text-foreground">{userEmail || '—'}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container/60 border border-border-subtle flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-muted shrink-0" />
            <div>
              <span className="text-muted block text-[11px]">Active Property</span>
              <span className="font-semibold text-foreground">
                {activeBuilding?.name || 'All Properties'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Appearance Theme Selector */}
      <Card className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Appearance & Theme</h3>
        <p className="text-xs text-muted">
          Choose between light mode, dark mode, or follow your operating system settings.
        </p>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <button
            onClick={() => setTheme('light')}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              theme === 'light'
                ? 'bg-primary-container border-primary text-on-primary-container shadow-xs'
                : 'bg-surface border-border-subtle text-muted hover:text-foreground hover:bg-surface-highest'
            }`}
          >
            <Sun className="w-5 h-5 mb-1.5" />
            <span>Light</span>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              theme === 'dark'
                ? 'bg-primary-container border-primary text-on-primary-container shadow-xs'
                : 'bg-surface border-border-subtle text-muted hover:text-foreground hover:bg-surface-highest'
            }`}
          >
            <Moon className="w-5 h-5 mb-1.5" />
            <span>Dark</span>
          </button>

          <button
            onClick={() => setTheme('system')}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              theme === 'system'
                ? 'bg-primary-container border-primary text-on-primary-container shadow-xs'
                : 'bg-surface border-border-subtle text-muted hover:text-foreground hover:bg-surface-highest'
            }`}
          >
            <Laptop className="w-5 h-5 mb-1.5" />
            <span>System Auto</span>
          </button>
        </div>
      </Card>

      {/* Security & Sessions */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Sign Out</h3>
            <p className="text-xs text-muted">
              End your active session on this device.
            </p>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={handleSignOut}
            isLoading={isLoading}
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            Sign Out
          </Button>
        </div>
      </Card>

      {/* Legal & Version Info */}
      <div className="text-center text-[11px] text-muted space-y-1 pt-4">
        <p>Rent-Hive Management Platform · v1.0.0 (PWA Ready)</p>
        <div className="flex items-center justify-center gap-3">
          <span className="hover:underline cursor-pointer">Terms of Service</span>
          <span>•</span>
          <span className="hover:underline cursor-pointer">Privacy Policy</span>
        </div>
      </div>
    </div>
  );
}
