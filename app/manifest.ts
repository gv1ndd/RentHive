import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rent-Hive Property Manager',
    short_name: 'Rent-Hive',
    description: 'Unified PG & Hostel Rental Property Management Platform',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F8F9FC',
    theme_color: '#6C4AB6',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Search Directory',
        short_name: 'Search',
        description: 'Search rooms, beds, and tenants',
        url: '/search',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Record Payment',
        short_name: 'Payments',
        description: 'View and record payments',
        url: '/payments',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Tenant Directory',
        short_name: 'Tenants',
        description: 'Manage active tenants and stay histories',
        url: '/tenants',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
