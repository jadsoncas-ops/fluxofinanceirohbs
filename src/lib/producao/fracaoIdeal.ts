import { Unidade } from '@/lib/types';

/** Motor de fração ideal — portado verbatim do cota_saas (src/lib/fracaoIdeal.ts). Funções puras. */

export function somaUnidade(u: Unidade): number {
  return (u.areaPrivativa || 0) + (u.areaGaragem || 0) + (u.areaComum || 0);
}

export function unidadesAutonomas(units: Unidade[]): Unidade[] {
  return units.filter(u => u.autonoma !== false);
}

export function areaTotalAutonomas(units: Unidade[]): number {
  return unidadesAutonomas(units).reduce((s, u) => s + somaUnidade(u), 0);
}

export interface LinhaFracao {
  unidade: Unidade;
  soma: number;
  fracaoPct: number;
  fracaoM2: number;
}

/** fração% da unidade = soma(privativa+garagem+comum) / soma total das unidades autônomas × 100. fração m² = (fração% / 100) × terreno. */
export function calcularQuadroFracao(units: Unidade[], terreno: number): LinhaFracao[] {
  const somaTotal = areaTotalAutonomas(units);
  return unidadesAutonomas(units).map(u => {
    const soma = somaUnidade(u);
    const fracaoPct = somaTotal ? (soma / somaTotal) * 100 : 0;
    const fracaoM2 = terreno ? (fracaoPct / 100) * terreno : 0;
    return { unidade: u, soma, fracaoPct, fracaoM2 };
  });
}

/** Linha de verificação (TOTAL) do quadro — soma toda coluna; fracaoPct deve fechar em 100, fracaoM2 em terreno. */
export function verificacaoQuadro(linhas: LinhaFracao[]) {
  return linhas.reduce(
    (acc, l) => ({
      banheiros: acc.banheiros + (l.unidade.banheiros || 0),
      areaPrivativa: acc.areaPrivativa + (l.unidade.areaPrivativa || 0),
      areaGaragem: acc.areaGaragem + (l.unidade.areaGaragem || 0),
      areaComum: acc.areaComum + (l.unidade.areaComum || 0),
      soma: acc.soma + l.soma,
      fracaoM2: acc.fracaoM2 + l.fracaoM2,
      fracaoPct: acc.fracaoPct + l.fracaoPct,
    }),
    { banheiros: 0, areaPrivativa: 0, areaGaragem: 0, areaComum: 0, soma: 0, fracaoM2: 0, fracaoPct: 0 }
  );
}

/** Agrupa unidades por pavimento, preservando a ordem de inserção do array — essa ordem é a ordem canônica de impressão em todo documento. */
export function agruparPorPavimento(units: Unidade[]): Map<string, Unidade[]> {
  const map = new Map<string, Unidade[]>();
  units.forEach(u => {
    const list = map.get(u.pavimento) || [];
    list.push(u);
    map.set(u.pavimento, list);
  });
  return map;
}

/** Formatação de prosa — 2 casas decimais, vírgula (nunca diverge do que aparece na tabela). */
export function fmtProsa(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

/** Formatação de tabela — 4 casas por padrão (5 para coeficientes ABNT). */
export function fmt(n: number, casas = 4): string {
  return n.toFixed(casas).replace('.', ',');
}
