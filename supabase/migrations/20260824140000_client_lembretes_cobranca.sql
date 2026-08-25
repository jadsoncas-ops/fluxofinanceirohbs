-- Troca o "último lembrete" (um valor só) por um histórico completo de cobranças enviadas —
-- cada marcação de "já cobrei" vira um timestamp na lista, pra mostrar 1ª/2ª/3ª cobrança e
-- aparecer no calendário da Agenda no dia em que cada uma foi enviada.
alter table public.hbs_clients drop column if exists ultimo_lembrete_em;
alter table public.hbs_clients add column lembretes_cobranca jsonb not null default '[]'::jsonb;
