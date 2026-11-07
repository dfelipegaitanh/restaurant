import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bistro POS — Experiencia Gastronómica',
  description: 'Gestión moderna de comandas en tiempo real, tablet de autoservicio y KDS.',
  other: {
    'color-scheme': 'dark',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark bg-[#0a0a0c] text-neutral-100">
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="min-h-screen bg-[#0a0a0c] text-neutral-200 antialiased selection:bg-amber-500/20 selection:text-amber-300">
        {children}
      </body>
    </html>
  );
}
