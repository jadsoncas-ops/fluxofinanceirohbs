import { AvaliacaoAluguel } from '@/lib/types';

/** Nova avaliação — mesmos valores padrão da migração SQL, usados ao criar direto no cliente
 *  (antes do primeiro round-trip com o Supabase) para o formulário já abrir preenchido. */
export function criarAvaliacaoPadrao(): AvaliacaoAluguel {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    entidadeSolicitante: 'Prefeitura Municipal de Itabuna',
    secretariaDestinataria: 'Secretaria de Infraestrutura e Urbanismo',
    tipoLaudo: 'Laudo Técnico de Avaliação de Aluguel de Imóvel Urbano',
    finalidade: 'Laudo de avaliação de bens para determinação do justo valor locatício de mercado, no âmbito da Administração Pública Municipal.',
    municipioUf: 'Itabuna/BA',
    grauFundamentacao: 'Grau II',
    metodologiaAplicada: 'Método Comparativo Direto de Dados de Mercado',
    dataReferencia: new Date().toISOString(),
    estadoConservacao: 'O imóvel se encontra com estado de conservação regular, não havendo necessidade de custos de adaptação por parte do locatário/município, considerando que o locador entregará o imóvel em condições adequadas de uso.',
    responsavelNome: 'Jádson Castro Santana',
    responsavelRegistro: 'Engenheiro Civil – CREA-BA nº 051598661-5',
    fatorRedutorPercent: 10,
    comparaveis: [],
    cidadeAssinatura: 'Itabuna',
    dataAssinatura: new Date().toISOString().slice(0, 10),
    status: 'Rascunho',
    createdAt: now,
    updatedAt: now,
  };
}

export function novoComparavel() {
  return { id: crypto.randomUUID() };
}
