import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Transaction, Client, Process, ProcessStatus, ProcessNote } from '@/lib/types';
import { getClients, getProcessByClient, getProcesses, updateProcess, deleteProcess, addTransaction, deleteTransaction, getTransactions, updateTransaction } from '@/lib/storage';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, FolderClosed, AlertCircle, ClipboardList, TrendingUp, TrendingDown, DollarSign,
  History, Clock3, FileText, Archive, Play, Trash2, Info, Check,
  Search, CalendarDays, UserPlus, X, ChevronUp, Pencil, CalendarPlus
} from 'lucide-react';
import { ClientForm } from './ClientForm';
import { PartialPaymentModal } from './PartialPaymentModal';

type ProcessViewFilter = 'tramite' | 'concluidos' | 'arquivados';
type InlineForm = 'receita' | 'despesa' | null;

interface QuickForm {
  descricao: string;
  valor: string;
  data: string;
  efetivado: boolean;
}

interface Props {
  allTransactions: Transaction[];
  onRefresh: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function ProcessManager({ allTransactions, onRefresh, activeTab = 'ativos', onTabChange }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [clientes, setClientes] = useState<Client[]>([]);
  const [viewFilter, setViewFilter] = useState<ProcessViewFilter>('tramite');
  const [searchTerm, setSearchTerm] = useState('');

  // Drawer state
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
  const [activeProcess, setActiveProcess] = useState<Process | null>(null);
  const [newNote, setNewNote] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Inline launch form
  const [inlineForm, setInlineForm] = useState<InlineForm>(null);
  const [quickForm, setQuickForm] = useState<QuickForm>({ descricao: '', valor: '', data: today, efetivado: true });

  // Edit note
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Edit financial transaction
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingTransactionData, setEditingTransactionData] = useState<Partial<Transaction>>({});

  // Delete confirmations
  const [deleteProcessOpen, setDeleteProcessOpen] = useState(false);
  const [deleteCardTarget, setDeleteCardTarget] = useState<{ processId: string; name: string } | null>(null);
  const [deleteTimelineTarget, setDeleteTimelineTarget] = useState<{ id: string; tipo: 'nota' | 'transacao'; label: string } | null>(null);

  // New process creation
  const [completeItem, setCompleteItem] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectClientOpen, setSelectClientOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  useEffect(() => {
    setClientes(getClients());
  }, [allTransactions]);

  // Sync activeProcess when id changes
  useEffect(() => {
    if (activeProcessId) {
      const all = getProcesses();
      const proc = all.find(p => p.id === activeProcessId);
      if (proc) {
        setActiveProcess({ ...proc });
      } else {
        setActiveProcess(null);
      }
      setHasUnsavedChanges(false);
      setInlineForm(null);
      setQuickForm({ descricao: '', valor: '', data: today, efetivado: true });
    } else {
      setActiveProcess(null);
    }
  }, [activeProcessId, today]);

  // Local update (buffered — needs Save button)
  const handleLocalUpdate = useCallback((updates: Partial<Process>) => {
    setActiveProcess(prev => prev ? { ...prev, ...updates } : null);
    setHasUnsavedChanges(true);
  }, []);

  // Immediate persist (status, archive, notes)
  const handleImmediateUpdate = useCallback((updates: Partial<Process>) => {
    if (!activeProcess) return;
    
    // Regra: Ao colocar status "Finalizado", perguntamos se deseja arquivar (se quitado)
    if (updates.status === 'Finalizado' && !activeProcess.isArchived) {
      // Usar a mesma lógica de cálculo dos cards: contrato - recebido
      const clientTxs = (getTransactions() || []).filter(t => t.processId === activeProcess.id || (!t.processId && t.clienteId === activeProcess.clienteId));
      const recebidoTotal = clientTxs.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído').reduce((s, t) => s + t.valor, 0);
      const isPaid = (activeProcess.valorContrato || 0) > 0 && Math.max(0, activeProcess.valorContrato! - recebidoTotal) === 0;

      if (isPaid) {
        setArchiveConfirmOpen(true);
      }
    }

    const updated = { ...activeProcess, ...updates, updatedAt: Date.now() };
    setActiveProcess(updated);
    updateProcess(updated);
    onRefresh();
  }, [activeProcess, onRefresh]);

  const handleSaveChanges = useCallback(() => {
    if (!activeProcess) return;
    updateProcess({ ...activeProcess, updatedAt: Date.now() });
    setHasUnsavedChanges(false);
    onRefresh(); 
    toast.success('Alterações salvas!');
    setTimeout(() => setActiveProcessId(null), 1000);
  }, [activeProcess, onRefresh]);

  // Add technical note
  const handleAddNote = useCallback(() => {
    if (!newNote.trim() || !activeProcess) return;
    const note: ProcessNote = { id: crypto.randomUUID(), data: Date.now(), texto: newNote.trim() };
    const updated = { ...activeProcess, notas: [note, ...activeProcess.notas], updatedAt: Date.now() };
    setActiveProcess(updated);
    updateProcess(updated);
    setNewNote('');
    onRefresh();
    toast.success('Nota adicionada.');
  }, [newNote, activeProcess, onRefresh]);

  // Edit note
  const handleSaveNoteEdit = useCallback(() => {
    if (!activeProcess || !editingNoteId || !editingNoteText.trim()) return;
    const notas = activeProcess.notas.map(n =>
      n.id === editingNoteId ? { ...n, texto: editingNoteText.trim() } : n
    );
    const updated = { ...activeProcess, notas, updatedAt: Date.now() };
    setActiveProcess(updated);
    updateProcess(updated);
    setEditingNoteId(null);
    setEditingNoteText('');
    onRefresh();
    toast.success('Nota atualizada.');
  }, [activeProcess, editingNoteId, editingNoteText, onRefresh]);

  // Quick financial launch
  const handleQuickLaunch = useCallback(() => {
    if (!activeProcess || !quickForm.valor || !quickForm.descricao.trim() || !quickForm.data) return;
    const valor = parseFloat(quickForm.valor);
    if (isNaN(valor) || valor <= 0) { toast.error('Insira um valor válido.'); return; }
    
    const tx: Transaction = {
      id: crypto.randomUUID(),
      data: quickForm.data,
      tipo: inlineForm === 'receita' ? 'Entrada' : 'Saída',
      categoria: inlineForm === 'receita' ? 'Recebimento' : 'Custo/Repasse',
      descricao: quickForm.descricao,
      valor,
      status: quickForm.efetivado ? 'Concluído' : 'Pendente',
      isRepasse: inlineForm === 'despesa',
      clienteId: activeProcess.clienteId,
      processId: activeProcess.id,
      updatedAt: Date.now(),
    };
    
    addTransaction(tx);
    toast.success(tx.status === 'Concluído' ? 'Caixa atualizado!' : 'Lançamento previsto na Gaveta.');
    setInlineForm(null);
    setQuickForm({ descricao: '', valor: '', data: today, efetivado: true });
    onRefresh();
  }, [activeProcess, inlineForm, quickForm, today, onRefresh]);

  // Save financial transaction edit
  const handleSaveTransactionEdit = useCallback(() => {
    if (!editingTransactionId || !activeProcess) return;
    const allTxs = getTransactions();
    const oldTx = allTxs.find(t => t.id === editingTransactionId);
    if (!oldTx) return;

    const valor = parseFloat(editingTransactionData.valor?.toString() || '0');
    if (isNaN(valor) || valor <= 0) { toast.error('Insira um valor válido.'); return; }

    const updatedTx: Transaction = {
      ...oldTx,
      descricao: editingTransactionData.descricao || oldTx.descricao,
      valor,
      data: editingTransactionData.data || oldTx.data,
      updatedAt: Date.now(),
    };

    updateTransaction(updatedTx);
    setEditingTransactionId(null);
    setEditingTransactionData({});
    onRefresh();
    toast.success('Lançamento atualizado!');
  }, [editingTransactionId, editingTransactionData, activeProcess, onRefresh]);

  // Confirm delete from timeline
  const handleConfirmTimelineDelete = useCallback(() => {
    if (!deleteTimelineTarget || !activeProcess) return;
    if (deleteTimelineTarget.tipo === 'nota') {
      const notas = activeProcess.notas.filter(n => n.id !== deleteTimelineTarget.id);
      const updated = { ...activeProcess, notas, updatedAt: Date.now() };
      setActiveProcess(updated);
      updateProcess(updated);
      onRefresh();
      toast.success('Nota removida.');
    } else {
      deleteTransaction(deleteTimelineTarget.id);
      onRefresh();
      toast.success('Lançamento removido.');
    }
    setDeleteTimelineTarget(null);
  }, [deleteTimelineTarget, activeProcess, onRefresh]);

  // Delete full process from drawer
  const handleDeleteProcess = useCallback(() => {
    if (!activeProcess) return;
    deleteProcess(activeProcess.id);
    toast.success('Processo excluído.');
    setDeleteProcessOpen(false);
    setActiveProcessId(null);
    onRefresh();
  }, [activeProcess, onRefresh]);

  // Delete from card
  const handleDeleteCardProcess = useCallback(() => {
    if (!deleteCardTarget) return;
    deleteProcess(deleteCardTarget.processId);
    toast.success(`Processo excluído.`);
    setDeleteCardTarget(null);
    onRefresh();
  }, [deleteCardTarget, onRefresh]);

  function getClientName(id?: string | null) {
    if (!id) return 'Sem cliente';
    return clientes.find(c => c.id === id)?.nome || 'Cliente desconhecido';
  }

  // Process cards
  const processCards = useMemo(() => {
    const processes = getProcesses();
    type FinancialStatus = 'PAGO' | 'PARCIAL' | 'PENDENTE';
    const cards: {
      id: string; clienteId: string; name: string;
      objeto: string;
      status: ProcessStatus | 'A definir'; protocolo?: string;
      dataProtocolo?: string; isArchived: boolean;
      recebido: number; saldo: number;
      repassesPagos: number; gastoPrevisto: number;
      liquidoReal: number; valorContrato: number;
      recebidosPendentes: number;
      lucroFuturo: number;
      financialStatus: FinancialStatus;
      lastNotes: string[];
    }[] = [];

    const assignedTxIds = new Set<string>();
    processes.forEach(proc => {
      const client = clientes.find(c => c.id === proc.clienteId);
      
      // Filtro Rigoroso: Se o lançamento tem processId, é amarrado a ele. 
      // Se não tem (legado), amarramos apenas ao primeiro processo encontrado desse cliente para evitar duplicidade.
      const clientTxs = allTransactions.filter(t => {
        if (t.processId) return t.processId === proc.id;
        if (!t.processId && t.clienteId === proc.clienteId && !assignedTxIds.has(t.id)) {
          assignedTxIds.add(t.id);
          return true;
        }
        return false;
      });
      
      const recebido = clientTxs
        .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
        .reduce((s, t) => s + t.valor, 0);

      const repassesPagos = clientTxs
        .filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status === 'Concluído')
        .reduce((s, t) => s + t.valor, 0);

      const gastoPrevisto = clientTxs
        .filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status !== 'Concluído')
        .reduce((s, t) => s + t.valor, 0);

      const recebidosPendentes = clientTxs
        .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Pendente')
        .reduce((s, t) => s + t.valor, 0);
      
      const valorContrato = proc.valorContrato || 0;
      const saldo = Math.max(0, valorContrato - recebido);
      const lucroFuturo = (saldo + recebidosPendentes) - gastoPrevisto;
      const liquidoReal = recebido === 0 ? 0 : recebido - repassesPagos;
      const lastNotes = (proc.notas || [])
        .sort((a, b) => b.data - a.data).slice(0, 3).map(n => n.texto);

      const financialStatus: FinancialStatus = 
        recebido === 0 ? 'PENDENTE' : 
        valorContrato > 0 && saldo === 0 ? 'PAGO' : 'PARCIAL';

      cards.push({
        id: proc.id, 
        clienteId: proc.clienteId,
        name: client?.nome || 'Cliente desconhecido',
        objeto: proc.objeto || 'Serviço sem objeto',
        status: proc.status || 'Levantamento',
        protocolo: proc.protocolo,
        dataProtocolo: proc.dataProtocolo,
        isArchived: proc.isArchived || false,
        recebido, 
        saldo, 
        repassesPagos, 
        gastoPrevisto,
        recebidosPendentes,
        lucroFuturo,
        liquidoReal, 
        valorContrato, 
        financialStatus, 
        lastNotes,
      });
    });

    return cards;
  }, [allTransactions, clientes]);

  const unlinkedTxs = useMemo(() =>
    allTransactions.filter(t => !t.isRepasse && !t.clienteId), [allTransactions]);

  const filteredCards = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let cards = processCards;
    if (term) cards = cards.filter(c => c.name.toLowerCase().includes(term) || c.objeto.toLowerCase().includes(term) || (c.protocolo ?? '').toLowerCase().includes(term));
    
    // Novas Regras de Abas:
    switch (activeTab) {
      case 'ativos': 
        // ATIVOS: Status não é 'Finalizado' OU ainda tem saldo a receber
        return cards.filter(c => !c.isArchived && (c.status !== 'Finalizado' || c.saldo > 0 || c.recebidosPendentes > 0));
      
      case 'concluidos': 
        // CONCLUÍDOS: Financeiro quitado mas trâmite ainda não finalizado
        return cards.filter(c => !c.isArchived && (c.saldo === 0 && c.recebidosPendentes === 0) && c.status !== 'Finalizado');
      
      case 'arquivados': 
        // ARQUIVADOS: Finalizado e Quitado
        return cards.filter(c => c.isArchived || (c.status === 'Finalizado' && c.saldo === 0 && c.recebidosPendentes === 0));
      
      default: return cards;
    }
  }, [processCards, activeTab, searchTerm]);

  // Client Finances for current process
  const clientFinances = useMemo(() => {
    if (!activeProcess) return { recebido: 0, saldo: 0, repassesPagos: 0, gastoPrevisto: 0 };
    const clientTxs = allTransactions.filter(t => t.processId === activeProcess.id || (!t.processId && t.clienteId === activeProcess.clienteId));
    
    const recebido = clientTxs
      .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
      .reduce((s, t) => s + t.valor, 0);

    const repassesPagos = clientTxs
      .filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status === 'Concluído')
      .reduce((s, t) => s + t.valor, 0);

    const gastoPrevisto = clientTxs
      .filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status !== 'Concluído')
      .reduce((s, t) => s + t.valor, 0);

    const recebidosPendentes = clientTxs
      .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Pendente')
      .reduce((s, t) => s + t.valor, 0);

    const saldo = Math.max(0, (activeProcess.valorContrato || 0) - recebido);
    const lucroFuturo = (saldo + recebidosPendentes) - gastoPrevisto;

    return { recebido, saldo: saldo + recebidosPendentes, repassesPagos, gastoPrevisto, lucroFuturo };
  }, [activeProcess, allTransactions]);

  // Combined timeline
  const timelineEvents = useMemo(() => {
    if (!activeProcess) return [];
    const clientTxs = allTransactions.filter(t => t.processId === activeProcess.id || (!t.processId && t.clienteId === activeProcess.clienteId));
    const combined: any[] = (activeProcess.notas || []).map(n => ({
      id: n.id, data: n.data, texto: n.texto, tipo: 'nota' as const,
    }));
    clientTxs.forEach(t => combined.push({
      id: t.id,
      data: new Date(t.data + 'T12:00:00').getTime(),
      texto: `${t.tipo === 'Entrada' || t.tipo === 'A Receber' ? '💰' : '💸'} ${t.tipo}: R$ ${t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — ${t.descricao}`,
      tipo: 'transacao' as const,
      status: t.status,
      parentId: t.parentId,
      isExpense: t.tipo === 'Saída' || t.tipo === 'A Pagar',
      dataFormatada: new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
    }));
    return combined.sort((a, b) => b.data - a.data);
  }, [activeProcess, allTransactions]);

  const lucrosRealizados = clientFinances.recebido - clientFinances.repassesPagos;
  const lucroPositivo = lucrosRealizados >= 0;

  const filterTabs = [
    { key: 'ativos', label: 'Ativos', emoji: '🚀' },
    { key: 'concluidos', label: 'Concluídos', emoji: '💰' },
    { key: 'arquivados', label: 'Arquivados', emoji: '📂' },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-10">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
            <FolderClosed className="w-5 h-5 text-primary" /> Processos
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">Central de Gestão de Regularização</p>
        </div>
        <Button size="sm" onClick={() => setSelectClientOpen(true)} className="gap-1.5 font-bold shadow-sm rounded-lg hover:-translate-y-0.5 transition-transform">
          <Plus className="w-4 h-4" /> Novo Processo
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar cliente ou protocolo..." className="pl-9 h-10 bg-background shadow-sm border-border/60"
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-muted/60 p-1 rounded-xl border border-border/60 shadow-inner">
        {filterTabs.map(tab => (
          <button key={tab.key} onClick={() => onTabChange?.(tab.key)}
            className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
              activeTab === tab.key ? 'bg-background shadow-sm text-foreground ring-1 ring-border' : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}>
            <span>{tab.emoji}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* A Organizar banner */}
      {unlinkedTxs.length > 0 && viewFilter === 'tramite' && (
        <Card className="border-amber-500/30 bg-amber-500/[0.03] rounded-2xl overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black text-sm text-foreground tracking-tight">A Organizar</h4>
                <p className="text-[10px] text-amber-600 font-bold mt-0.5">{unlinkedTxs.length} lançamento(s) sem processo vinculado</p>
              </div>
              <Badge variant="outline" className="text-[9px] h-5 px-2 border-amber-500/30 text-amber-600 font-black uppercase tracking-widest">Pendente</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Process Cards */}
      {filteredCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/10 rounded-2xl border border-border/30 border-dashed">
          <FolderClosed className="w-16 h-16 mb-4 opacity-10" />
          <p className="text-xs font-black uppercase tracking-widest opacity-30">
            {activeTab === 'ativos' ? 'Nenhum processo em trâmite' : activeTab === 'concluidos' ? 'Nenhum processo concluído' : 'Nenhum processo arquivado'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCards.map(card => (
            <Card key={card.id}
              className={`group overflow-hidden rounded-2xl border border-border/40 transition-all duration-300 hover:shadow-md relative cursor-pointer active:scale-[0.99] ${card.isArchived ? 'grayscale opacity-60' : 'bg-card hover:border-primary/40'}`}>
              {card.financialStatus === 'PAGO' && (
                <div className="absolute top-0 right-0 z-10">
                   <div className="bg-emerald-500 text-white text-[8px] font-black tracking-widest px-2 py-1 rounded-bl-xl shadow-sm uppercase">💰 Financeiro Quitado</div>
                </div>
              )}
              <CardContent className="p-4" onClick={() => setActiveProcessId(card.id)}>
                <div className="flex gap-3">
                  {/* Icon */}
                  <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 shrink-0 self-start transition-transform group-hover:scale-110 duration-300 mt-0.5">
                    <FolderClosed className="w-5 h-5 text-primary" />
                  </div>

                  {/* Info (clickable) */}
                  <div className="flex-1 min-w-0" onClick={() => setActiveProcessId(card.id)}>
                    <div className="flex items-baseline gap-2">
                      <h4 className="font-black text-sm text-foreground tracking-tight truncate">{card.name}</h4>
                      <span className="text-[10px] text-primary/60 font-medium truncate">• {card.objeto}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={`text-[9px] h-4 px-1.5 py-0 border-current bg-transparent uppercase font-black tracking-wider ${
                        card.status === 'Exigência' ? 'text-destructive' : card.status === 'Finalizado' ? 'text-success' : 'text-primary'
                      }`}>{card.status}</Badge>
                      {card.dataProtocolo && (
                        <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {new Date(card.dataProtocolo + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>

                    {/* Last 3 technical notes preview */}
                    {card.lastNotes.length > 0 && (
                      <div className="mt-2.5 space-y-1">
                        {card.lastNotes.map((note, i) => (
                          <p key={i} className="text-[10px] text-muted-foreground leading-snug flex items-start gap-1.5">
                            <span className="shrink-0 text-primary/50 mt-px">›</span>
                            <span className="truncate">{note}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Financial summary + delete */}
                  <div className="flex flex-col items-end gap-1 shrink-0 min-w-[86px]">
                    <div className="text-right space-y-0.5" onClick={() => setActiveProcessId(card.id)}>
                      {/* Financial Status Badge */}
                      <div className="flex justify-end mb-1">
                        {card.financialStatus === 'PAGO' && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-emerald-500/15 text-emerald-600 rounded-full border border-emerald-500/25">✓ PAGO</span>
                        )}
                        {card.financialStatus === 'PARCIAL' && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-amber-500/15 text-amber-600 rounded-full border border-emerald-500/25">PARCIAL</span>
                        )}
                        {card.financialStatus === 'PENDENTE' && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full border border-border/40">PENDENTE</span>
                        )}
                      </div>

                      {/* Realized Layer (Vivid) */}
                      {(card.recebido > 0 || card.repassesPagos > 0) && (
                        <div className="space-y-0.5 mb-1.5">
                          {card.recebido > 0 && (
                            <div className="flex items-center gap-1 justify-end">
                              <TrendingUp className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                              <span className="text-[10px] font-black text-emerald-500 tabular-nums">
                                R$ {card.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          {card.repassesPagos > 0 && (
                            <div className="flex items-center gap-1 justify-end">
                              <TrendingDown className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                              <span className="text-[10px] font-bold text-rose-500 tabular-nums">
                                R$ {card.repassesPagos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Projections Layer (Muted) */}
                      <div className="flex flex-col gap-0.5 pt-1.5 border-t border-border/20">
                        <div className="flex items-center gap-1 justify-end opacity-60">
                          <Clock3 className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          <span className="text-[9px] font-bold text-slate-500 tabular-nums">
                             Prev: R$ {(card.saldo + card.recebidosPendentes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {card.gastoPrevisto > 0 && (
                          <div className="flex items-center gap-1 justify-end opacity-50">
                            <TrendingDown className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span className="text-[9px] font-bold text-slate-500 tabular-nums">
                               Prev: R$ {card.gastoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Liquid Summary */}
                      <div className="flex flex-col text-right mt-1.5">
                        {card.liquidoReal !== 0 && (
                          <span className="text-[10px] font-black leading-none text-emerald-600">LÍQ. R$ {card.liquidoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        )}
                        <span className="text-[8px] font-bold text-primary/40 mt-0.5" title="Expectativa total de lucro ao finalizar o processo">
                          LÍQ. PREVISTO: R$ {card.lucroFuturo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteCardTarget({ processId: card.id, name: card.name }); }}
                      className="p-1.5 rounded-lg text-destructive/30 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 mt-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Select Client */}
      <AlertDialog open={selectClientOpen} onOpenChange={setSelectClientOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-black">Novo Processo</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">Selecione um cliente ou cadastre um novo.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <Button variant="outline" className="w-full justify-start gap-2 h-10 font-bold text-primary border-primary/20 bg-primary/5"
              onClick={() => { setSelectClientOpen(false); setClientFormOpen(true); }}>
              <UserPlus className="w-4 h-4" /> Cadastrar Novo Cliente
            </Button>
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {clientes.map(c => (
                <button key={c.id} onClick={() => {
                  setSelectClientOpen(false);
                  const newProc: Process = {
                    id: crypto.randomUUID(),
                    clienteId: c.id,
                    objeto: 'Novo Serviço',
                    status: 'Levantamento',
                    notas: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  };
                  updateProcess(newProc);
                  onRefresh();
                  setActiveProcessId(newProc.id);
                }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors border border-border/40">
                  {c.nome}
                </button>
              ))}
            </div>
          </div>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClientForm open={clientFormOpen} onClose={() => setClientFormOpen(false)}
        onSave={(newClient) => {
          setClientFormOpen(false); setClientes(getClients());
          if (newClient) {
            const newProc: Process = {
              id: crypto.randomUUID(),
              clienteId: newClient.id,
              objeto: 'Novo Serviço',
              status: 'Levantamento',
              notas: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            updateProcess(newProc);
            onRefresh();
            setTimeout(() => setActiveProcessId(newProc.id), 100);
          }
        }} />

      {/* Delete card process */}
      <AlertDialog open={!!deleteCardTarget} onOpenChange={v => !v && setDeleteCardTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-black text-destructive">Apagar Processo</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Deseja apagar o processo de <span className="font-bold text-foreground">{deleteCardTarget?.name}</span>?
              Isso removerá todas as notas e transações vinculadas.
              <span className="block mt-2 font-bold text-destructive">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCardProcess} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold">
              <Trash2 className="w-4 h-4 mr-1.5" /> Sim, apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete drawer process */}
      <AlertDialog open={deleteProcessOpen} onOpenChange={setDeleteProcessOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-black text-destructive">Apagar Processo</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Deseja apagar este processo?
              Isso removerá todas as notas e transações vinculadas.
              <span className="block mt-2 font-bold text-destructive">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProcess} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold">
              <Trash2 className="w-4 h-4 mr-1.5" /> Sim, apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete timeline item */}
      <AlertDialog open={!!deleteTimelineTarget} onOpenChange={v => !v && setDeleteTimelineTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-black text-destructive">Remover Registro</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Deseja remover este registro?
              {deleteTimelineTarget?.tipo === 'transacao' && (
                <span className="block mt-1 text-destructive font-bold">Este lançamento será excluído e os totais recalculados.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTimelineDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold">
              <Trash2 className="w-4 h-4 mr-1.5" /> Sim, remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===================== PROCESS DRAWER ===================== */}
      <Sheet open={!!activeProcessId} onOpenChange={v => !v && setActiveProcessId(null)}>
        <SheetContent className="w-full sm:max-w-md bg-card p-0 flex flex-col border-l border-border/50 overflow-hidden">

          {/* Header */}
          <SheetHeader className="p-5 pb-3 border-b border-border/30 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <ClipboardList className="w-5 h-5" />
                <SheetTitle className="text-base font-black tracking-tight uppercase">Gaveta de Processo</SheetTitle>
              </div>
              {activeProcess && (
                <button onClick={() => setDeleteProcessOpen(true)}
                  className="p-1.5 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <SheetDescription className="text-xs font-medium text-muted-foreground">
              <span className="text-foreground font-bold">{getClientName(activeProcess?.clienteId)}</span>
            </SheetDescription>
          </SheetHeader>

          {activeProcess && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">

                {/* ── Financial Summary ── */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/30 p-3 rounded-xl border border-border/50 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
                      <Info className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Contrato</span>
                    </div>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-[10px] font-bold text-muted-foreground">R$</span>
                      <input
                        type="number"
                        value={activeProcess.valorContrato || ''}
                        onChange={e => handleLocalUpdate({ valorContrato: parseFloat(e.target.value) || 0 })}
                        className="bg-transparent border-none text-sm font-black text-foreground focus:outline-none focus:ring-0 p-0 w-full tabular-nums"
                        placeholder="0,00"
                      />
                    </div>
                    <span className="text-[8px] text-muted-foreground/50 italic mt-0.5">toque para editar</span>
                  </div>

                  <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1 text-emerald-600">
                      <TrendingUp className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Recebido</span>
                    </div>
                    <p className="text-sm font-black text-emerald-600 tabular-nums">
                      R$ {clientFinances.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[8px] text-emerald-600/50 italic mt-0.5">soma automática de receitas</span>
                  </div>

                  <div className="bg-sky-500/5 p-3 rounded-xl border border-sky-500/20 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1 text-sky-600">
                      <DollarSign className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Crédito Futuro</span>
                    </div>
                    <p className="text-sm font-black tabular-nums text-sky-600">
                      R$ {clientFinances.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <div className="flex flex-col mt-1 border-t border-sky-500/10 pt-1">
                       <span className="text-[8px] font-black uppercase text-muted-foreground/60">Lucro Futuro Líquido</span>
                       <span className="text-[10px] font-black text-sky-700">R$ {clientFinances.lucroFuturo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="bg-destructive/5 p-3 rounded-xl border border-destructive/20 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1 text-destructive">
                      <TrendingDown className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Custos Pagos</span>
                    </div>
                    <p className="text-sm font-black text-destructive tabular-nums">
                      R$ {clientFinances.repassesPagos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    {clientFinances.gastoPrevisto > 0 && (
                      <span className="text-[8px] text-muted-foreground/70 font-medium italic mt-0.5"
                        title="Este valor é uma projeção e não afeta o Dashboard atual">
                        + R$ {clientFinances.gastoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} previsto
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Quick Launch Buttons ── */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lançamentos Financeiros</Label>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => { setInlineForm(inlineForm === 'receita' ? null : 'receita'); setQuickForm({ descricao: '', valor: '', data: today, efetivado: true }); }}
                      className={`flex-1 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest gap-1.5 transition-all ${inlineForm === 'receita' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-600/20'}`}
                    >
                      {inlineForm === 'receita' ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Receita
                    </Button>
                    <Button
                      onClick={() => { setInlineForm(inlineForm === 'despesa' ? null : 'despesa'); setQuickForm({ descricao: '', valor: '', data: today, efetivado: true }); }}
                      variant="outline"
                      className={`flex-1 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest gap-1.5 transition-all ${inlineForm === 'despesa' ? 'bg-destructive text-destructive-foreground border-destructive shadow-lg' : 'border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground'}`}
                    >
                      {inlineForm === 'despesa' ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Despesa/Repasse
                    </Button>
                  </div>

                  {/* Inline expanded form */}
                  {inlineForm && (
                    <div className={`rounded-xl border p-4 space-y-3 animate-in slide-in-from-top-2 duration-200 ${inlineForm === 'receita' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-destructive/5 border-destructive/20'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${inlineForm === 'receita' ? 'text-emerald-600' : 'text-destructive'}`}>
                        {inlineForm === 'receita' ? '+ Nova Receita' : '+ Nova Despesa / Repasse'}
                      </p>
                      <Input
                        placeholder="Descrição (ex: Parcela 1, Repasse Cartório...)"
                        value={quickForm.descricao}
                        onChange={e => setQuickForm(f => ({ ...f, descricao: e.target.value }))}
                        className="h-10 bg-background/60 border-border/60 rounded-lg text-sm"
                        autoFocus
                      />
                      <div className="flex items-center gap-2 py-0.5">
                        <input
                          type="checkbox"
                          id="efetivado"
                          checked={quickForm.efetivado}
                          onChange={e => setQuickForm(f => ({ ...f, efetivado: e.target.checked }))}
                          className="w-4 h-4 rounded border-border/60 text-primary focus:ring-primary/20"
                        />
                        <Label htmlFor="efetivado" className="text-xs font-bold cursor-pointer text-foreground/80">Marcar como Efetivado / Pago</Label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">R$</span>
                          <Input
                            type="number"
                            placeholder="0,00"
                            value={quickForm.valor}
                            onChange={e => setQuickForm(f => ({ ...f, valor: e.target.value }))}
                            className="h-10 pl-9 bg-background/60 border-border/60 rounded-lg text-sm font-bold tabular-nums"
                          />
                        </div>
                        <div className="relative">
                          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input
                            type="date"
                            value={quickForm.data}
                            onChange={e => setQuickForm(f => ({ ...f, data: e.target.value }))}
                            className="h-10 pl-9 bg-background/60 border-border/60 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleQuickLaunch}
                          disabled={!quickForm.descricao.trim() || !quickForm.valor || !quickForm.data}
                          className={`flex-1 h-10 rounded-lg font-bold text-xs gap-1.5 ${inlineForm === 'receita' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-destructive hover:bg-destructive/90 text-white'}`}
                        >
                          <Check className="w-4 h-4" /> Confirmar Lançamento
                        </Button>
                        <Button variant="ghost" onClick={() => { setInlineForm(null); setQuickForm({ descricao: '', valor: '', data: today, efetivado: true }); }}
                          className="h-10 w-10 px-0 rounded-lg text-muted-foreground hover:bg-muted shrink-0">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Archive Button ── */}
                {activeProcess.status === 'Finalizado' && (
                  <Button variant="outline"
                    onClick={() => handleImmediateUpdate({ isArchived: !activeProcess.isArchived })}
                    className={`w-full h-10 rounded-xl text-[11px] font-black uppercase tracking-widest gap-2 ${activeProcess.isArchived ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-muted/50 text-muted-foreground border-border/50'}`}>
                    {activeProcess.isArchived ? <><Play className="w-4 h-4" /> Reativar Processo</> : <><Archive className="w-4 h-4" /> Arquivar Processo</>}
                  </Button>
                )}

                {/* ── Status ── */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status de Trâmite</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Levantamento', 'Protocolo', 'Exigência', 'Finalizado'] as ProcessStatus[]).map(s => (
                      <Button key={s} variant="outline"
                        onClick={() => handleImmediateUpdate({ status: s })}
                        className={`h-11 rounded-xl text-xs font-bold transition-all border-border/50 ${
                          activeProcess.status === s
                            ? s === 'Exigência' ? 'bg-destructive/10 text-destructive border-destructive/30'
                            : s === 'Finalizado' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                            : 'bg-primary/10 text-primary border-primary/30'
                            : 'hover:bg-muted opacity-60'
                        }`}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* ── Objeto & Protocolo ── */}
                <div className="space-y-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70">Objeto do Serviço</span>
                    <Input value={activeProcess.objeto} onChange={e => handleLocalUpdate({ objeto: e.target.value })}
                      placeholder="Ex: Regularização Casa X, Desmembramento Lote Y..."
                      className="h-10 bg-muted/20 border-border/50 rounded-xl font-bold text-sm text-primary" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Protocolo nº</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground opacity-50" />
                        <Input value={activeProcess.protocolo || ''} onChange={e => handleLocalUpdate({ protocolo: e.target.value })}
                          placeholder="Nº Processo" className="h-10 pl-9 bg-muted/20 border-border/50 rounded-xl font-medium text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data Protocolo</Label>
                      <Input type="date" value={activeProcess.dataProtocolo || ''} onChange={e => handleLocalUpdate({ dataProtocolo: e.target.value })}
                        className="h-10 bg-muted/20 border-border/50 rounded-xl font-medium text-sm" />
                    </div>
                  </div>
                </div>

                {/* ── Timeline ── */}
                <div className="space-y-3 pt-4 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Histórico Técnico & Financeiro</Label>
                  </div>

                  {/* Add note */}
                  <div className="relative">
                    <Textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                      placeholder="Adicionar atualização técnica... (Ctrl+Enter para salvar)"
                      className="min-h-[72px] bg-muted/20 border-border/50 rounded-xl font-medium p-3 pr-12 resize-none text-sm"
                      onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleAddNote()} />
                    <Button size="icon" onClick={handleAddNote} disabled={!newNote.trim()}
                      className="absolute right-2 bottom-2 w-8 h-8 rounded-lg shadow-lg">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Events list */}
                  <div className="space-y-3 pt-1">
                    {timelineEvents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 opacity-30">
                        <History className="w-8 h-8 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Sem eventos registrados</p>
                      </div>
                    ) : (
                      <div className="relative space-y-3 pl-4 before:absolute before:left-1 before:top-2 before:bottom-0 before:w-0.5 before:bg-border/30">
                        {timelineEvents.map((item: any) => {
                          const isFinancial = item.tipo === 'transacao';
                          const isExpense = item.isExpense;
                          const isPendente = isFinancial && item.status !== 'Concluído';
                          const isEditingNote = editingNoteId === item.id;
                          const isEditingTx = editingTransactionId === item.id;

                          return (
                            <div key={item.id} className="relative group/item">
                              <div className={`absolute -left-[1.35rem] top-1.5 w-3 h-3 rounded-full border-2 border-background shadow-sm ${isFinancial ? (isPendente ? 'bg-slate-300' : (isExpense ? 'bg-destructive' : 'bg-emerald-500')) : 'bg-primary'}`} />
                              <div className={`p-3 rounded-xl border border-border/30 transition-colors ${isFinancial ? (isPendente ? 'bg-muted/10 border-dashed border-muted-foreground/20 opacity-80' : (isExpense ? 'bg-destructive/5' : 'bg-emerald-500/5')) : 'bg-muted/30'}`}>
                                
                                {/* Header / Labels */}
                                <div className="flex items-center justify-between mb-1">
                                  <p className={`text-[9px] font-black uppercase tracking-widest ${isFinancial ? (isPendente ? 'text-muted-foreground' : (isExpense ? 'text-destructive/80' : 'text-emerald-600/80')) : 'text-primary/70'}`}>
                                    {isFinancial ? (isPendente ? `⏳ Previsto (${item.isExpense ? 'Saída' : 'Entrada'})` : (isExpense ? 'Saída / Repasse' : 'Receita')) : 'Atualização Técnica'}
                                    {item.dataFormatada && <span className="normal-case font-medium ml-1.5 opacity-70">• {item.dataFormatada}</span>}
                                  </p>
                                  <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                    {isPendente && (
                                      <>
                                        <button
                                          onClick={() => {
                                            const tx = allTransactions.find(t => t.id === item.id);
                                            if (tx) {
                                              updateTransaction({ ...tx, status: 'Concluído', updatedAt: Date.now() });
                                              onRefresh();
                                              toast.success('Lançamento efetivado no Dashboard!');
                                            }
                                          }}
                                          title="Confirmar Pagamento Integral"
                                          className="p-1 rounded text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            const tx = allTransactions.find(t => t.id === item.id);
                                            if (tx) {
                                              const dateToMove = tx.previsaoData || tx.data;
                                              const d = new Date(dateToMove + 'T12:00:00');
                                              d.setMonth(d.getMonth() + 1);
                                              const nextDate = d.toISOString().slice(0, 10);
                                              updateTransaction({ ...tx, previsaoData: nextDate, updatedAt: Date.now() });
                                              onRefresh();
                                              toast.success('Lançamento postergado para o próximo mês!');
                                            }
                                          }}
                                          title="Postegar para o próximo mês"
                                          className="p-1 rounded text-primary hover:bg-primary hover:text-white transition-colors"
                                        >
                                          <CalendarPlus className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            const tx = allTransactions.find(t => t.id === item.id);
                                            if (tx) setCompleteItem(tx);
                                          }}
                                          title="Baixa Parcial"
                                          className="p-1 rounded text-amber-600 hover:bg-amber-500 hover:text-white transition-colors"
                                        >
                                          <Clock3 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => {
                                        if (isFinancial) {
                                          const tx = allTransactions.find(t => t.id === item.id);
                                          if (tx) {
                                            setEditingTransactionId(tx.id);
                                            setEditingTransactionData({ valor: tx.valor, descricao: tx.descricao, data: tx.data });
                                          }
                                        } else {
                                          setEditingNoteId(item.id);
                                          setEditingNoteText(item.texto);
                                        }
                                      }}
                                      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteTimelineTarget({ id: item.id, tipo: isFinancial ? 'transacao' : 'nota', label: item.texto })}
                                      className="p-1 rounded text-destructive/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                {/* Content or Edit Form */}
                                {isEditingTx ? (
                                  <div className="mt-2 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                    <Input
                                      placeholder="Descrição"
                                      value={editingTransactionData.descricao || ''}
                                      onChange={e => setEditingTransactionData(d => ({ ...d, descricao: e.target.value }))}
                                      className="h-8 text-xs bg-background/60 border-border/50 rounded-lg p-2"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">R$</span>
                                        <Input
                                          type="number"
                                          placeholder="0,00"
                                          value={editingTransactionData.valor || ''}
                                          onChange={e => setEditingTransactionData(d => ({ ...d, valor: parseFloat(e.target.value) }))}
                                          className="h-8 pl-6 text-xs bg-background/60 border-border/50 rounded-lg font-bold tabular-nums"
                                        />
                                      </div>
                                      <Input
                                        type="date"
                                        value={editingTransactionData.data || ''}
                                        onChange={e => setEditingTransactionData(d => ({ ...d, data: e.target.value }))}
                                        className="h-8 text-[10px] bg-background/60 border-border/50 rounded-lg p-1"
                                      />
                                      <div className="col-span-2 space-y-1">
                                        <Label className="text-[8px] font-black uppercase text-muted-foreground pl-1">Previsão Real (Mês/Ano)</Label>
                                        <Input
                                          type="date"
                                          value={editingTransactionData.previsaoData || ''}
                                          onChange={e => setEditingTransactionData(d => ({ ...d, previsaoData: e.target.value }))}
                                          className="h-8 text-[10px] bg-background/60 border-stone-500/20 rounded-lg p-1"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                      <Button size="sm" onClick={handleSaveTransactionEdit}
                                        className="h-7 px-3 text-[10px] font-bold rounded-lg gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white">
                                        <Check className="w-3 h-3" /> Atualizar
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => { setEditingTransactionId(null); setEditingTransactionData({}); }}
                                        className="h-7 px-3 text-[10px] font-bold rounded-lg">
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : isEditingNote ? (
                                  <div className="mt-2 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                    <Textarea value={editingNoteText} onChange={e => setEditingNoteText(e.target.value)}
                                      className="min-h-[60px] text-xs bg-background/60 border-border/50 rounded-lg resize-none p-2" autoFocus />
                                    <div className="flex gap-1.5">
                                      <Button size="sm" onClick={handleSaveNoteEdit}
                                        className="h-7 px-3 text-[10px] font-bold rounded-lg gap-1">
                                        <Check className="w-3 h-3" /> Salvar
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => { setEditingNoteId(null); setEditingNoteText(''); }}
                                        className="h-7 px-3 text-[10px] font-bold rounded-lg">
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className={`text-xs font-medium leading-relaxed ${isFinancial ? (isExpense ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-400 font-bold') : 'text-foreground/90'}`}>
                                    {item.texto}
                                  </p>
                                )}

                                <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1 mt-1.5">
                                  <Clock3 className="w-2.5 h-2.5" />
                                  {new Date(item.data).toLocaleString('pt-BR')}
                                  {item.parentId && (
                                    <span className="ml-2 text-primary/50 flex items-center gap-1">
                                      🔗 Lançamento Vinculado
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Lucro Líquido — always at bottom ── */}
                <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${lucroPositivo ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-destructive/20 bg-destructive/5'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lucro Líquido Realizado</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-sm font-bold ${lucroPositivo ? 'text-emerald-500/70' : 'text-destructive/70'}`}>R$</span>
                    <span className={`text-2xl font-black tabular-nums tracking-tighter ${lucroPositivo ? 'text-emerald-500' : 'text-destructive'}`}>
                      {lucrosRealizados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground italic font-medium">Lucro real (Dinheiro que entrou − Dinheiro que saiu)</p>
                </div>

              </div>
            </div>
          )}

          {/* Fixed Footer */}
          {activeProcess && (
            <div className="shrink-0 flex gap-2 p-4 border-t border-border/30 bg-card/95 backdrop-blur-sm">
              <Button onClick={handleSaveChanges} disabled={!hasUnsavedChanges}
                className={`flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-widest gap-2 transition-all ${hasUnsavedChanges ? 'shadow-lg' : 'opacity-50'}`}>
                <Check className="w-4 h-4" /> Salvar Alterações
              </Button>
              <Button variant="outline" onClick={() => setActiveProcessId(null)}
                className="h-11 px-4 rounded-xl font-bold text-xs text-muted-foreground border-border/50 hover:bg-muted">
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <PartialPaymentModal
        open={!!completeItem}
        onClose={() => setCompleteItem(null)}
        onSave={onRefresh}
        transaction={completeItem}
      />
      {/* Archive Confirmation (when finalizing) */}
      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent className="rounded-3xl border-border/50">
          <AlertDialogHeader>
            <div className="mx-auto bg-emerald-500/10 p-4 rounded-full mb-2">
              <Archive className="w-8 h-8 text-emerald-600" />
            </div>
            <AlertDialogTitle className="text-center font-black uppercase tracking-widest text-lg">Deseja Arquivar?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm font-medium leading-relaxed">
              O financeiro deste contrato está 100% quitado (💰). <br /> Ao arquivar, ele será movido para a aba de **Arquivados**.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <AlertDialogCancel className="rounded-xl border-border/40 font-bold h-11 flex-1">Apenas Finalizar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              handleImmediateUpdate({ isArchived: true });
              setArchiveConfirmOpen(false);
              setActiveProcessId(null);
            }} className="rounded-xl bg-emerald-500 hover:bg-emerald-600 font-black uppercase tracking-widest text-xs h-11 flex-1 shadow-lg shadow-emerald-500/20">
              <Archive className="w-4 h-4 mr-2" /> Sim, Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
