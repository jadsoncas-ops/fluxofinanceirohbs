import { Account } from './types';

/** Reserva & disponível — baseado 100% no saldo real das contas (o mesmo saldo mantido
 *  manualmente em Contas), nunca numa fórmula sobre o histórico de lançamentos. A "conta
 *  reserva" é a conta que você designa em Contas como o dinheiro protegido da empresa; ela
 *  só sobe/desce quando você de fato transfere ou tira dinheiro dela. */
export interface ReservaResumo {
  temContaReserva: boolean;
  contaNome?: string;
  reserva: number;
  caixaTotal: number;
  disponivelAgora: number;
}

export function computeReserva(accounts: Account[], contaReservaId?: string): ReservaResumo {
  const ativas = accounts.filter(a => a.ativo);
  const caixaTotal = ativas.reduce((s, a) => s + a.saldo, 0);
  const contaReserva = contaReservaId ? ativas.find(a => a.id === contaReservaId) : undefined;

  if (!contaReserva) {
    return { temContaReserva: false, reserva: 0, caixaTotal, disponivelAgora: caixaTotal };
  }

  return {
    temContaReserva: true,
    contaNome: contaReserva.nome,
    reserva: contaReserva.saldo,
    caixaTotal,
    disponivelAgora: caixaTotal - contaReserva.saldo,
  };
}
