-- Anexo IV — Registro fotográfico da Avaliação. Fotos guardadas como data URI dentro do jsonb
-- (mesmo padrão da logo timbrada), sem storage externo. fotos_por_pagina controla o layout de
-- impressão: '2' = par lado a lado (fotos maiores, horizontal), '4' = grade 2x2 (vertical).
alter table public.hbs_avaliacoes add column fotos jsonb not null default '[]'::jsonb;
alter table public.hbs_avaliacoes add column fotos_por_pagina text not null default '4';
