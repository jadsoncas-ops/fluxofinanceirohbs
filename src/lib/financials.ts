import { Transaction, Process } from './types';

export interface ClientFinancials {
  totalContratado: number;
  recebido: number;
  aReceber: number;
  atrasado: number;
  pago: number;
  aPagar: number;
}

/** Agregação financeira de um cliente — usada na ficha do cliente (/clientes/:id). */
export function computeClientFinancials(
  clienteId: string,
  transactions: Transaction[],
  processes: Process[]
): ClientFinancials {
  const today = new Date().toISOString().slice(0, 10);
  const totalContratado = processes
    .filter(p => p.clienteId === clienteId)
    .reduce((s, p) => s + (p.valorContrato || 0), 0);

  const clientTxs = transactions.filter(t => t.clienteId === clienteId);

  const recebido = clientTxs
    .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
    .reduce((s, t) => s + t.valor, 0);

  const aReceber = clientTxs
    .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído')
    .reduce((s, t) => s + t.valor, 0);

  const atrasado = clientTxs
    .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído' && t.data < today)
    .reduce((s, t) => s + t.valor, 0);

  const pago = clientTxs
    .filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status === 'Concluído')
    .reduce((s, t) => s + t.valor, 0);

  const aPagar = clientTxs
    .filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status !== 'Concluído')
    .reduce((s, t) => s + t.valor, 0);

  return { totalContratado, recebido, aReceber, atrasado, pago, aPagar };
}

export interface TrabalhoFinancials {
  contratado: number;
  recebido: number;
  aReceber: number;
  atrasado: number;
  /** Próxima parcela a vencer (não atrasada), se houver. */
  proximoVencimento: { valor: number; data: string } | null;
}

/** Agregação financeira de um trabalho específico — usada na página de detalhe do Trabalho. */
export function computeTrabalhoFinancials(trabalho: Process, transactions: Transaction[]): TrabalhoFinancials {
  const today = new Date().toISOString().slice(0, 10);
  const txs = transactions.filter(t => t.processId === trabalho.id);

  const recebido = txs
    .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
    .reduce((s, t) => s + t.valor, 0);

  const pendentes = txs.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído');
  const aReceber = pendentes.reduce((s, t) => s + t.valor, 0);
  const atrasado = pendentes.filter(t => t.data < today).reduce((s, t) => s + t.valor, 0);

  const proximo = pendentes.filter(t => t.data >= today).sort((a, b) => a.data.localeCompare(b.data))[0];

  return {
    contratado: trabalho.valorContrato || 0,
    recebido,
    aReceber,
    atrasado,
    proximoVencimento: proximo ? { valor: proximo.valor, data: proximo.data } : null,
  };
}
