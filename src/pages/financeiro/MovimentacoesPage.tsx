import { useMemo, useState } from 'react';
import { Plus, SlidersHorizontal, ChevronDown, ArrowUpCircle, ArrowDownCircle, CalendarClock, CheckCircle2, Pencil, Trash2, ArrowRight } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getClients, getProcesses, deleteTransaction, updateTransaction } from '@/lib/storage';
import { dataEfetiva } from '@/lib/financials';
import { isIncome, statusLabel, agruparLancamentos, LancamentoGrupo } from '@/lib/lancamentos';
import { DetalheLancamentoDialog } from '@/components/financeiro/DetalheLancamentoDialog';
import { ValorMonetario } from '@/components/ValorMonetario';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function rotuloData(dataStr: string): string {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
  const d = new Date(dataStr + 'T12:00:00'); d.setHours(0, 0, 0, 0);
  if (d.getTime() === hoje.getTime()) return 'Hoje';
  if (d.getTime() === ontem.getTime()) return 'Ontem';
  const sufixoAno = d.getFullYear() !== hoje.getFullYear() ? ` de ${d.getFullYear()}` : '';
  return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}${sufixoAno}`;
}

function getNext3MonthsOptions(originalDateStr: string) {
  const [, , dStr] = originalDateStr.split('-');
  const origDay = parseInt(dStr, 10);
  const options = [];
  const baseDate = new Date();
  const txDate = new Date(originalDateStr + 'T12:00:00');
  const startRef = txDate > baseDate ? txDate : baseDate;
  const currentMonth = startRef.getMonth();
  const currentYear = startRef.getFullYear();
  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  for (let i = 1; i <= 3; i++) {
    const targetMonth = (currentMonth + i) % 12;
    const targetYear = currentYear + Math.floor((currentMonth + i) / 12);
    const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const finalDay = Math.min(origDay, lastDayOfMonth);
    const mFmt = String(targetMonth + 1).padStart(2, '0');
    const dFmt = String(finalDay).padStart(2, '0');
    options.push({ label: `${MONTHS[targetMonth]} ${targetYear}`, newDate: `${targetYear}-${mFmt}-${dFmt}`, displayDate: `${dFmt}/${mFmt}/${targetYear}` });
  }
  return options;
}

type FiltroTipo = 'todos' | 'entradas' | 'saidas';
type FiltroStatus = 'todos' | 'concluidos' | 'pendentes';

export default function FinanceiroMovimentacoesPage() {
  const shell = useShell();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [detalhe, setDetalhe] = useState<Transaction | null>(null);
  const [expandidoChave, setExpandidoChave] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const clientes = useMemo(() => getClients(), []);
  const processos = useMemo(() => getProcesses(), []);

  function nomeCliente(id?: string | null) { return id ? clientes.find(c => c.id === id)?.nome : undefined; }
  function trabalhoDe(id?: string) { return id ? processos.find(p => p.id === id) : undefined; }

  // Resumo do período — mesmo critério que já existia (status Concluído, dataEfetiva), só
  // renomeado. O seletor de período (acima, no cabeçalho do Shell) já mostra o mês selecionado,
  // então não repete "no mês" no rótulo — o tooltip mantém a explicação de que aqui é sempre o
  // período escolhido acima, podendo diferir do mês atual real que a Visão Geral usa.
  const { entradas, saidas, resultado } = useMemo(() => {
    const realizados = shell.monthTransactions.filter(t => t.status === 'Concluído');
    let entradas = 0, saidas = 0;
    for (const t of realizados) { if (isIncome(t)) entradas += t.valor; else saidas += t.valor; }
    return { entradas, saidas, resultado: entradas - saidas };
  }, [shell.monthTransactions]);

  const filtradas = useMemo(() => {
    let items = shell.monthTransactions;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(t =>
        t.descricao.toLowerCase().includes(q) ||
        (nomeCliente(t.clienteId) || '').toLowerCase().includes(q) ||
        (trabalhoDe(t.processId)?.objeto || '').toLowerCase().includes(q)
      );
    }
    if (filtroTipo !== 'todos') items = items.filter(t => (filtroTipo === 'entradas') === isIncome(t));
    if (filtroStatus !== 'todos') items = items.filter(t => (filtroStatus === 'concluidos') === (t.status === 'Concluído'));
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell.monthTransactions, search, filtroTipo, filtroStatus]);

  const grupos = useMemo(() => {
    return agruparLancamentos(filtradas).sort((a, b) => b.dataOrdenacao.localeCompare(a.dataOrdenacao));
  }, [filtradas]);

  const blocos = useMemo(() => {
    const mapa = new Map<string, LancamentoGrupo[]>();
    for (const g of grupos) {
      const rotulo = rotuloData(g.dataOrdenacao);
      const arr = mapa.get(rotulo);
      if (arr) arr.push(g); else mapa.set(rotulo, [g]);
    }
    return Array.from(mapa.entries());
  }, [grupos]);

  const filtrosAtivos = filtroTipo !== 'todos' || filtroStatus !== 'todos';

  function limparFiltroTipo(novo: FiltroTipo) {
    setFiltroTipo(prev => (prev === novo ? 'todos' : novo));
  }

  function handlePostpone(tx: Transaction, newDate: string, monthLabel: string) {
    updateTransaction({ ...tx, data: newDate });
    toast.success(`Lançamento movido para ${monthLabel}`);
    shell.refresh();
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteTransaction(deleteTarget.id);
    toast.success('Lançamento excluído.');
    setDeleteTarget(null);
    shell.refresh();
  }

  return (
    <div className="space-y-[16px] pb-10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[16px] font-semibold">Movimentações</h1>
          <p className="text-[12px] text-mute-2 mt-0.5">Seu extrato — tudo que entrou e saiu.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 px-[14px] py-[9px] rounded-xl bg-primary text-primary-foreground text-[12.5px] font-medium hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> Nova movimentação
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => shell.openNovoRecebimento()} className="text-[12.5px] gap-2">
              <ArrowDownCircle className="w-3.5 h-3.5 text-success" /> Entrada / recebimento
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => shell.openNewTransaction({ tipo: 'Saída' })} className="text-[12.5px] gap-2">
              <ArrowUpCircle className="w-3.5 h-3.5 text-destructive" /> Saída / pagamento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Resumo do período — clicar em Entradas/Saídas filtra a lista abaixo pelo mesmo tipo */}
      <div className="grid grid-cols-3 gap-px bg-border border border-border rounded-xl overflow-hidden">
        <KpiCard
          label="Entradas" value={fmt(entradas)} size="compact" tone="success"
          active={filtroTipo === 'entradas'} onClick={() => limparFiltroTipo('entradas')}
          info="Recebido no período selecionado acima (competência) — pode diferir da Visão Geral, que usa sempre o mês atual real."
        />
        <KpiCard label="Saídas" value={fmt(saidas)} size="compact" tone="destructive" active={filtroTipo === 'saidas'} onClick={() => limparFiltroTipo('saidas')} />
        <KpiCard label="Resultado" value={fmt(resultado)} size="compact" tone={resultado >= 0 ? 'success' : 'destructive'} />
      </div>

      {/* Busca + Filtros */}
      <div className="flex items-center gap-2">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lançamento..." className="flex-1 h-9 text-[13px] border-2" />
        <Popover open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
          <PopoverTrigger asChild>
            <button className={cn('h-9 px-3 rounded-lg border-2 text-[12.5px] font-medium flex items-center gap-1.5 flex-none transition-colors', filtrosAtivos ? 'border-primary text-primary' : 'hover:border-hover')}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros {filtrosAtivos && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[240px] space-y-3">
            <div>
              <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2 mb-1.5">Tipo</div>
              <div className="flex gap-1">
                {([['todos', 'Todos'], ['entradas', 'Entradas'], ['saidas', 'Saídas']] as [FiltroTipo, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => setFiltroTipo(v)} className={cn('px-2.5 py-1 rounded-md text-[11px] font-medium border', filtroTipo === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-mute-2 hover:border-hover')}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2 mb-1.5">Status</div>
              <div className="flex gap-1 flex-wrap">
                {([['todos', 'Todos'], ['concluidos', 'Recebidos/Pagos'], ['pendentes', 'Pendentes']] as [FiltroStatus, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => setFiltroStatus(v)} className={cn('px-2.5 py-1 rounded-md text-[11px] font-medium border', filtroStatus === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-mute-2 hover:border-hover')}>{l}</button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Lista agrupada por data */}
      {blocos.length === 0 ? (
        <div className="bg-card border border-dash border-2 rounded-xl py-10 text-center">
          {shell.monthTransactions.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">Nenhuma movimentação neste período. Lançamentos de entrada e saída aparecem aqui assim que forem registrados.</p>
          ) : (
            <>
              <p className="text-[12.5px] text-muted-foreground">Nenhum lançamento corresponde à busca ou aos filtros.</p>
              <button onClick={() => { setSearch(''); setFiltroTipo('todos'); setFiltroStatus('todos'); }} className="mt-2 text-[11.5px] font-medium text-accent">Limpar busca e filtros</button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-[18px]">
          {blocos.map(([rotulo, gruposDoDia]) => (
            <div key={rotulo}>
              <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-mute-2 mb-2 px-0.5">{rotulo}</div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {gruposDoDia.map((g, i) => (
                  <div key={g.chave} className={cn(i > 0 && 'border-t border-3')}>
                    {g.parcelado ? (
                      <CartaoParcelado
                        grupo={g}
                        expandido={expandidoChave === g.chave}
                        onToggle={() => setExpandidoChave(prev => (prev === g.chave ? null : g.chave))}
                        onAbrirDetalhe={setDetalhe}
                        onRegistrar={tx => shell.openCompleteTransaction(tx)}
                      />
                    ) : (
                      <LinhaMovimentacao
                        tx={g.itens[0]}
                        clienteNome={nomeCliente(g.itens[0].clienteId)}
                        trabalho={trabalhoDe(g.itens[0].processId)}
                        onAbrirDetalhe={() => setDetalhe(g.itens[0])}
                        onVerTrabalho={() => navigate(`/trabalhos/${g.itens[0].processId}`)}
                        onAdiar={(data, label) => handlePostpone(g.itens[0], data, label)}
                        onConcluir={() => shell.openCompleteTransaction(g.itens[0])}
                        onEditar={() => shell.openEditTransaction(g.itens[0])}
                        onExcluir={() => setDeleteTarget(g.itens[0])}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <DetalheLancamentoDialog transaction={detalhe} onClose={() => setDetalhe(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LinhaMovimentacao({ tx, clienteNome, trabalho, onAbrirDetalhe, onVerTrabalho, onAdiar, onConcluir, onEditar, onExcluir }: {
  tx: Transaction;
  clienteNome?: string;
  trabalho?: { id: string; objeto: string };
  onAbrirDetalhe: () => void;
  onVerTrabalho: () => void;
  onAdiar: (data: string, label: string) => void;
  onConcluir: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const income = isIncome(tx);
  const pendente = tx.status !== 'Concluído';
  const vinculado = !!tx.processId;
  const todayStr = new Date().toISOString().slice(0, 10);
  const atrasado = pendente && tx.data < todayStr;
  const Icon = income ? ArrowDownCircle : ArrowUpCircle;

  return (
    <div className={cn('flex items-start gap-3 px-[16px] py-[12px] hover:bg-surface-3/60 transition-colors cursor-pointer', atrasado && 'bg-destructive-soft/25')} onClick={onAbrirDetalhe}>
      <Icon className={cn('w-4 h-4 mt-[2px] flex-none', income ? 'text-success' : 'text-destructive')} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-medium truncate">{tx.descricao}</span>
          <span className={cn('font-mono-hbs text-[13.5px] flex-none', income ? 'text-success' : 'text-destructive')}>
            {income ? '+ ' : '− '}<ValorMonetario value={fmt(tx.valor)} />
          </span>
        </div>
        <div className="text-[11px] text-mute-2 truncate mt-0.5">{clienteNome || 'Sem cliente'}{trabalho && ` · ${trabalho.objeto}`}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <StatusBadge tone={atrasado ? 'destructive' : tx.status === 'Concluído' ? 'success' : 'warning'}>
            {atrasado ? 'Atrasado' : statusLabel(tx)}
          </StatusBadge>
          <span className="text-[11px] text-mute-3">{new Date(dataEfetiva(tx) + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 flex-none" onClick={e => e.stopPropagation()}>
        {vinculado ? (
          <button onClick={onVerTrabalho} className="h-7 px-2 rounded-lg text-[10.5px] font-medium text-mute-2 hover:text-foreground hover:bg-surface-3 transition-colors flex items-center gap-1 whitespace-nowrap">
            Ver trabalho <ArrowRight className="w-3 h-3" />
          </button>
        ) : (
          <>
            {pendente && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-mute-3" title="Adiar">
                    <CalendarClock className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs">Adiar para qual mês?</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {getNext3MonthsOptions(tx.data).map(opt => (
                    <DropdownMenuItem key={opt.newDate} onClick={() => onAdiar(opt.newDate, opt.label)} className="text-xs flex justify-between gap-3">
                      <span>{opt.label}</span><span className="text-mute-2 font-mono-hbs">{opt.displayDate}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {pendente && (
              <button onClick={onConcluir} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-success-soft text-mute-3 hover:text-success" title={income ? 'Marcar como recebida' : 'Marcar como paga'}>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={onEditar} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-mute-3" title="Editar">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onExcluir} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive-soft text-mute-3 hover:text-destructive" title="Excluir">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CartaoParcelado({ grupo, expandido, onToggle, onAbrirDetalhe, onRegistrar }: {
  grupo: LancamentoGrupo;
  expandido: boolean;
  onToggle: () => void;
  onAbrirDetalhe: (tx: Transaction) => void;
  onRegistrar: (tx: Transaction) => void;
}) {
  const income = isIncome(grupo.itens[0]);
  const Icon = income ? ArrowDownCircle : ArrowUpCircle;
  const pendente = grupo.itens.find(t => t.status !== 'Concluído');
  const descricaoBase = grupo.itens[0].descricao.replace(/\s*\(Restante\)\s*$/i, '');

  return (
    <div>
      <div className="flex items-start gap-3 px-[16px] py-[12px] hover:bg-surface-3/60 transition-colors cursor-pointer" onClick={onToggle}>
        <Icon className={cn('w-4 h-4 mt-[2px] flex-none', income ? 'text-success' : 'text-destructive')} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium truncate">{descricaoBase}</span>
            <span className={cn('font-mono-hbs text-[13.5px] flex-none', income ? 'text-success' : 'text-destructive')}>
              {income ? '+ ' : '− '}<ValorMonetario value={fmt(grupo.valorRestante > 0 ? grupo.valorRestante : grupo.valorTotal)} />
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <StatusBadge tone={grupo.valorRestante > 0 ? 'accent' : 'success'}>{grupo.valorRestante > 0 ? 'Parcial' : (income ? 'Recebido' : 'Pago')}</StatusBadge>
            <span className="text-[11px] text-mute-2">
              {income ? 'Recebido' : 'Pago'} {fmt(grupo.valorRecebido)} de {fmt(grupo.valorTotal)}{grupo.valorRestante > 0 && ` · restam ${fmt(grupo.valorRestante)}`}
            </span>
          </div>
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-mute-3 flex-none mt-[3px] transition-transform', expandido && 'rotate-180')} />
      </div>

      {expandido && (
        <div className="bg-surface-2 px-[16px] py-[12px] space-y-1.5 border-t border-3">
          {grupo.itens.map(t => (
            <div key={t.id} onClick={() => onAbrirDetalhe(t)} className="flex items-center justify-between gap-2 text-[11.5px] py-1 cursor-pointer hover:opacity-70">
              <span className="text-mute-2">{t.status === 'Concluído' ? `${income ? 'Recebido' : 'Pago'} em ${new Date(dataEfetiva(t) + 'T12:00:00').toLocaleDateString('pt-BR')}` : `Vencimento ${new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}`}</span>
              <span className="font-mono-hbs">{fmt(t.valor)}</span>
            </div>
          ))}
          {pendente && (
            <button onClick={() => onRegistrar(pendente)} className="mt-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[11.5px] font-medium hover:opacity-90 transition-opacity">
              Registrar {income ? 'recebimento' : 'pagamento'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
