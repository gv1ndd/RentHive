'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full text-center space-y-4 p-6 shadow-lg border-2 border-border">
        <div className="w-14 h-14 rounded-2xl bg-surface-highest text-muted flex items-center justify-center mx-auto">
          <FileQuestion className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h1 className="text-lg font-bold text-foreground">Page Not Found</h1>
          <p className="text-xs text-muted leading-relaxed">
            The page or record you are looking for does not exist or has been moved.
          </p>
        </div>

        <div className="pt-2">
          <Link href="/">
            <Button variant="primary" size="sm" leftIcon={<Home className="w-3.5 h-3.5" />}>
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
