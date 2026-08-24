-- Nota opcional sobre parceiro (ex.: despachante) cujo honorário está embutido no valor total da
-- proposta, mas que atua de forma independente da HBS — deixa isso explícito pro cliente no
-- documento impresso, sem tom agressivo.
alter table public.hbs_propostas add column observacao_parceiro text;
