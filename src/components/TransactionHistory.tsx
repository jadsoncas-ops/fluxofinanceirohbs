import { useState, useMemo, useEffect } from 'react';
import { Transaction, Client } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, CheckCircle2, Clock3, Trash2, ArrowUpRight, ArrowDownRight, CornerDownRight, CalendarDays, Wallet, CalendarClock, AlertCircle, Plus, ChevronDown, ChevronUp, ArrowDownUp, FolderClosed, Send, Landmark as OrgaoIcon, Info } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteTransaction, updateTransaction, getProcessByClient, updateProcess } from '@/lib/storage';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getClients } from '@/lib/storage';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Process, ProcessStatus, ProcessNote, TransactionType, TransactionStatus } from '@/lib/types';
import { ClipboardList, Landmark, History, TrendingUp, TrendingDown, DollarSign, FileText, ExternalLink, Archive, Play, Receipt, Briefcase } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

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
type SortOrder = 'Data' | 'Valor' | 'Cliente';

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
  const [sortBy, setSortBy] = useState<SortOrder>('Data');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [clientes, setClientes] = useState<Client[]>([]);
  const [processFilter, setProcessFilter] = useState<'Ativos' | 'Arquivados'>('Ativos');
  
  // Estados para Gaveta de Processo
  const [activeProcessClienteId, setActiveProcessClienteId] = useState<string | null>(null);
  const [activeProcess, setActiveProcess] = useState<Process | null>(null);
  const [newNote, setNewNote] = useState('');
  const [showLaunchForm, setShowLaunchForm] = useState(false);
  const [launchData, setLaunchData] = useState({
    tipo: 'Entrada' as TransactionType,
    valor: 0,
    descricao: '',
    categoria: ''
  });

  useEffect(() => {
    setClientes(getClients());
  }, []);

  useEffect(() => {
    if (activeProcessClienteId) {
      const proc = getProcessByClient(activeProcessClienteId);
      if (proc) {
        setActiveProcess(proc);
      } else {
        // Inicializa novo processo para o cliente
        setActiveProcess({
          id: crypto.randomUUID(),
          clienteId: activeProcessClienteId,
          objeto: '',
          status: 'Levantamento',
          notas: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    } else {
      setActiveProcess(null);
    }
  }, [activeProcessClienteId]);

  const handleUpdateProcess = (updates: Partial<Process>) => {
    if (!activeProcess) return;
    const updated = { ...activeProcess, ...updates, updatedAt: Date.now() };
    setActiveProcess(updated);
    updateProcess(updated);
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !activeProcess) return;
    const note: ProcessNote = {
      id: crypto.randomUUID(),
      data: Date.now(),
      texto: newNote.trim()
    };
    handleUpdateProcess({ notas: [note, ...activeProcess.notas] });
    setNewNote('');
    toast.success('Nota de histórico adicionada.');
  };

  const handleQuickLaunch = () => {
    if (!activeProcess || !launchData.valor || !launchData.descricao) return;
    
    // Create transaction based on launchData
    const newTx: Transaction = {
       id: crypto.randomUUID(),
       data: todayStr,
       tipo: launchData.tipo,
       categoria: launchData.categoria || (launchData.tipo === 'Entrada' ? '📐 Elaboração de Projeto' : '⚙️ Custos operacionais'),
       descricao: launchData.descricao,
       valor: launchData.valor,
       status: 'Concluído',
       isRepasse: launchData.tipo === 'Saída' && launchData.descricao.toLowerCase().includes('repasse'),
       clienteId: activeProcess.clienteId,
       updatedAt: Date.now()
    };

    // Use parents props callback or directly add via storage (which is better for persistence)
    // But since the parent component manages the list, it's better if we update the list too.
    // Actually, calling addTransaction works but we need a refresh. Index.tsx uses refresh().
    import('@/lib/storage').then(s => {
       s.addTransaction(newTx);
       toast.success(`${launchData.tipo} lançada com sucesso!`);
       setShowLaunchForm(false);
       setLaunchData({ tipo: 'Entrada', valor: 0, descricao: '', categoria: '' });
       onDelete(); // Trigger parent refresh
    });
  };

  const clientFinances = useMemo(() => {
    if (!activeProcessClienteId) return { contrato: 0, recebido: 0, saldo: 0, repasses: 0 };
    const clientTxs = transactions.filter(t => t.clienteId === activeProcessClienteId);
    const recebido = clientTxs
      .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
      .reduce((sum, t) => sum + t.valor, 0);
    const repasses = clientTxs
      .filter(t => t.tipo === 'Saída' || t.tipo === 'A Pagar' || t.isRepasse)
      .reduce((sum, t) => sum + t.valor, 0);
    const contrato = activeProcess?.valorContrato || 0;
    const saldo = Math.max(0, contrato - recebido);
    return { contrato, recebido, saldo, repasses };
  }, [transactions, activeProcessClienteId, activeProcess?.valorContrato]);

  const timelineEvents = useMemo(() => {
    if (!activeProcess || !activeProcessClienteId) return [];
    
    const clientTxs = transactions.filter(t => t.clienteId === activeProcessClienteId);
    const combined: any[] = [...activeProcess.notas];
    clientTxs.forEach(t => {
      combined.push({
        id: `tx-${t.id}`,
        data: new Date(t.data + 'T12:00:00').getTime(),
        texto: `💸 ${t.tipo}: R$ ${t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - ${t.descricao}`,
        transaction: t // Link original para edição
      });
    });

    return combined.sort((a, b) => b.data - a.data);
  }, [activeProcess, transactions, activeProcessClienteId]);

  const lucroLiquido = clientFinances.recebido - clientFinances.repasses;

  function getClientName(id?: string | null) {
    if (!id) return "Sem cliente";
    const c = clientes.find(c => c.id === id);
    return c ? c.nome : "Sem cliente";
  }

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
    // Se o clienteId tiver um processo arquivado, filtramos dependendo do tab
    if (tx.clienteId) {
      const proc = getProcessByClient(tx.clienteId);
      if (processFilter === 'Ativos' && proc?.isArchived) return false;
      if (processFilter === 'Arquivados' && !proc?.isArchived) return false;
    } else if (processFilter === 'Arquivados') {
      return false; // Transações sem cliente não são arquiváveis sozinhas
    }

    if (viewType === 'Realizado') return tx.status === 'Concluído';
    return tx.status === 'Pendente' || tx.status === 'Parcial';
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

  const showCompleted = viewType === 'Pendente'; // Não, o usuário pediu um toggle específico no topo.
  const [mostrarArquivados, setMostrarArquivados] = useState(false);

  const processesData = useMemo(() => {
    // 1. Get all unique clientIds in the current filtered set
    const clientIds = new Set<string>();
    filtered.forEach(tx => {
      if (tx.clienteId) clientIds.add(tx.clienteId);
    });

    const groups = [];
    
    // 2. Process groups
    clientIds.forEach(cId => {
      const proc = getProcessByClient(cId);
      const isArchived = proc?.isArchived || proc?.status === 'Finalizado';
      
      if (!mostrarArquivados && isArchived) return;

      const clientTxs = filtered.filter(tx => tx.clienteId === cId);
      const client = clientes.find(c => c.id === cId);
      
      groups.push({
        type: 'process',
        id: cId,
        name: client?.nome || 'Cliente Desconhecido',
        status: proc?.status || 'A definir',
        valorContrato: proc?.valorContrato || 0,
        isArchived,
        items: clientTxs
      });
    });

    // 3. Unlinked group
    const unlinked = filtered.filter(tx => !tx.clienteId);
    if (unlinked.length > 0) {
      groups.unshift({
        type: 'unlinked',
        id: 'unlinked',
        name: 'Lançamentos Avulsos',
        status: 'Pendente de Vínculo',
        valorContrato: 0,
        isArchived: false,
        items: unlinked
      });
    }

    return groups;
  }, [filtered, mostrarArquivados, clientes]);

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
    const isLate = viewType === 'Pendente' && (tx.status === 'Pendente' || tx.status === 'Parcial') && tx.data < todayStr;
    const children = childrenMap.get(tx.id) || [];
    const hasChildren = children.length > 0 && !isChild;
    const childrenSum = children.reduce((s, c) => s + Math.abs(c.valor), 0);
    const liquidez = isIncome ? (tx.valor - childrenSum) : tx.valor;

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
            {tx.status === 'Parcial' && tx.originalTotal ? (
               <div className="flex flex-col items-end gap-px">
                  <span className="text-[9px] text-muted-foreground line-through font-medium leading-none">Repasse: R$ {tx.originalTotal.toFixed(2)}</span>
                  <span className="text-[10px] text-emerald-600 font-bold leading-none py-0.5">Pago: R$ {(tx.originalTotal - tx.valor).toFixed(2)}</span>
                  <span className={`text-xs font-black tabular-nums text-destructive leading-none`}>Falta: R$ {tx.valor.toFixed(2)}</span>
               </div>
            ) : (
               <p className={`text-xs font-bold tabular-nums ${color}`}>
                 - R$ {tx.valor.toFixed(2)}
               </p>
            )}
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
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={`text-[9px] font-bold tracking-wider uppercase leading-none h-4 px-1.5 py-0 border-current bg-background shadow-xs ${color}`}>{tx.tipo}</Badge>
              <span className="text-xs text-muted-foreground truncate font-medium">{tx.categoria}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 block">
               <span className="text-[10px] text-muted-foreground bg-muted/20 px-1.5 py-0.5 rounded border border-border/40 font-medium">👤 {getClientName(tx.clienteId)}</span>
               {tx.clienteId && (
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-5 px-1.5 text-[9px] text-primary/70 hover:text-primary hover:bg-primary/5 font-bold uppercase tracking-tighter"
                   onClick={() => setActiveProcessClienteId(tx.clienteId || null)}
                 >
                   <FolderClosed className="w-3 h-3 mr-1" /> Gerir Processo
                 </Button>
               )}
               <span className="text-[10px] text-muted-foreground font-medium opacity-50 border-l border-border/40 pl-2">{new Date(tx.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {tx.status === 'Parcial' && tx.originalTotal ? (
               <div className="flex flex-col items-end">
                 <span className="text-[10px] text-muted-foreground line-through font-medium">Era: R$ {tx.originalTotal.toFixed(2)}</span>
                 <p className={`text-xl font-black tabular-nums tracking-tighter ${color}`}>
                   {isIncome ? '+' : '-'} R$ {tx.valor.toFixed(2)}
                 </p>
               </div>
            ) : (
               <p className={`text-xl font-black tabular-nums tracking-tighter ${color}`}>
                 {isIncome ? '+' : '-'} R$ {tx.valor.toFixed(2)}
               </p>
            )}
            <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 border-0 font-bold uppercase tracking-wider ${
              tx.status === 'Concluído' ? 'bg-success/15 text-success' : 
              (tx.status === 'Parcial' ? 'bg-primary/15 text-primary' : 'bg-warning/20 text-warning')
            }`}>
              {tx.status === 'Concluído' ? <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> : <Clock3 className="w-2.5 h-2.5 mr-1" />}
              {tx.status}
            </Badge>
          </div>
        </div>

        {/* Simplificação: resumo financeiro detalhado removido da linha principal, agora focado na Gaveta */}
        
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
            
            {(tx.status === 'Pendente' || tx.status === 'Parcial') && !tx.parentId && (
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

      <div className="flex bg-muted/30 p-1 rounded-lg border border-border/40 max-w-fit mx-auto">
        <button 
          onClick={() => setProcessFilter('Ativos')}
          className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${processFilter === 'Ativos' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
        >
          🚀 Ativos
        </button>
        <button 
          onClick={() => setProcessFilter('Arquivados')}
          className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${processFilter === 'Arquivados' ? 'bg-slate-700 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
        >
          📂 Arquivados
        </button>
      </div>

      {filter !== 'Tudo' && filtered.length > 0 && (
        <div className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium shadow-sm transition-all ${
          filter === 'Receitas' ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          <span>Total {filter} em {viewType}</span>
          <span className="tabular-nums font-bold text-base">R$ {totalFiltered.toFixed(2)}</span>
        </div>
      )}

      {/* Select de Ordenacao */}
      <div className="flex justify-end pt-1">
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortOrder)}>
          <SelectTrigger className="h-8 text-xs w-[180px] bg-background shadow-sm">
             <div className="flex items-center gap-1.5">
               <ArrowDownUp className="w-3.5 h-3.5 text-muted-foreground" />
               <SelectValue placeholder="Ordenar por" />
             </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Data">Data (Padrão)</SelectItem>
            <SelectItem value="Valor">Valor (Maior → Menor)</SelectItem>
            <SelectItem value="Cliente">Cliente (A → Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex bg-muted/30 p-1.5 rounded-xl border border-border/40 justify-center items-center gap-4">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 cursor-pointer">
           <input 
             type="checkbox" 
             checked={mostrarArquivados} 
             onChange={e => setMostrarArquivados(e.target.checked)}
             className="w-4 h-4 rounded border-primary/30 text-primary focus:ring-primary/20"
           />
           Mostrar Concluídos
        </Label>
      </div>

      {processesData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground bg-muted/20 rounded-lg border border-border/50 border-dashed">
          <Briefcase className="w-10 h-10 mb-2 opacity-20" />
          <p className="text-sm font-medium">Nenhum processo em trâmite encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {processesData.map((group) => {
            const isUnlinked = group.type === 'unlinked';
            return (
              <Card 
                key={group.id} 
                onClick={() => isUnlinked ? null : setActiveProcessClienteId(group.id)}
                className={`transition-all border-border/50 hover:border-primary/40 shadow-sm hover:shadow-md rounded-2xl overflow-hidden cursor-pointer group ${group.isArchived ? 'opacity-50 grayscale bg-muted/30' : 'bg-card'}`}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl border ${isUnlinked ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' : 'bg-primary/5 border-primary/20 text-primary'}`}>
                        {isUnlinked ? <AlertCircle className="w-5 h-5" /> : <FolderClosed className="w-5 h-5" />}
                      </div>
                      <div>
                         <h4 className="font-bold text-sm text-foreground tracking-tight">{group.name}</h4>
                         <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className={`text-[9px] h-4 px-1.5 py-0 border-current bg-background uppercase font-black tracking-widest ${group.status === 'Exigência' ? 'text-destructive' : 'text-primary'}`}>
                              {group.status}
                            </Badge>
                            {isUnlinked && <span className="text-[10px] text-amber-600 font-bold italic">({group.items.length} pendências)</span>}
                         </div>
                      </div>
                    </div>

                    <div className="text-right">
                       <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Contrato</p>
                       <p className="text-sm font-black text-foreground tabular-nums">
                         R$ {group.valorContrato.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                       </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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

      <Sheet open={!!activeProcessClienteId} onOpenChange={v => !v && setActiveProcessClienteId(null)}>
        <SheetContent className="w-full sm:max-w-md bg-card p-0 flex flex-col gap-0 border-l border-border/50">
          <SheetHeader className="p-6 pb-4 border-b border-border/30 bg-muted/20">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <ClipboardList className="w-5 h-5" />
              <SheetTitle className="text-lg font-black tracking-tight uppercase">Gaveta de Processo</SheetTitle>
            </div>
            <SheetDescription className="text-xs font-medium text-muted-foreground">
              Gerencie o trâmite e notas para: <span className="text-foreground font-bold">{getClientName(activeProcessClienteId)}</span>
            </SheetDescription>
          </SheetHeader>

          {activeProcess && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              {/* Resumo Financeiro */}
              <div className="grid grid-cols-2 gap-2">
                 <div className="bg-muted/30 p-3 rounded-xl border border-border/50 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
                      <Info className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest leading-none">Contrato</span>
                    </div>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-[10px] font-bold text-muted-foreground mr-0.5">R$</span>
                      <input 
                        type="number" 
                        value={activeProcess.valorContrato || ''} 
                        onChange={e => handleUpdateProcess({ valorContrato: parseFloat(e.target.value) || 0 })}
                        className="bg-transparent border-none text-base font-black text-foreground focus:outline-none focus:ring-0 p-0 w-full tabular-nums"
                        placeholder="0,00"
                      />
                    </div>
                 </div>
                 <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1 text-emerald-600">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest leading-none">Recebido</span>
                    </div>
                    <p className="text-base font-black text-emerald-600 tabular-nums">R$ {clientFinances.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                 </div>
                 <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/20 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1 text-amber-600">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest leading-none">Saldo</span>
                    </div>
                    <p className="text-base font-black text-amber-600 tabular-nums">R$ {clientFinances.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                 </div>
                 <div className="bg-destructive/5 p-3 rounded-xl border border-destructive/20 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1 text-destructive">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest leading-none">Custos</span>
                    </div>
                    <p className="text-base font-black text-destructive tabular-nums">R$ {clientFinances.repasses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                 </div>
              </div>

              {/* Botão Lançar e Arquivar */}
              <div className="flex gap-2">
                 <Button 
                   onClick={() => setShowLaunchForm(!showLaunchForm)}
                   className="flex-1 h-10 rounded-xl bg-primary hover:bg-primary/90 text-[11px] font-black uppercase tracking-widest gap-2 shadow-sm"
                 >
                   <Plus className="w-4 h-4" /> Lançar Valor
                 </Button>
                 {activeProcess.status === 'Finalizado' && (
                   <Button 
                     variant="outline"
                     onClick={() => handleUpdateProcess({ isArchived: !activeProcess.isArchived })}
                     className={`flex-1 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest gap-2 ${activeProcess.isArchived ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-slate-500/10 text-slate-600 border-slate-500/20'}`}
                   >
                     {activeProcess.isArchived ? <><Play className="w-4 h-4" /> Reativar</> : <><Archive className="w-4 h-4" /> Arquivar</>}
                   </Button>
                 )}
              </div>

              {/* Mini formulário de lançamento */}
              {showLaunchForm && (
                <div className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-3 animate-in fade-in slide-in-from-top-2">
                   <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setLaunchData({...launchData, tipo: 'Entrada'})}
                        className={`py-2 rounded-lg text-xs font-bold ${launchData.tipo === 'Entrada' ? 'bg-success text-white' : 'bg-muted text-muted-foreground'}`}>Receita</button>
                      <button 
                        onClick={() => setLaunchData({...launchData, tipo: 'Saída'})}
                        className={`py-2 rounded-lg text-xs font-bold ${launchData.tipo === 'Saída' ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground'}`}>Despesa</button>
                   </div>
                   <Input 
                     placeholder="Descrição (ex: Parcelamento)" 
                     value={launchData.descricao}
                     onChange={e => setLaunchData({...launchData, descricao: e.target.value})}
                     className="h-10 bg-background text-xs" />
                   <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground opacity-50">R$</span>
                      <Input 
                        type="number"
                        placeholder="Valor"
                        value={launchData.valor || ''}
                        onChange={e => setLaunchData({...launchData, valor: parseFloat(e.target.value) || 0 })}
                        className="h-10 pl-8 bg-background text-xs font-bold" />
                   </div>
                   <Button size="sm" onClick={handleQuickLaunch} className="w-full h-10 font-black uppercase tracking-widest text-[10px]">
                      Confirmar Lançamento
                   </Button>
                </div>
              )}

              {/* Status de Trâmite */}
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Status de Trâmite</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Levantamento', 'Protocolo', 'Exigência', 'Finalizado'] as ProcessStatus[]).map(s => (
                    <Button 
                      key={s} 
                      variant="outline" 
                      onClick={() => handleUpdateProcess({ status: s })}
                      className={`h-11 rounded-xl text-xs font-bold transition-all border-border/50 ${
                        activeProcess.status === s 
                          ? (s === 'Exigência' ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-primary/10 text-primary border-primary/30') 
                          : 'hover:bg-muted opacity-60'
                      }`}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Objeto / Google Drive */}
              <div className="grid gap-4">
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Objeto do Serviço</Label>
                   <Input 
                     value={activeProcess.objeto} 
                     onChange={e => handleUpdateProcess({ objeto: e.target.value })}
                     placeholder="Ex: Regularização Cássia Silva"
                     className="h-11 bg-muted/20 border-border/50 rounded-xl font-medium focus:bg-background transition-all"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Link de Documentos (Google Drive)</Label>
                   <div className="flex gap-2">
                     <div className="relative flex-1">
                       <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-50" />
                       <Input 
                         value={activeProcess.driveLink || ''} 
                         onChange={e => handleUpdateProcess({ driveLink: e.target.value })}
                         placeholder="URL da Pasta"
                         className="h-11 pl-10 bg-muted/20 border-border/50 rounded-xl text-xs"
                       />
                     </div>
                     {activeProcess.driveLink && (
                       <Button size="icon" variant="outline" className="h-11 w-11 rounded-xl shrink-0" asChild>
                         <a href={activeProcess.driveLink} target="_blank" rel="noopener noreferrer">
                           <ExternalLink className="w-5 h-5 text-primary" />
                         </a>
                       </Button>
                     )}
                   </div>
                 </div>
              </div>

              {/* Campos de Protocolo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Protocolo nº</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-50" />
                    <Input 
                      value={activeProcess.protocolo || ''} 
                      onChange={e => handleUpdateProcess({ protocolo: e.target.value })}
                      placeholder="Nº Processo"
                      className="h-11 pl-10 bg-muted/20 border-border/50 rounded-xl font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Data Protocolo</Label>
                  <Input 
                    type="date"
                    value={activeProcess.dataProtocolo || ''} 
                    onChange={e => handleUpdateProcess({ dataProtocolo: e.target.value })}
                    className="h-11 bg-muted/20 border-border/50 rounded-xl font-medium"
                  />
                </div>
              </div>

              {/* Timeline de Notas */}
              <div className="space-y-4 pt-4 border-t border-border/30">
                 <div className="flex items-center gap-2 mb-2">
                    <History className="w-4 h-4 text-primary" />
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Histórico Técnico & Financeiro</Label>
                 </div>
                 
                 <div className="relative">
                    <Textarea 
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Adicionar atualização técnica..."
                      className="min-h-[80px] bg-muted/20 border-border/50 rounded-xl font-medium p-4 pr-12 focus:bg-background transition-all resize-none"
                    />
                    <Button 
                      size="icon" 
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
                      className="absolute right-2 bottom-2 w-8 h-8 rounded-lg shadow-lg"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                 </div>

                 <div className="space-y-4 pt-2">
                    {timelineEvents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 opacity-30 grayscale">
                        <History className="w-8 h-8 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Sem eventos registrados</p>
                      </div>
                    ) : (
                      <div className="relative space-y-4 pl-4 before:absolute before:left-1 before:top-2 before:bottom-0 before:w-0.5 before:bg-border/30">
                        {timelineEvents.map(note => {
                          const isFinancial = !!(note as any).transaction;
                          return (
                            <div key={note.id} className="relative">
                              <div className={`absolute -left-[1.35rem] top-1.5 w-3 h-3 rounded-full border-2 border-background shadow-sm ${isFinancial ? 'bg-emerald-500 hover:scale-110' : 'bg-primary'} cursor-pointer transition-transform`}></div>
                              <div 
                                onClick={() => isFinancial && handleEditClick((note as any).transaction)}
                                className={`${isFinancial ? 'bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer' : 'bg-muted/30'} p-3 rounded-xl border border-border/30 transition-colors`}
                              >
                                {isFinancial && (
                                   <div className="flex items-center justify-between mb-1">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/80">Lançamento Financeiro</p>
                                      <Pencil className="w-2.5 h-2.5 text-emerald-600/50" />
                                   </div>
                                )}
                                <p className={`text-xs font-medium leading-relaxed mb-1.5 ${isFinancial ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-foreground/90'}`}>{note.texto}</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                  <Clock3 className="w-2.5 h-2.5" />
                                  {new Date(note.data).toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                 </div>
              </div>

              {/* Lucro Líquido do Processo */}
              <div className="mt-auto p-6 border-t border-border/30 bg-muted/40 sticky bottom-0">
                 <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lucro Líquido do Processo</span>
                 </div>
                 <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-success/70">R$</span>
                    <span className="text-3xl font-black text-success tabular-nums tracking-tighter">
                      {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                 </div>
                 <p className="text-[9px] text-muted-foreground italic mt-1 font-medium italic opacity-60">Calculado: Recebido - Custos de Repasses</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
