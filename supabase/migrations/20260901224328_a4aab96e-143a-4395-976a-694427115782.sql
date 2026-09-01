create or replace function public.hbs_next_proposta_codigo()
returns text
language sql
set search_path = public
as $$
  select 'PRP-' || lpad(nextval('public.hbs_proposta_codigo_seq')::text, 4, '0');
$$;

create or replace function public.hbs_next_contrato_codigo()
returns text
language sql
set search_path = public
as $$
  select 'CTR-' || lpad(nextval('public.hbs_contrato_codigo_seq')::text, 4, '0');
$$;