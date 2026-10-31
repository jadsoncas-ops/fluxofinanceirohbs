-- Texto do contrato ajustável por serviço (objeto, fases, prazo e limite de responsabilidade).
-- { "objeto": "...", "fases": ["..."], "prazoEntrega": "...", "paragrafoUnico": "...", "testemunhas": false }
-- Aditiva e segura: nenhum contrato existente muda.

alter table public.hbs_contratos add column if not exists texto_personalizado jsonb;
