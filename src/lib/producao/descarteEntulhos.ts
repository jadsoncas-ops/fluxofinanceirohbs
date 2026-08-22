import { CompanyConfig, DescarteEntulhosData, Process } from '@/lib/types';

/** Dados iniciais: usa o que já foi salvo neste Trabalho (edição), senão parte de hoje/Itabuna. */
export function dadosIniciaisDescarteEntulhos(trabalho: Process): DescarteEntulhosData {
  if (trabalho.descarteEntulhos) return trabalho.descarteEntulhos;
  return {
    cidade: 'Itabuna',
    dataDocumento: new Date().toISOString().slice(0, 10),
  };
}

export interface DescarteEntulhosDoc {
  cidade: string;
  data: string;
  responsavelNome: string;
  responsavelCrea: string;
}

export function montarDescarteEntulhos(data: DescarteEntulhosData, config: CompanyConfig): DescarteEntulhosDoc {
  return {
    cidade: data.cidade?.trim() || 'Itabuna',
    data: data.dataDocumento ? new Date(data.dataDocumento + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    responsavelNome: config.responsavelNome || '(configure em Configurações)',
    responsavelCrea: config.responsavelCrea || '',
  };
}
