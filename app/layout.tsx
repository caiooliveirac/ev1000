import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hemodynamic Simulator MVP',
  description: 'EV1000-like educational simulator (phase 1)'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ backgroundColor: '#070d18', color: '#e8edf7' }}>{children}</body>
    </html>
  );
}
