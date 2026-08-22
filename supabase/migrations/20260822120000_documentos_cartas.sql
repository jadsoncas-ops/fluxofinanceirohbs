-- ============================================================================
-- Dados persistidos dos 4 novos geradores de carta/declaração da Produção
-- Técnica (Procuração, Carta de Reforma Simples, Declaração de Anuência,
-- Descarte de Entulhos) — mesmo padrão da coluna `averbacao` já existente.
-- ============================================================================

alter table public.hbs_processes add column procuracao jsonb;
alter table public.hbs_processes add column carta_reforma jsonb;
alter table public.hbs_processes add column anuencia jsonb;
alter table public.hbs_processes add column descarte_entulhos jsonb;
