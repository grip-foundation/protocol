-- PayClaw — Supabase Schema
-- Run: supabase db push

-- ─── API Keys ───────────────────────────────────────────────────────────────
create table if not exists api_keys (
  id          uuid primary key default gen_random_uuid(),
  key_hash    text not null unique,           -- sha256 of the actual key
  key_prefix  text not null,                  -- first 8 chars for display (e.g. "pc_live_")
  owner_id    uuid not null,
  name        text,                           -- "My OpenClaw agent"
  created_at  timestamptz default now(),
  last_used   timestamptz,
  revoked_at  timestamptz,
  scopes      text[] default array['pay','escrow','read']
);

-- ─── Agents ─────────────────────────────────────────────────────────────────
create table if not exists agents (
  id              uuid primary key default gen_random_uuid(),
  api_key_id      uuid references api_keys(id),
  agent_id        text not null,              -- internal identifier
  wallet_address  text,                       -- on-chain smart account address
  on_chain        boolean default false,      -- whether DID is registered on Grip
  on_chain_tx     text,                       -- registration tx hash
  model_version   text,
  name            text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── Payments ───────────────────────────────────────────────────────────────
create table if not exists payments (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid references agents(id),
  type            text not null check (type in ('direct', 'escrow')),
  direction       text not null check (direction in ('outbound', 'inbound')),
  status          text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'failed', 'refunded')),
  amount_usdc     numeric(18,6) not null,
  fee_usdc        numeric(18,6) default 0,
  to_address      text,
  from_address    text,
  memo            text,
  escrow_id       bigint,                     -- on-chain escrow ID
  tx_hash         text,
  block_number    bigint,
  created_at      timestamptz default now(),
  confirmed_at    timestamptz,
  metadata        jsonb default '{}'
);

-- ─── Pix Transactions ───────────────────────────────────────────────────────
create table if not exists pix_transactions (
  id              uuid primary key default gen_random_uuid(),
  payment_id      uuid references payments(id),
  direction       text not null check (direction in ('in', 'out')),
  status          text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'failed')),
  amount_brl      numeric(18,2) not null,
  amount_usdc     numeric(18,6),
  rate_brl_usdc   numeric(18,6),
  pix_key         text,
  e2e_id          text unique,               -- Pix end-to-end ID
  globalpix_id    text,
  created_at      timestamptz default now(),
  confirmed_at    timestamptz
);

-- ─── Session Keys ────────────────────────────────────────────────────────────
create table if not exists session_keys (
  id                    uuid primary key default gen_random_uuid(),
  agent_id              uuid references agents(id),
  key_id                text not null unique,   -- on-chain keyId (bytes32)
  tx_hash               text,
  daily_limit_usdc      numeric(18,6),
  per_tx_limit_usdc     numeric(18,6),
  escalation_usdc       numeric(18,6),
  valid_until           timestamptz,
  allowed_contracts     text[],
  active                boolean default true,
  created_at            timestamptz default now(),
  revoked_at            timestamptz
);

-- ─── Webhooks ────────────────────────────────────────────────────────────────
create table if not exists webhooks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null,
  url         text not null,
  events      text[] not null,               -- ['payment.confirmed', 'escrow.released']
  secret      text not null,                 -- HMAC signing secret
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists webhook_deliveries (
  id            uuid primary key default gen_random_uuid(),
  webhook_id    uuid references webhooks(id),
  event         text not null,
  payload       jsonb not null,
  status        text default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts      int default 0,
  last_error    text,
  delivered_at  timestamptz,
  created_at    timestamptz default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_payments_agent_id    on payments(agent_id);
create index if not exists idx_payments_tx_hash     on payments(tx_hash);
create index if not exists idx_payments_escrow_id   on payments(escrow_id);
create index if not exists idx_pix_e2e_id           on pix_transactions(e2e_id);
create index if not exists idx_api_keys_hash        on api_keys(key_hash);

-- ─── RLS (Row Level Security) ─────────────────────────────────────────────────
alter table api_keys          enable row level security;
alter table agents             enable row level security;
alter table payments           enable row level security;
alter table pix_transactions   enable row level security;
alter table session_keys       enable row level security;
alter table webhooks           enable row level security;
-- Service role bypasses RLS — API uses service key
