import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/lib/context/theme-context';
import { PwaRegister } from '@/components/pwa/pwa-register';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { PostHogProvider } from '@/components/observability/posthog-provider';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Rent-Hive — Property & Hostel Management',
  description:
    'Single-owner property, PG, and hostel management platform for tenant check-ins, bed matrix tracking, rent calculations, electricity splitting, and payments.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rent-Hive',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF7F2' },
    { media: '(prefers-color-scheme: dark)', color: '#0D0F0D' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={jakarta.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <PostHogProvider>
          <ThemeProvider>
            <PwaRegister />
            {children}
            <InstallPrompt />
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
