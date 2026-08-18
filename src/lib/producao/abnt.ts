import { Unidade } from '@/lib/types';
import { somaUnidade, unidadesAutonomas, areaTotalAutonomas } from './fracaoIdeal';

/** Quadros NBR 12721 (IV-A/IV-B) — portado verbatim do cota_saas (src/lib/documentos/abnt.ts). */

export interface LinhaAbnt {
  label: string;
  privativa: number;
  garagem: number;
  /** D = B + C (garagem entra como área privativa aqui, não como área comum). */
  privativaTotal: number;
  comum: number;
  /** F = D + E */
  areaReal: number;
  /** área privativa total × valor unitário de referência (CUB ou valor adotado). */
  custo: number;
  /** Quadro IV-A — coeficiente de proporcionalidade sobre o custo. */
  coefCusto: number;
  /** Quadro IV-B — coeficiente de proporcionalidade sobre a área. */
  coefArea: number;
}

export function fmtMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * `valorUnitarioReferencia` é tratado como um número puro — esta função não sabe (nem precisa saber)
 * se é o CUB oficial do SINDUSCON ou um valor de referência específico adotado pelo profissional.
 * Essa distinção é só de rótulo/justificativa na tela, nunca persistida.
 */
export function calcularQuadroAbnt(units: Unidade[], valorUnitarioReferencia: number) {
  const fracUnits = unidadesAutonomas(units);
  const somaTotal = areaTotalAutonomas(units);

  const linhasBrutas = fracUnits.map(u => {
    const privativaTotal = (u.areaPrivativa || 0) + (u.areaGaragem || 0);
    return { u, privativaTotal, custo: privativaTotal * valorUnitarioReferencia };
  });
  const custoTotalGeral = linhasBrutas.reduce((s, l) => s + l.custo, 0);

  const linhas: LinhaAbnt[] = linhasBrutas.map(({ u, privativaTotal, custo }) => ({
    label: `${u.pavimento} (${u.nome})`,
    privativa: u.areaPrivativa || 0,
    garagem: u.areaGaragem || 0,
    privativaTotal,
    comum: u.areaComum || 0,
    areaReal: somaUnidade(u),
    custo,
    coefCusto: custoTotalGeral ? custo / custoTotalGeral : 0,
    coefArea: somaTotal ? somaUnidade(u) / somaTotal : 0,
  }));

  const totais = linhas.reduce(
    (acc, l) => ({
      privativa: acc.privativa + l.privativa,
      garagem: acc.garagem + l.garagem,
      privativaTotal: acc.privativaTotal + l.privativaTotal,
      comum: acc.comum + l.comum,
      areaReal: acc.areaReal + l.areaReal,
      custo: acc.custo + l.custo,
    }),
    { privativa: 0, garagem: 0, privativaTotal: 0, comum: 0, areaReal: 0, custo: 0 }
  );

  return { linhas, totais, custoTotalGeral, somaTotal };
}
