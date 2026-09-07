import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DAMAI Open Days 2026 | La Dolce Vita',
  description: 'Prenota la tua visita ai DAMAI Open Days 2026. 30-31 ottobre e 1 novembre.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
