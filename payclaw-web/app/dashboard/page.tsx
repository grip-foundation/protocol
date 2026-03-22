'use client';
import { useState } from 'react';

const RECENT_TXS = [
  { id: '1', to: 'OpenAI',           amount: -20.00, status: 'confirmed', type: 'direct',  time: '2s ago' },
  { id: '2', to: 'Agent B (escrow)', amount: -0.02,  status: 'released',  type: 'escrow',  time: '1m ago' },
  { id: '3', to: 'Pix deposit',      amount: +17.24, status: 'confirmed', type: 'deposit', time: '5m ago' },
  { id: '4', to: 'Anthropic API',    amount: -8.50,  status: 'confirmed', type: 'direct',  time: '12m ago' },
  { id: '5', to: 'Dataset Agent',    amount: -5.00,  status: 'released',  type: 'escrow',  time: '1h ago' },
];

const AGENTS = [
  { id: 'peppe-agent',     balance: 460.00, txs: 127,  rep: 99.2, status: 'active' },
  { id: 'research-agent',  balance: 85.40,  txs: 34,   rep: 97.1, status: 'active' },
  { id: 'writer-agent',    balance: 0.00,   txs: 0,    rep: null,  status: 'inactive' },
];

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="border border-border bg-surface p-5">
      <div className="text-xs text-muted uppercase tracking-widest mb-3">{label}</div>
      <div className={`text-3xl font-semibold ${accent ? 'grad' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [payTo, setPayTo] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);

  async function handleQuickPay() {
    if (!payTo || !payAmount) return;
    setPaying(true);
    await new Promise(r => setTimeout(r, 1200));
    setPaying(false);
    setPayTo('');
    setPayAmount('');
  }

  return (
    <div className="max-w-5xl space-y-6">

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
        <Stat label="Total balance" value="$545.40" sub="across 3 agents" accent />
        <Stat label="This month" value="33 txs" sub="$33.52 paid out" />
        <Stat label="Protocol fees" value="$0.03" sub="0.1% on escrow" />
        <Stat label="Avg success rate" value="98.2%" sub="on-chain reputation" />
      </div>

      <div className="grid md:grid-cols-3 gap-6">

        {/* Quick pay */}
        <div className="md:col-span-1 border border-border bg-surface p-5">
          <div className="text-xs text-muted uppercase tracking-widest mb-4">Quick pay</div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1.5">Agent</label>
              <select className="w-full bg-bg border border-border text-xs text-white px-3 py-2.5 outline-none focus:border-cyan transition-colors">
                {AGENTS.filter(a => a.status === 'active').map(a => (
                  <option key={a.id}>{a.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1.5">To</label>
              <input
                value={payTo}
                onChange={e => setPayTo(e.target.value)}
                placeholder="OpenAI, 0xabc..."
                className="w-full bg-bg border border-border text-xs text-white px-3 py-2.5 outline-none focus:border-cyan transition-colors placeholder:text-muted"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1.5">Amount (USDC)</label>
              <input
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="20.00"
                type="number"
                min="0"
                step="0.01"
                className="w-full bg-bg border border-border text-xs text-white px-3 py-2.5 outline-none focus:border-cyan transition-colors placeholder:text-muted"
              />
            </div>
            <button
              onClick={handleQuickPay}
              disabled={paying || !payTo || !payAmount}
              className="w-full py-2.5 text-xs font-medium bg-gradient-to-r from-violet to-cyan text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {paying ? 'Sending...' : 'Pay →'}
            </button>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="md:col-span-2 border border-border bg-surface">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="text-xs text-muted uppercase tracking-widest">Recent transactions</div>
            <a href="/dashboard/payments" className="text-xs text-muted hover:text-cyan transition-colors">View all →</a>
          </div>
          <div className="divide-y divide-border">
            {RECENT_TXS.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/1 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-1.5 py-0.5 border ${
                    tx.type === 'deposit'
                      ? 'border-green-500/30 text-green-400 bg-green-500/5'
                      : tx.type === 'escrow'
                      ? 'border-cyan/30 text-cyan bg-cyan/5'
                      : 'border-border text-muted'
                  }`}>
                    {tx.type}
                  </span>
                  <div>
                    <div className="text-xs text-white">{tx.to}</div>
                    <div className="text-xs text-muted">{tx.time}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-medium ${tx.amount > 0 ? 'text-green-400' : 'text-white'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} USDC
                  </div>
                  <div className="text-xs text-cyan">{tx.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agents */}
      <div className="border border-border bg-surface">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-xs text-muted uppercase tracking-widest">Agents</div>
          <a href="/dashboard/agents" className="text-xs text-muted hover:text-cyan transition-colors">Manage →</a>
        </div>
        <div className="divide-y divide-border">
          {AGENTS.map(agent => (
            <div key={agent.id} className="flex items-center justify-between px-5 py-4 hover:bg-white/1 transition-colors">
              <div className="flex items-center gap-4">
                <span className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-cyan animate-pulse-dot' : 'bg-muted'}`} />
                <div>
                  <div className="text-xs text-white font-medium">{agent.id}</div>
                  <div className="text-xs text-muted">{agent.txs} txs</div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                {agent.rep && (
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-muted">Rep score</div>
                    <div className="text-xs text-cyan">{agent.rep}%</div>
                  </div>
                )}
                <div className="text-right">
                  <div className="text-xs text-muted">Balance</div>
                  <div className="text-xs text-white font-medium">${agent.balance.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
