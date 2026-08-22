-- ============================================================================
-- Compromissos — reunião/visita agendada com horário, separado de Tarefas
-- (que são "o que precisa ser feito", sem horário). Usado no widget de
-- agenda semanal da dashboard.
-- ============================================================================

create table public.hbs_compromissos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  data date not null,
  hora_inicio time,
  hora_fim time,
  com_quem text,
  cliente_id uuid references public.hbs_clients(id) on delete set null,
  process_id uuid references public.hbs_processes(id) on delete set null,
  cor text not null default 'roxo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger set_updated_at before update on public.hbs_compromissos
  for each row execute function public.hbs_update_updated_at_column();

create index idx_hbs_compromissos_data on public.hbs_compromissos(data);
create index idx_hbs_compromissos_cliente_id on public.hbs_compromissos(cliente_id);

alter table public.hbs_compromissos enable row level security;
create policy "authenticated_all" on public.hbs_compromissos for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.hbs_compromissos;
