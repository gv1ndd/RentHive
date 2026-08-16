'use client';

import React, { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Rent-Hive Application Error:', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full text-center space-y-4 p-6 shadow-lg border-2 border-border">
        <div className="w-14 h-14 rounded-2xl bg-status-pending/15 text-status-pending flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h1 className="text-lg font-bold text-foreground">Something went wrong</h1>
          <p className="text-xs text-muted leading-relaxed">
            An unexpected error occurred while loading this view. You can try reloading or return to the dashboard.
          </p>
        </div>

        {error.message && (
          <div className="p-3 rounded-xl bg-surface-container text-left text-xs font-mono text-muted break-all border border-border-subtle max-h-28 overflow-y-auto">
            {error.message}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => reset()} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            Try Again
          </Button>

          <Link href="/">
            <Button variant="primary" size="sm" leftIcon={<Home className="w-3.5 h-3.5" />}>
              Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
