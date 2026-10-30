import { describe, it, expect } from 'vitest';
import { inteiroPorExtenso, reaisPorExtenso } from '@/lib/extenso';

describe('inteiroPorExtenso', () => {
  it.each([
    [0, 'zero'],
    [1, 'um'],
    [15, 'quinze'],
    [20, 'vinte'],
    [21, 'vinte e um'],
    [99, 'noventa e nove'],
    [100, 'cem'],
    [101, 'cento e um'],
    [110, 'cento e dez'],
    [250, 'duzentos e cinquenta'],
    [999, 'novecentos e noventa e nove'],
    [1000, 'mil'],
    [1001, 'mil e um'],
    [1100, 'mil e cem'],
    [1500, 'mil e quinhentos'],
    [1999, 'mil novecentos e noventa e nove'],
    [2000, 'dois mil'],
    [2340, 'dois mil trezentos e quarenta'],
    [10000, 'dez mil'],
    [21000, 'vinte e um mil'],
    [92025, 'noventa e dois mil e vinte e cinco'],
    [101000, 'cento e um mil'],
    [250000, 'duzentos e cinquenta mil'],
    [1000000, 'um milhão'],
    [1000001, 'um milhão e um'],
    [1200000, 'um milhão e duzentos mil'],
    [1250000, 'um milhão duzentos e cinquenta mil'],
    [2000000, 'dois milhões'],
    [1000000000, 'um bilhão'],
  ])('%i → %s', (n, esperado) => {
    expect(inteiroPorExtenso(n)).toBe(esperado);
  });
});

describe('reaisPorExtenso', () => {
  it.each([
    [0, 'zero reais'],
    [1, 'um real'],
    [2, 'dois reais'],
    [0.01, 'um centavo'],
    [0.5, 'cinquenta centavos'],
    [1.01, 'um real e um centavo'],
    [443.93, 'quatrocentos e quarenta e três reais e noventa e três centavos'],
    [1500, 'mil e quinhentos reais'],
    [1500.5, 'mil e quinhentos reais e cinquenta centavos'],
    [92025.25, 'noventa e dois mil e vinte e cinco reais e vinte e cinco centavos'],
    [1000000, 'um milhão de reais'],
    [2000000, 'dois milhões de reais'],
    [1250000, 'um milhão duzentos e cinquenta mil reais'],
  ])('%f → %s', (v, esperado) => {
    expect(reaisPorExtenso(v)).toBe(esperado);
  });

  it('arredonda para centavos sem erro de ponto flutuante', () => {
    expect(reaisPorExtenso(0.1 + 0.2)).toBe('trinta centavos');
    expect(reaisPorExtenso(4221.45)).toBe('quatro mil duzentos e vinte e um reais e quarenta e cinco centavos');
  });
});
