import { TrabalhoEtapa } from './types';

/** Explicação de 1 frase por etapa do Kanban de Trabalhos — HBS 2.1.1. Fonte única pra não deixar o
 *  texto divergir entre TrabalhosPage, TrabalhoDetailPage e Dashboard, que já duplicam o mapa de
 *  cor (ETAPA_TONE) localmente por decisão anterior. Isso aqui é conteúdo, não lógica visual —
 *  extrair separado não conflita com "não virar util compartilhado ainda". */
export const ETAPA_DESCRICAO: Record<TrabalhoEtapa, string> = {
  'Aguardando cliente': 'O próximo passo depende de uma informação, documento ou ação do cliente.',
  'Elaboração': 'Coleta de dados e elaboração do projeto/documentação antes de dar entrada no processo.',
  'Tramitando prefeitura': 'Protocolo enviado e em análise na prefeitura.',
  'Tramitando cartório': 'Protocolo enviado e em análise no cartório de registro.',
  'Pendência/Exigência': 'Voltou com exigência da prefeitura ou do cartório, aguardando correção/resposta.',
  'Concluído': 'Trabalho finalizado e entregue ao cliente.',
};
