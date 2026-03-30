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
import { getClients, getProcessByClient, getProcesses, updateProcess, deleteProcess, addTransaction } from '@/lib/storage';
import { toast } from 'sonner';
import {
  Plus, FolderClosed, AlertCircle, ClipboardList, TrendingUp, TrendingDown, DollarSign,
  History, Clock3, FileText, Archive, Play, Trash2, Info, Check,
  Search, CalendarDays, UserPlus, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { ClientForm } from './ClientForm';

type ProcessViewFilter = 'tramite' | 'concluidos' | 'arquivados';
type InlineForm = 'receita' | 'despesa' | null;

interface QuickForm {
  descricao: string;
  valor: string;
}

interface Props {
  allTransactions: Transaction[];
  onRefresh: () => void;
}

export function ProcessManager({ allTransactions, onRefresh }: Props) {
  const [clientes, setClientes] = useState<Client[]>([]);
  const [viewFilter, setViewFilter] = useState<ProcessViewFilter>('tramite');
  const [searchTerm, setSearchTerm] = useState('');

  // Drawer state
  const [activeProcessClienteId, setActiveProcessClienteId] = useState<string | null>(null);
  const [activeProcess, setActiveProcess] = useState<Process | null>(null);
  const [newNote, setNewNote] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCardTarget, setDeleteCardTarget] = useState<{ clienteId: string; name: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Inline launch form
  const [inlineForm, setInlineForm] = useState<InlineForm>(null);
  const [quickForm, setQuickForm] = useState<QuickForm>({ descricao: '', valor: '' });

  // New process creation
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [selectClientOpen, setSelectClientOpen] = useState(false);

  useEffect(() => {
    setClientes(getClients());
  }, [allTransactions]);

  useEffect(() => {
    if (activeProcessClienteId) {
      const proc = getProcessByClient(activeProcessClienteId);
      if (proc) {
        setActiveProcess({ ...proc });
      } else {
        setActiveProcess({
          id: crypto.randomUUID(),
          clienteId: activeProcessClienteId,
          objeto: '',
          status: 'Levantamento',
          notas: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      setHasUnsavedChanges(false);
      setInlineForm(null);
      setQuickForm({ descricao: '', valor: '' });
    } else {
      setActiveProcess(null);
      setHasUnsavedChanges(false);
    }
  }, [activeProcessClienteId]);

  // Mark changes without persisting immediately
  const handleLocalUpdate = useCallback((updates: Partial<Process>) => {
    if (!activeProcess) return;
    setActiveProcess(prev => prev ? { ...prev, ...updates } : null);
    setHasUnsavedChanges(true);
  }, [activeProcess]);

  // Persist immediately (status, notes, archive)
  const handleImmediateUpdate = useCallback((updates: Partial<Process>) => {
    if (!activeProcess) return;
    const updated = { ...activeProcess, ...updates, updatedAt: Date.now() };
    setActiveProcess(updated);
    updateProcess(updated);
    onRefresh();
  }, [activeProcess, onRefresh]);

  // Save all pending changes
  const handleSaveChanges = useCallback(() => {
    if (!activeProcess) return;
    const updated = { ...activeProcess, updatedAt: Date.now() };
    updateProcess(updated);
    setHasUnsavedChanges(false);
    toast.success('Alterações salvas com sucesso!');
    onRefresh();
  }, [activeProcess, onRefresh]);

  const handleAddNote = useCallback(() => {
    if (!newNote.trim() || !activeProcess) return;
    const note: ProcessNote = {
      id: crypto.randomUUID(),
      data: Date.now(),
      texto: newNote.trim(),
    };
    const updated = { ...activeProcess, notas: [note, ...activeProcess.notas], updatedAt: Date.now() };
    setActiveProcess(updated);
    updateProcess(updated);
    setNewNote('');
    onRefresh();
    toast.success('Nota adicionada.');
  }, [newNote, activeProcess, onRefresh]);

  // Inline quick launch
  const handleQuickLaunch = useCallback(() => {
    if (!activeProcess || !quickForm.valor || !quickForm.descricao.trim()) return;
    const valor = parseFloat(quickForm.valor);
    if (isNaN(valor) || valor <= 0) {
      toast.error('Insira um valor válido.');
      return;
    }
    const tipo = inlineForm === 'receita' ? 'Entrada' : 'Saída';
    const today = new Date().toISOString().slice(0, 10);
    addTransaction({
      id: crypto.randomUUID(),
      tipo,
      descricao: quickForm.descricao.trim(),
      valor,
      data: today,
      status: 'Concluído',
      categoria: inlineForm === 'receita' ? 'Receita' : 'Despesa',
      clienteId: activeProcess.clienteId,
      isRepasse: inlineForm === 'despesa',
    });
    toast.success(`${tipo === 'Entrada' ? 'Receita' : 'Despesa'} lançada com sucesso!`);
    setInlineForm(null);
    setQuickForm({ descricao: '', valor: '' });
    onRefresh();
  }, [activeProcess, inlineForm, quickForm, onRefresh]);

  const handleDeleteProcess = useCallback(() => {
    if (!activeProcess) return;
    deleteProcess(activeProcess.id);
    toast.success('Processo e lançamentos vinculados excluídos.');
    setDeleteConfirmOpen(false);
    setActiveProcessClienteId(null);
    onRefresh();
  }, [activeProcess, onRefresh]);

  const handleDeleteCardProcess = useCallback(() => {
    if (!deleteCardTarget) return;
    const proc = getProcessByClient(deleteCardTarget.clienteId);
    if (proc) {
      deleteProcess(proc.id);
    }
    // Also remove any transactions for this client
    toast.success(`Processo de ${deleteCardTarget.name} excluído.`);
    setDeleteCardTarget(null);
    onRefresh();
  }, [deleteCardTarget, onRefresh]);

  function getClientName(id?: string | null) {
    if (!id) return 'Sem cliente';
    return clientes.find(c => c.id === id)?.nome || 'Cliente desconhecido';
  }

  // Compute process cards
  const processCards = useMemo(() => {
    const processes = getProcesses();
    const clientIds = new Set<string>();
    processes.forEach(p => clientIds.add(p.clienteId));
    allTransactions.forEach(t => { if (t.clienteId) clientIds.add(t.clienteId); });

    const cards: {
      id: string; clienteId: string; name: string;
      status: ProcessStatus | 'A definir'; protocolo?: string;
      dataProtocolo?: string; isArchived: boolean;
      recebido: number; saldo: number; repasses: number; valorContrato: number; hasProcess: boolean;
    }[] = [];

    clientIds.forEach(cId => {
      const proc = processes.find(p => p.clienteId === cId);
      const client = clientes.find(c => c.id === cId);
      const clientTxs = allTransactions.filter(t => t.clienteId === cId);
      const recebido = clientTxs
        .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
        .reduce((s, t) => s + t.valor, 0);
      const repasses = clientTxs
        .filter(t => t.tipo === 'Saída' || t.tipo === 'A Pagar' || t.isRepasse)
        .reduce((s, t) => s + t.valor, 0);
      const valorContrato = proc?.valorContrato || 0;
      const saldo = Math.max(0, valorContrato - recebido);
      cards.push({
        id: proc?.id || cId, clienteId: cId,
        name: client?.nome || 'Cliente desconhecido',
        status: proc?.status || 'A definir',
        protocolo: proc?.protocolo, dataProtocolo: proc?.dataProtocolo,
        isArchived: proc?.isArchived || false,
        recebido, saldo, repasses, valorContrato, hasProcess: !!proc,
      });
    });
    return cards;
  }, [allTransactions, clientes]);

  const unlinkedTxs = useMemo(() =>
    allTransactions.filter(t => !t.isRepasse && !t.clienteId),
    [allTransactions]);

  const filteredCards = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let cards = processCards;
    if (term) cards = cards.filter(c => c.name.toLowerCase().includes(term) || (c.protocolo ?? '').toLowerCase().includes(term));
    switch (viewFilter) {
      case 'tramite': return cards.filter(c => !c.isArchived && c.status !== 'Finalizado');
      case 'concluidos': return cards.filter(c => !c.isArchived && c.status === 'Finalizado');
      case 'arquivados': return cards.filter(c => c.isArchived);
      default: return cards;
    }
  }, [processCards, viewFilter, searchTerm]);

  // Finances for drawer (recalculate on every render with fresh allTransactions)
  const clientFinances = useMemo(() => {
    if (!activeProcessClienteId) return { contrato: 0, recebido: 0, saldo: 0, repasses: 0 };
    const clientTxs = allTransactions.filter(t => t.clienteId === activeProcessClienteId);
    const recebido = clientTxs
      .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
      .reduce((s, t) => s + t.valor, 0);
    const repasses = clientTxs
      .filter(t => t.tipo === 'Saída' || t.tipo === 'A Pagar' || t.isRepasse)
      .reduce((s, t) => s + t.valor, 0);
    const contrato = activeProcess?.valorContrato || 0;
    const saldo = Math.max(0, contrato - recebido);
    return { contrato, recebido, saldo, repasses };
  }, [allTransactions, activeProcessClienteId, activeProcess?.valorContrato]);

  const timelineEvents = useMemo(() => {
    if (!activeProcess || !activeProcessClienteId) return [];
    const clientTxs = allTransactions.filter(t => t.clienteId === activeProcessClienteId);
    const combined: any[] = [...activeProcess.notas];
    clientTxs.forEach(t => {
      combined.push({
        id: `tx-${t.id}`,
        data: new Date(t.data + 'T12:00:00').getTime(),
        texto: `${t.tipo === 'Entrada' || t.tipo === 'A Receber' ? '💰' : '💸'} ${t.tipo}: R$ ${t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — ${t.descricao}`,
        transaction: t,
        isExpense: t.tipo === 'Saída' || t.tipo === 'A Pagar',
      });
    });
    return combined.sort((a, b) => b.data - a.data);
  }, [activeProcess, allTransactions, activeProcessClienteId]);

  const lucroLiquido = clientFinances.recebido - clientFinances.repasses;
  const lucroPositivo = lucroLiquido >= 0;

  const filterTabs: { key: ProcessViewFilter; label: string; emoji: string }[] = [
    { key: 'tramite', label: 'Em Trâmite', emoji: '🚀' },
    { key: 'concluidos', label: 'Concluídos', emoji: '✅' },
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
        <Input
          placeholder="Buscar cliente ou protocolo..."
          className="pl-9 h-10 bg-background shadow-sm border-border/60"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-muted/60 p-1 rounded-xl border border-border/60 shadow-inner">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setViewFilter(tab.key)}
            className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
              viewFilter === tab.key
                ? 'bg-background shadow-sm text-foreground ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}
          >
            <span>{tab.emoji}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* "A Organizar" banner */}
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
            {viewFilter === 'tramite' ? 'Nenhum processo em trâmite' : viewFilter === 'concluidos' ? 'Nenhum processo concluído' : 'Nenhum processo arquivado'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredCards.map(card => (
            <Card
              key={card.id}
              className={`transition-all border-border/40 hover:border-primary/40 shadow-sm hover:shadow-md rounded-2xl overflow-hidden cursor-pointer group active:scale-[0.99] ${card.isArchived ? 'opacity-60 grayscale' : 'bg-card'}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3" onClick={() => setActiveProcessClienteId(card.clienteId)}>
                  {/* Icon */}
                  <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 shrink-0 transition-transform group-hover:scale-110 duration-300">
                    <FolderClosed className="w-5 h-5 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-sm text-foreground tracking-tight truncate">{card.name}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={`text-[9px] h-4 px-1.5 py-0 border-current bg-transparent uppercase font-black tracking-wider ${
                        card.status === 'Exigência' ? 'text-destructive' :
                        card.status === 'Finalizado' ? 'text-success' : 'text-primary'
                      }`}>
                        {card.status}
                      </Badge>
                      {card.dataProtocolo && (
                        <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {new Date(card.dataProtocolo + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial summary */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end mb-0.5">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      <span className="text-xs font-black text-emerald-500 tabular-nums">
                        R$ {card.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                    {card.valorContrato > 0 && (
                      <span className="text-[9px] text-muted-foreground font-medium">
                        Saldo: R$ {card.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>

                  {/* Delete button on card — stop propagation */}
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteCardTarget({ clienteId: card.clienteId, name: card.name }); }}
                    className="ml-1 p-1.5 rounded-lg text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    title="Apagar processo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Select Client Dialog */}
      <AlertDialog open={selectClientOpen} onOpenChange={setSelectClientOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-black">Novo Processo</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Selecione um cliente existente ou cadastre um novo para iniciar o processo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-10 font-bold text-primary border-primary/20 bg-primary/5"
              onClick={() => { setSelectClientOpen(false); setClientFormOpen(true); }}
            >
              <UserPlus className="w-4 h-4" /> Cadastrar Novo Cliente
            </Button>
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {clientes.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectClientOpen(false); setActiveProcessClienteId(c.id); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors border border-border/40"
                >
                  {c.nome}
                </button>
              ))}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client Form */}
      <ClientForm
        open={clientFormOpen}
        onClose={() => setClientFormOpen(false)}
        onSave={(newClient) => {
          setClientFormOpen(false);
          setClientes(getClients());
          if (newClient) setTimeout(() => setActiveProcessClienteId(newClient.id), 100);
        }}
      />

      {/* Delete from card confirmation */}
      <AlertDialog open={!!deleteCardTarget} onOpenChange={v => !v && setDeleteCardTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-black text-destructive">Apagar Processo</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Deseja apagar o processo de <span className="font-bold text-foreground">{deleteCardTarget?.name}</span>?
              Isso removerá também todas as notas e transações vinculadas.
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

      {/* Delete from drawer confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-black text-destructive">Apagar Processo</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Deseja apagar o processo de <span className="font-bold text-foreground">{getClientName(activeProcessClienteId)}</span>?
              Isso removerá também todas as notas e transações vinculadas.
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

      {/* ===================== PROCESS DRAWER ===================== */}
      <Sheet open={!!activeProcessClienteId} onOpenChange={v => !v && setActiveProcessClienteId(null)}>
        <SheetContent className="w-full sm:max-w-md bg-card p-0 flex flex-col border-l border-border/50 overflow-hidden">
          {/* Header */}
          <SheetHeader className="p-5 pb-3 border-b border-border/30 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <ClipboardList className="w-5 h-5" />
                <SheetTitle className="text-base font-black tracking-tight uppercase">Gaveta de Processo</SheetTitle>
              </div>
              {activeProcess && (
                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="p-1.5 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Apagar processo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <SheetDescription className="text-xs font-medium text-muted-foreground">
              <span className="text-foreground font-bold">{getClientName(activeProcessClienteId)}</span>
            </SheetDescription>
          </SheetHeader>

          {activeProcess && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">

                {/* ── Financial Summary Cards ── */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Contrato (editable) */}
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
                        title="Clique para editar o valor do contrato"
                      />
                    </div>
                    <span className="text-[8px] text-muted-foreground/60 italic mt-0.5">clique para editar</span>
                  </div>

                  {/* Recebido (display only, calculated from txs) */}
                  <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1 text-emerald-600">
                      <TrendingUp className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Recebido</span>
                    </div>
                    <p className="text-sm font-black text-emerald-600 tabular-nums">
                      R$ {clientFinances.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[8px] text-emerald-600/50 italic mt-0.5">via lançamentos</span>
                  </div>

                  {/* Saldo */}
                  <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/20 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1 text-amber-600">
                      <DollarSign className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Saldo a Receber</span>
                    </div>
                    <p className="text-sm font-black text-amber-600 tabular-nums">
                      R$ {clientFinances.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    {clientFinances.recebido >= clientFinances.contrato && clientFinances.contrato > 0 && (
                      <span className="text-[8px] text-emerald-600 font-bold mt-0.5">✓ Contrato quitado</span>
                    )}
                  </div>

                  {/* Custos */}
                  <div className="bg-destructive/5 p-3 rounded-xl border border-destructive/20 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1 text-destructive">
                      <TrendingDown className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Custos</span>
                    </div>
                    <p className="text-sm font-black text-destructive tabular-nums">
                      R$ {clientFinances.repasses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* ── Quick Launch Buttons ── */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lançamentos Financeiros</Label>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => { setInlineForm(inlineForm === 'receita' ? null : 'receita'); setQuickForm({ descricao: '', valor: '' }); }}
                      className={`flex-1 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest gap-1.5 transition-all ${inlineForm === 'receita' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-600/20'}`}
                    >
                      {inlineForm === 'receita' ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Receita
                    </Button>
                    <Button
                      onClick={() => { setInlineForm(inlineForm === 'despesa' ? null : 'despesa'); setQuickForm({ descricao: '', valor: '' }); }}
                      variant="outline"
                      className={`flex-1 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest gap-1.5 transition-all ${inlineForm === 'despesa' ? 'bg-destructive text-destructive-foreground border-destructive shadow-lg' : 'border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground'}`}
                    >
                      {inlineForm === 'despesa' ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Despesa/Repasse
                    </Button>
                  </div>

                  {/* Inline form (expanded) */}
                  {inlineForm && (
                    <div className={`rounded-xl border p-4 space-y-3 animate-in slide-in-from-top-2 duration-200 ${inlineForm === 'receita' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-destructive/5 border-destructive/20'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${inlineForm === 'receita' ? 'text-emerald-600' : 'text-destructive'}`}>
                        {inlineForm === 'receita' ? '+ Nova Receita' : '+ Nova Despesa / Repasse'}
                      </p>
                      <div className="space-y-2">
                        <Input
                          placeholder="Descrição (ex: Parcela 1, Repasse Cartório...)"
                          value={quickForm.descricao}
                          onChange={e => setQuickForm(f => ({ ...f, descricao: e.target.value }))}
                          className="h-10 bg-background/60 border-border/60 rounded-lg text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">R$</span>
                            <Input
                              type="number"
                              placeholder="0,00"
                              value={quickForm.valor}
                              onChange={e => setQuickForm(f => ({ ...f, valor: e.target.value }))}
                              className="h-10 pl-9 bg-background/60 border-border/60 rounded-lg text-sm font-bold tabular-nums"
                              onKeyDown={e => e.key === 'Enter' && handleQuickLaunch()}
                            />
                          </div>
                          <Button
                            onClick={handleQuickLaunch}
                            disabled={!quickForm.descricao.trim() || !quickForm.valor}
                            className={`h-10 px-4 rounded-lg font-bold text-xs ${inlineForm === 'receita' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-destructive hover:bg-destructive/90 text-white'}`}
                          >
                            <Check className="w-4 h-4 mr-1" /> Lançar
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => { setInlineForm(null); setQuickForm({ descricao: '', valor: '' }); }}
                            className="h-10 w-10 px-0 rounded-lg text-muted-foreground hover:bg-muted"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Archive Button (only when Finalizado) ── */}
                {activeProcess.status === 'Finalizado' && (
                  <Button
                    variant="outline"
                    onClick={() => handleImmediateUpdate({ isArchived: !activeProcess.isArchived })}
                    className={`w-full h-10 rounded-xl text-[11px] font-black uppercase tracking-widest gap-2 ${activeProcess.isArchived ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-muted/50 text-muted-foreground border-border/50'}`}
                  >
                    {activeProcess.isArchived ? <><Play className="w-4 h-4" /> Reativar Processo</> : <><Archive className="w-4 h-4" /> Arquivar Processo</>}
                  </Button>
                )}

                {/* ── Status ── */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status de Trâmite</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Levantamento', 'Protocolo', 'Exigência', 'Finalizado'] as ProcessStatus[]).map(s => (
                      <Button
                        key={s}
                        variant="outline"
                        onClick={() => handleImmediateUpdate({ status: s })}
                        className={`h-11 rounded-xl text-xs font-bold transition-all border-border/50 ${
                          activeProcess.status === s
                            ? s === 'Exigência' ? 'bg-destructive/10 text-destructive border-destructive/30'
                            : s === 'Finalizado' ? 'bg-success/10 text-success border-success/30'
                            : 'bg-primary/10 text-primary border-primary/30'
                            : 'hover:bg-muted opacity-60'
                        }`}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* ── Objeto & Protocolo ── */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Objeto do Serviço</Label>
                    <Input
                      value={activeProcess.objeto}
                      onChange={e => handleLocalUpdate({ objeto: e.target.value })}
                      placeholder="Ex: Regularização — Cássia Silva"
                      className="h-10 bg-muted/20 border-border/50 rounded-xl font-medium text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Protocolo nº</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground opacity-50" />
                        <Input
                          value={activeProcess.protocolo || ''}
                          onChange={e => handleLocalUpdate({ protocolo: e.target.value })}
                          placeholder="Nº Processo"
                          className="h-10 pl-9 bg-muted/20 border-border/50 rounded-xl font-medium text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data Protocolo</Label>
                      <Input
                        type="date"
                        value={activeProcess.dataProtocolo || ''}
                        onChange={e => handleLocalUpdate({ dataProtocolo: e.target.value })}
                        className="h-10 bg-muted/20 border-border/50 rounded-xl font-medium text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Timeline ── */}
                <div className="space-y-3 pt-4 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Histórico Técnico & Financeiro</Label>
                  </div>

                  <div className="relative">
                    <Textarea
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Adicionar atualização técnica..."
                      className="min-h-[72px] bg-muted/20 border-border/50 rounded-xl font-medium p-3 pr-12 resize-none text-sm"
                      onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleAddNote()}
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

                  <div className="space-y-3 pt-1">
                    {timelineEvents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 opacity-30">
                        <History className="w-8 h-8 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Sem eventos registrados</p>
                      </div>
                    ) : (
                      <div className="relative space-y-3 pl-4 before:absolute before:left-1 before:top-2 before:bottom-0 before:w-0.5 before:bg-border/30">
                        {timelineEvents.map((note: any) => {
                          const isFinancial = !!note.transaction;
                          const isExpense = note.isExpense;
                          return (
                            <div key={note.id} className="relative">
                              <div className={`absolute -left-[1.35rem] top-1.5 w-3 h-3 rounded-full border-2 border-background shadow-sm ${isFinancial ? (isExpense ? 'bg-destructive' : 'bg-emerald-500') : 'bg-primary'}`} />
                              <div className={`p-3 rounded-xl border border-border/30 transition-colors ${isFinancial ? (isExpense ? 'bg-destructive/5' : 'bg-emerald-500/5') : 'bg-muted/30'}`}>
                                {isFinancial && (
                                  <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isExpense ? 'text-destructive/80' : 'text-emerald-600/80'}`}>
                                    {isExpense ? 'Saída / Repasse' : 'Receita'}
                                  </p>
                                )}
                                <p className={`text-xs font-medium leading-relaxed mb-1 ${isFinancial ? (isExpense ? 'text-destructive font-bold' : 'text-emerald-700 dark:text-emerald-400 font-bold') : 'text-foreground/90'}`}>
                                  {note.texto}
                                </p>
                                <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1">
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

                {/* ── Lucro Líquido ── (own row, clear layout) */}
                <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lucro Líquido do Processo</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-sm font-bold ${lucroPositivo ? 'text-emerald-500/70' : 'text-destructive/70'}`}>R$</span>
                    <span className={`text-2xl font-black tabular-nums tracking-tighter ${lucroPositivo ? 'text-emerald-500' : 'text-destructive'}`}>
                      {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground italic font-medium">Recebido − Custos de Repasses</p>
                </div>

              </div>
            </div>
          )}

          {/* ── Fixed Footer: Save / Close ── */}
          {activeProcess && (
            <div className="shrink-0 flex gap-2 p-4 border-t border-border/30 bg-card/95 backdrop-blur-sm">
              <Button
                onClick={handleSaveChanges}
                disabled={!hasUnsavedChanges}
                className={`flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-widest gap-2 transition-all ${hasUnsavedChanges ? 'shadow-lg' : 'opacity-50'}`}
              >
                <Check className="w-4 h-4" /> Salvar Alterações
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveProcessClienteId(null)}
                className="h-11 px-4 rounded-xl font-bold text-xs text-muted-foreground border-border/50 hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
