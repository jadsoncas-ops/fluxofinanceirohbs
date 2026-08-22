import { ComparavelAvaliacao } from '@/lib/types';

/** Extração "momentânea" (sem IA/servidor): você cola o texto de um anúncio, ou uma tabela/lista
 *  gerada por um chat de IA externo (ChatGPT, etc.), e isto tenta separar em comparáveis por regex —
 *  nada de rede, roda no navegador. Endereço e anunciante em texto livre não têm padrão confiável pra
 *  extrair sozinho quando não vêm de uma tabela, então ficam em branco pra revisão manual nesse caso. */
export type AnuncioExtraido = Partial<Omit<ComparavelAvaliacao, 'id'>>;

function parseMoedaBr(texto: string): number {
  // "4.000,00" -> 4000.00 · "1.800" -> 1800 · "550" -> 550
  const semMilhar = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto.replace(/\./g, '');
  return parseFloat(semMilhar);
}

/** Um único anúncio em texto livre (copiado de um site de imóveis). */
export function extrairDadosAnuncio(texto: string): AnuncioExtraido {
  const resultado: AnuncioExtraido = {};

  const valorMatch = texto.match(/R\$\s*([\d.]{1,10}(?:,\d{2})?)/);
  if (valorMatch) {
    const v = parseMoedaBr(valorMatch[1]);
    if (Number.isFinite(v) && v > 0) resultado.valorAluguel = v;
  }

  const areaMatch = texto.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i);
  if (areaMatch) {
    const a = parseFloat(areaMatch[1].replace(',', '.'));
    if (Number.isFinite(a) && a > 0) resultado.areaConstruida = a;
  }

  const urlMatch = texto.match(/(https?:\/\/[^\s]+)/i);
  if (urlMatch) resultado.fonte = urlMatch[1];

  return resultado;
}

type ColunaCampo = keyof AnuncioExtraido;

function identificarColuna(cabecalho: string): ColunaCampo | null {
  const h = cabecalho.toLowerCase();
  if (h.includes('endere')) return 'endereco';
  if (h.includes('conserv')) return 'estadoConservacao';
  if (h.includes('área') || h.includes('area') || h.includes('m²') || h.includes('m2')) return 'areaConstruida';
  if (h.includes('anunc') || h.includes('corretor') || h.includes('imobili')) return 'anunciante';
  if (h.includes('valor') || h.includes('aluguel') || h.includes('preç') || h.includes('preco') || h.includes('r$')) return 'valorAluguel';
  if (h.includes('fonte') || h.includes('link') || h.includes('url')) return 'fonte';
  return null;
}

function celulaParaValor(campo: ColunaCampo, valorCelula: string): string | number | undefined {
  const limpo = valorCelula.trim().replace(/\*\*/g, '');
  if (!limpo) return undefined;
  if (campo === 'areaConstruida') {
    const m = limpo.match(/(\d+(?:[.,]\d+)?)/);
    return m ? parseFloat(m[1].replace(',', '.')) : undefined;
  }
  if (campo === 'valorAluguel') {
    const m = limpo.match(/([\d.]{1,10}(?:,\d{2})?)/);
    return m ? parseMoedaBr(m[1]) : undefined;
  }
  return limpo;
}

/** Tabela markdown (o formato padrão que o ChatGPT usa quando você pede "uma tabela"): linha de
 *  cabeçalho, linha separadora (---), depois uma linha por comparável, tudo separado por "|". */
function tentarTabelaMarkdown(linhas: string[]): AnuncioExtraido[] | null {
  const linhasTabela = linhas.filter(l => l.trim().startsWith('|') || (l.match(/\|/g)?.length ?? 0) >= 2);
  if (linhasTabela.length < 2) return null;

  const celulasDe = (linha: string) => linha.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

  const cabecalho = celulasDe(linhasTabela[0]);
  const colunas = cabecalho.map(identificarColuna);
  if (colunas.every(c => c === null)) return null;

  const linhasDados = linhasTabela.slice(1).filter(l => !/^[\s|:-]+$/.test(l));

  const resultados: AnuncioExtraido[] = [];
  for (const linha of linhasDados) {
    const celulas = celulasDe(linha);
    const item: AnuncioExtraido = {};
    colunas.forEach((campo, i) => {
      if (!campo || !celulas[i]) return;
      const v = celulaParaValor(campo, celulas[i]);
      if (v !== undefined) (item as Record<string, unknown>)[campo] = v;
    });
    if (Object.keys(item).length > 0) resultados.push(item);
  }
  return resultados.length > 0 ? resultados : null;
}

/** Ponto de entrada do "colar lista ou tabela": aceita uma tabela markdown (ChatGPT/Claude/etc.),
 *  ou, se não achar uma tabela, tenta uma linha por comparável em texto livre. */
export function extrairMultiplos(texto: string): AnuncioExtraido[] {
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  if (linhas.length === 0) return [];

  const tabela = tentarTabelaMarkdown(linhas);
  if (tabela) return tabela;

  // Sem tabela: tenta uma linha por comparável (funciona bem pra listas numeradas/com marcadores).
  const porLinha = linhas
    .map(l => l.replace(/^[-•*\d.)\s]+/, ''))
    .map(extrairDadosAnuncio)
    .filter(item => item.valorAluguel || item.areaConstruida || item.fonte);
  if (porLinha.length > 0) return porLinha;

  // Nada estruturado — trata o texto inteiro como um único comparável.
  const unico = extrairDadosAnuncio(texto);
  return unico.valorAluguel || unico.areaConstruida || unico.fonte ? [unico] : [];
}
