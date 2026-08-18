import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Transaction, Process } from '@/lib/types';
import { getClients, getProcesses } from '@/lib/storage';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Clock3, Trash2, Pencil, CalendarClock, ArrowRight, ArrowDownUp, Wallet } from 'lucide-react';
import { deleteTransaction, updateTransaction } from '@/lib/storage';
import { toast } from 'sonner';
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
  const currentYear = startRef.getFullYear();
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

function getCategoryEmoji(categoria: string): string {
  const match = categoria.match(/^(\p{Emoji_Presentation}|\p{Emoji}️?)/u);
  return match ? match[0] : '📄';
}

type ViewType = 'Realizado' | 'Pendente';
type SortOrder = 'Data' | 'Valor' | 'Cliente';

interface Props {
  transactions: Transaction[];
  tipo: 'Receitas' | 'Despesas';
  onEdit: (tx: Transaction) => void;
  onComplete: (tx: Transaction) => void;
  onDelete: () => void;
}

/** Lista de lançamentos do Fluxo de Caixa — visualização e organização. Lançamentos vinculados a um Trabalho
 *  só mostram link "Ver trabalho" (edição acontece lá); só lançamentos sem trabalho (despesas gerais, avulsos)
 *  são editáveis aqui, porque não têm outra tela onde viver. */
export function TransactionList({ transactions, tipo, onEdit, onComplete, onDelete }: Props) {
  const navigate = useNavigate();
  const [viewType, setViewType] = useState<ViewType>('Realizado');
  const [sortBy, setSortBy] = useState<SortOrder>('Data');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const clientes = useMemo(() => getClients(), []);
  const processos = useMemo(() => getProcesses(), []);
  const todayStr = new Date().toISOString().slice(0, 10);

  function getClientName(id?: string | null) {
    if (!id) return null;
    return clientes.find(c => c.id === id)?.nome || null;
  }
  function getTrabalho(id?: string): Process | undefined {
    return id ? processos.find(p => p.id === id) : undefined;
  }

  const filtered = useMemo(() => {
    let items = transactions.filter(t => {
      const isIncome = t.tipo === 'Entrada' || t.tipo === 'A Receber';
      if (tipo === 'Receitas' && !isIncome) return false;
      if (tipo === 'Despesas' && isIncome) return false;
      if (viewType === 'Realizado') return t.status === 'Concluído';
      return t.status === 'Pendente' || t.status === 'Parcial';
    });
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(t =>
        t.descricao.toLowerCase().includes(q) ||
        (getClientName(t.clienteId) || '').toLowerCase().includes(q) ||
        (getTrabalho(t.processId)?.objeto || '').toLowerCase().includes(q)
      );
    }
    const sorted = [...items];
    if (sortBy === 'Data') sorted.sort((a, b) => a.data.localeCompare(b.data));
    if (sortBy === 'Valor') sorted.sort((a, b) => b.valor - a.valor);
    if (sortBy === 'Cliente') sorted.sort((a, b) => (getClientName(a.clienteId) || '').localeCompare(getClientName(b.clienteId) || ''));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, tipo, viewType, search, sortBy]);

  const total = filtered.reduce((s, t) => s + t.valor, 0);

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteTransaction(deleteTarget.id);
    toast.success('Lançamento excluído.');
    setDeleteTarget(null);
    onDelete();
  }

  function handlePostpone(tx: Transaction, newDate: string, monthLabel: string) {
    updateTransaction({ ...tx, data: newDate });
    toast.success(`Lançamento movido para ${monthLabel}`);
    onDelete();
  }

  return (
    <div className="space-y-[14px]">
      <div className="flex bg-surface-2 p-1 rounded-xl border border-3 w-fit">
        <button onClick={() => setViewType('Realizado')} className={cn('px-3.5 py-[7px] rounded-lg text-[12.5px] font-medium transition-colors flex items-center gap-1.5', viewType === 'Realizado' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
          <Wallet className="w-3.5 h-3.5" /> Realizado
        </button>
        <button onClick={() => setViewType('Pendente')} className={cn('px-3.5 py-[7px] rounded-lg text-[12.5px] font-medium transition-colors flex items-center gap-1.5', viewType === 'Pendente' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
          <CalendarClock className="w-3.5 h-3.5" /> Previsto
        </button>
      </div>

      <div className="flex flex-wrap gap-2.5 items-center justify-between">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por descrição, cliente ou trabalho" className="flex-1 min-w-[220px] h-9 text-[13px] border-2" />
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortOrder)}>
          <SelectTrigger className="h-9 text-xs w-[170px]"><div className="flex items-center gap-1.5"><ArrowDownUp className="w-3.5 h-3.5 text-muted-foreground" /><SelectValue /></div></SelectTrigger>
          <SelectContent>
            <SelectItem value="Data">Data</SelectItem>
            <SelectItem value="Valor">Valor (maior → menor)</SelectItem>
            <SelectItem value="Cliente">Cliente (A → Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 && (
        <div className={cn('flex items-center justify-between rounded-lg px-4 py-2.5 text-[12.5px] font-medium', tipo === 'Receitas' ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive')}>
          <span>Total {tipo.toLowerCase()} em {viewType.toLowerCase()}</span>
          <span className="font-mono-hbs text-[13.5px]">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card border border-dash border-2 rounded-xl py-14 text-center">
          <p className="text-sm font-medium">Nada por aqui ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">{viewType === 'Realizado' ? 'Nenhum lançamento concluído neste período.' : 'Nenhum lançamento previsto neste período.'}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.map(t => {
            const isIncome = t.tipo === 'Entrada' || t.tipo === 'A Receber';
            const isPendente = t.status !== 'Concluído';
            const isLate = isPendente && t.data < todayStr;
            const trabalho = getTrabalho(t.processId);
            const clienteNome = getClientName(t.clienteId);
            const vinculado = !!t.processId;

            return (
              <div key={t.id} className={cn('flex items-center gap-3 px-[18px] py-[13px] border-t border-3 first:border-t-0', isLate && 'bg-destructive-soft/30')}>
                <span className="w-[34px] h-[34px] flex-none rounded-lg bg-surface-2 grid place-items-center text-[15px]">{getCategoryEmoji(t.categoria)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium truncate">{t.descricao}</span>
                    {isLate && <span className="text-[9.5px] px-1.5 py-[1px] rounded-[4px] bg-destructive-soft text-destructive font-medium uppercase tracking-wide flex-none">Atrasado</span>}
                  </div>
                  <div className="text-[11px] text-mute-2 mt-0.5 truncate">
                    {clienteNome || 'Sem cliente'}
                    {trabalho && <> · {trabalho.objeto}</>}
                    {' · '}{new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <span className={cn('font-mono-hbs text-[14px] flex-none', isIncome ? 'text-success' : 'text-warning')}>
                  {isIncome ? '+' : '-'} R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={cn('text-[10px] px-2 py-[3px] rounded-[5px] font-medium flex-none flex items-center gap-1',
                  t.status === 'Concluído' ? 'bg-success-soft text-success' : t.status === 'Parcial' ? 'bg-accent-soft text-accent' : 'bg-warning-soft text-warning')}>
                  {t.status === 'Concluído' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock3 className="w-2.5 h-2.5" />}
                  {t.status}
                </span>

                <div className="flex-none flex items-center gap-1">
                  {vinculado ? (
                    <button onClick={() => navigate(`/trabalhos/${t.processId}`)} className="h-7 px-2.5 rounded-lg border-2 text-[11px] font-medium hover:border-hover transition-colors flex items-center gap-1">
                      Ver trabalho <ArrowRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <>
                      {isPendente && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-mute-2" title="Adiar">
                              <CalendarClock className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-xs">Adiar para qual mês?</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {getNext3MonthsOptions(t.data).map(opt => (
                              <DropdownMenuItem key={opt.newDate} onClick={() => handlePostpone(t, opt.newDate, opt.label)} className="text-xs flex justify-between gap-3">
                                <span>{opt.label}</span><span className="text-mute-2 font-mono-hbs">{opt.displayDate}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {isPendente && (
                        <button onClick={() => onComplete(t)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-success-soft text-mute-2 hover:text-success" title={isIncome ? 'Marcar como recebida' : 'Marcar como paga'}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => onEdit(t)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-mute-2" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(t)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive-soft text-mute-2 hover:text-destructive" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
