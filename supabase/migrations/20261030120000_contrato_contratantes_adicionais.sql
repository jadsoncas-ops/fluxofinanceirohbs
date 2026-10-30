-- Mais de um contratante por contrato.
-- O cliente principal continua em hbs_contratos.cliente_id (financeiro e cobrança ficam nele);
-- os demais contratantes ficam aqui, como foto da qualificação no momento do contrato:
-- [{ "nome": "...", "documento": "...", "estadoCivil": "...", "profissao": "...", "conjugeNome": "...", "endereco": "..." }]
-- Aditiva e segura: nenhum contrato existente muda.

alter table public.hbs_contratos add column if not exists contratantes_adicionais jsonb;
