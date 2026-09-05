import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, FileStack, Handshake, Landmark, MessageCircle, Check, ChevronLeft, Flame, PiggyBank, Wallet, AlertTriangle, CheckCircle2, CalendarPlus } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getAccounts, getProcesses, getClients, getTasks, getPropostas, getCompromissos, getCompanyConfig, getHistorico, updateClient, updateProcess, registrarEvento } from '@/lib/storage';
import { computeAttentionItems, AttentionItem, AttentionTipo, toggleLembreteCobranca } from '@/lib/attention';
import { computeReserva } from '@/lib/reserva';
import { linkWhatsApp } from '@/lib/mensagens';
import { TrabalhoEtapa, Compromisso } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CalendarioAgenda } from '@/components/CalendarioAgenda';
import { NovoCompromissoDialog } from '@/components/dashboard/NovoCompromissoDialog';
import { ValorMonetario } from '@/components/ValorMonetario';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const WEEKDAYS_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const STAGE_ORDER: TrabalhoEtapa[] = ['Aguardando cliente', 'Levantamento', 'Tramitando', 'Devolutiva', 'Concluído'];
const STAGE_PCT: Record<TrabalhoEtapa, number> = { 'Aguardando cliente': 10, Levantamento: 30, Tramitando: 65, Devolutiva: 80, Concluído: 100 };
const STAGE_DOT: Record<TrabalhoEtapa, string> = { 'Aguardando cliente': 'bg-warning', Levantamento: 'bg-mute-3', Tramitando: 'bg-accent', Devolutiva: 'bg-destructive', Concluído: 'bg-success' };
const PROXIMA_ACAO: Record<TrabalhoEtapa, string> = { 'Aguardando cliente': 'Cobrar retorno do cliente', Levantamento: 'Fazer levantamento do imóvel/documentação', Tramitando: 'Acompanhar trâmite no órgão', Devolutiva: 'Atender exigência/pendência', Concluído: 'Arquivar trabalho' };

function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
function dataPorExtenso() {
  const d = new Date();
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${d.toLocaleDateString('pt-BR', { month: 'long' })}`;
}

const TIPO_LABEL: Record<AttentionTipo, string> = { Cobranca: 'Cobrança', Cartorio: 'Cartório', Orgao: 'Órgão', Pendencia: 'Pendência' };
const TIPO_TAG: Record<AttentionTipo, string> = { Cobranca: 'bg-destructive-soft text-destructive', Cartorio: 'bg-accent-soft text-accent', Orgao: 'bg-warning-soft text-warning', Pendencia: 'bg-neutral-soft text-mute-2' };

export default function DashboardPage() {
  const shell = useShell();
  const navigate = useNavigate();
  const { allTransactions: transactions } = shell;
  const [lembrete, setLembrete] = useState<{ clienteId?: string; clienteNome: string; telefone: { ddd: string; numero: string }; mensagem: string } | null>(null);
  const [mensagemEditada, setMensagemEditada] = useState('');
  const [compromissoDialogOpen, setCompromissoDialogOpen] = useState(false);
  const [compromissoEditando, setCompromissoEditando] = useState<Compromisso | undefined>(undefined);
  const [novoCompromissoData, setNovoCompromissoData] = useState<string | undefined>(undefined);
  const [filtro, setFiltro] = useState<'tudo' | AttentionTipo>('tudo');
  const [telefoneInlineId, setTelefoneInlineId] = useState<string | null>(null);
  const [telefoneDdd, setTelefoneDdd] = useState('');
  const [telefoneNumero, setTelefoneNumero] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);

  function abrirNovoCompromisso(data?: string) { setCompromissoEditando(undefined); setNovoCompromissoData(data); setCompromissoDialogOpen(true); }
  function abrirEditarCompromisso(c: Compromisso) { setCompromissoEditando(c); setCompromissoDialogOpen(true); }

  const {
    attention, cashflow, etapas, tasks, clients, compromissos, trabalhosAtivosTotal, saldoProjetado, saudeEscritorio, reserva,
    statusGeral, kpis, atencaoTop, hojeAgenda, trabalhosAtencao, financeiro, atividadeRecente,
  } = useMemo(() => {
    const accounts = getAccounts();
    const processes = getProcesses();
    const clients = getClients();
    const tasks = getTasks();
    const compromissos = getCompromissos();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const reserva = computeReserva(accounts, getCompanyConfig().contaReservaId);

    const saldoDisponivel = accounts.filter(a => a.ativo).reduce((s, a) => s + a.saldo, 0);
    const aReceberTx = transactions.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído');
    const aReceber = aReceberTx.reduce((s, t) => s + t.valor, 0);
    const aReceberAtrasado = aReceberTx.filter(t => t.data < today).reduce((s, t) => s + t.valor, 0);
    const aPagarTx = transactions.filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status !== 'Concluído');
    const aPagar = aPagarTx.reduce((s, t) => s + t.valor, 0);
    const receitaMes = transactions
      .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
      .filter(t => { const d = new Date(t.data + 'T12:00:00'); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .reduce((s, t) => s + t.valor, 0);

    const trabalhosAtivos = processes.filter(p => !p.isArchived && (p.etapa || 'Levantamento') !== 'Concluído');
    const parados14d = trabalhosAtivos.filter(p => Date.now() - p.updatedAt > 14 * 86400000).length;

    const registrosComRegistro = processes.filter(p => !p.isArchived && p.registro);
    const prazosSete = registrosComRegistro.filter(p => {
      const r = p.registro!;
      const exigenciaProxima = (r.exigencias || []).some(e => e.status === 'Aberta' && e.prazo && e.prazo <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
      const prenotacaoProxima = r.dataPrenotacao && !r.matricula && (r.prazoPrenotacaoDias ?? 30) - Math.round((Date.now() - new Date(r.dataPrenotacao + 'T12:00:00').getTime()) / 86400000) <= 7;
      return exigenciaProxima || prenotacaoProxima;
    }).length;

    const etapaSegmentos = STAGE_ORDER.map(etapa => ({ etapa, count: trabalhosAtivos.filter(p => (p.etapa || 'Levantamento') === etapa).length, color: STAGE_DOT[etapa] })).filter(e => e.count > 0);

    const attention = computeAttentionItems(transactions, clients, tasks, processes, getPropostas());

    const cashflow = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const receita = transactions.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído' && new Date(t.data + 'T12:00:00').getMonth() === d.getMonth() && new Date(t.data + 'T12:00:00').getFullYear() === d.getFullYear()).reduce((s, t) => s + t.valor, 0);
      const despesa = transactions.filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status === 'Concluído' && new Date(t.data + 'T12:00:00').getMonth() === d.getMonth() && new Date(t.data + 'T12:00:00').getFullYear() === d.getFullYear()).reduce((s, t) => s + t.valor, 0);
      return { mes: MONTHS_SHORT[d.getMonth()], receita, despesa };
    });

    const etapasBase = STAGE_ORDER.map(etapa => {
      const doEstagio = trabalhosAtivos.filter(p => (p.etapa || 'Levantamento') === etapa);
      const diasParadoMedio = doEstagio.length > 0 ? doEstagio.reduce((s, p) => s + (Date.now() - p.updatedAt) / 86400000, 0) / doEstagio.length : 0;
      return { etapa, count: doEstagio.length, pct: STAGE_PCT[etapa], acao: PROXIMA_ACAO[etapa], dot: STAGE_DOT[etapa], ids: doEstagio.map(p => p.id), diasParadoMedio };
    }).filter(e => e.count > 0);
    const etapaGargalo = etapasBase.reduce((pior, e) => (e.diasParadoMedio > 7 && e.diasParadoMedio > (pior?.diasParadoMedio || 0) ? e : pior), null as (typeof etapasBase)[number] | null);
    const etapas = etapasBase.map(e => ({ ...e, destaque: etapaGargalo?.etapa === e.etapa }));

    const mesesFechados = cashflow.slice(0, 5);
    const receitaMediaMensal = mesesFechados.length > 0 ? mesesFechados.reduce((s, m) => s + m.receita, 0) / mesesFechados.length : 0;
    const clientesInadimplentes = new Set(aReceberTx.filter(t => t.data < today && t.clienteId).map(t => t.clienteId));
    const inadimplenciaPct = aReceber > 0 ? Math.round((aReceberAtrasado / aReceber) * 1000) / 10 : 0;
    void receitaMediaMensal;
    const cobrarAgoraIds = Array.from(clientesInadimplentes);

    const saldoProjetado = Array.from({ length: 9 }).map((_, w) => {
      const limite = new Date(now); limite.setDate(limite.getDate() + w * 7);
      const limiteStr = limite.toISOString().slice(0, 10);
      const receberAte = transactions.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído' && t.data <= limiteStr).reduce((s, t) => s + t.valor, 0);
      const pagarAte = transactions.filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status !== 'Concluído' && t.data <= limiteStr).reduce((s, t) => s + t.valor, 0);
      return { semana: w, label: w === 0 ? 'hoje' : `${w}sem`, saldo: saldoDisponivel + receberAte - pagarAte };
    });
    const primeiraSemanaNegativa = saldoProjetado.find(p => p.saldo < 0);

    let nota = 100;
    const motivos: string[] = [];
    if (inadimplenciaPct > 0) { nota -= Math.min(40, inadimplenciaPct); motivos.push(`Inadimplência de ${inadimplenciaPct}%`); }
    if (parados14d > 0) { nota -= Math.min(30, parados14d * 10); motivos.push(`${parados14d} trabalho${parados14d > 1 ? 's' : ''} parado${parados14d > 1 ? 's' : ''} há mais de 14 dias`); }
    if (prazosSete > 0) { nota -= Math.min(20, prazosSete * 5); motivos.push(`${prazosSete} prazo${prazosSete > 1 ? 's' : ''} de cartório apertado${prazosSete > 1 ? 's' : ''}`); }
    nota = Math.max(0, Math.round(nota));
    const saudeEscritorio = {
      nota,
      status: nota >= 80 ? 'Bom momento' : nota >= 50 ? 'Atenção' : 'Situação crítica',
      motivos: motivos.length > 0 ? motivos : ['Nada puxando a nota pra baixo agora.'],
    };

    // ── Status geral — leitura de 1 frase da situação do dia, derivada 100% de
    // attention.ts (crítico primeiro, depois geral). Nunca um dado inventado. ──
    const criticos = attention.filter(a => a.severity === 'critical').length;
    const avisos = attention.filter(a => a.severity === 'warning').length;
    const statusGeral = criticos > 0
      ? { tom: 'critical' as const, titulo: 'Atenção imediata', texto: `${criticos} situaç${criticos > 1 ? 'ões' : 'ão'} precisa${criticos > 1 ? 'm' : ''} ser resolvida${criticos > 1 ? 's' : ''} agora.` }
      : avisos > 0
        ? { tom: 'warning' as const, titulo: 'Atenção necessária', texto: `${attention.length} ponto${attention.length > 1 ? 's' : ''} precisa${attention.length > 1 ? 'm' : ''} da sua atenção hoje.` }
        : { tom: 'success' as const, titulo: 'Tudo sob controle', texto: 'Nenhuma pendência crítica no momento.' };

    // ── KPIs — só os 4 que importam pra decisão do dia, cada um com contexto real. ──
    const semanaAtrasMs = Date.now() - 7 * 86400000;
    const trabalhosNovosSemana = trabalhosAtivos.filter(p => p.createdAt >= semanaAtrasMs).length;
    const faturamentoMesAnterior = cashflow[4]?.receita || 0;
    const faturamentoDeltaPct = faturamentoMesAnterior > 0 ? Math.round(((receitaMes - faturamentoMesAnterior) / faturamentoMesAnterior) * 1000) / 10 : null;
    const inicioMesMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const clientesNovosMes = clients.filter(c => (c.createdAt || 0) >= inicioMesMs).length;

    const kpis = [
      {
        label: 'Trabalhos ativos', value: String(trabalhosAtivos.length),
        delta: trabalhosNovosSemana > 0 ? `+${trabalhosNovosSemana} esta semana` : 'Nenhum novo esta semana',
        deltaColor: trabalhosNovosSemana > 0 ? 'text-success' : 'text-muted-foreground',
        cta: 'Ver trabalhos', to: '/trabalhos', money: false,
      },
      {
        label: 'Faturamento do mês', value: fmtMoney(receitaMes),
        delta: faturamentoDeltaPct === null ? (receitaMes > 0 ? 'Sem mês anterior pra comparar' : 'Nada faturado ainda') : `${faturamentoDeltaPct >= 0 ? '+' : ''}${faturamentoDeltaPct}% vs. mês anterior`,
        deltaColor: faturamentoDeltaPct === null ? 'text-muted-foreground' : faturamentoDeltaPct >= 0 ? 'text-success' : 'text-destructive',
        cta: 'Ver financeiro', to: '/caixa', money: true,
      },
      {
        label: 'Clientes ativos', value: String(clients.length),
        delta: clientesNovosMes > 0 ? `${clientesNovosMes} novo${clientesNovosMes > 1 ? 's' : ''} este mês` : 'Nenhum novo este mês',
        deltaColor: 'text-muted-foreground',
        cta: 'Ver clientes', to: '/clientes', money: false,
      },
      {
        label: 'Pendências', value: String(attention.length),
        delta: criticos > 0 ? `${criticos} crítica${criticos > 1 ? 's' : ''}` : attention.length > 0 ? 'Nenhuma crítica' : 'Tudo em dia',
        deltaColor: criticos > 0 ? 'text-destructive' : 'text-muted-foreground',
        cta: 'Ver pendências', to: '#atencao', money: false,
      },
    ];

    // ── Precisa da sua atenção — os 5 primeiros de attention.ts (já vem ordenado
    // crítico → aviso → info). Ação inline quando existe (recebido/exigência),
    // senão navega pro destino de sempre. ──
    const atencaoTop = attention.slice(0, 5);

    // ── Hoje — só compromissos de hoje (Agenda já existe pra tudo, aqui é resumo). ──
    const hojeAgenda = compromissos
      .filter(c => c.data === today)
      .sort((a, b) => (a.horaInicio || '99:99').localeCompare(b.horaInicio || '99:99'));

    // ── Trabalhos que merecem atenção — atrasado > prazo próximo > parado >
    // (se sobrar espaço) os mais recentes, só pra não deixar a seção vazia
    // numa semana tranquila. ──
    const em7Str = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const trabalhosInfo = trabalhosAtivos.map(p => {
      const atrasado = !!p.prazo && p.prazo < today;
      const prazoProximo = !atrasado && !!p.prazo && p.prazo <= em7Str;
      const paradoDias = Math.round((Date.now() - p.updatedAt) / 86400000);
      const parado = !atrasado && !prazoProximo && paradoDias > 14;
      const status = atrasado ? 'Atrasado' : prazoProximo ? 'Atenção' : parado ? 'Atenção' : 'Em andamento';
      const prioridade = atrasado ? 0 : prazoProximo ? 1 : parado ? 2 : 3;
      return { id: p.id, nome: p.objeto || 'Trabalho', status, prazo: p.prazo, updatedAt: p.updatedAt, prioridade };
    });
    let trabalhosAtencao = trabalhosInfo.filter(t => t.prioridade < 3).sort((a, b) => a.prioridade - b.prioridade || (a.prazo || '9999').localeCompare(b.prazo || '9999')).slice(0, 5);
    if (trabalhosAtencao.length < 3) {
      const extras = trabalhosInfo.filter(t => !trabalhosAtencao.includes(t)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5 - trabalhosAtencao.length);
      trabalhosAtencao = [...trabalhosAtencao, ...extras];
    }

    // ── Financeiro (resumo) — reaproveita exatamente os mesmos números já
    // calculados acima; não recalcula nada com regra nova. ──
    const financeiro = {
      recebido: receitaMes, aReceber, aPagar, resultadoPrevisto: aReceber - aPagar,
      alerta: aReceberAtrasado > 0
        ? `${clientesInadimplentes.size} cobrança${clientesInadimplentes.size > 1 ? 's' : ''} vencida${clientesInadimplentes.size > 1 ? 's' : ''} — ${fmtMoney(aReceberAtrasado)}`
        : primeiraSemanaNegativa
          ? `Caixa projetado fica negativo em ${primeiraSemanaNegativa.label === 'hoje' ? 'breve' : primeiraSemanaNegativa.label}`
          : null,
      cobrarAgoraIds,
    };

    // ── Atividade recente — histórico global de verdade (getHistorico sem
    // filtro), não um feed inventado. ──
    const atividadeRecente = getHistorico().slice(0, 4);

    return {
      attention, cashflow, etapas, tasks, clients, compromissos, trabalhosAtivosTotal: trabalhosAtivos.length, saldoProjetado, saudeEscritorio, reserva,
      statusGeral, kpis, atencaoTop, hojeAgenda, trabalhosAtencao, financeiro, atividadeRecente,
    };
  }, [transactions, shell.refreshKey]);

  const maxCash = Math.max(1, ...cashflow.flatMap(m => [m.receita, m.despesa]));
  const tiposPresentes = Array.from(new Set(attention.map(a => a.tipo)));
  const filaVisivel = filtro === 'tudo' ? attention : attention.filter(a => a.tipo === filtro);
  const selecionaveis = filaVisivel.filter(a => a.clienteIdParaLembrete);
  const todosSelecionados = selecionaveis.length > 0 && selecionaveis.every(a => selecionados.includes(a.id));
  const maxSaldoProjetado = Math.max(1, ...saldoProjetado.map(p => Math.abs(p.saldo)));
  void todosSelecionados;

  function marcarCobrado(clienteId: string | undefined) {
    if (!clienteId) return;
    const client = clients.find(c => c.id === clienteId);
    if (!client) return;
    updateClient(toggleLembreteCobranca(client));
  }

  function cobrarAgoraClick() {
    if (financeiro.cobrarAgoraIds.length === 0) return;
    setFiltro('Cobranca');
    const idsCobranca = attention.filter(a => a.tipo === 'Cobranca' && a.clienteIdParaLembrete && financeiro.cobrarAgoraIds.includes(a.clienteIdParaLembrete)).map(a => a.id);
    setSelecionados(idsCobranca);
    document.getElementById('fila-completa')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cumprirExigenciaInline(ref: { processId: string; exigenciaId: string }) {
    const trabalho = getProcesses().find(p => p.id === ref.processId);
    if (!trabalho?.registro) return;
    const atual = trabalho.registro.exigencias || [];
    const exigencia = atual.find(e => e.id === ref.exigenciaId);
    if (!exigencia) return;
    const atualizadas = atual.map(e => (e.id === ref.exigenciaId ? { ...e, status: 'Cumprida' as const, cumpridaEm: Date.now() } : e));
    updateProcess({ ...trabalho, registro: { ...trabalho.registro, exigencias: atualizadas } });
    registrarEvento({
      modulo: 'Cartório',
      texto: `Exigência cumprida — ${exigencia.descricao}`,
      clienteId: trabalho.clienteId,
      trabalhoId: trabalho.id,
    });
    toast.success('Exigência marcada como cumprida.');
    shell.refresh();
  }

  function abrirLembrete(a: AttentionItem) {
    if (!a.whatsapp) return;
    setLembrete({ ...a.whatsapp, clienteId: a.clienteIdParaLembrete });
    setMensagemEditada(a.whatsapp.mensagem);
  }

  function salvarTelefoneInline(clienteId: string) {
    if (!telefoneDdd.trim() || !telefoneNumero.trim()) { toast.error('Informe DDD e número.'); return; }
    const cliente = getClients().find(c => c.id === clienteId);
    if (!cliente) return;
    updateClient({ ...cliente, telefone: { ddd: telefoneDdd.replace(/\D/g, ''), numero: telefoneNumero.replace(/\D/g, '') } });
    toast.success('Telefone salvo.');
    setTelefoneInlineId(null);
    setTelefoneDdd('');
    setTelefoneNumero('');
    shell.refresh();
  }

  function kpiClick(to: string) {
    if (to.startsWith('#')) { document.getElementById(to.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    navigate(to);
  }

  function atencaoItemAction(a: AttentionItem) {
    if (a.transactionId) { const tx = transactions.find(t => t.id === a.transactionId); if (tx) shell.openCompleteTransaction(tx); return; }
    if (a.exigenciaRef) { cumprirExigenciaInline(a.exigenciaRef); return; }
    navigate(a.to);
  }

  const STATUS_STYLE = {
    critical: { wrap: 'bg-destructive-soft border-destructive/30', icon: 'text-destructive', titulo: 'text-destructive', texto: 'text-destructive/80' },
    warning: { wrap: 'bg-warning-soft border-warning-border', icon: 'text-warning', titulo: 'text-warning', texto: 'text-warning/85' },
    success: { wrap: 'bg-success-soft border-success/30', icon: 'text-success', titulo: 'text-success', texto: 'text-success/80' },
  } as const;
  const statusStyle = STATUS_STYLE[statusGeral.tom];

  const SEVERITY_ROW = {
    critical: { wrap: 'bg-destructive-soft', dot: 'bg-destructive', titulo: 'text-destructive', btn: 'bg-destructive text-destructive-foreground' },
    warning: { wrap: 'bg-warning-soft', dot: 'bg-warning', titulo: 'text-warning', btn: 'bg-warning text-warning-foreground' },
    info: { wrap: 'bg-accent-soft', dot: 'bg-accent', titulo: 'text-accent', btn: 'bg-accent text-accent-foreground' },
  } as const;

  const TRABALHO_STATUS_STYLE: Record<string, string> = {
    Atrasado: 'bg-destructive-soft text-destructive',
    Atenção: 'bg-warning-soft text-warning',
    'Em andamento': 'bg-accent-soft text-accent',
  };

  return (
    <div className="flex flex-col gap-3 animate-hbs-in">
      {/* HEADER */}
      <div className="order-1 flex items-end justify-between gap-3 flex-wrap flex-none">
        <div className="min-w-0">
          <h1 className="text-[19px] font-semibold -tracking-[.02em] leading-tight">{saudacao()}, Jádson.</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">Aqui está o resumo do seu escritório hoje — {dataPorExtenso()}.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => shell.openNovoTrabalho()} className="h-8 px-2.5 bg-card border-2 rounded-lg text-[11.5px] hover:border-hover transition-colors flex items-center gap-1.5"><Layers className="w-3 h-3" /> Novo trabalho</button>
          <button onClick={() => navigate('/producao')} className="h-8 px-2.5 bg-card border-2 rounded-lg text-[11.5px] hover:border-hover transition-colors flex items-center gap-1.5"><FileStack className="w-3 h-3" /> Gerar documento</button>
          <button onClick={() => navigate('/comercial')} className="h-8 px-2.5 bg-card border-2 rounded-lg text-[11.5px] hover:border-hover transition-colors flex items-center gap-1.5"><Handshake className="w-3 h-3" /> Nova proposta</button>
          <button onClick={() => shell.openNovoRecebimento()} className="h-8 px-2.5 bg-primary text-primary-foreground rounded-lg text-[11.5px] hover:bg-primary-hover transition-colors flex items-center gap-1.5"><Landmark className="w-3 h-3" /> Lançar recebimento</button>
        </div>
      </div>

      {/* STATUS GERAL */}
      <div className={cn('order-2 flex items-center gap-3 rounded-xl border px-4 py-3 flex-none', statusStyle.wrap)}>
        <AlertTriangle className={cn('w-[18px] h-[18px] flex-none', statusStyle.icon)} strokeWidth={2} />
        <div className="min-w-0">
          <div className={cn('text-[13.5px] font-semibold', statusStyle.titulo)}>{statusGeral.titulo}</div>
          <div className={cn('text-[12px] mt-[1px]', statusStyle.texto)}>{statusGeral.texto}</div>
        </div>
      </div>

      {/* KPIs — depois de Atenção no mobile, antes no desktop (ordem pedida por breakpoint) */}
      <div className="order-4 lg:order-3 grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-xl overflow-hidden flex-none">
        {kpis.map(k => (
          <button key={k.label} onClick={() => kpiClick(k.to)} className="bg-card px-3.5 pt-3 pb-3 text-left hover:bg-surface-3 transition-colors">
            <div className="text-[10px] tracking-[.05em] uppercase text-mute-2 font-medium">{k.label}</div>
            <div className="font-mono-hbs text-[21px] font-semibold -tracking-[.02em] mt-1.5">
              {k.money ? <ValorMonetario value={k.value} /> : k.value}
            </div>
            <div className={cn('text-[10.5px] mt-1', k.deltaColor)}>{k.delta}</div>
            <div className="text-[11px] font-semibold text-primary mt-2 pt-2 border-t border-3">{k.cta} →</div>
          </button>
        ))}
      </div>

      {/* PRECISA DA SUA ATENÇÃO — antes dos KPIs no mobile, depois no desktop */}
      <section id="atencao" className="order-3 lg:order-4 bg-card border border-border rounded-xl p-4 flex-none">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="text-[15px] font-semibold">Precisa da sua atenção</div>
          <div className="text-[11.5px] text-mute-2">{attention.length} {attention.length === 1 ? 'item' : 'itens'}</div>
        </div>
        <p className="text-[12px] text-muted-foreground mt-0.5 mb-3">O que precisa ser resolvido agora.</p>

        {atencaoTop.length === 0 ? (
          <div className="py-8 text-center text-[12.5px] text-muted-foreground flex flex-col items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Nada pendente agora. Bom sinal.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {atencaoTop.map(a => {
              const s = SEVERITY_ROW[a.severity];
              const acaoLabel = a.transactionId ? 'Recebido' : a.exigenciaRef ? 'Cumprir' : a.cta;
              return (
                <div key={a.id} className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-lg px-3.5 py-2.5', s.wrap)}>
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className={cn('w-2 h-2 rounded-full flex-none mt-[5px]', s.dot)} />
                    <div className="min-w-0">
                      <div className={cn('text-[13px] font-semibold leading-[1.3]', s.titulo)}>{a.title}</div>
                      {a.sub && <div className="text-[11.5px] text-muted-foreground mt-[1px] leading-[1.35]">{a.sub}</div>}
                    </div>
                  </div>
                  <button onClick={() => atencaoItemAction(a)} className={cn('flex-none h-7 px-3 rounded-md text-[11.5px] font-semibold whitespace-nowrap hover:opacity-90 transition-opacity self-start sm:self-auto ml-[18px] sm:ml-0', s.btn)}>
                    {acaoLabel}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {attention.length > 0 && (
          <div className="text-right mt-3">
            <button onClick={() => document.getElementById('fila-completa')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="text-[12.5px] font-semibold text-primary">
              Ver todas as pendências →
            </button>
          </div>
        )}
      </section>

      {/* HOJE + TRABALHOS QUE MERECEM ATENÇÃO */}
      <div className="order-5 grid grid-cols-1 lg:grid-cols-2 gap-3 flex-none items-start">
        <section className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[14px] font-semibold">Hoje</div>
            <button onClick={() => abrirNovoCompromisso()} className="text-mute-2 hover:text-primary transition-colors" title="Agendar compromisso"><CalendarPlus className="w-4 h-4" /></button>
          </div>
          {hojeAgenda.length === 0 ? (
            <div className="text-[12.5px] text-muted-foreground py-3">Nada agendado para hoje.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {hojeAgenda.map(c => (
                <div key={c.id} onClick={() => abrirEditarCompromisso(c)} className="flex gap-3.5 cursor-pointer">
                  <div className="font-mono-hbs text-[12.5px] text-mute-2 w-[42px] flex-none pt-[1px]">{c.horaInicio || '—'}</div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate">{c.titulo}</div>
                    {c.comQuem && <div className="text-[11.5px] text-muted-foreground truncate mt-[1px]">{c.comQuem}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-card border border-border rounded-xl p-4">
          <div className="text-[14px] font-semibold mb-3">Trabalhos que merecem atenção</div>
          {trabalhosAtencao.length === 0 ? (
            <div className="text-[12.5px] text-muted-foreground py-3">Nenhum trabalho ativo agora.</div>
          ) : (
            <div className="flex flex-col">
              {trabalhosAtencao.map(t => (
                <div key={t.id} onClick={() => navigate(`/trabalhos/${t.id}`)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 py-[9px] border-b border-3 last:border-b-0 cursor-pointer">
                  <div className="text-[13px] leading-[1.3] flex-1 min-w-0">{t.nome}</div>
                  <div className="flex items-center gap-2.5 flex-none">
                    <span className={cn('text-[10.5px] font-semibold px-2 py-[3px] rounded-md', TRABALHO_STATUS_STYLE[t.status])}>{t.status}</span>
                    <span className="font-mono-hbs text-[11.5px] text-mute-2 w-9 text-right">{t.prazo ? t.prazo.slice(8, 10) + '/' + t.prazo.slice(5, 7) : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="text-right mt-3">
            <button onClick={() => navigate('/trabalhos')} className="text-[12.5px] font-semibold text-primary">Ver todos os trabalhos →</button>
          </div>
        </section>
      </div>

      {/* FINANCEIRO + ATIVIDADE + SAÚDE */}
      <div className="order-6 grid grid-cols-1 lg:grid-cols-3 gap-3 flex-none items-start">
        <section className="bg-card border border-border rounded-xl p-4">
          <div className="text-[14px] font-semibold mb-3">Financeiro</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><div className="font-mono-hbs text-[16.5px] font-semibold"><ValorMonetario value={fmtMoney(financeiro.recebido)} /></div><div className="text-[11px] text-muted-foreground mt-0.5">Recebido</div></div>
            <div><div className="font-mono-hbs text-[16.5px] font-semibold"><ValorMonetario value={fmtMoney(financeiro.aReceber)} /></div><div className="text-[11px] text-muted-foreground mt-0.5">A receber</div></div>
            <div><div className="font-mono-hbs text-[16.5px] font-semibold"><ValorMonetario value={fmtMoney(financeiro.aPagar)} /></div><div className="text-[11px] text-muted-foreground mt-0.5">A pagar</div></div>
            <div><div className={cn('font-mono-hbs text-[16.5px] font-semibold', financeiro.resultadoPrevisto < 0 && 'text-destructive')}><ValorMonetario value={fmtMoney(financeiro.resultadoPrevisto)} /></div><div className="text-[11px] text-muted-foreground mt-0.5">Resultado previsto</div></div>
          </div>
          {financeiro.alerta && (
            <button onClick={cobrarAgoraClick} className="w-full text-left text-[11.5px] text-destructive bg-destructive-soft rounded-lg px-3 py-2 mb-3 flex items-center gap-1.5 hover:opacity-90 transition-opacity">
              <AlertTriangle className="w-3.5 h-3.5 flex-none" /> {financeiro.alerta}
            </button>
          )}
          <button onClick={() => navigate('/caixa')} className="text-[12.5px] font-semibold text-primary">Ver financeiro →</button>
        </section>

        <section className="bg-card border border-border rounded-xl p-4">
          <div className="text-[14px] font-semibold mb-3">Atividade recente</div>
          {atividadeRecente.length === 0 ? (
            <div className="text-[12.5px] text-muted-foreground py-3">Nenhuma atividade registrada ainda.</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {atividadeRecente.map(ev => (
                <div key={ev.id} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success flex-none mt-[2px]" />
                  <div className="text-[12.5px] text-foreground/85 leading-[1.4]">{ev.texto}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-[14px] font-semibold">Saúde do escritório</div>
            <div className="font-mono-hbs text-[17px] font-semibold">{saudeEscritorio.nota}<span className="text-[11px] text-mute-2 font-normal">/100</span></div>
          </div>
          <div className={cn('text-[11.5px] font-semibold mb-2.5', saudeEscritorio.nota >= 80 ? 'text-success' : saudeEscritorio.nota >= 50 ? 'text-warning' : 'text-destructive')}>{saudeEscritorio.status}</div>
          <div className="flex flex-col gap-1 mb-3">
            {saudeEscritorio.motivos.map((m, i) => <div key={i} className="text-[11.5px] text-muted-foreground">• {m}</div>)}
          </div>
          <button onClick={() => navigate('/relatorios')} className="text-[12.5px] font-semibold text-primary">Ver análise →</button>
        </section>
      </div>

      {/* INFORMAÇÕES SECUNDÁRIAS */}
      <div className="order-7 flex flex-col gap-3 pt-1">
        <div className="text-[11px] uppercase tracking-[.08em] text-mute-3 font-semibold px-1">Mais informações</div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] gap-2.5 items-start">

          {/* Fila de hoje — attention.ts inteiro, filtrável, com ação de cobrança em lote */}
          <section id="fila-completa" className="bg-card border border-border rounded-xl overflow-hidden flex flex-col lg:min-h-[420px]">
            <div className="px-3 py-2 border-b border-3 flex items-center gap-2 flex-wrap">
              <div className="text-[12.5px] font-semibold">Fila completa</div>
              <span className="text-[10.5px] font-mono-hbs text-mute-2">{filaVisivel.length} de {attention.length}</span>
              <div className="flex-1" />
              <div className="flex gap-1 flex-wrap justify-end">
                <button onClick={() => setFiltro('tudo')} className={cn('px-2 h-6 rounded-full text-[11px] font-medium border', filtro === 'tudo' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-mute-2 hover:border-hover')}>Tudo</button>
                {tiposPresentes.map(t => (
                  <button key={t} onClick={() => setFiltro(t)} className={cn('px-2 h-6 rounded-full text-[11px] font-medium border', filtro === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-mute-2 hover:border-hover')}>{TIPO_LABEL[t]}</button>
                ))}
              </div>
            </div>

            {selecionados.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-accent-soft border-b border-border">
                <span className="text-[11.5px] font-mono-hbs font-semibold text-accent">{selecionados.length} selecionados</span>
                <div className="flex-1" />
                <button
                  onClick={() => { selecionados.forEach(id => { const a = attention.find(x => x.id === id); if (a?.clienteIdParaLembrete) marcarCobrado(a.clienteIdParaLembrete); }); setSelecionados([]); }}
                  className="h-6 px-2.5 rounded-md bg-warning text-warning-foreground text-[11px] font-medium"
                >Marcar como cobrado</button>
                <button onClick={() => setSelecionados([])} className="h-6 px-2 text-[11px] text-mute-2">Limpar</button>
              </div>
            )}

            {filaVisivel.length === 0 ? (
              <div className="px-3 py-8 text-center text-[12px] text-muted-foreground">Nada nesta fila. Bom sinal.</div>
            ) : (
              <div className="flex-1">
                {filaVisivel.map(a => {
                  const historico = a.lembretesCobranca || [];
                  const ultimoLembrete = historico.length > 0 ? Math.max(...historico) : null;
                  const cobradoHoje = ultimoLembrete && new Date(ultimoLembrete).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
                  const sel = selecionados.includes(a.id);
                  const semTelefone = !a.whatsapp && !!a.clienteIdParaLembrete;
                  const telefoneAberto = telefoneInlineId === a.clienteIdParaLembrete;
                  return (
                    <div key={a.id} className={cn('px-3 py-[7px] border-b border-3', !telefoneAberto && 'hover:bg-surface-3 transition-colors')}>
                      <div className="flex items-center gap-2">
                        {a.clienteIdParaLembrete ? (
                          <input type="checkbox" checked={sel} onChange={() => setSelecionados(s => sel ? s.filter(x => x !== a.id) : [...s, a.id])} className="w-3.5 h-3.5 accent-accent flex-none" />
                        ) : <span className="w-3.5 flex-none" />}
                        <span className={cn('w-[3px] self-stretch rounded-[2px] min-h-[24px]', a.severity === 'critical' ? 'bg-destructive' : a.severity === 'warning' ? 'bg-warning' : 'bg-mute-3')} />
                        <div onClick={() => navigate(a.to)} className="min-w-0 flex-1 cursor-pointer">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('text-[8.5px] px-1.5 py-[1px] rounded-[4px] font-semibold uppercase tracking-wide flex-none', TIPO_TAG[a.tipo])}>{TIPO_LABEL[a.tipo]}</span>
                            <span className="text-[11.5px] font-medium leading-[1.3] truncate">{a.title}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate mt-[1px]">{a.sub}{cobradoHoje && <span className="text-success font-medium"> · ✓ cobrado hoje</span>}</div>
                        </div>
                        <div className="flex items-center gap-1 flex-none">
                          {a.exigenciaRef && (
                            <button onClick={() => cumprirExigenciaInline(a.exigenciaRef!)} title="Marcar exigência como cumprida" className="h-6 w-6 grid place-items-center rounded-md hover:bg-success-soft text-mute-2 hover:text-success"><Check className="w-3 h-3" /></button>
                          )}
                          {a.transactionId && (
                            <button
                              onClick={() => { const tx = transactions.find(t => t.id === a.transactionId); if (tx) shell.openCompleteTransaction(tx); }}
                              title="Marcar como recebido — some da fila de verdade"
                              className="h-6 px-2 rounded-md text-[10.5px] font-medium bg-success text-success-foreground hover:opacity-90 flex-none whitespace-nowrap flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Recebido
                            </button>
                          )}
                          {a.whatsapp && (
                            <button onClick={() => abrirLembrete(a)} title="Enviar lembrete por WhatsApp" className="h-6 w-6 grid place-items-center bg-warning text-warning-foreground rounded-md hover:opacity-90"><MessageCircle className="w-3 h-3" /></button>
                          )}
                          {semTelefone ? (
                            <button
                              onClick={() => { setTelefoneInlineId(telefoneAberto ? null : a.clienteIdParaLembrete!); setTelefoneDdd(''); setTelefoneNumero(''); }}
                              className="text-[10px] font-medium text-accent whitespace-nowrap flex items-center gap-0.5"
                            >
                              + telefone
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate(a.to)}
                              className={cn(
                                'h-6 px-2 rounded-md text-[10.5px] font-medium whitespace-nowrap flex-none',
                                a.severity === 'critical' ? 'bg-destructive text-destructive-foreground hover:opacity-90' : 'bg-neutral-soft text-foreground hover:bg-surface-3'
                              )}
                            >
                              {a.cta}
                            </button>
                          )}
                        </div>
                      </div>
                      {telefoneAberto && (
                        <div className="flex items-center gap-1.5 mt-1.5 pl-[23px]">
                          <Input value={telefoneDdd} onChange={e => setTelefoneDdd(e.target.value)} placeholder="DDD" maxLength={2} className="h-7 text-[11px] w-12" autoFocus />
                          <Input value={telefoneNumero} onChange={e => setTelefoneNumero(e.target.value)} onKeyDown={e => e.key === 'Enter' && salvarTelefoneInline(a.clienteIdParaLembrete!)} placeholder="Número" maxLength={9} className="h-7 text-[11px] flex-1" />
                          <button onClick={() => salvarTelefoneInline(a.clienteIdParaLembrete!)} className="h-7 px-2.5 bg-primary text-primary-foreground rounded-md text-[11px] font-medium flex-none">Salvar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-2.5">
            {/* Reserva & disponível pra você — saldo real das contas, sem fórmula sobre histórico. */}
            <section className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-mute-2" />
                  <span className="text-[12.5px] font-semibold">Reserva & disponível pra você</span>
                </div>
                <button onClick={() => navigate('/caixa/contas')} className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary-hover transition-colors">
                  Ver contas
                </button>
              </div>
              {reserva.temContaReserva ? (
                <div className="grid grid-cols-2 gap-px bg-border border border-border rounded-lg overflow-hidden">
                  <div className="bg-card px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[.06em] text-mute-2"><PiggyBank className="w-3 h-3" /> Reserva da empresa</div>
                    <div className="font-mono-hbs text-[19px] mt-1">{fmtMoney(reserva.reserva)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">saldo real de "{reserva.contaNome}"</div>
                  </div>
                  <div className="bg-card px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[.06em] text-mute-2">Disponível pra você agora</div>
                    <div className={cn('font-mono-hbs text-[19px] mt-1', reserva.disponivelAgora < 0 ? 'text-destructive' : 'text-success')}>{fmtMoney(reserva.disponivelAgora)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{fmtMoney(reserva.caixaTotal)} em caixa no total</div>
                  </div>
                </div>
              ) : (
                <div className="text-[11.5px] text-muted-foreground bg-surface-2 border border-3 rounded-lg px-2.5 py-2.5">
                  Marque uma das suas contas como "conta reserva da empresa" em <button onClick={() => navigate('/caixa/contas')} className="text-accent font-medium underline underline-offset-2">Contas</button> pra acompanhar aqui quanto está protegido e quanto sobra pra você.
                </div>
              )}
            </section>

            {/* Caixa real (6 meses fechados) + projeção (8 semanas à frente) */}
            <section className="bg-card border border-border rounded-xl px-3 pt-2.5 pb-2.5 flex flex-col">
              <div className="flex items-baseline justify-between">
                <div className="text-[12.5px] font-semibold">Caixa · real & projeção</div>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-[7px] h-[7px] rounded-[2px] bg-accent" />Receita</span>
                  <span className="flex items-center gap-1"><span className="w-[7px] h-[7px] rounded-[2px] bg-warning" />Despesa</span>
                </div>
              </div>
              <div className="text-[9.5px] uppercase tracking-[.06em] text-mute-3 mt-2">6 meses fechados</div>
              <div className="flex items-end gap-2.5 h-[130px] mt-1.5">
                {cashflow.map(m => (
                  <div key={m.mes} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                    <div className="flex-1 w-full flex items-end justify-center gap-1">
                      <div className="w-2.5 rounded-t-[3px] bg-accent" style={{ height: `${Math.max(2, (m.receita / maxCash) * 100)}%` }} title={`Receita · ${fmtMoney(m.receita)}`} />
                      <div className="w-2.5 rounded-t-[3px] bg-warning" style={{ height: `${Math.max(2, (m.despesa / maxCash) * 100)}%` }} title={`Despesa · ${fmtMoney(m.despesa)}`} />
                    </div>
                    <span className="text-[9.5px] text-mute-2 font-mono-hbs">{m.mes}</span>
                  </div>
                ))}
              </div>

              <div className="text-[9.5px] uppercase tracking-[.06em] text-mute-3 mt-3 pt-3 border-t border-3">Saldo projetado · 8 semanas, só o que já está lançado</div>
              <div className="flex items-end gap-1.5 h-[110px] mt-1.5">
                {saldoProjetado.map(p => {
                  const negativo = p.saldo < 0;
                  const alturaPct = Math.max(4, (Math.abs(p.saldo) / maxSaldoProjetado) * 100);
                  return (
                    <div key={p.semana} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <div
                        className={cn('w-full rounded-t-[3px]', negativo ? 'bg-destructive' : 'bg-accent')}
                        style={{ height: `${alturaPct}%` }}
                        title={`${p.label} · ${fmtMoney(p.saldo)}`}
                      />
                      <span className="text-[9px] text-mute-2 font-mono-hbs">{p.label}</span>
                    </div>
                  );
                })}
              </div>
              {saldoProjetado.some(p => p.saldo < 0) && (
                <div className="text-[10.5px] text-destructive mt-1.5">Saldo fica negativo em alguma semana das próximas 8.</div>
              )}
            </section>

            {/* Trabalhos por etapa — pipeline inteiro, cada etapa diz o que fazer */}
            <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col min-h-[220px]">
              <div className="px-3 py-2 border-b border-3 flex items-center justify-between gap-2">
                <div className="text-[12.5px] font-semibold">Trabalhos por etapa</div>
                <button onClick={() => navigate('/trabalhos')} className="text-[10.5px] font-medium text-accent flex items-center gap-0.5"><ChevronLeft className="w-2.5 h-2.5 rotate-180" />Todos</button>
              </div>
              <div className="flex-1">
                {etapas.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">Nenhum trabalho em andamento.</div>
                ) : etapas.map(e => (
                  <div key={e.etapa} onClick={() => navigate('/trabalhos')} className={cn('px-3 py-[8px] border-b border-3 last:border-b-0 cursor-pointer hover:bg-surface-3 transition-colors', e.destaque && 'bg-warning-soft')}>
                    <div className="flex items-center gap-2">
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-none', e.dot)} />
                      <div className="text-[11.5px] font-medium flex-1">{e.etapa}</div>
                      {e.destaque && <Flame className="w-3 h-3 text-warning flex-none" />}
                      <span className="font-mono-hbs text-[10px] text-mute-2 flex-none">{e.count}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5 pl-3.5">{e.destaque ? `Parado em média há ${Math.round(e.diasParadoMedio)} dias — ${e.acao.toLowerCase()}` : e.acao}</div>
                    <div className="h-1 bg-bar-track rounded-full mt-1.5 ml-3.5 overflow-hidden">
                      <div className={cn('h-full rounded-full', e.destaque ? 'bg-warning' : 'bg-accent-faded')} style={{ width: `${e.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div>
          <CalendarioAgenda compromissos={compromissos} tasks={tasks} transactions={transactions} clients={clients} onNovo={abrirNovoCompromisso} onEditar={abrirEditarCompromisso} />
        </div>
      </div>

      <Dialog open={!!lembrete} onOpenChange={v => !v && setLembrete(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Lembrete para {lembrete?.clienteNome}</DialogTitle></DialogHeader>
          <p className="text-[12px] text-muted-foreground -mt-2">Revise ou ajuste o texto antes de enviar.</p>
          <Textarea value={mensagemEditada} onChange={e => setMensagemEditada(e.target.value)} className="min-h-[220px] text-[13px]" />
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setLembrete(null)} className="h-9 px-3.5 rounded-lg text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
            <button
              onClick={() => { if (!lembrete) return; window.open(linkWhatsApp(lembrete.telefone.ddd, lembrete.telefone.numero, mensagemEditada), '_blank', 'noreferrer'); marcarCobrado(lembrete.clienteId); setLembrete(null); }}
              className="h-9 px-3.5 bg-warning text-warning-foreground rounded-lg text-[12.5px] font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
            ><MessageCircle className="w-3.5 h-3.5" /> Abrir no WhatsApp</button>
          </div>
        </DialogContent>
      </Dialog>

      <NovoCompromissoDialog open={compromissoDialogOpen} onClose={() => setCompromissoDialogOpen(false)} compromisso={compromissoEditando} dataInicial={novoCompromissoData} />
    </div>
  );
}
