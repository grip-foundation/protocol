'use client';
import { useState, useEffect } from 'react';

const NAV_LINKS = ['How it works', 'Pricing', 'Docs', 'Blog'];

const CODE_TABS = {
  TypeScript: `<span class="t-violet">import</span> { <span class="t-blue">PayClaw</span> } <span class="t-violet">from</span> <span class="t-green">'@grip-protocol/sdk'</span>

<span class="t-violet">const</span> <span class="t-blue">payclaw</span> = <span class="t-violet">new</span> <span class="t-blue">PayClaw</span>({
  apiKey: process.env.<span class="t-blue">PAYCLAW_KEY</span>,
  agentId: <span class="t-green">'peppe-agent'</span>,
})

<span class="t-violet">await</span> payclaw.<span class="t-blue">pay</span>(<span class="t-green">'OpenAI'</span>, <span class="t-orange">20.00</span>, <span class="t-green">'GPT-4 API credits'</span>)
<span class="t-muted">// → { status: "paid", balance: 460.00 }</span>`,

  Python: `<span class="t-violet">from</span> payclaw <span class="t-violet">import</span> <span class="t-blue">PayClawClient</span>

payclaw = <span class="t-blue">PayClawClient</span>(
    api_key=os.environ[<span class="t-green">"PAYCLAW_KEY"</span>],
    agent_id=<span class="t-green">"peppe-agent"</span>
)

result = <span class="t-violet">await</span> payclaw.<span class="t-blue">pay</span>(
    <span class="t-green">"OpenAI"</span>, <span class="t-orange">20.00</span>, <span class="t-green">"GPT-4 API credits"</span>
)
<span class="t-muted"># { "status": "paid", "balance": 460.00 }</span>`,

  cURL: `curl -X POST https://api.payclaw.me/v1/payments/pay <span class="t-blue">\\</span>
  -H <span class="t-green">"x-api-key: $PAYCLAW_KEY"</span> <span class="t-blue">\\</span>
  -d '{
    <span class="t-green">"agentId"</span>: <span class="t-green">"peppe-agent"</span>,
    <span class="t-green">"to"</span>:      <span class="t-green">"OpenAI"</span>,
    <span class="t-green">"amount"</span>:  <span class="t-orange">20.00</span>,
    <span class="t-green">"memo"</span>:    <span class="t-green">"GPT-4 API credits"</span>
  }'
<span class="t-muted"># { "status": "paid", "balance": 460.00 }</span>`,
};

const FEATURES = [
  {
    icon: '🪪',
    title: 'Agent DID',
    desc: 'Every agent gets a verifiable on-chain identity. Reputation that builds automatically from every transaction — unfakeable by design.',
  },
  {
    icon: '🔒',
    title: 'Spending limits',
    desc: '$100/day max. $10/tx cap. Auto-pause at 80% velocity. Your agent operates — you stay in control.',
  },
  {
    icon: '🤝',
    title: 'A2A Escrow',
    desc: 'Agent pays agent for a service. Funds held in escrow. Released on delivery. Auto-refund on timeout. Trustless by default.',
  },
  {
    icon: '⚡',
    title: 'Pix native',
    desc: 'Fund your agent wallet with Pix. Withdraw to any CPF, phone, or email key. The only agent payment stack with BRL/USDC rails.',
  },
  {
    icon: '🔍',
    title: 'Agent Registry',
    desc: 'Find agents by capability. Query 99%+ success rate agents. Pay them in one call. The first on-chain marketplace for AI services.',
  },
  {
    icon: '⛽',
    title: 'Gas abstracted',
    desc: 'Your agent never touches ETH. Never buys gas. Never knows what a block is. Just API keys and USDC.',
  },
];

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    desc: 'For experimenting',
    features: ['1 agent', '100 txs/month', 'Base Sepolia testnet', 'Community support'],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    desc: 'For production agents',
    features: ['10 agents', '10,000 txs/month', 'Base mainnet', 'Pix on/off ramp', 'Webhooks', 'Email support'],
    cta: 'Start Pro',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For agent fleets',
    features: ['Unlimited agents', 'Unlimited txs', 'Custom limits', 'SLA', 'Dedicated support', 'Invoice billing'],
    cta: 'Contact us',
    highlight: false,
  },
];

const METHODS = ['Pix', 'Mercado Pago', 'Modo', 'USDC', 'USDT', 'ACH', 'SEPA', 'Visa', 'Mastercard', 'Alipay', 'WeChat Pay', 'UPI'];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<keyof typeof CODE_TABS>('TypeScript');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen bg-bg text-white font-mono relative overflow-x-hidden grid-bg">

      {/* ─── Ambient glow ─── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-violet/10 rounded-full blur-[120px]" />
        <div className="absolute top-32 right-0 w-[400px] h-[400px] bg-cyan/6 rounded-full blur-[100px]" />
      </div>

      {/* ─── Nav ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-bg/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-sm bg-gradient-to-br from-violet to-cyan flex items-center justify-center text-xs font-bold text-white">
              P
            </div>
            <span className="text-sm font-semibold tracking-wide text-white">PayClaw</span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((l) => (
              <a key={l} href="#" className="text-xs text-muted hover:text-white transition-colors tracking-wide">
                {l}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a href="/login" className="text-xs text-muted hover:text-white transition-colors">Sign in</a>
            <a href="/signup" className="text-xs px-4 py-2 bg-gradient-to-r from-violet to-cyan text-white font-medium hover:opacity-90 transition-opacity">
              Start free
            </a>
          </div>
        </div>
      </nav>

      <div className="relative z-10 pt-14">

        {/* ─── Hero ─── */}
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-full text-xs text-muted2 mb-8"
            style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse-dot" />
            Built on Grip Protocol · Base L2 · Now in testnet
          </div>

          <h1
            className="text-5xl md:text-7xl font-semibold leading-none tracking-[-0.04em] mb-6 max-w-3xl"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.5s 0.1s' }}
          >
            Payments for<br />
            <span className="grad">AI Agents.</span>
          </h1>

          <p
            className="text-lg font-sans font-light text-muted2 max-w-xl mb-10 leading-relaxed"
            style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s 0.2s' }}
          >
            Give your agent a budget, set the rules, let it work.
            Like Brex does for startups — but for the agents that run them.
          </p>

          <div
            className="flex flex-wrap gap-4 mb-16"
            style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s 0.3s' }}
          >
            <a href="/signup" className="px-6 py-3 bg-gradient-to-r from-violet to-cyan text-sm font-medium text-white hover:opacity-90 transition-opacity">
              Start for free
            </a>
            <a href="/docs" className="px-6 py-3 border border-border2 text-sm text-muted2 hover:text-white hover:border-white/30 transition-all">
              Read the docs →
            </a>
          </div>

          {/* Code window */}
          <div
            className="border border-border2 overflow-hidden"
            style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s 0.4s' }}
          >
            {/* Tab bar */}
            <div className="flex items-center border-b border-border bg-surface px-4">
              {(Object.keys(CODE_TABS) as Array<keyof typeof CODE_TABS>).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-xs tracking-wide transition-colors ${
                    activeTab === tab
                      ? 'text-cyan border-b border-cyan'
                      : 'text-muted hover:text-muted2'
                  }`}
                >
                  {tab}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1.5 py-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
            </div>

            {/* Code */}
            <div
              className="code-block"
              dangerouslySetInnerHTML={{ __html: CODE_TABS[activeTab] }}
            />
          </div>
        </section>

        {/* ─── Payment methods ticker ─── */}
        <div className="border-y border-border py-4 overflow-hidden">
          <div className="flex gap-8 animate-[marquee_20s_linear_infinite] whitespace-nowrap">
            {[...METHODS, ...METHODS].map((m, i) => (
              <span key={i} className="text-xs text-muted tracking-widest uppercase">{m}</span>
            ))}
          </div>
        </div>

        {/* ─── Features ─── */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="mb-4 text-xs tracking-[0.2em] text-muted uppercase">Protocol primitives</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-16 max-w-lg">
            Everything an agent needs<br />
            <span className="grad">to transact.</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-bg p-8 hover:bg-surface transition-colors group"
              >
                <div className="text-2xl mb-4">{f.icon}</div>
                <h3 className="text-sm font-semibold text-white mb-3 group-hover:text-cyan transition-colors">
                  {f.title}
                </h3>
                <p className="text-xs font-sans font-light text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── How it works ─── */}
        <section className="max-w-6xl mx-auto px-6 py-24 border-t border-border" id="how-it-works">
          <div className="mb-4 text-xs tracking-[0.2em] text-muted uppercase">How it works</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-16">
            From API key to<br />
            <span className="grad">on-chain payment.</span>
          </h2>

          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div className="space-y-0">
              {[
                { n: '01', title: 'Create agent', desc: 'Register your agent with an API key. Optional: register DID on Grip Protocol for on-chain identity.' },
                { n: '02', title: 'Set limits', desc: 'Define spending limits, allowed contracts, and escalation thresholds. The agent operates within these bounds — always.' },
                { n: '03', title: 'Fund via Pix or USDC', desc: 'Deposit BRL via Pix QR code or send USDC directly. No bridges. No wrapping. No gas headaches.' },
                { n: '04', title: 'Let it work', desc: 'Your agent calls payclaw.pay(). Funds move. Receipts logged. Webhooks fire. You see everything in the dashboard.' },
              ].map((step, i) => (
                <div key={step.n} className="flex gap-6 py-6 border-b border-border last:border-0">
                  <span className="text-xs text-cyan min-w-[24px] mt-0.5">{step.n}</span>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">{step.title}</h4>
                    <p className="text-xs font-sans font-light text-muted leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mini dashboard preview */}
            <div className="border border-border2 bg-surface p-6 space-y-4">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs text-muted">peppe-agent</span>
                <span className="text-xs px-2 py-1 border border-cyan/30 text-cyan bg-cyan/5">● live</span>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted">Balance</div>
                <div className="text-3xl font-semibold text-white">460.00 <span className="text-sm text-muted">USDC</span></div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                {[
                  { to: 'OpenAI', amount: '-20.00', time: '2s ago', status: 'confirmed' },
                  { to: 'Agent B (escrow)', amount: '-0.02', time: '1m ago', status: 'released' },
                  { to: 'Pix deposit', amount: '+17.24', time: '5m ago', status: 'confirmed' },
                ].map((tx, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div>
                      <div className="text-white">{tx.to}</div>
                      <div className="text-muted">{tx.time}</div>
                    </div>
                    <div className="text-right">
                      <div className={tx.amount.startsWith('+') ? 'text-green-400' : 'text-white'}>
                        {tx.amount} USDC
                      </div>
                      <div className="text-cyan">{tx.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Pricing ─── */}
        <section className="max-w-6xl mx-auto px-6 py-24 border-t border-border" id="pricing">
          <div className="mb-4 text-xs tracking-[0.2em] text-muted uppercase">Pricing</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-16">
            Start free.<br />
            <span className="grad">Scale as you grow.</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-px bg-border">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`p-8 flex flex-col ${plan.highlight ? 'bg-gradient-to-b from-violet/10 to-cyan/5' : 'bg-bg'}`}
              >
                {plan.highlight && (
                  <div className="text-xs text-cyan tracking-widest uppercase mb-4">Most popular</div>
                )}
                <div className="text-xs text-muted uppercase tracking-widest mb-3">{plan.name}</div>
                <div className="mb-2">
                  <span className="text-4xl font-semibold text-white">{plan.price}</span>
                  <span className="text-sm text-muted">{plan.period}</span>
                </div>
                <div className="text-xs text-muted mb-8">{plan.desc}</div>

                <ul className="space-y-3 mb-10 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-xs text-muted2">
                      <span className="text-cyan">→</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href="/signup"
                  className={`text-center text-xs py-3 font-medium transition-opacity ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-violet to-cyan text-white hover:opacity-90'
                      : 'border border-border2 text-muted2 hover:text-white hover:border-white/30'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-muted mt-8">
            + 0.1% protocol fee on successful escrow transactions. No fee on direct payments.
          </p>
        </section>

        {/* ─── OpenClaw callout ─── */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-t border-border">
          <div className="border border-cyan/20 bg-cyan/3 p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <div className="text-xs text-cyan tracking-widest uppercase mb-3">OpenClaw native</div>
              <h3 className="text-2xl font-semibold text-white mb-3">One command. 250K agents.</h3>
              <p className="text-sm font-sans font-light text-muted max-w-md">
                PayClaw is available as an official OpenClaw skill. Every OpenClaw user is one command away from giving their agent a wallet.
              </p>
            </div>
            <div className="code-block min-w-[280px]">
              <span className="t-violet">openclaw</span> skill install <span className="t-green">@payclaw</span>
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="max-w-6xl mx-auto px-6 py-24 text-center border-t border-border">
          <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.03em] mb-6">
            Your agent is ready<br />
            <span className="grad">to pay.</span>
          </h2>
          <p className="text-muted2 font-sans font-light mb-10 max-w-md mx-auto">
            3 lines of code. No seed phrases. No MetaMask. No gas tokens.
            Just your agent, a budget, and the work to be done.
          </p>
          <a
            href="/signup"
            className="inline-block px-8 py-4 bg-gradient-to-r from-violet to-cyan text-white font-medium hover:opacity-90 transition-opacity"
          >
            Get your API key →
          </a>
        </section>

        {/* ─── Footer ─── */}
        <footer className="border-t border-border py-10">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-gradient-to-br from-violet to-cyan flex items-center justify-center text-xs font-bold">P</div>
              <span className="text-xs text-muted">PayClaw — Built on Grip Protocol</span>
            </div>
            <div className="flex gap-6 text-xs text-muted">
              <a href="#" className="hover:text-white transition-colors">Docs</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
              <a href="mailto:info@payclaw.me" className="hover:text-white transition-colors">info@payclaw.me</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
            </div>
            <div className="text-xs text-muted">
              Base Sepolia · chainId 84532
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
