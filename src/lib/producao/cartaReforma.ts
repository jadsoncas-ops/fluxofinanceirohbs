import { CartaReformaData, CompanyConfig, Process } from '@/lib/types';

export const SERVICOS_PADRAO: string[] = [
  'Serviços de pintura interna e externa',
  'Revisão e manutenção da cobertura, incluindo verificação e substituição pontual de telhas quando necessário',
  'Instalação e manutenção de corrimões',
  'Instalação de sinalização de emergência e combate a incêndio, conforme normas de segurança aplicáveis',
];

/** Dados iniciais: usa o que já foi salvo neste Trabalho (edição), senão parte da lista padrão de serviços da HBS. */
export function dadosIniciaisCartaReforma(trabalho: Process): CartaReformaData {
  if (trabalho.cartaReforma) return trabalho.cartaReforma;
  return {
    servicos: [...SERVICOS_PADRAO],
    cidade: 'Itabuna',
    dataDocumento: new Date().toISOString().slice(0, 10),
  };
}

export interface CartaReformaDoc {
  servicos: string[];
  observacoes: string;
  cidade: string;
  data: string;
  responsavelNome: string;
  responsavelCrea: string;
}

export function montarCartaReforma(data: CartaReformaData, config: CompanyConfig): CartaReformaDoc {
  return {
    servicos: (data.servicos || []).filter(s => s.trim().length > 0),
    observacoes: data.observacoes?.trim() || '',
    cidade: data.cidade?.trim() || 'Itabuna',
    data: data.dataDocumento ? new Date(data.dataDocumento + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    responsavelNome: config.responsavelNome || '(configure em Configurações)',
    responsavelCrea: config.responsavelCrea || '',
  };
}
