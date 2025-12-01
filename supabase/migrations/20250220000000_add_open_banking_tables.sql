-- Enable RLS
alter table if exists bank_connections enable row level security;
alter table if exists bank_transactions enable row level security;

-- 1. Table: bank_connections
create table if not exists bank_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  institution_id text not null,
  institution_name text not null,
  institution_logo text,
  requisition_id text not null unique,
  agreement_id text not null,
  status text default 'created', -- created, linked, expired, error
  accounts jsonb default '[]'::jsonb, -- Stocke IDs et métadonnées des comptes
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_synced_at timestamptz
);

-- RLS Policies for bank_connections
create policy "Users can view their own bank connections"
  on bank_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert their own bank connections"
  on bank_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own bank connections"
  on bank_connections for update
  using (auth.uid() = user_id);

create policy "Users can delete their own bank connections"
  on bank_connections for delete
  using (auth.uid() = user_id);

-- 2. Table: bank_transactions
create table if not exists bank_transactions (
  id uuid default gen_random_uuid() primary key,
  connection_id uuid references bank_connections(id) on delete cascade not null,
  external_id text not null,
  booking_date date not null,
  amount decimal(10,2) not null,
  currency text default 'EUR',
  description text,
  remittance_information text,
  category text,
  status text default 'pending', -- pending, matched, ignored, manual
  match_confidence_score float, -- 0.0 à 1.0
  matched_invoice_id uuid references invoices(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Unique constraint to prevent duplicate transactions
create unique index if not exists idx_bank_transactions_external_id 
  on bank_transactions(connection_id, external_id);

-- RLS Policies for bank_transactions
-- On utilise une jointure implicite via connection_id pour vérifier le propriétaire
create policy "Users can view transactions of their connections"
  on bank_transactions for select
  using (
    exists (
      select 1 from bank_connections
      where bank_connections.id = bank_transactions.connection_id
      and bank_connections.user_id = auth.uid()
    )
  );

-- Seul le backend (service role) devrait idéalement insérer des transactions, 
-- mais pour le MVP/dev on peut autoriser l'insert si la connexion appartient au user
create policy "Users can insert transactions into their connections"
  on bank_transactions for insert
  with check (
    exists (
      select 1 from bank_connections
      where bank_connections.id = connection_id
      and bank_connections.user_id = auth.uid()
    )
  );

