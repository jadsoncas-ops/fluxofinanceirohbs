-- Logo timbrada (Prefeitura/Secretaria/CIUB) exibida no topo do documento de Avaliação —
-- guardada como data URI, preenchida pelo usuário direto na tela da avaliação.
alter table public.hbs_avaliacoes add column logo_url text;
