import { Transaction } from './types';

export const PERCENTUAL_RESERVA_PADRAO = 20;

export interface ReservaResumo {
  percentual: number;
  /** Receita líquida acumulada — recebido, já descontado repasse a parceiro. Base de tudo abaixo. */
  receitaLiquida: number;
  /** O que fica pra empresa (paga despesa de escritório: contador, luz, nota fiscal). */
  reserva: number;
  /** Já gasto de despesa de escritório — sai da reserva. */
  gastoReserva: number;
  /** O que sobra na reserva agora. */
  reservaDisponivel: number;
  /** O que é seu, pra usar como quiser. */
  disponivelPessoal: number;
  /** Já retirado pra você. */
  retirado: number;
  /** O que ainda pode ser retirado sem mexer na reserva. */
  disponivelAgora: number;
}

/**
 * Divide toda receita já recebida (líquida de repasse a parceiro) em dois baldes: a % que fica
 * reservada pra empresa (paga despesa de escritório) e o resto, que é seu, pra usar como quiser
 * (inclusive dívida pessoal). É um cálculo acumulado — nunca reseta, porque o dinheiro não some
 * só porque o mês virou. Despesa avulsa (sem cliente/trabalho) sai da reserva por padrão; quando
 * marcada como retirada pessoal, sai do seu lado.
 */
export function computeReserva(transactions: Transaction[], percentual: number = PERCENTUAL_RESERVA_PADRAO): ReservaResumo {
  const recebido = transactions
    .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
    .reduce((s, t) => s + t.valor, 0);
  const repassado = transactions
    .filter(t => t.isRepasse && (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status === 'Concluído')
    .reduce((s, t) => s + t.valor, 0);
  const receitaLiquida = Math.max(0, recebido - repassado);

  const avulsas = transactions.filter(t => !t.isRepasse && !t.clienteId && !t.processId && (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status === 'Concluído');
  const gastoReserva = avulsas.filter(t => !t.isRetirada).reduce((s, t) => s + t.valor, 0);
  const retirado = avulsas.filter(t => t.isRetirada).reduce((s, t) => s + t.valor, 0);

  const reserva = receitaLiquida * (percentual / 100);
  const disponivelPessoal = receitaLiquida - reserva;

  return {
    percentual,
    receitaLiquida,
    reserva,
    gastoReserva,
    reservaDisponivel: reserva - gastoReserva,
    disponivelPessoal,
    retirado,
    disponivelAgora: disponivelPessoal - retirado,
  };
}
