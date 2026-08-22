import { AnuenciaData, Client, Process } from '@/lib/types';

const PLACEHOLDER = 'Informação necessária para geração.';

/** Dados iniciais: usa o que já foi salvo neste Trabalho (edição), senão pré-preenche só os dados do
 *  proprietário/imóvel a partir do Trabalho — o declarante é sempre um terceiro (confrontante), nunca o cliente,
 *  então não há como auto-preencher aquela parte. */
export function dadosIniciaisAnuencia(trabalho: Process, cliente: Client | undefined): AnuenciaData {
  if (trabalho.anuencia) return trabalho.anuencia;
  return {
    proprietarioNome: cliente?.nome || undefined,
    imovelEndereco: trabalho.endereco || undefined,
    matricula: trabalho.tecnico?.matricula || undefined,
    cidade: 'Itabuna',
    comarca: 'Itabuna',
    dataDocumento: new Date().toISOString().slice(0, 10),
  };
}

export interface AnuenciaDoc {
  declaranteNome: string;
  declaranteCpf: string;
  proprietarioNome: string;
  imovelEndereco: string;
  matricula: string;
  cartorio: string;
  comarca: string;
  cidade: string;
  data: string;
}

export function montarAnuencia(data: AnuenciaData): AnuenciaDoc {
  return {
    declaranteNome: data.declaranteNome?.trim() || PLACEHOLDER,
    declaranteCpf: data.declaranteCpf?.trim() || PLACEHOLDER,
    proprietarioNome: data.proprietarioNome?.trim() || PLACEHOLDER,
    imovelEndereco: data.imovelEndereco?.trim() || PLACEHOLDER,
    matricula: data.matricula?.trim() || PLACEHOLDER,
    cartorio: data.cartorio?.trim() || 'Cartório de Registro de Imóveis',
    comarca: data.comarca?.trim() || 'Itabuna',
    cidade: data.cidade?.trim() || 'Itabuna',
    data: data.dataDocumento ? new Date(data.dataDocumento + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
  };
}
