import { useState, useMemo } from 'react';
import { Transaction } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, CheckCircle2, Clock3, Trash2, ArrowUpRight, ArrowDownRight, CornerDownRight, CalendarDays, Wallet, CalendarClock, AlertCircle, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteTransaction, updateTransaction } from '@/lib/storage';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    
    // Calcula ultimo dia valido para garantir que nao exista 31 de Abril ou 30 de Fev.
    const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const finalDay = Math.min(origDay, lastDayOfMonth);
    
    const mFmt = String(targetMonth + 1).padStart(2, '0');
    const dFmt = String(finalDay).padStart(2, '0');
    const newDateStr = `${targetYear}-${mFmt}-${dFmt}`;
    
    options.push({
      label: `${MONTHS[targetMonth]} ${targetYear}`,
      newDate: newDateStr,
      displayDate: `${dFmt}/${mFmt}/${targetYear}`,
    });
  }
  return options;
}

type ViewType = 'Realizado' | 'Pendente';
type FilterTab = 'Tudo' | 'Receitas' | 'Despesas';

function getCategoryEmoji(categoria: string): string {
  const match = categoria.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
  return match ? match[0] : '📄';
}

function getTypeStyles(tipo: string) {
  return 'border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all duration-200';
}

function getAmountColor(tipo: string) {
  if (tipo === 'Entrada') return 'text-success';
  if (tipo === 'Saída') return 'text-destructive';
  if (tipo === 'A Receber') return 'text-primary';
  if (tipo === 'A Pagar') return 'text-warning';
  return '';
}

interface Props {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onComplete: (tx: Transaction) => void;
  onDelete: () => void;
  onAddRepasse?: (tx: Transaction) => void;
}

export function TransactionHistory({ transactions, onEdit, onComplete, onDelete, onAddRepasse }: Props) {
  const [viewType, setViewType] = useState<ViewType>('Realizado');
  const [filter, setFilter] = useState<FilterTab>('Tudo');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  const viewFiltered = transactions.filter(tx => {
    if (viewType === 'Realizado') return tx.status === 'Concluído';
    return tx.status === 'Pendente';
  });

  const filtered = useMemo(() => {
    // 1. Get base items for the filter
    const baseItems = viewFiltered.filter(tx => {
      if (filter === 'Receitas') return tx.tipo === 'Entrada' || tx.tipo === 'A Receber';
      if (filter === 'Despesas') return (tx.tipo === 'Saída' || tx.tipo === 'A Pagar');
      return true;
    });

    if (filter === 'Receitas') {
       // Automatically include repasses linked to these receitas so they show up in the tree
       const parentIdsInView = new Set(baseItems.map(t => t.id));
       const linkedRepasses = viewFiltered.filter(t => t.parentId && parentIdsInView.has(t.parentId) && t.isRepasse);
       // Avoid duplicates if some repasse already matched (unlikely given the !isRepasse above but safer)
       const existingIds = new Set(baseItems.map(t => t.id));
       const toAdd = linkedRepasses.filter(r => !existingIds.has(r.id));
       return [...baseItems, ...toAdd];
    }
    
    return baseItems;
  }, [viewFiltered, filter]);

  const childrenMap = new Map<string, Transaction[]>();
  const parentIdsInFiltered = new Set(filtered.map(t => t.id));
  const nestedChildIds = new Set<string>();

  filtered.forEach(tx => {
    if (tx.parentId && parentIdsInFiltered.has(tx.parentId)) {
      nestedChildIds.add(tx.id);
      const existing = childrenMap.get(tx.parentId) || [];
      existing.push(tx);
      childrenMap.set(tx.parentId, existing);
    }
  });

  const topLevel = filtered.filter(tx => !nestedChildIds.has(tx.id));

  const totalFiltered = filtered.reduce((sum, tx) => {
    const isIncome = tx.tipo === 'Entrada' || tx.tipo === 'A Receber';
    // No Histórico, agora exibimos o Bruto nos totais das abas para bater com o que está listado.
    // O usuário verá os repasses na lista e o total os incluirá.
    return sum + tx.valor;
  }, 0);

  // Group by Date
  const groupedDates = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    topLevel.forEach(tx => {
      const d = tx.data;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(tx);
    });
    // Pendentes: A to Z (próximos do vencimento primeiro ou atrasados)
    // Realizados: Z to A (mais recentes primeiro)
    const sortedDates = Array.from(map.keys()).sort((a, b) => 
      viewType === 'Realizado' ? b.localeCompare(a) : a.localeCompare(b)
    );
    
    return sortedDates.map(date => ({ 
      date, 
      dateObj: new Date(date + 'T12:00:00'),
      items: map.get(date)! 
    }));
  }, [topLevel, viewType]);

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteTransaction(deleteTarget.id);
    toast.success('Lançamento excluído com sucesso.');
    setDeleteTarget(null);
    onDelete();
  }

  function handlePostpone(tx: Transaction, newDate: string, monthLabel: string) {
    const updated = { ...tx, data: newDate };
    updateTransaction(updated);
    toast.success(`Lançamento movido para ${monthLabel}`);
    onDelete(); // Triggers parent refresh instantly without reload
  }

  function handleEditClick(tx: Transaction) {
    if (tx.parentId) {
      const parent = transactions.find(t => t.id === tx.parentId);
      if (parent) {
         onEdit(parent);
         return;
      }
    }
    onEdit(tx);
  }

  function renderRow(tx: Transaction, isChild = false) {
    const emoji = getCategoryEmoji(tx.categoria);
    const styles = getTypeStyles(tx.tipo);
    const color = getAmountColor(tx.tipo);
    const isIncome = tx.tipo === 'Entrada' || tx.tipo === 'A Receber';
    const isLate = viewType === 'Pendente' && tx.status === 'Pendente' && tx.data < todayStr;
    const children = childrenMap.get(tx.id) || [];
    const hasChildren = children.length > 0 && !isChild;
    const childrenSum = children.reduce((s, c) => s + Math.abs(c.valor), 0);
    const liquido = isIncome ? (tx.valor - childrenSum) : tx.valor;

    if (isChild) {
      return (
        <div key={tx.id} className="flex items-center justify-between gap-3 px-3 py-2.5 ml-8 mt-1.5 border border-border/40 rounded-lg bg-card hover:bg-muted/40 transition-colors shadow-sm relative">
          <div className="absolute -left-4 top-1/2 -mt-px w-4 h-px bg-border/60"></div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-muted/60 text-muted-foreground shadow-sm">
              <span className="text-[12px] leading-none">{emoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Badge variant="outline" className={`text-[9px] h-3 px-1 py-0 bg-transparent ${color} border-current opacity-80 uppercase font-bold tracking-wider`}>Repasse</Badge>
                <p className="text-[11px] font-semibold truncate text-foreground/80">{tx.descricao}</p>
              </div>
              <span className="text-[9px] text-muted-foreground flex items-center gap-1.5 truncate">
                <span>{tx.categoria}</span>
                {tx.updatedAt && <span className="italic opacity-70">• Editado</span>}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <p className={`text-xs font-bold tabular-nums ${color}`}>
              - R$ {tx.valor.toFixed(2)}
            </p>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground hover:bg-muted font-medium hover:text-foreground transition-colors" onClick={() => handleEditClick(tx)}>
              <Pencil className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 px-0 text-destructive/50 hover:bg-destructive/10 hover:text-destructive shrink-0" onClick={() => setDeleteTarget(tx)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div key={tx.id} className={`flex relative flex-col p-4 rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-all ${styles} mb-2.5 group ${isLate ? 'border-destructive/40 bg-destructive/[0.03]' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-background shadow-sm border border-border/50">
            <span className="text-xl leading-none">{emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className={`text-sm font-bold truncate tracking-tight ${isLate ? 'text-destructive' : 'text-foreground'}`}>{tx.descricao}</p>
              {isLate && <Badge variant="destructive" className="text-[9px] h-4 px-1.5 py-0 border-0 flex gap-1 items-center font-bold tracking-wide uppercase"><AlertCircle className="w-3 h-3" /> Atrasado</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[9px] font-bold tracking-wider uppercase leading-none h-4 px-1.5 py-0 border-current bg-background shadow-xs ${color}`}>{tx.tipo}</Badge>
              <span className="text-xs text-muted-foreground truncate font-medium">{tx.categoria}</span>
              {tx.updatedAt && <span className="text-[9px] text-muted-foreground/60 italic font-medium ml-1 flex items-center gap-1"><Pencil className="w-2.5 h-2.5" /> Editado</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <p className={`text-xl font-black tabular-nums tracking-tighter ${color}`}>
              {isIncome ? '+' : '-'} R$ {tx.valor.toFixed(2)}
            </p>
            <Badge variant={tx.status === 'Concluído' ? 'default' : 'secondary'} className={`text-[10px] h-4 px-1.5 border-0 font-bold uppercase tracking-wider ${tx.status === 'Concluído' ? 'bg-success/15 text-success' : 'bg-warning/20 text-warning'}`}>
              {tx.status === 'Concluído' ? <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> : <Clock3 className="w-2.5 h-2.5 mr-1" />}
              {tx.status}
            </Badge>
          </div>
        </div>

        {hasChildren && (
          <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-3 gap-2 text-center bg-muted/20 p-2.5 rounded-xl border border-border/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
             <div className="flex flex-col items-center justify-center">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-0.5">Total Recebido</p>
                <p className="font-bold text-xs text-foreground tabular-nums">R$ {tx.valor.toFixed(2)}</p>
             </div>
             <div className="flex flex-col items-center justify-center relative">
                <div className="absolute left-0 top-1 bottom-1 w-px bg-border/50"></div>
                <div className="absolute right-0 top-1 bottom-1 w-px bg-border/50"></div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-0.5">Repassado</p>
                <p className="font-bold text-xs text-destructive/80 tabular-nums">- R$ {childrenSum.toFixed(2)}</p>
             </div>
             <div className="flex flex-col items-center justify-center">
                <p className="text-[10px] text-success font-bold uppercase tracking-widest mb-0.5">Líquido P/ Empresa</p>
                <p className="font-bold text-xs text-success tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]">R$ {liquido.toFixed(2)}</p>
             </div>
          </div>
        )}
        
        <div className={`flex items-center gap-2 mt-4 pt-4 border-t border-border/40 border-dashed transition-opacity opacity-80 group-hover:opacity-100 ${hasChildren ? 'justify-between' : 'justify-end'}`}>
          {hasChildren && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[10px] font-bold tracking-wide uppercase text-muted-foreground hover:text-foreground bg-background hover:bg-muted"
              onClick={() => toggleExpand(tx.id)}
            >
              {expandedParents.has(tx.id) ? (
                <><ChevronUp className="w-4 h-4 mr-1.5"/> Ocultar ({children.length})</>
              ) : (
                <><ChevronDown className="w-4 h-4 mr-1.5"/> Ver Repasses ({children.length})</>
              )}
            </Button>
          )}

          <div className="flex items-center justify-end flex-wrap gap-2 flex-1">
            {isIncome && onAddRepasse && (
              <Button variant="outline" size="sm" className="h-7 px-3 text-[10px] bg-background border-border hover:bg-muted text-foreground font-semibold shadow-sm" onClick={() => onAddRepasse(tx)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Repasse
              </Button>
            )}
            
            {tx.status === 'Pendente' && !tx.parentId && (
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-3 text-[10px] bg-accent/30 text-muted-foreground hover:bg-muted font-medium hover:text-foreground border-border/50 shadow-sm transition-colors">
                      <CalendarClock className="w-3.5 h-3.5 mr-1.5" /> {isLate ? 'Adiar para outro mês' : (isIncome ? 'Não recebi ainda' : 'Não paguei ainda')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 rounded-xl border-border/50 shadow-xl overflow-hidden p-1">
                    <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground/80 pb-1">Para qual mês deseja mover?</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-border/40 mb-1" />
                    {getNext3MonthsOptions(tx.data).map((opt) => (
                      <DropdownMenuItem 
                        key={opt.newDate} 
                        className="text-xs flex justify-between items-center cursor-pointer py-2.5 px-3 focus:bg-primary/10 transition-colors rounded-lg mb-0.5"
                        onClick={() => handlePostpone(tx, opt.newDate, opt.label)}
                      >
                        <span className="font-semibold text-foreground/90">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground tracking-tight tabular-nums bg-muted px-1.5 py-0.5 rounded shadow-sm border border-border/50">{opt.displayDate}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="default" size="sm" className="h-7 px-3.5 text-[10.5px] font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 shadow-sm transition-all" onClick={() => onComplete(tx)}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {isIncome ? 'Recebido' : 'Pago'}
                </Button>
              </div>
            )}
            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[10px] text-muted-foreground hover:bg-muted font-medium hover:text-foreground border border-transparent transition-colors" onClick={() => handleEditClick(tx)}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> {tx.status === 'Concluído' ? 'Ajustar' : 'Editar'}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-8 px-0 text-destructive/60 hover:bg-destructive/10 hover:text-destructive shrink-0" onClick={() => setDeleteTarget(tx)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      
      {/* View Toggle */}
      <div className="flex bg-muted/60 p-1.5 rounded-xl border border-border/60 shadow-inner">
        <button
          onClick={() => setViewType('Realizado')}
          className={`flex-1 flex justify-center items-center gap-2 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
            viewType === 'Realizado' 
              ? 'bg-background shadow-sm text-foreground ring-1 ring-border' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
          }`}
        >
          <Wallet className="w-4 h-4" /> Extrato (Realizado)
        </button>
        <button
          onClick={() => setViewType('Pendente')}
          className={`flex-1 flex justify-center items-center gap-2 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
            viewType === 'Pendente' 
              ? 'bg-background shadow-sm text-foreground ring-1 ring-border' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
          }`}
        >
          <CalendarClock className="w-4 h-4" /> Previsão (Pendente)
        </button>
      </div>

      <Tabs value={filter} onValueChange={v => setFilter(v as FilterTab)}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="Tudo" className="text-xs">Tudo</TabsTrigger>
          <TabsTrigger value="Receitas" className="text-xs">
            <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-success" /> Receitas
          </TabsTrigger>
          <TabsTrigger value="Despesas" className="text-xs">
            <ArrowDownRight className="w-3.5 h-3.5 mr-1 text-destructive" /> Despesas
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filter !== 'Tudo' && filtered.length > 0 && (
        <div className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium shadow-sm transition-all ${
          filter === 'Receitas' ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          <span>Total {filter} em {viewType}</span>
          <span className="tabular-nums font-bold text-base">R$ {totalFiltered.toFixed(2)}</span>
        </div>
      )}

      {groupedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground bg-muted/20 rounded-lg border border-border/50 border-dashed">
          <CalendarDays className="w-10 h-10 mb-2 opacity-20" />
          <p className="text-sm font-medium">Nenhum lançamento {viewType.toLowerCase()} encontrado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedDates.map(({ date, dateObj, items }) => {
            const isDateLate = viewType === 'Pendente' && date < todayStr;
            return (
              <div key={date} className="relative">
                <div className="flex items-center gap-3 mb-2 px-1">
                  <div className={`flex items-center justify-center p-1.5 rounded-md ${isDateLate ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                    {isDateLate ? <AlertCircle className="w-4 h-4 text-destructive" /> : <CalendarDays className="w-4 h-4 text-primary" />}
                  </div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${isDateLate ? 'text-destructive/90' : 'text-muted-foreground/80'}`}>
                    {dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    {isDateLate && <span className="ml-2 font-black italic">!</span>}
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-border/80 to-transparent"></div>
                </div>
                
                <div className="space-y-2">
                  {items.map(tx => {
                    const children = childrenMap.get(tx.id) || [];
                    return (
                      <div key={tx.id}>
                        {renderRow(tx)}
                        {children.length > 0 && expandedParents.has(tx.id) && (
                          <div className="space-y-0 relative mt-1 mb-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="absolute left-[1.125rem] top-0 bottom-3 w-px bg-border/60 z-0"></div>
                            {children.map(child => (
                              <div className="relative z-10" key={child.id}>
                                {renderRow(child, true)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold">
              <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
