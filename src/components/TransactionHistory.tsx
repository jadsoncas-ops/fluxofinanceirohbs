import { useState, useMemo } from 'react';
import { Transaction } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, CheckCircle2, Clock3, Trash2, ArrowUpRight, ArrowDownRight, CornerDownRight, CalendarDays } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteTransaction } from '@/lib/storage';
import { toast } from 'sonner';

type FilterTab = 'Tudo' | 'Receitas' | 'Despesas';

function getCategoryEmoji(categoria: string): string {
  const match = categoria.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
  return match ? match[0] : '📄';
}

function getTypeStyles(tipo: string) {
  switch (tipo) {
    case 'Entrada': return 'border-l-4 border-l-green-500 bg-green-500/[0.03] hover:bg-green-500/[0.06] border-t-border/40 border-r-border/40 border-b-border/40';
    case 'Saída': return 'border-l-4 border-l-red-500 bg-red-500/[0.03] hover:bg-red-500/[0.06] border-t-border/40 border-r-border/40 border-b-border/40';
    case 'A Receber': return 'border-l-4 border-l-yellow-500 bg-yellow-500/[0.03] hover:bg-yellow-500/[0.06] border-t-border/40 border-r-border/40 border-b-border/40';
    case 'A Pagar': return 'border-l-4 border-l-orange-500 bg-orange-500/[0.03] hover:bg-orange-500/[0.06] border-t-border/40 border-r-border/40 border-b-border/40';
    default: return 'border-l-4 border-l-border bg-card';
  }
}

function getAmountColor(tipo: string) {
  if (tipo === 'Entrada') return 'text-green-600 dark:text-green-500';
  if (tipo === 'Saída') return 'text-red-600 dark:text-red-500';
  if (tipo === 'A Receber') return 'text-yellow-600 dark:text-yellow-500';
  if (tipo === 'A Pagar') return 'text-orange-600 dark:text-orange-500';
  return '';
}

interface Props {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onComplete: (tx: Transaction) => void;
  onDelete: () => void;
}

export function TransactionHistory({ transactions, onEdit, onComplete, onDelete }: Props) {
  const [filter, setFilter] = useState<FilterTab>('Tudo');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const filtered = transactions.filter(tx => {
    if (filter === 'Receitas') return tx.tipo === 'Entrada' || tx.tipo === 'A Receber';
    if (filter === 'Despesas') return tx.tipo === 'Saída' || tx.tipo === 'A Pagar';
    return true;
  });

  const childrenMap = new Map<string, Transaction[]>();
  const childIds = new Set<string>();
  filtered.forEach(tx => {
    if (tx.parentId) {
      childIds.add(tx.id);
      const existing = childrenMap.get(tx.parentId) || [];
      existing.push(tx);
      childrenMap.set(tx.parentId, existing);
    }
  });

  const topLevel = filtered.filter(tx => !childIds.has(tx.id));
  const totalFiltered = filtered.reduce((sum, tx) => sum + tx.valor, 0);

  // Group by Date
  const groupedDates = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    topLevel.forEach(tx => {
      const d = tx.data;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(tx);
    });
    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return sortedDates.map(date => ({ 
      date, 
      dateObj: new Date(date + 'T12:00:00'),
      items: map.get(date)! 
    }));
  }, [topLevel]);

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteTransaction(deleteTarget.id);
    toast.success('Lançamento excluído com sucesso.');
    setDeleteTarget(null);
    onDelete();
  }

  function renderRow(tx: Transaction, isChild = false) {
    const emoji = getCategoryEmoji(tx.categoria);
    const styles = getTypeStyles(tx.tipo);
    const color = getAmountColor(tx.tipo);
    const isIncome = tx.tipo === 'Entrada' || tx.tipo === 'A Receber';

    if (isChild) {
      return (
        <div key={tx.id} className="flex items-center gap-2.5 px-3 py-2 ml-4 mb-1 border-l-2 rounded-r-lg bg-background/50 border-l-muted-foreground/30 hover:bg-muted/50 transition-colors">
          <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-muted/60 text-muted-foreground">
            <span className="text-[10px] leading-none">{emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={`text-[9px] h-3 px-1 py-0 bg-transparent ${color} border-current`}>{tx.tipo}</Badge>
              <p className="text-xs font-medium truncate text-foreground/80">{tx.descricao}</p>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">{tx.categoria}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <p className={`text-xs font-bold tabular-nums ${color}`}>
              {isIncome ? '+' : '-'} R$ {tx.valor.toFixed(2)}
            </p>
            <div className="flex gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => onEdit(tx)}>
                <Pencil className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/50 hover:text-destructive" onClick={() => setDeleteTarget(tx)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={tx.id} className={`flex relative flex-col p-3 rounded-lg border shadow-sm transition-all ${styles} mb-1.5 group`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-background shadow-sm border border-border/40">
            <span className="text-lg leading-none">{emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold truncate tracking-tight text-foreground/90">{tx.descricao}</p>
              {tx.isRepasse && <Badge variant="secondary" className="text-[9px] h-4 px-1 py-0 border-0 bg-primary/10 text-primary uppercase font-bold tracking-wider">Repasse</Badge>}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className={`text-[9px] leading-none h-4 px-1.5 py-0 border-current bg-background ${color}`}>{tx.tipo}</Badge>
              <span className="text-xs text-muted-foreground truncate">{tx.categoria}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <p className={`text-base font-black tabular-nums ${color}`}>
              {isIncome ? '+' : '-'} R$ {tx.valor.toFixed(2)}
            </p>
            <Badge variant={tx.status === 'Concluído' ? 'default' : 'secondary'} className={`text-[9px] h-4 px-1.5 border-0 ${tx.status === 'Concluído' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning font-semibold tracking-wide'}`}>
              {tx.status === 'Concluído' ? <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> : <Clock3 className="w-2.5 h-2.5 mr-1" />}
              {tx.status}
            </Badge>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border/40 border-dashed opacity-70 group-hover:opacity-100 transition-opacity">
          <Button variant="secondary" size="sm" className="h-6 px-2.5 text-[10px] bg-background border border-border hover:bg-muted" onClick={() => onEdit(tx)}>
            <Pencil className="w-3 h-3 mr-1" /> Editar
          </Button>
          {tx.status === 'Pendente' && (
            <Button variant="default" size="sm" className="h-6 px-2.5 text-[10px] bg-success/10 text-success hover:bg-success hover:text-white border border-success/20" onClick={() => onComplete(tx)}>
              <CheckCircle2 className="w-3 h-3 mr-1" /> Concluir
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 w-7 px-0 text-destructive/60 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteTarget(tx)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
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
          <span>Total {filter}</span>
          <span className="tabular-nums font-bold text-base">R$ {totalFiltered.toFixed(2)}</span>
        </div>
      )}

      {groupedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground bg-muted/20 rounded-lg border border-border/50 border-dashed">
          <CalendarDays className="w-10 h-10 mb-2 opacity-20" />
          <p className="text-sm font-medium">Nenhum lançamento encontrado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedDates.map(({ date, dateObj, items }) => (
            <div key={date} className="relative">
              {/* Date Header Segment */}
              <div className="flex items-center gap-3 mb-2 px-1">
                <div className="flex items-center justify-center p-1.5 bg-primary/10 rounded-md">
                   <CalendarDays className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                  {dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </h3>
                <div className="h-px flex-1 bg-gradient-to-r from-border/80 to-transparent"></div>
              </div>
              
              <div className="space-y-2">
                {items.map(tx => {
                  const children = childrenMap.get(tx.id) || [];
                  return (
                    <div key={tx.id}>
                      {renderRow(tx)}
                      {children.length > 0 && (
                        <div className="space-y-0 relative mt-0.5">
                          {/* visual string tying children */}
                          <div className="absolute left-6 top-0 bottom-3 w-px bg-border/60 z-0"></div>
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
          ))}
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
