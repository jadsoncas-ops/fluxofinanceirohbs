/** Extração "momentânea" (sem IA/servidor): você cola o texto copiado do anúncio (OLX, Zap, Wimóveis…)
 *  e isto tenta achar valor do aluguel, área e o link, por regex — nada de rede, roda no navegador.
 *  Endereço e anunciante não têm um padrão confiável pra extrair sozinho, então ficam para revisão manual. */
export interface AnuncioExtraido {
  valorAluguel?: number;
  areaConstruida?: number;
  fonte?: string;
}

function parseMoedaBr(texto: string): number {
  // "4.000,00" -> 4000.00 · "1.800" -> 1800 · "550" -> 550
  const semMilhar = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto.replace(/\./g, '');
  return parseFloat(semMilhar);
}

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
