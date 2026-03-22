'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard',           label: 'Overview',    icon: '◈' },
  { href: '/dashboard/agents',    label: 'Agents',      icon: '◎' },
  { href: '/dashboard/payments',  label: 'Payments',    icon: '◆' },
  { href: '/dashboard/escrow',    label: 'Escrow',      icon: '◇' },
  { href: '/dashboard/pix',       label: 'Pix',         icon: '◐' },
  { href: '/dashboard/webhooks',  label: 'Webhooks',    icon: '◉' },
  { href: '/dashboard/api-keys',  label: 'API Keys',    icon: '◌' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-bg flex font-mono">

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full bg-surface border-r border-border flex flex-col z-40 transition-all ${collapsed ? 'w-14' : 'w-56'}`}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border gap-3">
          <div className="w-7 h-7 flex-shrink-0 bg-gradient-to-br from-violet to-cyan flex items-center justify-center text-xs font-bold text-white rounded-sm">
            P
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-white tracking-wide">PayClaw</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-muted hover:text-white text-xs transition-colors"
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4">
          {NAV.map((item) => {
            const active = path === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-xs transition-all border-l-2 ${
                  active
                    ? 'text-cyan border-cyan bg-cyan/5'
                    : 'text-muted hover:text-white border-transparent hover:bg-white/3'
                }`}
              >
                <span className="flex-shrink-0 text-sm">{item.icon}</span>
                {!collapsed && <span className="tracking-wide">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="p-4 border-t border-border">
            <div className="text-xs text-muted leading-relaxed">
              Base Sepolia<br />
              <span className="text-cyan">● testnet</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className={`flex-1 flex flex-col transition-all ${collapsed ? 'ml-14' : 'ml-56'}`}>
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-surface/50 backdrop-blur flex items-center px-6 gap-4 sticky top-0 z-30">
          <div className="text-xs text-muted">
            {NAV.find(n => n.href === path)?.label ?? 'Dashboard'}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-xs text-muted">pc_live_···</span>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet to-cyan flex items-center justify-center text-xs font-bold">
              L
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
