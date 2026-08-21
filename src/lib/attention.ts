import { Transaction, Client, Task, Process, Proposta } from './types';

export type AttentionSeverity = 'critical' | 'warning' | 'info';

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  title: string;
  sub: string;
  cta: string;
  to: string;
}

function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysSince(dateStr: string, today: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const t = new Date(today + 'T12:00:00');
  return Math.round((t.getTime() - d.getTime()) / 86400000);
}

/**
 * Fonte única de verdade para "o que precisa de atenção" — usada no Dashboard,
 * na central de notificações e no badge do Financeiro na sidebar.
 * Só considera dados que realmente existem hoje (sem inventar prazos/documentos
 * que ainda não têm um campo no modelo).
 */
export function computeAttentionItems(
  transactions: Transaction[],
  clients: Client[],
  tasks: Task[],
  processes: Process[] = [],
  propostas: Proposta[] = []
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // 1. Recebimentos atrasados, agrupados por cliente
  const receberAtrasado = new Map<string, { valor: number; count: number }>();
  transactions.forEach(t => {
    if ((t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído' && t.data < today && t.clienteId) {
      const cur = receberAtrasado.get(t.clienteId) || { valor: 0, count: 0 };
      cur.valor += t.valor;
      cur.count += 1;
      receberAtrasado.set(t.clienteId, cur);
    }
  });
  receberAtrasado.forEach((v, clienteId) => {
    const client = clients.find(c => c.id === clienteId);
    if (!client) return;
    const dias = Math.max(...transactions.filter(t => t.clienteId === clienteId && t.status !== 'Concluído' && t.data < today).map(t => daysSince(t.data, today)));
    items.push({
      id: `receber-${clienteId}`,
      severity: 'critical',
      title: `Cobrar ${client.nome}`,
      sub: `${v.count} parcela${v.count > 1 ? 's' : ''} vencida${v.count > 1 ? 's' : ''} há ${dias} dia${dias > 1 ? 's' : ''} · ${fmtMoney(v.valor)}`,
      cta: 'Ver cliente',
      to: `/clientes/${clienteId}`,
    });
  });

  // 1.5 Vencimentos de amanhã, agrupados por cliente
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().slice(0, 10);
  const receberAmanha = new Map<string, { valor: number; count: number }>();
  transactions.forEach(t => {
    if ((t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído' && t.data === amanhaStr && t.clienteId) {
      const cur = receberAmanha.get(t.clienteId) || { valor: 0, count: 0 };
      cur.valor += t.valor;
      cur.count += 1;
      receberAmanha.set(t.clienteId, cur);
    }
  });
  receberAmanha.forEach((v, clienteId) => {
    const client = clients.find(c => c.id === clienteId);
    if (!client) return;
    items.push({
      id: `vence-amanha-${clienteId}`,
      severity: 'warning',
      title: `Vence amanhã: ${client.nome}`,
      sub: `${v.count} parcela${v.count > 1 ? 's' : ''} · ${fmtMoney(v.valor)} · envie o lembrete de cobrança`,
      cta: 'Ver cliente',
      to: `/clientes/${clienteId}`,
    });
  });

  // 2. Pagamentos (nossos) atrasados
  const pagarAtrasado = transactions.filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status !== 'Concluído' && t.data < today);
  if (pagarAtrasado.length > 0) {
    const total = pagarAtrasado.reduce((s, t) => s + t.valor, 0);
    const dias = Math.max(...pagarAtrasado.map(t => daysSince(t.data, today)));
    items.push({
      id: 'pagar-atrasado',
      severity: 'critical',
      title: `${pagarAtrasado.length} pagamento${pagarAtrasado.length > 1 ? 's' : ''} em atraso`,
      sub: `Vencido${pagarAtrasado.length > 1 ? 's' : ''} há até ${dias} dia${dias > 1 ? 's' : ''} · ${fmtMoney(total)}`,
      cta: 'Ver despesas',
      to: '/caixa/despesas',
    });
  }

  // 3. Tarefas atrasadas
  const tarefasAtrasadas = tasks.filter(t => t.status !== 'Concluída' && t.prazo && t.prazo < today);
  if (tarefasAtrasadas.length > 0) {
    items.push({
      id: 'tarefas-atrasadas',
      severity: 'warning',
      title: `${tarefasAtrasadas.length} tarefa${tarefasAtrasadas.length > 1 ? 's' : ''} atrasada${tarefasAtrasadas.length > 1 ? 's' : ''}`,
      sub: tarefasAtrasadas.length === 1 ? tarefasAtrasadas[0].titulo : 'Verifique o que ficou para trás',
      cta: 'Abrir tarefas',
      to: '/tarefas',
    });
  }

  // 4. Tarefas com prazo nos próximos 5 dias
  const em5dias = new Date();
  em5dias.setDate(em5dias.getDate() + 5);
  const em5diasStr = em5dias.toISOString().slice(0, 10);
  const tarefasProximas = tasks.filter(t => t.status !== 'Concluída' && t.prazo && t.prazo >= today && t.prazo <= em5diasStr);
  if (tarefasProximas.length > 0) {
    items.push({
      id: 'tarefas-proximas',
      severity: 'warning',
      title: `${tarefasProximas.length} tarefa${tarefasProximas.length > 1 ? 's' : ''} com prazo próximo`,
      sub: tarefasProximas.length === 1 ? tarefasProximas[0].titulo : 'Prazo nos próximos 5 dias',
      cta: 'Abrir tarefas',
      to: '/tarefas',
    });
  }

  // 5. Trabalhos aguardando cliente há mais de alguns dias
  const seteDiasMs = 7 * 86400000;
  processes.filter(p => !p.isArchived && p.etapa === 'Aguardando cliente' && Date.now() - p.updatedAt > seteDiasMs).forEach(p => {
    const dias = Math.round((Date.now() - p.updatedAt) / 86400000);
    const client = clients.find(c => c.id === p.clienteId);
    items.push({
      id: `trabalho-parado-${p.id}`,
      severity: dias > 14 ? 'critical' : 'warning',
      title: `"${p.objeto}" aguardando o cliente`,
      sub: `${client?.nome || 'Cliente'} · parado há ${dias} dias`,
      cta: 'Abrir trabalho',
      to: `/trabalhos/${p.id}`,
    });
  });

  // 6. Propostas enviadas sem resposta há mais de alguns dias
  propostas.filter(p => p.status === 'Enviada' && p.enviadaEm && Date.now() - p.enviadaEm > seteDiasMs).forEach(p => {
    const dias = Math.round((Date.now() - p.enviadaEm!) / 86400000);
    const client = clients.find(c => c.id === p.clienteId);
    items.push({
      id: `proposta-parada-${p.id}`,
      severity: dias > 10 ? 'critical' : 'warning',
      title: `Proposta ${p.codigo} sem resposta há ${dias}d`,
      sub: `${client?.nome || 'Cliente'} · ${fmtMoney(p.resultado.precoVenda)} · ${p.titulo}`,
      cta: 'Fazer follow-up',
      to: `/comercial`,
    });
  });

  const order: Record<AttentionSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}
