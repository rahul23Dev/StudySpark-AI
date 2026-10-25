import type { ReactNode } from 'react';

export const metadata = { title: 'StudySpark AI API' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 32, color: '#152238', background: '#FFF9F0' }}>
        {children}
      </body>
    </html>
  );
}
