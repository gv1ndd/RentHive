'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    // Check if dismissed before
    const dismissed = localStorage.getItem('rent_hive_pwa_dismissed') === 'true';
    if (dismissed) return;

    // Check standalone mode
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(inStandalone);
    if (inStandalone) return;

    // Check iOS
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      setIsDismissed(false);
      return;
    }

    // Android / Chrome beforeinstallprompt handler
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsDismissed(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsDismissed(true);
      localStorage.setItem('rent_hive_pwa_dismissed', 'true');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('rent_hive_pwa_dismissed', 'true');
  };

  if (isStandalone || isDismissed) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 left-4 lg:left-auto lg:max-w-md z-40 bg-surface border-2 border-primary/30 rounded-2xl p-4 shadow-xl animate-in slide-in-from-bottom duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
            R
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Install Rent-Hive</h3>
            <p className="text-xs text-muted">
              Add to your home screen for quick offline access and standalone mode.
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1 text-muted hover:text-foreground rounded-lg transition-colors cursor-pointer"
          aria-label="Dismiss install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {isIOS ? (
        <div className="mt-3 p-2.5 rounded-xl bg-surface-container/80 border border-border-subtle text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Share className="w-3.5 h-3.5 text-primary" />
            <span>To install on iOS:</span>
          </div>
          <p className="text-muted text-[11px] leading-relaxed">
            1. Tap the <span className="font-semibold text-foreground">Share</span> icon in Safari (box with up arrow).
            <br />
            2. Scroll down and tap <span className="font-semibold text-foreground">&quot;Add to Home Screen&quot;</span>.
          </p>
        </div>
      ) : deferredPrompt ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleDismiss}>
            Not Now
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleInstallClick}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Install App
          </Button>
        </div>
      ) : null}
    </div>
  );
}
