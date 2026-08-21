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

/** Divide um total em N partes IDÊNTICAS (trunca pra baixo na casa decimal escolhida) — unidades de
 *  projeto iguais recebem exatamente o mesmo valor, sem distribuir 1 unidade da última casa pra
 *  "algumas" delas só pra fechar a soma. Usado pela ferramenta "Dividir área total entre as unidades"
 *  nos Dados Técnicos do Trabalho. */
export function distribuirIgualmente(total: number, n: number, casas = 4): number[] {
  if (n <= 0) return [];
  const fator = Math.pow(10, casas);
  const valor = Math.floor((total * fator) / n) / fator;
  return Array.from({ length: n }, () => valor);
}

export interface LinhaFracaoFormatada {
  areaPrivativa: string;
  areaGaragem: string;
  areaComum: string;
  soma: string;
  fracaoM2: string;
  fracaoPct: string;
}

export type ColunaFracaoIdeal = 'areaPrivativa' | 'areaGaragem' | 'areaComum' | 'soma' | 'fracaoM2' | 'fracaoPct';
/** Ajuste manual por unidade — chave é `Unidade.id`, ou `VERIFICACAO_KEY` para a própria linha de
 *  Verificação (que também pode ser aproximada manualmente, independente das linhas). */
export type QuadroFracaoOverrides = Record<string, Partial<Record<ColunaFracaoIdeal, number>>>;
export const VERIFICACAO_KEY = '__verificacao__';

/** Quantas casas decimais mostrar em cada coluna — cada uma tem sua própria precisão natural (áreas
 *  medidas em obra costumam ter menos casas que frações calculadas). Perfil padrão inspirado em como o
 *  próprio quadro sai numa planilha bem formatada. */
export type ColunaCasas = Partial<Record<ColunaFracaoIdeal, number>>;
export const CASAS_PADRAO: Record<ColunaFracaoIdeal, number> = {
  areaGaragem: 4,
  areaPrivativa: 2,
  areaComum: 2,
  soma: 4,
  fracaoM2: 4,
  fracaoPct: 2,
};

/** Formata o Quadro de Fração Ideal inteiro coluna a coluna (privativa, garagem, comum, Σ, fração m²,
 *  fração %). As LINHAS sempre usam a precisão padrão de cada coluna (`CASAS_PADRAO`) — não são
 *  ajustáveis, pra manter a leitura de cada unidade estável. Só a VERIFICAÇÃO (`casasVerificacao`) tem
 *  a precisão ajustável por coluna, igual ao botão de aumentar/diminuir casas decimais de uma planilha:
 *  ela soma os valores reais das linhas e aproxima pro tamanho escolhido — sem forçar a soma visual das
 *  linhas a bater com o total ao centavo (33,33% × 3 "parece" 99,99% mas o total real, 100,00%, é o que
 *  conta). Quando `overrides` traz um ajuste manual pra uma unidade+coluna (ou pra `VERIFICACAO_KEY`),
 *  esse valor substitui o calculado. */
export function formatarQuadroFracao(
  linhas: LinhaFracao[],
  casasVerificacao?: ColunaCasas,
  overrides?: QuadroFracaoOverrides
): { linhas: LinhaFracaoFormatada[]; verificacao: LinhaFracaoFormatada } {
  const fmtN = (n: number, campo: ColunaFracaoIdeal, casas = CASAS_PADRAO[campo]) => n.toFixed(casas).replace('.', ',');

  const coluna = (campo: ColunaFracaoIdeal, extrai: (l: LinhaFracao) => number) =>
    linhas.map(l => overrides?.[l.unidade.id]?.[campo] ?? extrai(l));

  const privCol = coluna('areaPrivativa', l => l.unidade.areaPrivativa || 0);
  const garCol = coluna('areaGaragem', l => l.unidade.areaGaragem || 0);
  const comCol = coluna('areaComum', l => l.unidade.areaComum || 0);
  const somaCol = coluna('soma', l => l.soma);
  const m2Col = coluna('fracaoM2', l => l.fracaoM2);
  const pctCol = coluna('fracaoPct', l => l.fracaoPct);

  const somaArr = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const veri = (campo: ColunaFracaoIdeal, arr: number[]) =>
    fmtN(overrides?.[VERIFICACAO_KEY]?.[campo] ?? somaArr(arr), campo, casasVerificacao?.[campo] ?? CASAS_PADRAO[campo]);

  return {
    linhas: linhas.map((_, i) => ({
      areaPrivativa: fmtN(privCol[i], 'areaPrivativa'),
      areaGaragem: fmtN(garCol[i], 'areaGaragem'),
      areaComum: fmtN(comCol[i], 'areaComum'),
      soma: fmtN(somaCol[i], 'soma'),
      fracaoM2: fmtN(m2Col[i], 'fracaoM2'),
      fracaoPct: fmtN(pctCol[i], 'fracaoPct'),
    })),
    verificacao: {
      areaPrivativa: veri('areaPrivativa', privCol),
      areaGaragem: veri('areaGaragem', garCol),
      areaComum: veri('areaComum', comCol),
      soma: veri('soma', somaCol),
      fracaoM2: veri('fracaoM2', m2Col),
      fracaoPct: veri('fracaoPct', pctCol),
    },
  };
}

/** Formatação de prosa — 2 casas decimais, vírgula (nunca diverge do que aparece na tabela). */
export function fmtProsa(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

/** Formatação de tabela — 4 casas por padrão. Parece "demais" à primeira vista, mas é o que evita um
 *  problema pior: comprimir pra 2 casas obriga a regra do maior resto a criar uma diferença de 0,01
 *  (100 cm²) entre unidades fisicamente idênticas pra fechar a soma — o que parece um erro de projeto
 *  pra quem revisa. Em 4 casas, unidades iguais na origem continuam idênticas na tabela, e só a dízima
 *  genuína (ex.: dividir uma área em 3) aparece — na 4ª casa, 0,0001, imperceptível. Coeficientes do
 *  Quadro ABNT continuam em 5 casas (passam `casas` explícito). */
export function fmt(n: number, casas = 4): string {
  return n.toFixed(casas).replace('.', ',');
}
