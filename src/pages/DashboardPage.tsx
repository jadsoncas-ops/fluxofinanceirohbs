import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Layers, FileStack, Handshake, Landmark, MessageCircle, Check, ChevronLeft } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getAccounts, getProcesses, getClients, getTasks, getPropostas, getCompromissos, updateClient } from '@/lib/storage';
import { computeAttentionItems, AttentionItem } from '@/lib/attention';
import { linkWhatsApp } from '@/lib/mensagens';
import { TrabalhoEtapa, Compromisso } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CalendarioAgenda } from '@/components/CalendarioAgenda';
import { NovoCompromissoDialog } from '@/components/dashboard/NovoCompromissoDialog';
import { ValorMonetario } from '@/components/ValorMonetario';

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

const FILTROS = [
  { k: 'tudo', label: 'Tudo' },
  { k: 'critical', label: 'Vencidos' },
  { k: 'warning', label: 'Esta semana' },
  { k: 'info', label: 'Informativo' },
] as const;

export default function DashboardPage() {
  const shell = useShell();
  const navigate = useNavigate();
  const { allTransactions: transactions } = shell;
  const [lembrete, setLembrete] = useState<{ clienteId?: string; clienteNome: string; telefone: { ddd: string; numero: string }; mensagem: string } | null>(null);
  const [mensagemEditada, setMensagemEditada] = useState('');
  const [compromissoDialogOpen, setCompromissoDialogOpen] = useState(false);
  const [compromissoEditando, setCompromissoEditando] = useState<Compromisso | undefined>(undefined);
  const [novoCompromissoData, setNovoCompromissoData] = useState<string | undefined>(undefined);
  const [filtro, setFiltro] = useState<typeof FILTROS[number]['k']>('tudo');
  const [selecionados, setSelecionados] = useState<string[]>([]);

  function abrirNovoCompromisso(data?: string) { setCompromissoEditando(undefined); setNovoCompromissoData(data); setCompromissoDialogOpen(true); }
  function abrirEditarCompromisso(c: Compromisso) { setCompromissoEditando(c); setCompromissoDialogOpen(true); }

  const { kpis, attention, cashflow, etapas, resumo, tasks, clients, compromissos, trabalhosAtivosTotal } = useMemo(() => {
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

    const kpis = [
      { label: 'Caixa disponível', value: fmtMoney(saldoDisponivel), color: saldoDisponivel <= 0 ? 'text-destructive' : undefined, hint: accounts.length > 0 ? `${accounts.filter(a => a.ativo).length} conta${accounts.filter(a => a.ativo).length !== 1 ? 's' : ''}` : 'Cadastre suas contas', to: '/caixa/contas' },
      { label: 'A receber', value: fmtMoney(aReceber), color: aReceberAtrasado > 0 ? 'text-destructive' : undefined, hint: aReceberAtrasado > 0 ? `${fmtMoney(aReceberAtrasado)} vencidos` : 'Nada vencido agora', to: '/caixa/receitas' },
      { label: 'Trabalhos ativos', value: String(trabalhosAtivos.length), hint: parados14d > 0 ? `${parados14d} parado${parados14d > 1 ? 's' : ''} há +14 dias` : 'Nenhum parado', hintColor: parados14d > 0 ? 'text-warning' : undefined, to: '/trabalhos' },
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
    // inteiro, não só os 3 últimos tocados.
    const etapas = STAGE_ORDER.map(etapa => {
      const doEstagio = trabalhosAtivos.filter(p => (p.etapa || 'Levantamento') === etapa);
      return { etapa, count: doEstagio.length, pct: STAGE_PCT[etapa], acao: PROXIMA_ACAO[etapa], dot: STAGE_DOT[etapa], ids: doEstagio.map(p => p.id) };
    }).filter(e => e.count > 0);

    const resumo = `${trabalhosAtivos.length} trabalho${trabalhosAtivos.length !== 1 ? 's' : ''} aberto${trabalhosAtivos.length !== 1 ? 's' : ''} · ${attention.length} pendência${attention.length !== 1 ? 's' : ''}`;

    return { kpis, attention, cashflow, etapas, resumo, tasks, clients, compromissos, trabalhosAtivosTotal: trabalhosAtivos.length };
  }, [transactions, shell.refreshKey]);

  const maxCash = Math.max(1, ...cashflow.flatMap(m => [m.receita, m.despesa]));
  const whatsappTargets = attention.filter(a => a.whatsapp);
  const filaVisivel = filtro === 'tudo' ? attention : attention.filter(a => a.severity === filtro);
  const selecionaveis = filaVisivel.filter(a => a.clienteIdParaLembrete);
  const todosSelecionados = selecionaveis.length > 0 && selecionaveis.every(a => selecionados.includes(a.id));

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

  function abrirLembrete(a: AttentionItem) {
    if (!a.whatsapp) return;
    setLembrete({ ...a.whatsapp, clienteId: a.clienteIdParaLembrete });
    setMensagemEditada(a.whatsapp.mensagem);
  }

  return (
    <div className="flex flex-col gap-2.5 lg:h-full lg:min-h-0 lg:overflow-hidden animate-hbs-in">
      <div className="flex items-center justify-between gap-3 flex-wrap flex-none">
        <div className="min-w-0">
          <h1 className="text-[19px] font-semibold -tracking-[.02em] leading-tight">{saudacao()}, Jádson.</h1>
          <p className="text-[11px] text-mute-2 font-mono-hbs mt-0.5">{resumo}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => navigate('/trabalhos')} className="h-8 px-2.5 bg-card border-2 rounded-lg text-[11.5px] hover:border-hover transition-colors flex items-center gap-1.5"><Layers className="w-3 h-3" /> Novo trabalho</button>
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
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 lg:flex-1 lg:min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-2.5 lg:flex-1 lg:min-h-0">

          {/* Fila de hoje — attention.ts inteiro, filtrável, com ação de cobrança em lote */}
          <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-3 flex items-center gap-2 flex-wrap">
              <div className="text-[12.5px] font-semibold">Fila de hoje</div>
              <span className="text-[10.5px] font-mono-hbs text-mute-2">{filaVisivel.length} de {attention.length}</span>
              <div className="flex-1" />
              <div className="flex gap-1">
                {FILTROS.map(f => (
                  <button key={f.k} onClick={() => setFiltro(f.k)} className={cn('px-2 h-6 rounded-full text-[11px] font-medium border', filtro === f.k ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-mute-2 hover:border-hover')}>{f.label}</button>
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
                  return (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-[7px] border-b border-3 hover:bg-surface-3 transition-colors">
                      {a.clienteIdParaLembrete ? (
                        <input type="checkbox" checked={sel} onChange={() => setSelecionados(s => sel ? s.filter(x => x !== a.id) : [...s, a.id])} className="w-3.5 h-3.5 accent-accent flex-none" />
                      ) : <span className="w-3.5 flex-none" />}
                      <span className={cn('w-[3px] self-stretch rounded-[2px] min-h-[24px]', a.severity === 'critical' ? 'bg-destructive' : a.severity === 'warning' ? 'bg-warning' : 'bg-mute-3')} />
                      <div onClick={() => navigate(a.to)} className="min-w-0 flex-1 cursor-pointer">
                        <div className="text-[11.5px] font-medium leading-[1.3] truncate">{a.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{a.sub}{cobradoHoje && <span className="text-success font-medium"> · ✓ cobrado hoje</span>}</div>
                      </div>
                      {a.whatsapp ? (
                        <button onClick={() => abrirLembrete(a)} className="flex-none h-6 w-6 grid place-items-center bg-warning text-warning-foreground rounded-md hover:opacity-90"><MessageCircle className="w-3 h-3" /></button>
                      ) : (
                        <span onClick={() => navigate(a.to)} className="flex-none text-[10px] font-medium text-accent whitespace-nowrap flex items-center gap-0.5 cursor-pointer">{a.cta} <ChevronRight className="w-2.5 h-2.5" /></span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-2.5 min-h-0">
            {/* Caixa 6 meses — mantém o gráfico real, só com leitura por hover */}
            <section className="bg-card border border-border rounded-xl px-3 pt-2.5 pb-2.5 flex flex-col">
              <div className="flex items-baseline justify-between">
                <div className="text-[12.5px] font-semibold">Caixa · 6 meses</div>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-[7px] h-[7px] rounded-[2px] bg-accent" />Receita</span>
                  <span className="flex items-center gap-1"><span className="w-[7px] h-[7px] rounded-[2px] bg-bar-expense" />Despesa</span>
                </div>
              </div>
              <div className="flex items-end gap-2.5 h-[110px] mt-2">
                {cashflow.map(m => (
                  <div key={m.mes} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                    <div className="flex-1 w-full flex items-end justify-center gap-1">
                      <div className="w-2.5 rounded-t-[3px] bg-accent" style={{ height: `${Math.max(2, (m.receita / maxCash) * 100)}%` }} title={`Receita · ${fmtMoney(m.receita)}`} />
                      <div className="w-2.5 rounded-t-[3px] bg-bar-expense" style={{ height: `${Math.max(2, (m.despesa / maxCash) * 100)}%` }} title={`Despesa · ${fmtMoney(m.despesa)}`} />
                    </div>
                    <span className="text-[9.5px] text-mute-2 font-mono-hbs">{m.mes}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Trabalhos por etapa — pipeline inteiro, cada etapa diz o que fazer */}
            <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="px-3 py-2 border-b border-3 flex items-center justify-between gap-2">
                <div className="text-[12.5px] font-semibold">Trabalhos por etapa</div>
                <button onClick={() => navigate('/trabalhos')} className="text-[10.5px] font-medium text-accent flex items-center gap-0.5"><ChevronLeft className="w-2.5 h-2.5 rotate-180" />Todos</button>
              </div>
              <div className="overflow-y-auto flex-1 min-h-0">
                {etapas.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">Nenhum trabalho em andamento.</div>
                ) : etapas.map(e => (
                  <div key={e.etapa} onClick={() => navigate('/trabalhos')} className="px-3 py-[8px] border-b border-3 last:border-b-0 cursor-pointer hover:bg-surface-3 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-none', e.dot)} />
                      <div className="text-[11.5px] font-medium flex-1">{e.etapa}</div>
                      <span className="font-mono-hbs text-[10px] text-mute-2 flex-none">{e.count}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5 pl-3.5">{e.acao}</div>
                    <div className="h-1 bg-bar-track rounded-full mt-1.5 ml-3.5 overflow-hidden">
                      <div className="h-full bg-accent-faded rounded-full" style={{ width: `${e.pct}%` }} />
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
