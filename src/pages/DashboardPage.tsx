import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle, Check, ChevronLeft, Wallet, AlertTriangle, CheckCircle2, ArrowRight,
  Layers, FileStack, Handshake, Landmark, Users, ScrollText, CalendarDays, PiggyBank, type LucideIcon,
} from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getAccounts, getProcesses, getClients, getTasks, getPropostas, getCompromissos, getCompanyConfig, getHistorico, updateClient, updateProcess, registrarEvento } from '@/lib/storage';
import { computeAttentionItems, AttentionItem, AttentionTipo, toggleLembreteCobranca } from '@/lib/attention';
import { computeReserva } from '@/lib/reserva';
import { entradasNoMes, saidasNoMes, totalAReceber, totalAPagar } from '@/lib/financials';
import { linkWhatsApp } from '@/lib/mensagens';
import { TrabalhoEtapa, HistoricoModulo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/KpiCard';
import { toast } from 'sonner';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const WEEKDAYS_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const STAGE_ORDER: TrabalhoEtapa[] = ['Aguardando cliente', 'Levantamento', 'Tramitando', 'Devolutiva', 'Concluído'];
const STAGE_LABEL_CURTO: Record<TrabalhoEtapa, string> = { 'Aguardando cliente': 'aguardando cliente', Levantamento: 'levantamento', Tramitando: 'tramitando', Devolutiva: 'devolutiva', Concluído: 'concluído' };

const MODULO_ICON: Record<HistoricoModulo, { icon: LucideIcon; tone: string }> = {
  Financeiro: { icon: Landmark, tone: 'text-success' },
  Trabalhos: { icon: Layers, tone: 'text-accent' },
  'Produção Técnica': { icon: FileStack, tone: 'text-accent' },
  Clientes: { icon: Users, tone: 'text-accent' },
  Comercial: { icon: Handshake, tone: 'text-accent' },
  Cartório: { icon: ScrollText, tone: 'text-warning' },
};

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
function tempoRelativo(ts: number) {
  const diffH = (Date.now() - ts) / 3600000;
  if (diffH < 1) return 'há poucos minutos';
  if (diffH < 24) return `há ${Math.round(diffH)}h`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return 'ontem';
  if (diffD < 7) return `há ${diffD}d`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function dataCurta(d: string) {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

const TIPO_LABEL: Record<AttentionTipo, string> = { Cobranca: 'Cobrança', Cartorio: 'Cartório', Orgao: 'Órgão', Pendencia: 'Pendência' };
const TIPO_TAG: Record<AttentionTipo, string> = { Cobranca: 'bg-destructive-soft text-destructive', Cartorio: 'bg-accent-soft text-accent', Orgao: 'bg-warning-soft text-warning', Pendencia: 'bg-neutral-soft text-mute-2' };

/** Dashboard — cockpit gerencial (HBS 2.0, Fase 3). Resume o financeiro (mesma fonte de verdade
 *  de src/lib/financials.ts que já alimenta a Visão Geral — nenhum cálculo próprio aqui), o que
 *  precisa de atenção (attention.ts) e o que está acontecendo nos trabalhos/agenda. O calendário
 *  completo mora só em /agenda agora — aqui é só um resumo compacto com link. */
export default function DashboardPage() {
  const shell = useShell();
  const navigate = useNavigate();
  const { allTransactions: transactions } = shell;
  const [lembrete, setLembrete] = useState<{ clienteId?: string; clienteNome: string; telefone: { ddd: string; numero: string }; mensagem: string } | null>(null);
  const [mensagemEditada, setMensagemEditada] = useState('');
  const [filtro, setFiltro] = useState<'tudo' | AttentionTipo>('tudo');
  const [telefoneInlineId, setTelefoneInlineId] = useState<string | null>(null);
  const [telefoneDdd, setTelefoneDdd] = useState('');
  const [telefoneNumero, setTelefoneNumero] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const {
    attention, cashflow, etapasResumo, saudeEscritorio, reserva,
    statusGeral, kpisHero, kpisSecundarios, atencaoTop, hojeAgenda, proximosDias, trabalhosAtencao, atividadeRecente,
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
    const aReceber = totalAReceber(transactions);
    const aPagar = totalAPagar(transactions);
    const aReceberAtrasado = aReceberTx.filter(t => t.data < today).reduce((s, t) => s + t.valor, 0);
    // Mesma fórmula da Visão Geral (saldoAtual + aReceber - aPagar) — não recalcula diferente.
    const saldoProjetadoScalar = saldoDisponivel + aReceber - aPagar;

    const entradasMes = entradasNoMes(transactions, now.getFullYear(), now.getMonth());
    const saidasMes = saidasNoMes(transactions, now.getFullYear(), now.getMonth());
    const resultadoMes = entradasMes - saidasMes;

    const trabalhosAtivos = processes.filter(p => !p.isArchived && (p.etapa || 'Levantamento') !== 'Concluído');
    const parados14d = trabalhosAtivos.filter(p => Date.now() - p.updatedAt > 14 * 86400000).length;

    const registrosComRegistro = processes.filter(p => !p.isArchived && p.registro);
    const prazosSete = registrosComRegistro.filter(p => {
      const r = p.registro!;
      const exigenciaProxima = (r.exigencias || []).some(e => e.status === 'Aberta' && e.prazo && e.prazo <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
      const prenotacaoProxima = r.dataPrenotacao && !r.matricula && (r.prazoPrenotacaoDias ?? 30) - Math.round((Date.now() - new Date(r.dataPrenotacao + 'T12:00:00').getTime()) / 86400000) <= 7;
      return exigenciaProxima || prenotacaoProxima;
    }).length;

    const attention = computeAttentionItems(transactions, clients, tasks, processes, getPropostas());

    const cashflow = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const receita = entradasNoMes(transactions, d.getFullYear(), d.getMonth());
      const despesa = saidasNoMes(transactions, d.getFullYear(), d.getMonth());
      return { mes: MONTHS_SHORT[d.getMonth()], receita, despesa };
    });

    // Resumo de etapas — só contagem, sem barra de progresso/gargalo (isso é papel do Kanban).
    const etapasResumo = STAGE_ORDER
      .map(etapa => ({ etapa, label: STAGE_LABEL_CURTO[etapa], count: trabalhosAtivos.filter(p => (p.etapa || 'Levantamento') === etapa).length }))
      .filter(e => e.count > 0);

    const inadimplenciaPct = aReceber > 0 ? Math.round((aReceberAtrasado / aReceber) * 1000) / 10 : 0;

    let nota = 100;
    const motivos: string[] = [];
    if (inadimplenciaPct > 0) { nota -= Math.min(40, inadimplenciaPct); motivos.push(`Inadimplência de ${inadimplenciaPct}%`); }
    if (parados14d > 0) { nota -= Math.min(30, parados14d * 10); motivos.push(`${parados14d} trabalho${parados14d > 1 ? 's' : ''} parado${parados14d > 1 ? 's' : ''} há mais de 14 dias`); }
    if (prazosSete > 0) { nota -= Math.min(20, prazosSete * 5); motivos.push(`${prazosSete} prazo${prazosSete > 1 ? 's' : ''} de cartório apertado${prazosSete > 1 ? 's' : ''}`); }
    nota = Math.max(0, Math.round(nota));
    const saudeEscritorio = {
      status: nota >= 80 ? 'Tudo sob controle' : nota >= 50 ? 'Atenção' : 'Situação crítica',
      tone: (nota >= 80 ? 'success' : nota >= 50 ? 'warning' : 'destructive') as 'success' | 'warning' | 'destructive',
      motivoPrincipal: motivos[0] || null,
    };

    const criticos = attention.filter(a => a.severity === 'critical').length;
    const avisos = attention.filter(a => a.severity === 'warning').length;
    const statusGeral = criticos > 0
      ? { tom: 'critical' as const, titulo: 'Atenção imediata', texto: `${criticos} situaç${criticos > 1 ? 'ões' : 'ão'} precisa${criticos > 1 ? 'm' : ''} ser resolvida${criticos > 1 ? 's' : ''} agora.` }
      : avisos > 0
        ? { tom: 'warning' as const, titulo: 'Atenção necessária', texto: `${attention.length} ponto${attention.length > 1 ? 's' : ''} precisa${attention.length > 1 ? 'm' : ''} da sua atenção hoje.` }
        : { tom: 'success' as const, titulo: 'Tudo sob controle', texto: 'Nenhuma pendência crítica no momento.' };

    const kpisHero = [
      { label: 'Saldo disponível', value: saldoDisponivel, to: '/caixa/visao-geral', tone: saldoDisponivel < 0 ? 'destructive' as const : 'default' as const },
      { label: 'A receber', value: aReceber, to: '/caixa/cobranca', tone: 'accent' as const },
      { label: 'A pagar', value: aPagar, to: '/caixa/apagar', tone: 'warning' as const },
      { label: 'Saldo projetado', value: saldoProjetadoScalar, to: '/caixa/visao-geral', tone: saldoProjetadoScalar < 0 ? 'destructive' as const : 'default' as const },
    ];
    const kpisSecundarios = [
      { label: 'Entradas', value: entradasMes, tone: 'success' as const },
      { label: 'Saídas', value: saidasMes, tone: 'destructive' as const },
      { label: 'Resultado', value: resultadoMes, tone: (resultadoMes >= 0 ? 'success' : 'destructive') as const },
    ];

    const atencaoTop = attention.slice(0, 5);

    const hojeAgenda = compromissos.filter(c => c.data === today).sort((a, b) => (a.horaInicio || '99:99').localeCompare(b.horaInicio || '99:99'));
    const proximosDias = compromissos
      .filter(c => c.data > today)
      .sort((a, b) => a.data.localeCompare(b.data) || (a.horaInicio || '99:99').localeCompare(b.horaInicio || '99:99'))
      .slice(0, 4);

    const em7Str = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const trabalhosInfo = trabalhosAtivos.map(p => {
      const atrasado = !!p.prazo && p.prazo < today;
      const prazoProximo = !atrasado && !!p.prazo && p.prazo <= em7Str;
      const paradoDias = Math.round((Date.now() - p.updatedAt) / 86400000);
      const parado = !atrasado && !prazoProximo && paradoDias > 14;
      const status = atrasado ? 'Atrasado' : prazoProximo ? 'Atenção' : parado ? 'Atenção' : 'Em andamento';
      const prioridade = atrasado ? 0 : prazoProximo ? 1 : parado ? 2 : 3;
      const clienteNome = clients.find(c => c.id === p.clienteId)?.nome || 'Cliente';
      return { id: p.id, nome: p.objeto || 'Trabalho', clienteNome, status, prazo: p.prazo, updatedAt: p.updatedAt, prioridade };
    });
    let trabalhosAtencao = trabalhosInfo.filter(t => t.prioridade < 3).sort((a, b) => a.prioridade - b.prioridade || (a.prazo || '9999').localeCompare(b.prazo || '9999')).slice(0, 5);
    if (trabalhosAtencao.length < 3) {
      const extras = trabalhosInfo.filter(t => !trabalhosAtencao.includes(t)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5 - trabalhosAtencao.length);
      trabalhosAtencao = [...trabalhosAtencao, ...extras];
    }

    const atividadeRecente = getHistorico().slice(0, 5);

    return {
      attention, cashflow, etapasResumo, saudeEscritorio, reserva,
      statusGeral, kpisHero, kpisSecundarios, atencaoTop, hojeAgenda, proximosDias, trabalhosAtencao, atividadeRecente,
    };
  }, [transactions, shell.refreshKey]);

  const maxCash = Math.max(1, ...cashflow.flatMap(m => [m.receita, m.despesa]));
  const tiposPresentes = Array.from(new Set(attention.map(a => a.tipo)));
  const filaVisivel = filtro === 'tudo' ? attention : attention.filter(a => a.tipo === filtro);

  function marcarCobrado(clienteId: string | undefined) {
    if (!clienteId) return;
    const client = getClients().find(c => c.id === clienteId);
    if (!client) return;
    updateClient(toggleLembreteCobranca(client));
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

  const SAUDE_DOT: Record<'success' | 'warning' | 'destructive', string> = {
    success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive',
  };
  const SAUDE_TEXT: Record<'success' | 'warning' | 'destructive', string> = {
    success: 'text-success', warning: 'text-warning', destructive: 'text-destructive',
  };

  return (
    <div className="flex flex-col gap-3 animate-hbs-in">
      {/* TOPO — saudação + data + Criar (botão global já fica no header do Shell) */}
      <div className="flex items-end justify-between gap-3 flex-wrap flex-none">
        <div className="min-w-0">
          <h1 className="text-[19px] font-semibold -tracking-[.02em] leading-tight">{saudacao()}, Jádson.</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">Aqui está o resumo do seu escritório hoje — {dataPorExtenso()}.</p>
        </div>
      </div>

      {/* ATENÇÃO NECESSÁRIA / TUDO SOB CONTROLE */}
      <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-3 flex-none', statusStyle.wrap)}>
        <AlertTriangle className={cn('w-[18px] h-[18px] flex-none', statusStyle.icon)} strokeWidth={2} />
        <div className="min-w-0">
          <div className={cn('text-[13.5px] font-semibold', statusStyle.titulo)}>{statusGeral.titulo}</div>
          <div className={cn('text-[12px] mt-[1px]', statusStyle.texto)}>{statusGeral.texto}</div>
        </div>
      </div>

      {/* KPIs PRINCIPAIS — mesma fonte de verdade da Visão Geral (financials.ts) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-xl overflow-hidden flex-none">
        {kpisHero.map(k => (
          <KpiCard key={k.label} label={k.label} value={fmtMoney(k.value)} tone={k.tone} onClick={() => navigate(k.to)} />
        ))}
      </div>

      {/* KPIs SECUNDÁRIOS — menores, mesmo grid visual */}
      <div className="grid grid-cols-3 gap-px bg-border border border-border rounded-xl overflow-hidden flex-none">
        {kpisSecundarios.map(k => (
          <KpiCard key={k.label} label={k.label} value={fmtMoney(k.value)} tone={k.tone} size="compact" onClick={() => navigate('/caixa/visao-geral')} />
        ))}
      </div>

      {/* PRECISA DA SUA ATENÇÃO */}
      <section id="atencao" className="bg-card border border-border rounded-xl p-4 flex-none">
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

      {/* FLUXO DE CAIXA COMPACTO — contexto, não protagonista */}
      <section className="bg-card border border-border rounded-xl px-4 py-3 flex-none">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12.5px] font-semibold text-muted-foreground">Fluxo de caixa · 6 meses</div>
          <button onClick={() => navigate('/caixa/visao-geral')} className="text-[11.5px] font-semibold text-primary flex items-center gap-1">Ver financeiro <ArrowRight className="w-3 h-3" /></button>
        </div>
        <div className="flex items-end gap-2 h-[52px]">
          {cashflow.map(m => (
            <div key={m.mes} className="flex-1 flex flex-col items-center gap-1 h-full">
              <div className="flex-1 w-full flex items-end justify-center gap-1">
                <div className="w-2 rounded-t-[2px] bg-accent" style={{ height: `${Math.max(4, (m.receita / maxCash) * 100)}%` }} title={`Entradas · ${fmtMoney(m.receita)}`} />
                <div className="w-2 rounded-t-[2px] bg-warning" style={{ height: `${Math.max(4, (m.despesa / maxCash) * 100)}%` }} title={`Saídas · ${fmtMoney(m.despesa)}`} />
              </div>
              <span className="text-[9px] text-mute-3 font-mono-hbs">{m.mes}</span>
            </div>
          ))}
        </div>
      </section>

      {/* TRABALHOS QUE MERECEM ATENÇÃO */}
      <section className="bg-card border border-border rounded-xl p-4 flex-none">
        <div className="text-[14px] font-semibold mb-3">Trabalhos que merecem atenção</div>
        {trabalhosAtencao.length === 0 ? (
          <div className="text-[12.5px] text-muted-foreground py-3">Nenhum trabalho ativo agora.</div>
        ) : (
          <div className="flex flex-col">
            {trabalhosAtencao.map(t => (
              <div key={t.id} onClick={() => navigate(`/trabalhos/${t.id}`)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 py-[9px] border-b border-3 last:border-b-0 cursor-pointer">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] leading-[1.3] truncate">{t.clienteNome}</div>
                  <div className="text-[11px] text-mute-2 truncate mt-[1px]">{t.nome}</div>
                </div>
                <div className="flex items-center gap-2.5 flex-none">
                  <span className={cn('text-[10.5px] font-semibold px-2 py-[3px] rounded-md', TRABALHO_STATUS_STYLE[t.status])}>{t.status}</span>
                  <span className="font-mono-hbs text-[11.5px] text-mute-2 w-9 text-right">{t.prazo ? dataCurta(t.prazo) : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="text-right mt-3">
          <button onClick={() => navigate('/trabalhos')} className="text-[12.5px] font-semibold text-primary">Ver todos os trabalhos →</button>
        </div>
      </section>

      {/* ATIVIDADE RECENTE — timeline simples sobre o histórico real (getHistorico), agrupado por
          módulo (mesmo campo já usado em toda chamada de registrarEvento — não é dado novo). */}
      <section className="bg-card border border-border rounded-xl p-4 flex-none">
        <div className="text-[14px] font-semibold mb-3">Atividade recente</div>
        {atividadeRecente.length === 0 ? (
          <div className="text-[12.5px] text-muted-foreground py-3">Nenhuma atividade registrada ainda.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {atividadeRecente.map(ev => {
              const m = MODULO_ICON[ev.modulo];
              const Icon = m?.icon || CheckCircle2;
              return (
                <div key={ev.id} className="flex items-start gap-2.5">
                  <Icon className={cn('w-3.5 h-3.5 flex-none mt-[2px]', m?.tone || 'text-success')} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-foreground/85 leading-[1.4]">{ev.texto}</div>
                    <div className="text-[10.5px] text-mute-3 mt-0.5">{ev.modulo} · {tempoRelativo(ev.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Fila de hoje — attention.ts inteiro, filtrável, com ação de cobrança em lote */}
      <section id="fila-completa" className="bg-card border border-border rounded-xl overflow-hidden flex flex-col flex-none">
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
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {a.clienteIdParaLembrete ? (
                        <input type="checkbox" checked={sel} onChange={() => setSelecionados(s => sel ? s.filter(x => x !== a.id) : [...s, a.id])} className="w-3.5 h-3.5 accent-accent flex-none" />
                      ) : <span className="w-3.5 flex-none" />}
                      <span className={cn('w-[3px] self-stretch rounded-[2px] min-h-[24px]', a.severity === 'critical' ? 'bg-destructive' : a.severity === 'warning' ? 'bg-warning' : 'bg-mute-3')} />
                      <div onClick={() => navigate(a.to)} className="min-w-0 flex-1 cursor-pointer">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('text-[8.5px] px-1.5 py-[1px] rounded-[4px] font-semibold uppercase tracking-wide flex-none', TIPO_TAG[a.tipo])}>{TIPO_LABEL[a.tipo]}</span>
                          <span className="text-[11.5px] font-medium leading-[1.3] sm:truncate">{a.title}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground sm:truncate mt-[1px]">{a.sub}{cobradoHoje && <span className="text-success font-medium"> · ✓ cobrado hoje</span>}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap flex-none pl-[23px] sm:pl-0">
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

      {/* CLUSTER COMPACTO — Hoje/Próximos dias, Saúde do escritório, Trabalhos por etapa, Reserva.
          Todos secundários por design: sem score grande, sem Kanban, sem calendário completo. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <section className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold"><CalendarDays className="w-3.5 h-3.5 text-mute-2" /> Hoje &amp; próximos dias</div>
            <button onClick={() => navigate('/agenda')} className="text-[11.5px] font-semibold text-primary">Ver agenda →</button>
          </div>
          {hojeAgenda.length === 0 && proximosDias.length === 0 ? (
            <div className="text-[12px] text-muted-foreground py-2">Nada agendado pros próximos dias.</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {hojeAgenda.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="font-mono-hbs text-[11.5px] text-primary font-semibold w-[38px] flex-none">{c.horaInicio || 'Hoje'}</div>
                  <div className="min-w-0 truncate text-[12.5px]">{c.titulo}</div>
                </div>
              ))}
              {proximosDias.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="font-mono-hbs text-[11.5px] text-mute-2 w-[38px] flex-none">{dataCurta(c.data)}</div>
                  <div className="min-w-0 truncate text-[12.5px] text-muted-foreground">{c.titulo}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">Saúde do escritório</span>
              <span className="flex items-center gap-1.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', SAUDE_DOT[saudeEscritorio.tone])} />
                <span className={cn('text-[11.5px] font-semibold', SAUDE_TEXT[saudeEscritorio.tone])}>{saudeEscritorio.status}</span>
              </span>
            </div>
            {saudeEscritorio.motivoPrincipal && <div className="text-[11px] text-muted-foreground mt-1">{saudeEscritorio.motivoPrincipal}</div>}
            <button onClick={() => navigate('/relatorios')} className="text-[11.5px] font-semibold text-primary mt-1.5">Ver análise →</button>
          </div>

          <div className="pt-2.5 border-t border-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-semibold">Trabalhos por etapa</span>
              <button onClick={() => navigate('/trabalhos')} className="text-[11px] font-medium text-accent flex items-center gap-0.5"><ChevronLeft className="w-2.5 h-2.5 rotate-180" />Kanban</button>
            </div>
            {etapasResumo.length === 0 ? (
              <div className="text-[11.5px] text-muted-foreground">Nenhum trabalho em andamento.</div>
            ) : (
              <div className="text-[12px] text-muted-foreground">
                {etapasResumo.map((e, i) => (
                  <span key={e.etapa}>{i > 0 && ' · '}<span className="font-mono-hbs text-foreground">{e.count}</span> {e.label}</span>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2.5 border-t border-3">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold"><Wallet className="w-3.5 h-3.5 text-mute-2" /> Reserva &amp; disponível</div>
              <button onClick={() => navigate('/caixa/contas')} className="text-[11px] font-medium text-accent">Ver contas →</button>
            </div>
            {reserva.temContaReserva ? (
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-[.06em] text-mute-2"><PiggyBank className="w-2.5 h-2.5" /> Reserva</div>
                  <div className="font-mono-hbs text-[15px] mt-0.5">{fmtMoney(reserva.reserva)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[.06em] text-mute-2">Disponível pra você</div>
                  <div className={cn('font-mono-hbs text-[15px] mt-0.5', reserva.disponivelAgora < 0 ? 'text-destructive' : 'text-success')}>{fmtMoney(reserva.disponivelAgora)}</div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground">
                Marque uma conta como "reserva da empresa" em <button onClick={() => navigate('/caixa/contas')} className="text-accent font-medium underline underline-offset-2">Contas</button>.
              </div>
            )}
          </div>
        </section>
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
    </div>
  );
}
