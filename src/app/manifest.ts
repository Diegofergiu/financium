import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Mi Bolsillo — Tus cuentas, claras',
    short_name: 'Mi Bolsillo',
    description: 'Ingresos, gastos, cheques y presupuestos en un solo lugar.',
    lang: 'es',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbfaf7',
    theme_color: '#14594f',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Nuevo movimiento', url: '/transactions?nuevo=1', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Cheques', url: '/checks', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
