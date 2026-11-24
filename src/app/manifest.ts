// Web app manifest: lets people add LostFound to their home screen
// (on iPhone, push notifications only work for sites added to the home screen).
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LostFound – Community Lost & Found',
    short_name: 'LostFound',
    description: 'Report found items, search nearby and get alerts when something matching what you lost is posted.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
