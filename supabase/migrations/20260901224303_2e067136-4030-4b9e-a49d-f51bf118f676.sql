drop table if exists public.hbs_transactions cascade;

create table public.hbs_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  role text not null default 'admin' check (role in ('admin', 'membro')),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.hbs_profiles to authenticated;
grant all on public.hbs_profiles to service_role;

create table public.hbs_app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.hbs_app_settings to authenticated;
grant all on public.hbs_app_settings to service_role;

create table public.hbs_clients (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text,
  documento text,
  telefone jsonb,
  endereco jsonb,
  descricao text,
  qualificacao jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.hbs_clients to authenticated;
grant all on public.hbs_clients to service_role;

create table public.hbs_processes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.hbs_clients(id) on delete cascade,
  objeto text not null,
  status text not null,
  etapa text,
  tipo_trabalho text,
  endereco text,
  prazo date,
  protocolo text,
  data_protocolo date,
  valor_contrato numeric(12,2),
  drive_link text,
  is_archived boolean not null default false,
  notas jsonb not null default '[]'::jsonb,
  tecnico jsonb,
  contrato_id uuid,
  averbacao jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.hbs_processes to authenticated;
grant all on public.hbs_processes to service_role;

create table public.hbs_tasks (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  status text not null default 'Pendente',
  prioridade text not null default 'Média',
  prazo date,
  process_id uuid references public.hbs_processes(id) on delete cascade,
  cliente_id uuid references public.hbs_clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.hbs_tasks to authenticated;
grant all on public.hbs_tasks to service_role;

create table public.hbs_accounts (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null,
  saldo numeric(12,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.hbs_accounts to authenticated;
grant all on public.hbs_accounts to service_role;

create table public.hbs_partners (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  contato text,
  observacao text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.hbs_partners to authenticated;
grant all on public.hbs_partners to service_role;

create table public.hbs_documents (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cliente_id uuid references public.hbs_clients(id) on delete set null,
  process_id uuid references public.hbs_processes(id) on delete set null,
  tipo_tecnico text,
  versao text,
  situacao text not null,
  link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.hbs_documents to authenticated;
grant all on public.hbs_documents to service_role;

create table public.hbs_transactions (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  tipo text not null check (tipo in ('Entrada', 'Saída', 'A Receber', 'A Pagar')),
  categoria text not null,
  descricao text not null,
  valor numeric(12,2) not null check (valor > 0),
  status text not null default 'Pendente' check (status in ('Pendente', 'Concluído', 'Parcial')),
  is_repasse boolean not null default false,
  parent_id uuid references public.hbs_transactions(id) on delete cascade,
  partner_id uuid references public.hbs_partners(id) on delete set null,
  cliente_id uuid references public.hbs_clients(id) on delete set null,
  process_id uuid references public.hbs_processes(id) on delete cascade,
  previsao_data date,
  original_total numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.hbs_transactions to authenticated;
grant all on public.hbs_transactions to service_role;

create table public.hbs_propostas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  cliente_id uuid not null references public.hbs_clients(id) on delete cascade,
  trabalho_id uuid references public.hbs_processes(id) on delete set null,
  titulo text not null,
  itens jsonb not null default '[]'::jsonb,
  custo_hora_base numeric(12,2) not null default 0,
  lucro_percent numeric(6,2) not null default 0,
  impostos_percent numeric(6,2) not null default 0,
  comissao_percent numeric(6,2) not null default 0,
  custos_protocolo jsonb,
  resultado jsonb not null default '{}'::jsonb,
  prazo_dias integer,
  forma_pagamento text,
  parcelas_pagamento jsonb,
  status text not null default 'Rascunho',
  enviada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.hbs_propostas to authenticated;
grant all on public.hbs_propostas to service_role;

create table public.hbs_contratos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  proposta_id uuid not null references public.hbs_propostas(id) on delete cascade,
  cliente_id uuid not null references public.hbs_clients(id) on delete cascade,
  trabalho_id uuid references public.hbs_processes(id) on delete set null,
  valor numeric(12,2) not null,
  parcelas jsonb not null default '[]'::jsonb,
  status text not null default 'Ativo',
  assinado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.hbs_contratos to authenticated;
grant all on public.hbs_contratos to service_role;

create table public.hbs_historico_events (
  id uuid primary key default gen_random_uuid(),
  modulo text not null,
  texto text not null,
  cliente_id uuid references public.hbs_clients(id) on delete set null,
  trabalho_id uuid references public.hbs_processes(id) on delete set null,
  proposta_id uuid references public.hbs_propostas(id) on delete set null,
  contrato_id uuid references public.hbs_contratos(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.hbs_historico_events to authenticated;
grant all on public.hbs_historico_events to service_role;

create sequence public.hbs_proposta_codigo_seq start with 88;
create sequence public.hbs_contrato_codigo_seq start with 58;
grant usage on sequence public.hbs_proposta_codigo_seq to authenticated;
grant usage on sequence public.hbs_contrato_codigo_seq to authenticated;

create or replace function public.hbs_next_proposta_codigo()
returns text
language sql
as $$
  select 'PRP-' || lpad(nextval('public.hbs_proposta_codigo_seq')::text, 4, '0');
$$;

create or replace function public.hbs_next_contrato_codigo()
returns text
language sql
as $$
  select 'CTR-' || lpad(nextval('public.hbs_contrato_codigo_seq')::text, 4, '0');
$$;

grant execute on function public.hbs_next_proposta_codigo() to authenticated;
grant execute on function public.hbs_next_contrato_codigo() to authenticated;

create or replace function public.hbs_check_invite_code(code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.hbs_app_settings
    where key = 'invite_code' and value ->> 'code' = code
  );
$$;

grant execute on function public.hbs_check_invite_code(text) to anon, authenticated;

create or replace function public.hbs_profiles_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer from public.hbs_profiles;
$$;

grant execute on function public.hbs_profiles_count() to anon, authenticated;

insert into public.hbs_app_settings (key, value) values
  ('invite_code', '{"code":"HBS-ENG-4471"}'::jsonb),
  ('company_config', '{}'::jsonb),
  ('precificacao_config', '{}'::jsonb)
on conflict (key) do nothing;

create or replace function public.hbs_update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger set_updated_at before update on public.hbs_processes
  for each row execute function public.hbs_update_updated_at_column();
create trigger set_updated_at before update on public.hbs_tasks
  for each row execute function public.hbs_update_updated_at_column();
create trigger set_updated_at before update on public.hbs_documents
  for each row execute function public.hbs_update_updated_at_column();
create trigger set_updated_at before update on public.hbs_transactions
  for each row execute function public.hbs_update_updated_at_column();
create trigger set_updated_at before update on public.hbs_propostas
  for each row execute function public.hbs_update_updated_at_column();
create trigger set_updated_at before update on public.hbs_contratos
  for each row execute function public.hbs_update_updated_at_column();
create trigger set_updated_at before update on public.hbs_app_settings
  for each row execute function public.hbs_update_updated_at_column();

create index idx_hbs_processes_cliente_id on public.hbs_processes(cliente_id);
create index idx_hbs_tasks_process_id on public.hbs_tasks(process_id);
create index idx_hbs_tasks_cliente_id on public.hbs_tasks(cliente_id);
create index idx_hbs_transactions_cliente_id on public.hbs_transactions(cliente_id);
create index idx_hbs_transactions_process_id on public.hbs_transactions(process_id);
create index idx_hbs_transactions_parent_id on public.hbs_transactions(parent_id);
create index idx_hbs_transactions_data on public.hbs_transactions(data);
create index idx_hbs_documents_cliente_id on public.hbs_documents(cliente_id);
create index idx_hbs_documents_process_id on public.hbs_documents(process_id);
create index idx_hbs_propostas_cliente_id on public.hbs_propostas(cliente_id);
create index idx_hbs_contratos_cliente_id on public.hbs_contratos(cliente_id);
create index idx_hbs_historico_cliente_id on public.hbs_historico_events(cliente_id);
create index idx_hbs_historico_trabalho_id on public.hbs_historico_events(trabalho_id);
create index idx_hbs_historico_created_at on public.hbs_historico_events(created_at desc);

alter table public.hbs_clients enable row level security;
alter table public.hbs_processes enable row level security;
alter table public.hbs_tasks enable row level security;
alter table public.hbs_accounts enable row level security;
alter table public.hbs_partners enable row level security;
alter table public.hbs_documents enable row level security;
alter table public.hbs_transactions enable row level security;
alter table public.hbs_propostas enable row level security;
alter table public.hbs_contratos enable row level security;
alter table public.hbs_historico_events enable row level security;
alter table public.hbs_app_settings enable row level security;
alter table public.hbs_profiles enable row level security;

create policy "authenticated_all" on public.hbs_clients for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.hbs_processes for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.hbs_tasks for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.hbs_accounts for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.hbs_partners for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.hbs_documents for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.hbs_transactions for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.hbs_propostas for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.hbs_contratos for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.hbs_historico_events for all to authenticated using (true) with check (true);

create policy "authenticated_read" on public.hbs_app_settings for select to authenticated using (true);
create policy "authenticated_update" on public.hbs_app_settings for update to authenticated using (true) with check (true);
create policy "authenticated_insert" on public.hbs_app_settings for insert to authenticated with check (true);

create policy "profiles_select_all" on public.hbs_profiles for select to authenticated using (true);
create policy "profiles_insert_self_limited" on public.hbs_profiles for insert to authenticated
  with check (auth.uid() = id and (select count(*) from public.hbs_profiles) < 5);
create policy "profiles_update_self" on public.hbs_profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

alter publication supabase_realtime add table
  public.hbs_clients, public.hbs_processes, public.hbs_tasks, public.hbs_accounts,
  public.hbs_partners, public.hbs_documents, public.hbs_transactions, public.hbs_propostas,
  public.hbs_contratos, public.hbs_historico_events, public.hbs_profiles, public.hbs_app_settings;