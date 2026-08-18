import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Transaction, Client } from '@/lib/types';
import { Pencil, CheckCircle2, Clock3, Trash2, CalendarClock, AlertCircle, Plus, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteTransaction, updateTransaction, getClients, getProcesses } from '@/lib/storage';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getNext3MonthsOptions(originalDateStr: string) {
  const [, , dStr] = originalDateStr.split('-');
  const origDay = parseInt(dStr, 10);
  const options = [];
  const baseDate = new Date();
  const txDate = new Date(originalDateStr + 'T12:00:00');
  const startRef = txDate > baseDate ? txDate : baseDate;
  let currentMonth = startRef.getMonth();
  let currentYear = startRef.getFullYear();

  for (let i = 1; i <= 3; i++) {
    const targetMonth = (currentMonth + i) % 12;
    const targetYear = currentYear + Math.floor((currentMonth + i) / 12);
    const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const finalDay = Math.min(origDay, lastDayOfMonth);
    const mFmt = String(targetMonth + 1).padStart(2, '0');
    const dFmt = String(finalDay).padStart(2, '0');
    options.push({
      label: `${MONTHS[targetMonth]} ${targetYear}`,
      newDate: `${targetYear}-${mFmt}-${dFmt}`,
      displayDate: `${dFmt}/${mFmt}/${targetYear}`,
    });
  }
  return options;
}

type ViewType = 'Realizado' | 'Pendente';
type SortOrder = 'Data' | 'Valor' | 'Cliente';

function getCategoryEmoji(categoria: string): string {
  const match = categoria.match(/^(\p{Emoji_Presentation}|\p{Emoji}️?)/u);
  return match ? match[0] : '📄';
}

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Props {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onComplete: (tx: Transaction) => void;
  onDelete: () => void;
  onAddRepasse?: (tx: Transaction) => void;
  /** Receitas ou Despesas — cada tela é fixa em um tipo, nunca mistura A Receber com A Pagar. */
  initialFilter: 'Receitas' | 'Despesas';
}

/** Lista de lançamentos (Receitas ou Despesas) — flat, sem agrupamento por processo. Para ver o financeiro de um cliente/trabalho específico, use a ficha do Trabalho ou o Cliente 360. */
export function TransactionHistory({ transactions, onEdit, onComplete, onDelete, onAddRepasse, initialFilter }: Props) {
  const navigate = useNavigate();
  const [viewType, setViewType] = useState<ViewType>('Realizado');
  const [sortBy, setSortBy] = useState<SortOrder>('Data');
  const [busca, setBusca] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const clientes = useMemo(() => getClients(), []);
  const trabalhos = useMemo(() => getProcesses(), []);
  const todayStr = new Date().toISOString().slice(0, 10);
  const isIncome = initialFilter === 'Receitas';

  function getClientName(id?: string | null) {
    if (!id) return 'Sem cliente';
    return clientes.find(c => c.id === id)?.nome || 'Sem cliente';
  }

  function getTrabalhoNome(id?: string) {
    if (!id) return null;
    return trabalhos.find(p => p.id === id)?.objeto || null;
  }

  const filtered = useMemo(() => {
    const byType = transactions.filter(tx => {
      if (isIncome) return tx.tipo === 'Entrada' || tx.tipo === 'A Receber';
      return tx.tipo === 'Saída' || tx.tipo === 'A Pagar';
    });
    const byView = byType.filter(tx => (viewType === 'Realizado' ? tx.status === 'Concluído' : tx.status !== 'Concluído'));
    const bySearch = busca.trim()
      ? byView.filter(tx => tx.descricao.toLowerCase().includes(busca.toLowerCase()) || getClientName(tx.clienteId).toLowerCase().includes(busca.toLowerCase()))
      : byView;
    const sorted = [...bySearch].sort((a, b) => {
      if (sortBy === 'Valor') return b.valor - a.valor;
      if (sortBy === 'Cliente') return getClientName(a.clienteId).localeCompare(getClientName(b.clienteId));
      return a.data.localeCompare(b.data);
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, isIncome, viewType, busca, sortBy]);

  const totalFiltered = filtered.reduce((s, tx) => s + tx.valor, 0);

  const childrenMap = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    const parentIdsInFiltered = new Set(filtered.map(t => t.id));
    filtered.forEach(tx => {
      if (tx.parentId && parentIdsInFiltered.has(tx.parentId)) {
        const existing = map.get(tx.parentId) || [];
        existing.push(tx);
        map.set(tx.parentId, existing);
      }
    });
    return map;
  }, [filtered]);

  const topLevel = filtered.filter(tx => !tx.parentId);

  function toggleExpand(id: string) {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteTransaction(deleteTarget.id);
    toast.success('Lançamento excluído com sucesso.');
    setDeleteTarget(null);
    onDelete();
  }

  function handlePostpone(tx: Transaction, newDate: string, monthLabel: string) {
    updateTransaction({ ...tx, data: newDate });
    toast.success(`Lançamento movido para ${monthLabel}`);
    onDelete();
  }

  function handleEditClick(tx: Transaction) {
    if (tx.parentId) {
      const parent = transactions.find(t => t.id === tx.parentId);
      if (parent) { onEdit(parent); return; }
    }
    onEdit(tx);
  }

  function renderChild(tx: Transaction) {
    return (
      <div key={tx.id} className="flex items-center justify-between gap-3 px-[14px] py-[9px] ml-6 mt-1.5 border border-3 rounded-lg bg-surface-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[9.5px] uppercase font-medium bg-neutral-soft text-mute-2 px-1.5 py-[1px] rounded-[4px]">Repasse</span>
            <p className="text-[11.5px] font-medium truncate">{tx.descricao}</p>
          </div>
          <span className="text-[10.5px] text-mute-3">{tx.categoria}</span>
        </div>
        <div className="flex items-center gap-2 flex-none">
          <span className="font-mono-hbs text-[11.5px] text-destructive">− {fmt(tx.valor)}</span>
          <button onClick={() => handleEditClick(tx)} className="h-6 w-6 grid place-items-center rounded-md hover:bg-surface-3 text-mute-2"><Pencil className="w-3 h-3" /></button>
          <button onClick={() => setDeleteTarget(tx)} className="h-6 w-6 grid place-items-center rounded-md hover:bg-destructive-soft text-destructive"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
    );
  }

  function renderRow(tx: Transaction) {
    const emoji = getCategoryEmoji(tx.categoria);
    const isLate = viewType === 'Pendente' && tx.status !== 'Concluído' && tx.data < todayStr;
    const children = childrenMap.get(tx.id) || [];
    const trabalhoNome = getTrabalhoNome(tx.processId);
    const valorColor = isIncome ? 'text-success' : 'text-destructive';

    return (
      <div key={tx.id} className={cn('bg-card border border-border rounded-xl p-[14px_16px]', isLate && 'border-destructive/40 bg-destructive-soft')}>
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 flex-none rounded-lg bg-surface-2 grid place-items-center text-[16px]">{emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn('text-[13px] font-medium truncate', isLate && 'text-destructive')}>{tx.descricao}</p>
              {isLate && <span className="text-[9.5px] uppercase font-medium bg-destructive text-white px-1.5 py-[1px] rounded-[4px] flex items-center gap-1 flex-none"><AlertCircle className="w-2.5 h-2.5" /> Atrasada</span>}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10.5px] text-mute-2">{tx.categoria}</span>
              <span className="text-[10.5px] text-mute-3">·</span>
              <button onClick={() => tx.clienteId && navigate(`/clientes/${tx.clienteId}`)} className="text-[10.5px] text-mute-2 hover:text-accent transition-colors">{getClientName(tx.clienteId)}</button>
              {trabalhoNome && (
                <>
                  <span className="text-[10.5px] text-mute-3">·</span>
                  <button onClick={() => navigate(`/trabalhos/${tx.processId}`)} className="text-[10.5px] text-accent hover:underline">{trabalhoNome}</button>
                </>
              )}
              <span className="text-[10.5px] text-mute-3">·</span>
              <span className="text-[10.5px] text-mute-3 font-mono-hbs">{new Date(tx.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-none">
            <span className={cn('font-mono-hbs text-[17px]', valorColor)}>{isIncome ? '+' : '−'} {fmt(tx.valor)}</span>
            <span className={cn('text-[10px] px-2 py-[2px] rounded-[5px] font-medium', tx.status === 'Concluído' ? 'bg-success-soft text-success' : tx.status === 'Parcial' ? 'bg-accent-soft text-accent' : 'bg-warning-soft text-warning')}>
              {tx.status}
            </span>
          </div>
        </div>

        <div className={cn('flex items-center gap-2 mt-3 pt-3 border-t border-3', children.length > 0 ? 'justify-between' : 'justify-end')}>
          {children.length > 0 && (
            <button onClick={() => toggleExpand(tx.id)} className="h-7 px-2.5 rounded-lg border-2 text-[10.5px] font-medium hover:border-hover transition-colors flex items-center gap-1">
              {expandedParents.has(tx.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expandedParents.has(tx.id) ? 'Ocultar' : 'Ver'} repasses ({children.length})
            </button>
          )}
          <div className="flex items-center gap-2 flex-wrap justify-end flex-1">
            {isIncome && onAddRepasse && (
              <button onClick={() => onAddRepasse(tx)} className="h-7 px-2.5 rounded-lg border-2 text-[10.5px] font-medium hover:border-hover transition-colors flex items-center gap-1">
                <Plus className="w-3 h-3" /> Repasse
              </button>
            )}
            {tx.status !== 'Concluído' && !tx.parentId && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-7 px-2.5 rounded-lg border-2 text-[10.5px] font-medium hover:border-hover transition-colors flex items-center gap-1">
                      <CalendarClock className="w-3.5 h-3.5" /> {isLate ? 'Adiar' : (isIncome ? 'Não recebi ainda' : 'Não paguei ainda')}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel className="text-xs">Para qual mês deseja mover?</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {getNext3MonthsOptions(tx.data).map(opt => (
                      <DropdownMenuItem key={opt.newDate} onClick={() => handlePostpone(tx, opt.newDate, opt.label)} className="flex justify-between text-xs">
                        <span>{opt.label}</span>
                        <span className="text-mute-3 font-mono-hbs">{opt.displayDate}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <button onClick={() => onComplete(tx)} className="h-7 px-3 bg-success text-white rounded-lg text-[10.5px] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {isIncome ? 'Recebido' : 'Pago'}
                </button>
              </>
            )}
            <button onClick={() => handleEditClick(tx)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-mute-2"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => setDeleteTarget(tx)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive-soft text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {expandedParents.has(tx.id) && children.map(renderChild)}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex bg-surface-2 p-1 rounded-xl border border-3">
        <button
          onClick={() => setViewType('Realizado')}
          className={cn('flex-1 py-2 text-[12.5px] font-medium rounded-lg transition-colors', viewType === 'Realizado' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
        >
          Extrato (Realizado)
        </button>
        <button
          onClick={() => setViewType('Pendente')}
          className={cn('flex-1 py-2 text-[12.5px] font-medium rounded-lg transition-colors', viewType === 'Pendente' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
        >
          Previsão (Pendente)
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-mute-3 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por descrição ou cliente" className="h-9 text-xs pl-9" />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOrder)} className="h-9 px-2.5 rounded-lg border-2 bg-card text-[12px]">
          <option value="Data">Data (padrão)</option>
          <option value="Valor">Valor (maior → menor)</option>
          <option value="Cliente">Cliente (A → Z)</option>
        </select>
      </div>

      {filtered.length > 0 && (
        <div className={cn('flex items-center justify-between rounded-xl px-[16px] py-[11px]', isIncome ? 'bg-success-soft' : 'bg-destructive-soft')}>
          <span className={cn('text-[12.5px] font-medium', isIncome ? 'text-success' : 'text-destructive')}>Total em {viewType.toLowerCase()}</span>
          <span className={cn('font-mono-hbs text-[15px]', isIncome ? 'text-success' : 'text-destructive')}>{fmt(totalFiltered)}</span>
        </div>
      )}

      {topLevel.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <p className="text-sm font-medium">Nada por aqui ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">{busca ? 'Nenhum resultado para essa busca.' : `Nenhum lançamento ${viewType === 'Realizado' ? 'concluído' : 'pendente'} neste período.`}</p>
        </div>
      ) : (
        <div className="space-y-2.5">{topLevel.map(renderRow)}</div>
      )}

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
