import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PayClaw — Payments for AI Agents',
  description: 'Give your agent a budget. Set the rules. Let it work. Built on Grip Protocol.',
  openGraph: {
    title: 'PayClaw — Payments for AI Agents',
    description: 'Like Brex for AI agents. Pix-native. Built on Base.',
    url: 'https://payclaw.me',
    siteName: 'PayClaw',
    images: [{ url: 'https://payclaw.me/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PayClaw — Payments for AI Agents',
    description: 'Give your agent a wallet. 3 lines of code.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
