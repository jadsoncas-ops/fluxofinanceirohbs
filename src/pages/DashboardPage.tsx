import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Layers, FileStack, Handshake, Landmark, MessageCircle } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getAccounts, getProcesses, getClients, getTasks, getPropostas, getCompromissos } from '@/lib/storage';
import { computeAttentionItems, AttentionItem } from '@/lib/attention';
import { linkWhatsApp } from '@/lib/mensagens';
import { TrabalhoEtapa, Compromisso } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CalendarioAgenda } from '@/components/CalendarioAgenda';
import { NovoCompromissoDialog } from '@/components/dashboard/NovoCompromissoDialog';
import { ValorMonetario } from '@/components/ValorMonetario';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const STAGE_PCT: Record<TrabalhoEtapa, number> = { 'Aguardando cliente': 10, Levantamento: 30, Tramitando: 65, Devolutiva: 80, Concluído: 100 };
const STAGE_COLOR: Record<TrabalhoEtapa, string> = { 'Aguardando cliente': 'text-warning', Levantamento: 'text-mute-2', Tramitando: 'text-accent', Devolutiva: 'text-destructive', Concluído: 'text-success' };
const PROXIMA_ACAO: Record<TrabalhoEtapa, string> = { 'Aguardando cliente': 'Cobrar retorno do cliente', Levantamento: 'Fazer levantamento do imóvel/documentação', Tramitando: 'Acompanhar trâmite no órgão', Devolutiva: 'Atender exigência/pendência', Concluído: 'Arquivar trabalho' };
const MAX_ATENCAO_VISIVEL = 4;

function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const severityBar: Record<AttentionItem['severity'], string> = {
  critical: 'bg-destructive',
  warning: 'bg-warning',
  info: 'bg-mute-3',
};

export default function DashboardPage() {
  const shell = useShell();
  const navigate = useNavigate();
  const { allTransactions: transactions } = shell;
  const [lembrete, setLembrete] = useState<{ clienteNome: string; telefone: { ddd: string; numero: string }; mensagem: string } | null>(null);
  const [mensagemEditada, setMensagemEditada] = useState('');
  const [compromissoDialogOpen, setCompromissoDialogOpen] = useState(false);
  const [compromissoEditando, setCompromissoEditando] = useState<Compromisso | undefined>(undefined);
  const [novoCompromissoData, setNovoCompromissoData] = useState<string | undefined>(undefined);

  function abrirNovoCompromisso(data?: string) {
    setCompromissoEditando(undefined);
    setNovoCompromissoData(data);
    setCompromissoDialogOpen(true);
  }
  function abrirEditarCompromisso(c: Compromisso) {
    setCompromissoEditando(c);
    setCompromissoDialogOpen(true);
  }

  const { kpis, attention, cashflow, continuando, resumo, tasks, clients, compromissos } = useMemo(() => {
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
    const receitaMesAnterior = transactions
      .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
      .filter(t => { const d = new Date(t.data + 'T12:00:00'); const prev = new Date(now.getFullYear(), now.getMonth() - 1); return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear(); })
      .reduce((s, t) => s + t.valor, 0);

    const trabalhosAtivos = processes.filter(p => !p.isArchived && (p.etapa || 'Levantamento') !== 'Concluído');
    const aguardandoCliente = trabalhosAtivos.filter(p => p.etapa === 'Aguardando cliente').length;

    const kpis = [
      { label: 'Caixa disponível', value: fmtMoney(saldoDisponivel), isMoney: true, color: undefined, hint: accounts.length > 0 ? `${accounts.filter(a => a.ativo).length} conta${accounts.filter(a => a.ativo).length !== 1 ? 's' : ''} · hoje` : 'Cadastre suas contas', to: '/caixa/contas' },
      { label: 'A receber', value: fmtMoney(aReceber), isMoney: true, color: aReceber > 0 ? 'text-destructive' : undefined, hint: aReceberAtrasado > 0 ? `${fmtMoney(aReceberAtrasado)} vencidos` : 'Nada vencido agora', to: '/caixa/receitas' },
      { label: 'Receita do mês', value: fmtMoney(receitaMes), isMoney: true, color: undefined, hint: receitaMesAnterior > 0 ? `${receitaMes >= receitaMesAnterior ? '+' : '−'}${Math.abs(Math.round(((receitaMes - receitaMesAnterior) / receitaMesAnterior) * 100))}% sobre a média` : 'Sem histórico de comparação', to: '/caixa/visao-geral' },
      { label: 'Trabalhos ativos', value: String(trabalhosAtivos.length), isMoney: false, color: undefined, hint: aguardandoCliente > 0 ? `${aguardandoCliente} aguardando cliente` : 'Nenhum parado', to: '/trabalhos' },
      { label: 'Clientes ativos', value: String(clients.length), isMoney: false, color: undefined, hint: clients.length === 0 ? 'Cadastre o primeiro cliente' : 'na base', to: '/clientes' },
    ];

    const attention = computeAttentionItems(transactions, clients, tasks, processes, getPropostas());

    const cashflow = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const receita = transactions.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído' && new Date(t.data + 'T12:00:00').getMonth() === d.getMonth() && new Date(t.data + 'T12:00:00').getFullYear() === d.getFullYear()).reduce((s, t) => s + t.valor, 0);
      const despesa = transactions.filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status === 'Concluído' && new Date(t.data + 'T12:00:00').getMonth() === d.getMonth() && new Date(t.data + 'T12:00:00').getFullYear() === d.getFullYear()).reduce((s, t) => s + t.valor, 0);
      return { mes: MONTHS_SHORT[d.getMonth()], receita, despesa };
    });

    const continuando = trabalhosAtivos
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 3)
      .map(p => {
        const etapa = p.etapa || 'Levantamento';
        return {
          id: p.id,
          nome: p.objeto || 'Trabalho',
          endereco: p.endereco || (clients.find(c => c.id === p.clienteId)?.nome ?? ''),
          etapa,
          pct: STAGE_PCT[etapa],
          proximaAcao: PROXIMA_ACAO[etapa],
        };
      });

    const resumo = `${trabalhosAtivos.length} trabalho${trabalhosAtivos.length !== 1 ? 's' : ''} aberto${trabalhosAtivos.length !== 1 ? 's' : ''} · ${attention.length} pendência${attention.length !== 1 ? 's' : ''}`;

    return { kpis, attention, cashflow, continuando, resumo, tasks, clients, compromissos };
  }, [transactions, shell.refreshKey]);

  const maxCash = Math.max(1, ...cashflow.flatMap(m => [m.receita, m.despesa]));
  const whatsappTargets = attention.filter(a => a.whatsapp);
  const attentionVisivel = attention.slice(0, MAX_ATENCAO_VISIVEL);
  const attentionRestante = attention.length - attentionVisivel.length;

  return (
    <div className="flex flex-col gap-2.5 lg:h-full lg:min-h-0 lg:overflow-hidden animate-hbs-in">
      {/* Saudação + ações rápidas, numa linha só */}
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

      {/* KPI strip compacta */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border border border-border rounded-xl overflow-hidden flex-none">
        {kpis.map(k => (
          <button key={k.label} onClick={() => navigate(k.to)} className="bg-card px-3 pt-2.5 pb-2.5 text-left hover:bg-surface-3 transition-colors">
            <div className="text-[9.5px] tracking-[.06em] uppercase text-mute-2 font-medium">{k.label}</div>
            <div className={cn('font-mono-hbs text-[18px] font-medium -tracking-[.03em] mt-1', k.color)}>
              {k.isMoney ? <ValorMonetario value={k.value} /> : k.value}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{k.hint}</div>
          </button>
        ))}
      </div>

      {/* Núcleo da dashboard — no desktop cresce pra preencher o resto da tela sem rolar; no
          celular volta ao empilhado normal com scroll (a densidade de 3 colunas não cabe lá). */}
      <div className="flex flex-col gap-2.5 lg:flex-1 lg:min-h-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 lg:flex-1 lg:min-h-0">
          {/* Precisa da sua atenção */}
          <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-3 flex items-center justify-between gap-2">
              <div className="text-[12.5px] font-semibold">Precisa da sua atenção</div>
              <div className="flex items-center gap-1.5 flex-none">
                {whatsappTargets.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-6 w-6 grid place-items-center bg-warning text-warning-foreground rounded-md hover:opacity-90 transition-opacity">
                        <MessageCircle className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[250px]">
                      {whatsappTargets.map(a => (
                        <DropdownMenuItem key={a.id} onClick={() => { setLembrete(a.whatsapp!); setMensagemEditada(a.whatsapp!.mensagem); }} className="flex-col items-start gap-0.5 py-2">
                          <span className="text-[12.5px] font-medium">{a.whatsapp!.clienteNome}</span>
                          <span className="text-[10.5px] text-muted-foreground">{a.sub}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <span className="text-[10.5px] font-mono-hbs text-mute-2 whitespace-nowrap">{attention.length}</span>
              </div>
            </div>
            {attention.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">Nada pendente agora.</div>
            ) : (
              <>
                {attentionVisivel.map(a => (
                  <div key={a.id} onClick={() => navigate(a.to)} className="flex items-center gap-2 px-3 py-[7px] border-b border-3 cursor-pointer hover:bg-surface-3 transition-colors">
                    <span className={cn('w-[3px] self-stretch rounded-[2px] min-h-[24px]', severityBar[a.severity])} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-medium leading-[1.3] truncate">{a.title}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{a.sub}</div>
                    </div>
                    {a.whatsapp ? (
                      <button
                        onClick={e => { e.stopPropagation(); setLembrete(a.whatsapp!); setMensagemEditada(a.whatsapp!.mensagem); }}
                        className="flex-none h-6 w-6 grid place-items-center bg-warning text-warning-foreground rounded-md hover:opacity-90 transition-opacity"
                      >
                        <MessageCircle className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="flex-none text-[10px] font-medium text-accent whitespace-nowrap flex items-center gap-0.5">{a.cta} <ChevronRight className="w-2.5 h-2.5" /></span>
                    )}
                  </div>
                ))}
                {attentionRestante > 0 && (
                  <button onClick={() => navigate('/caixa/receitas')} className="px-3 py-[7px] text-[11px] font-medium text-accent hover:bg-surface-3 transition-colors text-left">
                    +{attentionRestante} mais
                  </button>
                )}
              </>
            )}
          </section>

          {/* Caixa 6 meses */}
          <section className="bg-card border border-border rounded-xl px-3 pt-2.5 pb-2.5 flex flex-col">
            <div className="flex items-baseline justify-between">
              <div className="text-[12.5px] font-semibold">Caixa · 6 meses</div>
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-[7px] h-[7px] rounded-[2px] bg-accent" />Receita</span>
                <span className="flex items-center gap-1"><span className="w-[7px] h-[7px] rounded-[2px] bg-bar-expense" />Despesa</span>
              </div>
            </div>
            <div className="flex items-end gap-2.5 flex-1 min-h-0 mt-2">
              {cashflow.map(m => (
                <div key={m.mes} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                  <div className="flex-1 w-full flex items-end justify-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-2.5 rounded-t-[3px] bg-accent cursor-default" style={{ height: `${Math.max(2, (m.receita / maxCash) * 100)}%` }} />
                      </TooltipTrigger>
                      <TooltipContent className="font-mono-hbs text-[11px]">Receita · {fmtMoney(m.receita)}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-2.5 rounded-t-[3px] bg-bar-expense cursor-default" style={{ height: `${Math.max(2, (m.despesa / maxCash) * 100)}%` }} />
                      </TooltipTrigger>
                      <TooltipContent className="font-mono-hbs text-[11px]">Despesa · {fmtMoney(m.despesa)}</TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-[9.5px] text-mute-2 font-mono-hbs">{m.mes}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Continuar trabalhando — linhas compactas */}
          <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-3 flex items-center justify-between gap-2">
              <div className="text-[12.5px] font-semibold">Continuar trabalhando</div>
              <button onClick={() => navigate('/trabalhos')} className="text-[10.5px] font-medium text-accent flex items-center gap-0.5 flex-none">Todos <ChevronRight className="w-2.5 h-2.5" /></button>
            </div>
            {continuando.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">Nenhum trabalho em andamento.</div>
            ) : (
              continuando.map(t => (
                <div key={t.id} onClick={() => navigate(`/trabalhos/${t.id}`)} className="px-3 py-[7px] border-b border-3 last:border-b-0 cursor-pointer hover:bg-surface-3 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-none', STAGE_COLOR[t.etapa].replace('text-', 'bg-'))} />
                    <div className="text-[11.5px] font-medium truncate flex-1">{t.nome}</div>
                    <span className="font-mono-hbs text-[10px] text-mute-2 flex-none">{t.pct}%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5 pl-3.5">{t.proximaAcao}</div>
                </div>
              ))
            )}
          </section>
        </div>

        {/* Agenda — semana ou mês, alternável */}
        <div className="min-h-[420px] lg:flex-1 lg:min-h-0">
          <CalendarioAgenda
            compromissos={compromissos}
            tasks={tasks}
            transactions={transactions}
            clients={clients}
            onNovo={abrirNovoCompromisso}
            onEditar={abrirEditarCompromisso}
          />
        </div>
      </div>

      <Dialog open={!!lembrete} onOpenChange={v => !v && setLembrete(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lembrete para {lembrete?.clienteNome}</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-muted-foreground -mt-2">Revise ou ajuste o texto antes de enviar — quem for mandar (Luanna ou você) pode adaptar à vontade.</p>
          <Textarea value={mensagemEditada} onChange={e => setMensagemEditada(e.target.value)} className="min-h-[220px] text-[13px]" />
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setLembrete(null)} className="h-9 px-3.5 rounded-lg text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
            <button
              onClick={() => {
                if (!lembrete) return;
                window.open(linkWhatsApp(lembrete.telefone.ddd, lembrete.telefone.numero, mensagemEditada), '_blank', 'noreferrer');
                setLembrete(null);
              }}
              className="h-9 px-3.5 bg-warning text-warning-foreground rounded-lg text-[12.5px] font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Abrir no WhatsApp
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <NovoCompromissoDialog
        open={compromissoDialogOpen}
        onClose={() => setCompromissoDialogOpen(false)}
        compromisso={compromissoEditando}
        dataInicial={novoCompromissoData}
      />
    </div>
  );
}
