import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dominic',
  description: 'Dominic - Your AI pair designer for Figma',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="w-[320px] h-[480px] overflow-hidden">{children}</body>
    </html>
  );
}
