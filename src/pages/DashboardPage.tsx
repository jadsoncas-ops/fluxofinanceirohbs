import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, FileStack, Handshake, Landmark, MessageCircle, Check, ChevronLeft, Flame } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getAccounts, getProcesses, getClients, getTasks, getPropostas, getCompromissos, updateClient, updateProcess, registrarEvento } from '@/lib/storage';
import { computeAttentionItems, AttentionItem, AttentionTipo } from '@/lib/attention';
import { linkWhatsApp } from '@/lib/mensagens';
import { TrabalhoEtapa, Compromisso } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CalendarioAgenda } from '@/components/CalendarioAgenda';
import { NovoCompromissoDialog } from '@/components/dashboard/NovoCompromissoDialog';
import { ValorMonetario } from '@/components/ValorMonetario';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
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

// "Você tem 3 itens vencidos, 1 exigência que vence hoje e 11 trabalhos em
// andamento" — só entra na frase o que existe de verdade; nunca lista "0 X".
function montarResumoFrase(vencidos: number, exigHoje: number, trabalhos: number) {
  const partes: string[] = [];
  if (vencidos > 0) partes.push(`${vencidos} ${vencidos > 1 ? 'itens vencidos' : 'item vencido'}`);
  if (exigHoje > 0) partes.push(`${exigHoje} exigência${exigHoje > 1 ? 's' : ''} de cartório que vence${exigHoje > 1 ? 'm' : ''} hoje`);
  partes.push(`${trabalhos} trabalho${trabalhos !== 1 ? 's' : ''} em andamento`);
  if (partes.length === 1) return `Você tem ${partes[0]}.`;
  return `Você tem ${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}.`;
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

  const { kpis, attention, cashflow, etapas, resumo, tasks, clients, compromissos, trabalhosAtivosTotal, analise, cobrarAgora, saldoProjetado, saudeEscritorio } = useMemo(() => {
    const accounts = getAccounts();
    const processes = getProcesses();
    const clients = getClients();
    const tasks = getTasks();
    const compromissos = getCompromissos();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    const saldoDisponivel = accounts.filter(a => a.ativo).reduce((s, a) => s + a.saldo, 0);
    const aReceberTx = transactions.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído');
    const aReceber = aReceberTx.reduce((s, t) => s + t.valor, 0);
    const aReceberAtrasado = aReceberTx.filter(t => t.data < today).reduce((s, t) => s + t.valor, 0);
    const receitaMes = transactions
      .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
      .filter(t => { const d = new Date(t.data + 'T12:00:00'); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .reduce((s, t) => s + t.valor, 0);

    const trabalhosAtivos = processes.filter(p => !p.isArchived && (p.etapa || 'Levantamento') !== 'Concluído');
    const parados14d = trabalhosAtivos.filter(p => Date.now() - p.updatedAt > 14 * 86400000).length;

    // 4 sinais em vez de 6 — caixa, a receber, trabalhos ativos e prazos de cartório
    // (a contagem de clientes some do topo: some para dentro de /clientes, onde tem peso).
    const registrosComRegistro = processes.filter(p => !p.isArchived && p.registro);
    const prazosSete = registrosComRegistro.filter(p => {
      const r = p.registro!;
      const exigenciaProxima = (r.exigencias || []).some(e => e.status === 'Aberta' && e.prazo && e.prazo <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
      const prenotacaoProxima = r.dataPrenotacao && !r.matricula && (r.prazoPrenotacaoDias ?? 30) - Math.round((Date.now() - new Date(r.dataPrenotacao + 'T12:00:00').getTime()) / 86400000) <= 7;
      return exigenciaProxima || prenotacaoProxima;
    }).length;
    const exigenciasHoje = registrosComRegistro.reduce((s, p) => s + (p.registro!.exigencias || []).filter(e => e.status === 'Aberta' && e.prazo === today).length, 0);

    // Segmentos das barrinhas dos KPIs — só uso quebras que já são dado real
    // (etapa do trabalho, vencido vs a vencer), nunca decorativo sem sentido.
    const etapaSegmentos = STAGE_ORDER.map(etapa => ({ etapa, count: trabalhosAtivos.filter(p => (p.etapa || 'Levantamento') === etapa).length, color: STAGE_DOT[etapa] })).filter(e => e.count > 0);
    const aVencer = Math.max(0, aReceber - aReceberAtrasado);

    const kpis = [
      { label: 'Caixa disponível', value: fmtMoney(saldoDisponivel), color: saldoDisponivel <= 0 ? 'text-destructive' : undefined, hint: accounts.length > 0 ? `${accounts.filter(a => a.ativo).length} conta${accounts.filter(a => a.ativo).length !== 1 ? 's' : ''}` : 'Cadastre suas contas', to: '/caixa/contas' },
      { label: 'A receber', value: fmtMoney(aReceber), color: aReceberAtrasado > 0 ? 'text-destructive' : undefined, hint: aReceberAtrasado > 0 ? `${fmtMoney(aReceberAtrasado)} vencidos` : 'Nada vencido agora', to: '/caixa/receitas', segments: aReceber > 0 ? [{ pct: (aReceberAtrasado / aReceber) * 100, color: 'bg-destructive' }, { pct: (aVencer / aReceber) * 100, color: 'bg-accent-faded' }] : undefined },
      { label: 'Trabalhos ativos', value: String(trabalhosAtivos.length), hint: parados14d > 0 ? `${parados14d} parado${parados14d > 1 ? 's' : ''} há +14 dias` : 'Nenhum parado', hintColor: parados14d > 0 ? 'text-warning' : undefined, to: '/trabalhos', segments: trabalhosAtivos.length > 0 ? etapaSegmentos.map(e => ({ pct: (e.count / trabalhosAtivos.length) * 100, color: e.color })) : undefined },
      { label: 'Prazos de cartório', value: String(prazosSete), hint: prazosSete > 0 ? 'nos próximos 7 dias' : 'Nada vencendo', hintColor: prazosSete > 0 ? 'text-destructive' : undefined, to: '/trabalhos' },
    ];

    const attention = computeAttentionItems(transactions, clients, tasks, processes, getPropostas());

    const cashflow = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const receita = transactions.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído' && new Date(t.data + 'T12:00:00').getMonth() === d.getMonth() && new Date(t.data + 'T12:00:00').getFullYear() === d.getFullYear()).reduce((s, t) => s + t.valor, 0);
      const despesa = transactions.filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status === 'Concluído' && new Date(t.data + 'T12:00:00').getMonth() === d.getMonth() && new Date(t.data + 'T12:00:00').getFullYear() === d.getFullYear()).reduce((s, t) => s + t.valor, 0);
      return { mes: MONTHS_SHORT[d.getMonth()], receita, despesa };
    });

    // Trabalhos por etapa — substitui "Continuar trabalhando": mostra o pipeline
    // inteiro, não só os 3 últimos tocados. A etapa com maior tempo médio parado
    // (acima de 7 dias) ganha destaque — é onde o gargalo real está agora, não
    // uma ordem fixa arbitrária.
    const etapasBase = STAGE_ORDER.map(etapa => {
      const doEstagio = trabalhosAtivos.filter(p => (p.etapa || 'Levantamento') === etapa);
      const diasParadoMedio = doEstagio.length > 0 ? doEstagio.reduce((s, p) => s + (Date.now() - p.updatedAt) / 86400000, 0) / doEstagio.length : 0;
      return { etapa, count: doEstagio.length, pct: STAGE_PCT[etapa], acao: PROXIMA_ACAO[etapa], dot: STAGE_DOT[etapa], ids: doEstagio.map(p => p.id), diasParadoMedio };
    }).filter(e => e.count > 0);
    const etapaGargalo = etapasBase.reduce((pior, e) => (e.diasParadoMedio > 7 && e.diasParadoMedio > (pior?.diasParadoMedio || 0) ? e : pior), null as (typeof etapasBase)[number] | null);
    const etapas = etapasBase.map(e => ({ ...e, destaque: etapaGargalo?.etapa === e.etapa }));

    // Análise — só afirma o que os números sustentam: vencido de hoje contra a
    // média mensal recebida nos meses fechados (exclui o mês corrente, que
    // ainda não terminou e sempre pareceria "baixo"), mais em quantos clientes
    // isso está concentrado (dado real, cada parcela vencida já tem clienteId).
    const mesesFechados = cashflow.slice(0, 5);
    const receitaMediaMensal = mesesFechados.length > 0 ? mesesFechados.reduce((s, m) => s + m.receita, 0) / mesesFechados.length : 0;
    const clientesInadimplentes = new Set(aReceberTx.filter(t => t.data < today && t.clienteId).map(t => t.clienteId));
    const inadimplenciaPct = aReceber > 0 ? Math.round((aReceberAtrasado / aReceber) * 1000) / 10 : 0;
    const multiploMedia = receitaMediaMensal > 0 ? Math.round((aReceberAtrasado / receitaMediaMensal) * 10) / 10 : 0;
    const analise = aReceberAtrasado > 0
      ? `Sua inadimplência está em ${inadimplenciaPct}%${multiploMedia > 1 ? `, ${multiploMedia}x a média dos últimos ${mesesFechados.length} meses` : ''} — e ${fmtMoney(aReceberAtrasado)} disso está em apenas ${clientesInadimplentes.size} cliente${clientesInadimplentes.size !== 1 ? 's' : ''}.`
      : 'Nenhum recebimento vencido agora.';
    const cobrarAgora = aReceberAtrasado > 0 ? { clienteIds: Array.from(clientesInadimplentes), label: `Cobrar os ${clientesInadimplentes.size} agora` } : null;

    // Saldo projetado — saldo atual das contas + o que já está previsto (A Receber/A
    // Pagar pendentes) até cada semana das próximas 8. Não é previsão de novos
    // contratos, só o que já foi lançado.
    const saldoProjetado = Array.from({ length: 9 }).map((_, w) => {
      const limite = new Date(now); limite.setDate(limite.getDate() + w * 7);
      const limiteStr = limite.toISOString().slice(0, 10);
      const receberAte = transactions.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído' && t.data <= limiteStr).reduce((s, t) => s + t.valor, 0);
      const pagarAte = transactions.filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status !== 'Concluído' && t.data <= limiteStr).reduce((s, t) => s + t.valor, 0);
      return { semana: w, label: w === 0 ? 'hoje' : `${w}sem`, saldo: saldoDisponivel + receberAte - pagarAte };
    });

    const itensVencidos = attention.filter(a => a.severity === 'critical').length;
    const resumo = montarResumoFrase(itensVencidos, exigenciasHoje, trabalhosAtivos.length);

    // Saúde do escritório — nota própria (não é indicador contábil oficial),
    // fórmula simples e documentada: começa em 100 e desconta por sinal real
    // de risco. Sempre explica os motivos que pesaram, nunca só o número.
    let nota = 100;
    const motivos: string[] = [];
    if (inadimplenciaPct > 0) { nota -= Math.min(40, inadimplenciaPct); motivos.push(`inadimplência de ${inadimplenciaPct}%`); }
    if (parados14d > 0) { nota -= Math.min(30, parados14d * 10); motivos.push(`${parados14d} trabalho${parados14d > 1 ? 's' : ''} parado${parados14d > 1 ? 's' : ''}`); }
    if (prazosSete > 0) { nota -= Math.min(20, prazosSete * 5); motivos.push(`${prazosSete} prazo${prazosSete > 1 ? 's' : ''} de cartório apertado${prazosSete > 1 ? 's' : ''}`); }
    nota = Math.max(0, Math.round(nota));
    const saudeEscritorio = {
      nota,
      motivo: motivos.length > 0 ? `${motivos.join(', ')} pux${motivos.length > 1 ? 'am' : 'a'} a nota pra baixo.` : 'Nada puxando a nota pra baixo.',
    };

    return { kpis, attention, cashflow, etapas, resumo, tasks, clients, compromissos, trabalhosAtivosTotal: trabalhosAtivos.length, analise, cobrarAgora, saldoProjetado, saudeEscritorio };
  }, [transactions, shell.refreshKey]);

  const maxCash = Math.max(1, ...cashflow.flatMap(m => [m.receita, m.despesa]));
  const whatsappTargets = attention.filter(a => a.whatsapp);
  const tiposPresentes = Array.from(new Set(attention.map(a => a.tipo)));
  const filaVisivel = filtro === 'tudo' ? attention : attention.filter(a => a.tipo === filtro);
  const selecionaveis = filaVisivel.filter(a => a.clienteIdParaLembrete);
  const todosSelecionados = selecionaveis.length > 0 && selecionaveis.every(a => selecionados.includes(a.id));
  const maxSaldoProjetado = Math.max(1, ...saldoProjetado.map(p => Math.abs(p.saldo)));

  function marcarCobrado(clienteId: string | undefined) {
    if (!clienteId) return;
    const client = clients.find(c => c.id === clienteId);
    if (!client) return;
    const hojeStr = new Date().toISOString().slice(0, 10);
    const historico = client.lembretesCobranca || [];
    const jaTemHoje = historico.some(ts => new Date(ts).toISOString().slice(0, 10) === hojeStr);
    const novoHistorico = jaTemHoje ? historico.filter(ts => new Date(ts).toISOString().slice(0, 10) !== hojeStr) : [...historico, Date.now()];
    updateClient({ ...client, lembretesCobranca: novoHistorico });
  }

  // Botão da Análise: filtra a fila pra Cobrança e já seleciona os clientes
  // inadimplentes, deixando a barra de ação em lote (Marcar como cobrado)
  // pronta — não dispara WhatsApp em massa sozinho, só prepara a revisão.
  function cobrarAgoraClick() {
    if (!cobrarAgora) return;
    setFiltro('Cobranca');
    const idsCobranca = attention.filter(a => a.tipo === 'Cobranca' && a.clienteIdParaLembrete && cobrarAgora.clienteIds.includes(a.clienteIdParaLembrete)).map(a => a.id);
    setSelecionados(idsCobranca);
  }

  // Ação em contexto: resolve a exigência direto da Fila de hoje, sem precisar
  // abrir o trabalho primeiro — mesma lógica de TrabalhoDetailPage.tsx, só que
  // aqui parte do processId+exigenciaId que o item já carrega.
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

  // Fecha o caminho mais longo do fluxo de cobrança: antes, cadastrar o telefone
  // de um cliente sem contato exigia sair da Fila de hoje, editar o cliente e
  // voltar pra achar o mesmo item de novo. Agora o telefone entra direto na linha.
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

  return (
    <div className="flex flex-col gap-2.5 lg:h-full lg:min-h-0 lg:overflow-hidden animate-hbs-in">
      <div className="flex items-center justify-between gap-3 flex-wrap flex-none">
        <div className="min-w-0">
          <h1 className="text-[19px] font-semibold -tracking-[.02em] leading-tight">{saudacao()}, Jádson.</h1>
          <p className="text-[11px] text-mute-2 font-mono-hbs mt-0.5">{resumo}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => shell.openNovoTrabalho()} className="h-8 px-2.5 bg-card border-2 rounded-lg text-[11.5px] hover:border-hover transition-colors flex items-center gap-1.5"><Layers className="w-3 h-3" /> Novo trabalho</button>
          <button onClick={() => navigate('/producao')} className="h-8 px-2.5 bg-card border-2 rounded-lg text-[11.5px] hover:border-hover transition-colors flex items-center gap-1.5"><FileStack className="w-3 h-3" /> Gerar documento</button>
          <button onClick={() => navigate('/comercial')} className="h-8 px-2.5 bg-card border-2 rounded-lg text-[11.5px] hover:border-hover transition-colors flex items-center gap-1.5"><Handshake className="w-3 h-3" /> Nova proposta</button>
          <button onClick={() => shell.openNovoRecebimento()} className="h-8 px-2.5 bg-card border-2 rounded-lg text-[11.5px] hover:border-hover transition-colors flex items-center gap-1.5"><Landmark className="w-3 h-3" /> Lançar recebimento</button>
        </div>
      </div>

      {/* 4 sinais com peso, não 6 números iguais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-xl overflow-hidden flex-none">
        {kpis.map(k => (
          <button key={k.label} onClick={() => navigate(k.to)} className="bg-card px-3 pt-2.5 pb-2.5 text-left hover:bg-surface-3 transition-colors">
            <div className="text-[9.5px] tracking-[.06em] uppercase text-mute-2 font-medium">{k.label}</div>
            <div className={cn('font-mono-hbs text-[20px] font-medium -tracking-[.03em] mt-1', k.color)}>
              {'value' in k && k.label !== 'Trabalhos ativos' && k.label !== 'Prazos de cartório' ? <ValorMonetario value={k.value} /> : k.value}
            </div>
            <div className={cn('text-[10px] mt-0.5 truncate', k.hintColor || 'text-muted-foreground')}>{k.hint}</div>
            {'segments' in k && k.segments && (
              <div className="flex gap-[2px] h-[3px] mt-1.5 rounded-full overflow-hidden">
                {k.segments.filter(s => s.pct > 0).map((s, i) => <div key={i} className={s.color} style={{ width: `${s.pct}%` }} />)}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Análise — uma frase, só o que os números sustentam, com ação direta quando dá */}
      <div className="flex-none bg-card border border-border rounded-xl px-3 py-2 text-[11.5px] text-muted-foreground flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-[.06em] text-mute-3 font-medium flex-none">Análise</span>
        <span className="flex-1 min-w-0">{analise}</span>
        {cobrarAgora && (
          <button onClick={cobrarAgoraClick} className="flex-none h-7 px-2.5 rounded-lg bg-destructive text-destructive-foreground text-[11px] font-medium hover:opacity-90 transition-opacity">
            {cobrarAgora.label}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5 lg:flex-1 lg:min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-2.5 lg:flex-1 lg:min-h-0">

          {/* Fila de hoje — attention.ts inteiro, filtrável, com ação de cobrança em lote */}
          <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-3 flex items-center gap-2 flex-wrap">
              <div className="text-[12.5px] font-semibold">Fila de hoje</div>
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
              <div className="overflow-y-auto flex-1 min-h-0">
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

          <div className="flex flex-col gap-2.5 min-h-0 overflow-y-auto">
            {/* Caixa real (6 meses fechados) + projeção (8 semanas à frente), num
                card só. Ficam como dois blocos — não uma linha contínua — porque
                fluxo mensal (receita−despesa) e saldo acumulado são grandezas
                diferentes; misturar os dois num eixo só seria enganoso. */}
            <section className="bg-card border border-border rounded-xl px-3 pt-2.5 pb-2.5 flex flex-col">
              <div className="flex items-baseline justify-between">
                <div className="text-[12.5px] font-semibold">Caixa · real & projeção</div>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-[7px] h-[7px] rounded-[2px] bg-accent" />Receita</span>
                  <span className="flex items-center gap-1"><span className="w-[7px] h-[7px] rounded-[2px] bg-warning" />Despesa</span>
                </div>
              </div>
              <div className="text-[9.5px] uppercase tracking-[.06em] text-mute-3 mt-2">6 meses fechados</div>
              <div className="flex items-end gap-2.5 h-[90px] mt-1.5">
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
              <div className="flex items-end gap-1.5 h-[70px] mt-1.5">
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

            {/* Saúde do escritório — nota própria (não é indicador contábil oficial),
                sempre com o motivo por trás, nunca só o número solto. */}
            <section className="bg-card border border-border rounded-xl px-3 pt-2.5 pb-2.5 flex flex-col flex-none">
              <div className="text-[12.5px] font-semibold">Saúde do escritório</div>
              <div className="flex items-center gap-2.5 mt-1.5">
                <span className={cn('font-mono-hbs text-[22px] font-medium', saudeEscritorio.nota >= 80 ? 'text-success' : saudeEscritorio.nota >= 50 ? 'text-warning' : 'text-destructive')}>{saudeEscritorio.nota}</span>
                <span className="text-[11px] text-mute-2">/100 · atenção</span>
              </div>
              <div className="h-1.5 bg-bar-track rounded-full mt-1.5 overflow-hidden">
                <div className={cn('h-full rounded-full', saudeEscritorio.nota >= 80 ? 'bg-success' : saudeEscritorio.nota >= 50 ? 'bg-warning' : 'bg-destructive')} style={{ width: `${saudeEscritorio.nota}%` }} />
              </div>
              <div className="text-[10.5px] text-muted-foreground mt-1.5">{saudeEscritorio.motivo}</div>
            </section>

            {/* Trabalhos por etapa — pipeline inteiro, cada etapa diz o que fazer */}
            <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col flex-1 min-h-[220px]">
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

        <div className="min-h-[420px] lg:flex-1 lg:min-h-0">
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
