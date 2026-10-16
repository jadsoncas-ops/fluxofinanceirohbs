-- Orçamento para quem ainda não é cliente cadastrado.
-- A proposta passa a poder nascer só com o nome do interessado (prospect_*); o cadastro do cliente
-- só é exigido ao aprovar (contrato e trabalho continuam amarrados a um cliente real).
-- Aditiva e segura: nenhuma proposta existente muda (todas já têm cliente_id).

alter table public.hbs_propostas alter column cliente_id drop not null;

alter table public.hbs_propostas
  add column if not exists prospect_nome text,
  add column if not exists prospect_documento text,
  add column if not exists prospect_contato text;

-- Toda proposta precisa identificar alguém: cliente cadastrado OU o nome do interessado.
alter table public.hbs_propostas
  add constraint hbs_propostas_cliente_ou_prospect
  check (cliente_id is not null or nullif(btrim(prospect_nome), '') is not null);
