import { AvaliacaoAluguel } from '@/lib/types';
import { calcularResumoAvaliacao } from './homogeneizacao';

export interface LinhaSecretaria {
  nome: string;
  quantidade: number;
  valorMedio: number | null;
}

export interface RelatorioAvaliacoes {
  total: number;
  concluidas: number;
  rascunhos: number;
  valorMedioGeral: number | null;
  rsM2MedioGeral: number | null;
  porSecretaria: LinhaSecretaria[];
}

/** Visão geral das Avaliações — não recalcula homogeneização (reaproveita calcularResumoAvaliacao),
 *  só agrega o que já é derivado de cada laudo individual. */
export function calcularRelatorio(avaliacoes: AvaliacaoAluguel[]): RelatorioAvaliacoes {
  const resumos = avaliacoes.map(a => ({ a, resumo: calcularResumoAvaliacao(a) }));

  const valoresMedios = resumos.map(r => r.resumo.valorMedio).filter((v): v is number => v !== null);
  const rsM2s = resumos.map(r => r.resumo.mediaM2).filter((v): v is number => v !== null);

  const porSecretariaMap = new Map<string, { quantidade: number; soma: number; comValor: number }>();
  for (const { a, resumo } of resumos) {
    const nome = a.secretariaSolicitante?.trim() || 'Não informada';
    const entry = porSecretariaMap.get(nome) || { quantidade: 0, soma: 0, comValor: 0 };
    entry.quantidade += 1;
    if (resumo.valorMedio !== null) { entry.soma += resumo.valorMedio; entry.comValor += 1; }
    porSecretariaMap.set(nome, entry);
  }

  const porSecretaria: LinhaSecretaria[] = Array.from(porSecretariaMap.entries())
    .map(([nome, e]) => ({ nome, quantidade: e.quantidade, valorMedio: e.comValor > 0 ? e.soma / e.comValor : null }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return {
    total: avaliacoes.length,
    concluidas: avaliacoes.filter(a => a.status === 'Concluído').length,
    rascunhos: avaliacoes.filter(a => a.status !== 'Concluído').length,
    valorMedioGeral: valoresMedios.length > 0 ? valoresMedios.reduce((s, v) => s + v, 0) / valoresMedios.length : null,
    rsM2MedioGeral: rsM2s.length > 0 ? rsM2s.reduce((s, v) => s + v, 0) / rsM2s.length : null,
    porSecretaria,
  };
}
