import { Transaction } from './types';
import { dataEfetiva } from './financials';

export function isIncome(t: Transaction): boolean {
  return t.tipo === 'Entrada' || t.tipo === 'A Receber';
}

/** Status simples pra exibição — Recebido/Pago/A receber/A pagar, conforme o lado do
 *  lançamento. Não é um valor novo no banco, só a tradução visual do status+tipo existentes. */
export function statusLabel(t: Transaction): string {
  if (t.status === 'Concluído') return isIncome(t) ? 'Recebido' : 'Pago';
  return isIncome(t) ? 'A receber' : 'A pagar';
}

function baseDescricao(d: string): string {
  return d.replace(/\s*\(Restante\)\s*$/i, '').trim();
}

function chaveAgrupamento(t: Transaction): string {
  // Sem clienteId na chave de propósito: o "(Restante)" que o PartialPaymentModal cria não copia
  // clienteId do lançamento original (só copia processId) — se a chave exigisse os dois batendo,
  // nenhum parcelamento normal agruparia (achado testando esta fase: um lançamento "Só R$60 de
  // R$100" ficava com o pai tendo cliente e o restante "Sem cliente"). processId já implica o
  // mesmo cliente quando presente (um trabalho pertence a um cliente só); sem processId (avulso),
  // agrupa só por descrição-base + lado, aceitando o mesmo risco (raro) que já existe no caso com
  // trabalho: duas cobranças diferentes com texto idêntico coincidindo.
  return [t.processId || '', isIncome(t) ? 'in' : 'out', baseDescricao(t.descricao)].join('::');
}

export interface LancamentoGrupo {
  chave: string;
  /** Todos os lançamentos do grupo, ordenados do mais antigo pro mais novo (por dataEfetiva). */
  itens: Transaction[];
  /** true quando o grupo reúne o lançamento original + "(Restante)" gerados por um
   *  recebimento/pagamento parcial — false quando é um lançamento avulso normal. */
  parcelado: boolean;
  /** Data usada pra posicionar o grupo na lista (a mais recente entre os itens). */
  dataOrdenacao: string;
  valorTotal: number;
  valorRecebido: number;
  valorRestante: number;
  proximoVencimento: string | null;
}

/** Agrupa visualmente lançamentos que são, na prática, parcelas da mesma operação — o
 *  lançamento original (reduzido ao valor efetivamente recebido/pago pelo PartialPaymentModal)
 *  + o(s) "(Restante)" criado(s) a partir dele. Não existe um parentId formal ligando os dois
 *  nesse caso (parentId no banco é reservado pra ligar repasse → lançamento do cliente) — o
 *  agrupamento aqui é 100% de leitura, via processId + cliente + descrição-base + lado
 *  (entrada/saída), e só ativa quando pelo menos um item do grupo tem "(Restante)" no nome.
 *  Isso evita juntar por coincidência dois lançamentos avulsos com o mesmo texto: sem um
 *  "(Restante)" real no meio, cada lançamento fica no seu próprio grupo de 1 item. */
export function agruparLancamentos(transactions: Transaction[]): LancamentoGrupo[] {
  const porChave = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const chave = chaveAgrupamento(t);
    const arr = porChave.get(chave);
    if (arr) arr.push(t); else porChave.set(chave, [t]);
  }

  const grupos: LancamentoGrupo[] = [];
  for (const [chave, itensBrutos] of porChave) {
    const temRestante = itensBrutos.length > 1 && itensBrutos.some(t => /\(Restante\)\s*$/i.test(t.descricao));
    if (temRestante) {
      const itens = [...itensBrutos].sort((a, b) => dataEfetiva(a).localeCompare(dataEfetiva(b)));
      const pendentes = itens.filter(t => t.status !== 'Concluído');
      const concluidos = itens.filter(t => t.status === 'Concluído');
      const valorRecebido = concluidos.reduce((s, t) => s + t.valor, 0);
      const valorRestante = pendentes.reduce((s, t) => s + t.valor, 0);
      const comOriginal = itens.find(t => t.originalTotal != null);
      const valorTotal = comOriginal?.originalTotal ?? (valorRecebido + valorRestante);
      const proximoVencimento = pendentes.length > 0 ? pendentes.map(t => t.data).sort()[0] : null;
      const dataOrdenacao = itens.map(t => dataEfetiva(t)).sort().slice(-1)[0];
      grupos.push({ chave, itens, parcelado: true, dataOrdenacao, valorTotal, valorRecebido, valorRestante, proximoVencimento });
    } else {
      for (const t of itensBrutos) {
        grupos.push({
          chave: t.id,
          itens: [t],
          parcelado: false,
          dataOrdenacao: dataEfetiva(t),
          valorTotal: t.valor,
          valorRecebido: t.status === 'Concluído' ? t.valor : 0,
          valorRestante: t.status === 'Concluído' ? 0 : t.valor,
          proximoVencimento: t.status === 'Concluído' ? null : t.data,
        });
      }
    }
  }
  return grupos;
}

/** Todos os outros lançamentos do mesmo grupo visual de `transaction` (mesma lógica de
 *  agruparLancamentos), buscados em `universo` — usado pro "Histórico financeiro" do
 *  DetalheLancamentoDialog, sempre completo mesmo se `transaction` veio de uma lista já
 *  filtrada/paginada por mês. */
export function irmaosDoGrupo(transaction: Transaction, universo: Transaction[]): Transaction[] {
  const chave = chaveAgrupamento(transaction);
  return universo.filter(t => t.id !== transaction.id && chaveAgrupamento(t) === chave);
}
