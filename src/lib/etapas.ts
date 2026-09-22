import { TrabalhoEtapa } from './types';

/** Explicação de 1 frase por etapa do Kanban de Trabalhos — HBS 2.1. Fonte única pra não deixar o
 *  texto divergir entre TrabalhosPage, TrabalhoDetailPage e Dashboard, que já duplicam o mapa de
 *  cor (ETAPA_TONE) localmente por decisão anterior. Isso aqui é conteúdo, não lógica visual —
 *  extrair separado não conflita com "não virar util compartilhado ainda". */
export const ETAPA_DESCRICAO: Record<TrabalhoEtapa, string> = {
  'Aguardando cliente': 'O próximo passo depende de uma informação, documento ou ação do cliente.',
  Levantamento: 'Coleta de dados e documentos do imóvel antes de dar entrada no processo.',
  Tramitando: 'Processo enviado e em análise pelo órgão ou cartório.',
  Devolutiva: 'Aguardando retorno, análise ou manifestação do órgão responsável.',
  Concluído: 'Trabalho finalizado e entregue ao cliente.',
};
