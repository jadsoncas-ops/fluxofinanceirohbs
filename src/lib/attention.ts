import { Transaction, Client, Task, Process, Proposta, Exigencia } from './types';
import { montarMensagemLembreteVencimento } from './mensagens';

export type AttentionSeverity = 'critical' | 'warning' | 'info';

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  title: string;
  sub: string;
  cta: string;
  to: string;
  /** Presente só nos itens de cobrança com telefone cadastrado — permite avisar o cliente direto daqui. */
  whatsapp?: { clienteNome: string; telefone: { ddd: string; numero: string }; mensagem: string };
  /** Presente só nos itens de cobrança — histórico de quando você marcou (ou mandou o lembrete de
   *  WhatsApp) que já cobrou esse cliente. Sem vínculo com parcela específica, é só um "já avisei". */
  clienteIdParaLembrete?: string;
  lembretesCobranca?: number[];
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

  // 1. Recebimentos vencidos + vencendo em breve (até 5 dias), agrupados por cliente — um único
  //    item por cliente (evita mostrar a mesma pessoa várias vezes quando ela tem parcelas em mais
  //    de uma faixa), com ação de WhatsApp anexada quando há telefone. A janela mais larga (não só
  //    "vence amanhã") é o fluxo de cobrança escalonado: dá pra avisar o cliente com antecedência,
  //    não só depois que já venceu.
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().slice(0, 10);
  const emCincoDias = new Date();
  emCincoDias.setDate(emCincoDias.getDate() + 5);
  const emCincoDiasStr = emCincoDias.toISOString().slice(0, 10);
  const avisosPorCliente = new Map<string, { valor: number; itens: { descricao: string; valor: number; trabalho?: string; data: string }[] }>();
  transactions.forEach(t => {
    if ((t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído' && t.data <= emCincoDiasStr && t.clienteId) {
      const cur = avisosPorCliente.get(t.clienteId) || { valor: 0, itens: [] };
      cur.valor += t.valor;
      cur.itens.push({ descricao: t.descricao, valor: t.valor, trabalho: processes.find(p => p.id === t.processId)?.objeto, data: t.data });
      avisosPorCliente.set(t.clienteId, cur);
    }
  });
  avisosPorCliente.forEach((v, clienteId) => {
    const client = clients.find(c => c.id === clienteId);
    if (!client) return;
    const vencidos = v.itens.filter(i => i.data < today);
    const venceAmanha = v.itens.filter(i => i.data === amanhaStr);
    const temVencido = vencidos.length > 0;
    const temAmanha = venceAmanha.length > 0;
    const dias = temVencido ? Math.max(...vencidos.map(i => daysSince(i.data, today))) : 0;
    const telefone = client.telefone?.ddd && client.telefone?.numero ? { ddd: client.telefone.ddd, numero: client.telefone.numero } : undefined;
    const severity: AttentionSeverity = temVencido ? 'critical' : temAmanha ? 'warning' : 'info';
    const title = temVencido ? `Cobrar ${client.nome}` : temAmanha ? `Vence amanhã: ${client.nome}` : `Vence em breve: ${client.nome}`;
    items.push({
      id: `receber-${clienteId}`,
      severity,
      title,
      sub: temVencido
        ? `${v.itens.length} parcela${v.itens.length > 1 ? 's' : ''} vencida${v.itens.length > 1 ? 's' : ''} há ${dias} dia${dias > 1 ? 's' : ''} · ${fmtMoney(v.valor)}`
        : `${v.itens.length} parcela${v.itens.length > 1 ? 's' : ''} · ${fmtMoney(v.valor)} · envie o lembrete de cobrança`,
      cta: 'Ver cliente',
      to: `/clientes/${clienteId}`,
      whatsapp: telefone ? { clienteNome: client.nome, telefone, mensagem: montarMensagemLembreteVencimento({ clienteNome: client.nome, itens: v.itens }) } : undefined,
      clienteIdParaLembrete: clienteId,
      lembretesCobranca: client.lembretesCobranca,
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

  // 7. Exigências de cartório com prazo vencido ou vencendo em até 5 dias.
  //    É o item mais caro de perder: exigência não cumprida derruba a prenotação
  //    e o trabalho volta para a fila do registrador do zero.
  processes.filter(p => !p.isArchived && p.registro?.exigencias?.length).forEach(p => {
    (p.registro!.exigencias || [])
      .filter(e => e.status === 'Aberta' && e.prazo && e.prazo <= emCincoDiasStr)
      .forEach(e => {
        const dias = daysSince(e.prazo!, today);
        const vencida = dias > 0;
        const faltam = e.documentosFaltantes?.length || 0;
        items.push({
          id: `exigencia-${p.id}-${e.id}`,
          severity: vencida || e.prazo === today ? 'critical' : 'warning',
          title: `Exigência ${vencida ? 'vencida' : e.prazo === today ? 'vence hoje' : `vence em ${-dias}d`} — ${p.objeto || 'Trabalho'}`,
          sub: [
            p.registro!.oficio,
            p.registro!.protocolo ? `protocolo ${p.registro!.protocolo}` : null,
            faltam > 0 ? `${faltam} documento${faltam > 1 ? 's' : ''} faltando` : e.descricao,
          ].filter(Boolean).join(' · '),
          cta: 'Cumprir exigência',
          to: `/trabalhos/${p.id}`,
        });
      });
  });

  // 8. Prenotação expirando. Prazo legal de 30 dias contados do protocolo;
  //    avisa a partir de 7 dias restantes, crítico com 3 ou menos.
  processes.filter(p => !p.isArchived && p.registro?.dataPrenotacao && !p.registro?.matricula).forEach(p => {
    const r = p.registro!;
    const totalDias = r.prazoPrenotacaoDias ?? 30;
    const decorridos = daysSince(r.dataPrenotacao!, today);
    const restam = totalDias - decorridos;
    if (restam > 7) return;
    items.push({
      id: `prenotacao-${p.id}`,
      severity: restam <= 3 ? 'critical' : 'warning',
      title: restam < 0
        ? `Prenotação expirada — ${p.objeto || 'Trabalho'}`
        : `Prenotação expira em ${restam}d — ${p.objeto || 'Trabalho'}`,
      sub: [r.oficio, r.protocolo ? `protocolo ${r.protocolo}` : null, `prenotado em ${r.dataPrenotacao!.split('-').reverse().join('/')}`]
        .filter(Boolean).join(' · '),
      cta: 'Abrir trabalho',
      to: `/trabalhos/${p.id}`,
    });
  });

  // 9. Protocolo sem movimento há mais de 30 dias — nem exigência, nem matrícula.
  //    Sinal de que alguém precisa ligar no ofício e cobrar andamento.
  const trintaDiasMs = 30 * 86400000;
  processes.filter(p => !p.isArchived && p.registro?.dataProtocolo && !p.registro?.matricula).forEach(p => {
    const r = p.registro!;
    const temExigenciaAberta = (r.exigencias || []).some(e => e.status === 'Aberta');
    if (temExigenciaAberta) return;
    if (Date.now() - p.updatedAt < trintaDiasMs) return;
    const dias = Math.round((Date.now() - p.updatedAt) / 86400000);
    items.push({
      id: `protocolo-parado-${p.id}`,
      severity: 'warning',
      title: `Protocolo sem movimento há ${dias}d — ${p.objeto || 'Trabalho'}`,
      sub: [r.oficio, r.protocolo ? `protocolo ${r.protocolo}` : null, 'cobrar andamento no ofício']
        .filter(Boolean).join(' · '),
      cta: 'Abrir trabalho',
      to: `/trabalhos/${p.id}`,
    });
  });

  const order: Record<AttentionSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}
