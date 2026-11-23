import type { Metadata } from 'next';
import './globals.css';
import './scanner-mobile.css';
import './home.css';
import './admin/admin.css';

export const metadata: Metadata = {
  title: 'Damai Christmas Village | 12 e 13 dicembre 2026',
  description: 'Registrati gratuitamente al Damai Christmas Village: sabato 12 e domenica 13 dicembre 2026, dalle 16:00 alle 21:30.',
  // Backend di registrazione: la pagina indicizzabile è quella del sito.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
