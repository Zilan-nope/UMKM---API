create extension if not exists "uuid-ossp";

create table if not exists public.businesses (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  business_type text not null default 'retail',
  currency text not null default 'IDR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.datasets (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  file_name text not null,
  category text not null,
  row_count integer not null default 0,
  schema_mapping jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dataset_rows (
  id uuid primary key default uuid_generate_v4(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  row_hash text not null,
  row_data jsonb not null,
  created_at timestamptz not null default now(),
  unique(dataset_id, row_hash)
);

create table if not exists public.import_histories (
  id uuid primary key default uuid_generate_v4(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  file_name text not null,
  import_mode text not null check (import_mode in ('replace', 'append', 'merge')),
  rows_added integer not null default 0,
  rows_updated integer not null default 0,
  rows_skipped integer not null default 0,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists public.dashboard_configs (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null,
  layout_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(business_id, category)
);

alter table public.businesses enable row level security;
alter table public.datasets enable row level security;
alter table public.dataset_rows enable row level security;
alter table public.import_histories enable row level security;
alter table public.dashboard_configs enable row level security;

create policy "Owner manages own businesses"
  on public.businesses for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owner manages own datasets"
  on public.datasets for all
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

create policy "Owner manages own dataset_rows"
  on public.dataset_rows for all
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

create policy "Owner manages own import_histories"
  on public.import_histories for all
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

create policy "Owner manages own dashboard_configs"
  on public.dashboard_configs for all
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));
