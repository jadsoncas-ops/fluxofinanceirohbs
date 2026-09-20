import { Transaction, Process } from './types';

/** Data que representa quando o dinheiro de fato entrou/saiu — usa dataConclusao quando existe
 *  (lançamento Concluído/Parcial confirmado após a data original), senão cai no vencimento
 *  (`data`). Toda leitura de "faturamento do mês" / "recebido este mês" deve usar isto, nunca
 *  `t.data` direto — é o único jeito de não misturar vencimento com data real de recebimento. */
export function dataEfetiva(t: Transaction): string {
  return t.dataConclusao || t.data;
}

// ── KPIs financeiros compartilhados (Visão Geral + Dashboard) ──────────────
// Extraídos porque as duas telas recalculavam a mesma coisa de formas
// sutilmente diferentes (ex.: a Visão Geral sempre travada no mês atual, a
// Dashboard permitindo paginar pra meses anteriores no card "Faturamento") —
// daí entradasNoMes/saidasNoMes recebem ano/mês como parâmetro em vez de
// assumir "agora": a Visão Geral sempre chama com o mês atual, a Dashboard
// chama com o mês que o usuário estiver navegando. Nenhum comportamento
// visível muda — é só a mesma lógica de antes, movida pra um lugar só.

/** Soma das entradas Concluídas cujo mês/ano efetivo (dataEfetiva) bate com o
 *  informado. */
export function entradasNoMes(transactions: Transaction[], ano: number, mes: number): number {
  return transactions
    .filter(t => t.status === 'Concluído' && (t.tipo === 'Entrada' || t.tipo === 'A Receber'))
    .filter(t => {
      const d = new Date(dataEfetiva(t) + 'T12:00:00');
      return d.getMonth() === mes && d.getFullYear() === ano;
    })
    .reduce((s, t) => s + t.valor, 0);
}

/** Soma das saídas Concluídas cujo mês/ano efetivo (dataEfetiva) bate com o
 *  informado. */
export function saidasNoMes(transactions: Transaction[], ano: number, mes: number): number {
  return transactions
    .filter(t => t.status === 'Concluído' && (t.tipo === 'Saída' || t.tipo === 'A Pagar'))
    .filter(t => {
      const d = new Date(dataEfetiva(t) + 'T12:00:00');
      return d.getMonth() === mes && d.getFullYear() === ano;
    })
    .reduce((s, t) => s + t.valor, 0);
}

/** Total ainda não recebido (todo status diferente de Concluído), sem filtro
 *  de mês — mesmo critério que já alimentava "A receber" na Visão Geral e o
 *  card de mesmo nome na Dashboard. */
export function totalAReceber(transactions: Transaction[]): number {
  return transactions
    .filter(t => t.status !== 'Concluído' && (t.tipo === 'Entrada' || t.tipo === 'A Receber'))
    .reduce((s, t) => s + t.valor, 0);
}

/** Total ainda não pago (todo status diferente de Concluído), sem filtro de
 *  mês — mesmo critério que já alimentava "A pagar" na Visão Geral. */
export function totalAPagar(transactions: Transaction[]): number {
  return transactions
    .filter(t => t.status !== 'Concluído' && (t.tipo === 'Saída' || t.tipo === 'A Pagar'))
    .reduce((s, t) => s + t.valor, 0);
}

export interface ClientFinancials {
  totalContratado: number;
  recebido: number;
  aReceber: number;
  atrasado: number;
  pago: number;
  aPagar: number;
  /** Repasses a parceiros (pagos + a pagar) vinculados a este cliente. */
  repasses: number;
  /** Lucro líquido previsto = contratado - repasses (pagos + a pagar). Mesma lógica de TrabalhoFinancials.resultadoPrevisto, agregada pra todos os trabalhos do cliente. */
  resultadoPrevisto: number;
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

  const repasses = clientTxs.filter(t => t.isRepasse).reduce((s, t) => s + t.valor, 0);

  return {
    totalContratado, recebido, aReceber, atrasado, pago, aPagar, repasses,
    resultadoPrevisto: totalContratado - repasses,
  };
}

export interface TrabalhoFinancials {
  contratado: number;
  recebido: number;
  aReceber: number;
  atrasado: number;
  /** Próxima parcela a vencer (não atrasada), se houver. */
  proximoVencimento: { valor: number; data: string } | null;
  /** Repasses a parceiros já pagos, vinculados a este trabalho. */
  repassado: number;
  /** Repasses a parceiros ainda pendentes, vinculados a este trabalho. */
  repasseAPagar: number;
  /** Resultado previsto = contratado - repasses (pagos + a pagar). */
  resultadoPrevisto: number;
  /** Resultado realizado = recebido - repasses já pagos. */
  resultadoRealizado: number;
  /** Contratado - recebido - a receber já registrado. > 0 quando falta lançar alguma parcela do valor contratado. */
  semParcelaRegistrada: number;
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

  const repasses = txs.filter(t => t.isRepasse);
  const repassado = repasses.filter(t => t.status === 'Concluído').reduce((s, t) => s + t.valor, 0);
  const repasseAPagar = repasses.filter(t => t.status !== 'Concluído').reduce((s, t) => s + t.valor, 0);

  const contratado = trabalho.valorContrato || 0;

  return {
    contratado,
    recebido,
    aReceber,
    atrasado,
    proximoVencimento: proximo ? { valor: proximo.valor, data: proximo.data } : null,
    repassado,
    repasseAPagar,
    resultadoPrevisto: contratado - (repassado + repasseAPagar),
    resultadoRealizado: recebido - repassado,
    semParcelaRegistrada: Math.max(0, Math.round((contratado - recebido - aReceber) * 100) / 100),
  };
}
