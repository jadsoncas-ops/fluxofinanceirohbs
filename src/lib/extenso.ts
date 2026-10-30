/** Valor em reais por extenso ("mil e quinhentos reais e cinquenta centavos") — usado nos contratos. */

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

/** 1 a 999. */
function ate999(n: number): string {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 20) partes.push(UNIDADES[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(' e ');
}

/** Inteiro não negativo (até 999.999.999.999) por extenso. Os grupos (bilhões, milhões, mil, unidades) vão
 *  separados por espaço; o "e" entra só antes do último grupo, e só quando ele é menor que 100 ou centena
 *  redonda ("mil e quinhentos", "dois mil trezentos e quarenta", "um milhão e duzentos mil"). */
export function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  const g = [Math.floor(n / 1e9), Math.floor((n % 1e9) / 1e6), Math.floor((n % 1e6) / 1e3), n % 1e3];
  const grupos: { valor: number; texto: string }[] = [];
  if (g[0]) grupos.push({ valor: g[0], texto: `${ate999(g[0])} ${g[0] === 1 ? 'bilhão' : 'bilhões'}` });
  if (g[1]) grupos.push({ valor: g[1], texto: `${ate999(g[1])} ${g[1] === 1 ? 'milhão' : 'milhões'}` });
  if (g[2]) grupos.push({ valor: g[2], texto: g[2] === 1 ? 'mil' : `${ate999(g[2])} mil` });
  if (g[3]) grupos.push({ valor: g[3], texto: ate999(g[3]) });

  const ultimo = grupos[grupos.length - 1];
  if (grupos.length === 1) return ultimo.texto;
  const antes = grupos.slice(0, -1).map(x => x.texto).join(' ');
  return ultimo.valor < 100 || ultimo.valor % 100 === 0 ? `${antes} e ${ultimo.texto}` : `${antes} ${ultimo.texto}`;
}

/** "R$ 1.500,50" → "mil e quinhentos reais e cinquenta centavos". Arredonda para centavos. */
export function reaisPorExtenso(valor: number): string {
  const centavosTotais = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;

  const partesReais = reais === 1 ? 'um real' : `${inteiroPorExtenso(reais)}${reais >= 1e6 && reais % 1e6 === 0 ? ' de' : ''} reais`;
  const partesCentavos = centavos === 1 ? 'um centavo' : `${inteiroPorExtenso(centavos)} centavos`;

  if (reais === 0 && centavos === 0) return 'zero reais';
  if (reais === 0) return partesCentavos;
  if (centavos === 0) return partesReais;
  return `${partesReais} e ${partesCentavos}`;
}
