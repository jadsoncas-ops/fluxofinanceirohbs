-- Marca quando o último lembrete de cobrança foi enviado a esse cliente (via WhatsApp ou marcado
-- manualmente) — só pra mostrar "já cobrado" na lista de atenção, sem vínculo com parcela específica.
alter table public.hbs_clients add column ultimo_lembrete_em timestamptz;
