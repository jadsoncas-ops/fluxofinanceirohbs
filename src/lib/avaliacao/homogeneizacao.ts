import { AvaliacaoAluguel, ComparavelAvaliacao } from '@/lib/types';

export interface ComparavelCalculado extends ComparavelAvaliacao {
  valorFatorReducao: number;
  valorAplicado: number;
  valorM2: number | null;
}

export interface ResumoAvaliacao {
  comparaveis: ComparavelCalculado[];
  totalM2: number;
  mediaM2: number | null;
  valorMedio: number | null;
  valorMinimo: number | null;
  valorMaximo: number | null;
}

/** Homogeneização simplificada (o mesmo método já usado nos laudos reais da CIUB/Prefeitura):
 *  aplica um fator redutor fixo de negociação sobre o valor anunciado, divide pela área do
 *  comparável para achar o R$/m², e tira a média simples entre os comparáveis válidos. O valor
 *  do imóvel avaliado é essa média multiplicada pela área dele, com min/máx em ±10%. */
export function calcularResumoAvaliacao(avaliacao: Pick<AvaliacaoAluguel, 'comparaveis' | 'fatorRedutorPercent' | 'areaConstruida'>): ResumoAvaliacao {
  const fator = (avaliacao.fatorRedutorPercent ?? 10) / 100;

  const comparaveis: ComparavelCalculado[] = (avaliacao.comparaveis || []).map(c => {
    const valorAluguel = c.valorAluguel || 0;
    const valorFatorReducao = valorAluguel * fator;
    const valorAplicado = valorAluguel - valorFatorReducao;
    // Arredonda para centavos aqui (não só na exibição) porque o TOTAL/MÉDIA soma os R$/m² já
    // arredondados linha a linha — mesma convenção das planilhas de homogeneização usadas nos
    // laudos reais, evitando que o total exibido divirja em centavos do que uma soma manual daria.
    const valorM2 = c.areaConstruida && c.areaConstruida > 0 ? Math.round((valorAplicado / c.areaConstruida) * 100) / 100 : null;
    return { ...c, valorFatorReducao, valorAplicado, valorM2 };
  });

  const validos = comparaveis.filter(c => c.valorM2 !== null) as (ComparavelCalculado & { valorM2: number })[];
  const totalM2 = validos.reduce((s, c) => s + c.valorM2, 0);
  const mediaM2 = validos.length > 0 ? totalM2 / validos.length : null;

  const area = avaliacao.areaConstruida || 0;
  const valorMedio = mediaM2 !== null && area > 0 ? mediaM2 * area : null;
  const valorMinimo = valorMedio !== null ? valorMedio * 0.9 : null;
  const valorMaximo = valorMedio !== null ? valorMedio * 1.1 : null;

  return { comparaveis, totalM2, mediaM2, valorMedio, valorMinimo, valorMaximo };
}

export function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function valorPorExtenso(v: number): string {
  // Extenso simplificado — cobre a faixa usual de aluguéis (até milhões), sem depender de lib externa.
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dez_dezenove = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function grupoAte999(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100);
    const resto = n % 100;
    const partes: string[] = [];
    if (c > 0) partes.push(centenas[c]);
    if (resto > 0) {
      if (resto < 10) partes.push(unidades[resto]);
      else if (resto < 20) partes.push(dez_dezenove[resto - 10]);
      else {
        const d = Math.floor(resto / 10);
        const u = resto % 10;
        partes.push(u > 0 ? `${dezenas[d]} e ${unidades[u]}` : dezenas[d]);
      }
    }
    return partes.join(' e ');
  }

  const inteiro = Math.floor(v);
  const centavos = Math.round((v - inteiro) * 100);

  if (inteiro === 0) return centavos > 0 ? `${grupoAte999(centavos)} centavo${centavos !== 1 ? 's' : ''}` : 'zero reais';

  const milhoes = Math.floor(inteiro / 1_000_000);
  const milhares = Math.floor((inteiro % 1_000_000) / 1000);
  const unidadesGrupo = inteiro % 1000;

  const partes: string[] = [];
  if (milhoes > 0) partes.push(`${grupoAte999(milhoes)} milh${milhoes === 1 ? 'ão' : 'ões'}`);
  if (milhares > 0) partes.push(`${milhares === 1 ? 'mil' : `${grupoAte999(milhares)} mil`}`);
  if (unidadesGrupo > 0) partes.push(grupoAte999(unidadesGrupo));

  const textoReais = `${partes.join(', ').replace(/,([^,]*)$/, ' e$1')} ${inteiro === 1 ? 'real' : 'reais'}`;
  const textoCentavos = centavos > 0 ? `${grupoAte999(centavos)} centavo${centavos !== 1 ? 's' : ''}` : '';
  return textoCentavos ? `${textoReais} e ${textoCentavos}` : textoReais;
}
