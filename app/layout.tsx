import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hemodynamic Simulator MVP',
  description: 'EV1000-like educational simulator (phase 1)'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
