-- ============================================================================
-- Avaliações de aluguel de imóvel urbano (Prefeitura/CIUB) — ferramenta
-- independente de Clientes/Trabalhos: o "cliente" aqui é uma Secretaria
-- Municipal, não um cliente da HBS. Segue o modelo NBR 14653 (Método
-- Comparativo Direto de Dados de Mercado) já usado nos laudos reais.
-- ============================================================================

create table public.hbs_avaliacoes (
  id uuid primary key default gen_random_uuid(),

  entidade_solicitante text not null default 'Prefeitura Municipal de Itabuna',
  secretaria_solicitante text,
  secretaria_destinataria text default 'Secretaria de Infraestrutura e Urbanismo',
  tipo_laudo text not null default 'Laudo Técnico de Avaliação de Aluguel de Imóvel Urbano',
  finalidade text default 'Laudo de avaliação de bens para determinação do justo valor locatício de mercado, no âmbito da Administração Pública Municipal.',

  endereco_imovel text,
  municipio_uf text default 'Itabuna/BA',
  grau_fundamentacao text default 'Grau II',
  proprietario text,
  metodologia_aplicada text default 'Método Comparativo Direto de Dados de Mercado',
  tipo_imovel text,
  area_construida numeric,
  data_referencia timestamptz default now(),
  destinacao_uso text,

  uso_predominante text,
  tipologia text,
  numero_pavimentos integer,
  padrao_construtivo text,
  estado_conservacao text default 'O imóvel se encontra com estado de conservação regular, não havendo necessidade de custos de adaptação por parte do locatário/município, considerando que o locador entregará o imóvel em condições adequadas de uso.',
  observacoes_adicionais text,

  responsavel_nome text default 'Jádson Castro Santana',
  responsavel_registro text default 'Engenheiro Civil – CREA-BA nº 051598661-5',
  colaborador_nome text,
  colaborador_registro text,
  avaliador_nome text,
  avaliador_registro text,

  fator_redutor_percent numeric not null default 10,
  comparaveis jsonb not null default '[]'::jsonb,

  cidade_assinatura text default 'Itabuna',
  data_assinatura date default current_date,
  status text not null default 'Rascunho',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger set_updated_at before update on public.hbs_avaliacoes
  for each row execute function public.hbs_update_updated_at_column();

create index idx_hbs_avaliacoes_status on public.hbs_avaliacoes(status);

alter table public.hbs_avaliacoes enable row level security;
create policy "authenticated_all" on public.hbs_avaliacoes for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.hbs_avaliacoes;
