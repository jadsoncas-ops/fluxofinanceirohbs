import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Transaction, Client, Process, ProcessStatus, ProcessNote, TransactionType } from '@/lib/types';
import { getClients, getProcessByClient, getProcesses, updateProcess, deleteProcess, addTransaction, getTransactions } from '@/lib/storage';
import { toast } from 'sonner';
import {
  Plus, FolderClosed, AlertCircle, ClipboardList, TrendingUp, TrendingDown, DollarSign,
  History, Clock3, FileText, ExternalLink, Archive, Play, Trash2, Pencil, Info,
  Search, CalendarDays, UserPlus
} from 'lucide-react';
import { ClientForm } from './ClientForm';

type ProcessViewFilter = 'tramite' | 'concluidos' | 'arquivados';

interface Props {
  allTransactions: Transaction[];
  onRefresh: () => void;
  onOpenTransactionForm: (opts: { clienteId?: string; tipo?: TransactionType; parentItem?: Transaction | null }) => void;
}

export function ProcessManager({ allTransactions, onRefresh, onOpenTransactionForm }: Props) {
  const [clientes, setClientes] = useState<Client[]>([]);
  const [viewFilter, setViewFilter] = useState<ProcessViewFilter>('tramite');
  const [searchTerm, setSearchTerm] = useState('');

  // Drawer state
  const [activeProcessClienteId, setActiveProcessClienteId] = useState<string | null>(null);
  const [activeProcess, setActiveProcess] = useState<Process | null>(null);
  const [newNote, setNewNote] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
        setActiveProcess(proc);
      } else {
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

  const handleUpdateProcess = useCallback((updates: Partial<Process>) => {
    if (!activeProcess) return;
    const updated = { ...activeProcess, ...updates, updatedAt: Date.now() };
    setActiveProcess(updated);
    updateProcess(updated);
  }, [activeProcess]);

  const handleAddNote = useCallback(() => {
    if (!newNote.trim() || !activeProcess) return;
    const note: ProcessNote = {
      id: crypto.randomUUID(),
      data: Date.now(),
      texto: newNote.trim()
    };
    handleUpdateProcess({ notas: [note, ...activeProcess.notas] });
    setNewNote('');
    toast.success('Nota adicionada.');
  }, [newNote, activeProcess, handleUpdateProcess]);

  const handleDeleteProcess = useCallback(() => {
    if (!activeProcess) return;
    deleteProcess(activeProcess.id);
    toast.success('Processo e lançamentos vinculados excluídos.');
    setDeleteConfirmOpen(false);
    setActiveProcessClienteId(null);
    onRefresh();
  }, [activeProcess, onRefresh]);

  function getClientName(id?: string | null) {
    if (!id) return 'Sem cliente';
    return clientes.find(c => c.id === id)?.nome || 'Cliente desconhecido';
  }

  // Compute process cards data
  const processCards = useMemo(() => {
    const processes = getProcesses();
    const clientIds = new Set<string>();
    
    // All clients that have processes
    processes.forEach(p => clientIds.add(p.clienteId));
    
    // Also include clients that have transactions but no process yet
    allTransactions.forEach(t => {
      if (t.clienteId) clientIds.add(t.clienteId);
    });

    const cards: {
      id: string;
      clienteId: string;
      name: string;
      status: ProcessStatus | 'A definir';
      protocolo?: string;
      dataProtocolo?: string;
      isArchived: boolean;
      recebido: number;
      saldo: number;
      repasses: number;
      valorContrato: number;
      hasProcess: boolean;
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
        id: proc?.id || cId,
        clienteId: cId,
        name: client?.nome || 'Cliente desconhecido',
        status: proc?.status || 'A definir',
        protocolo: proc?.protocolo,
        dataProtocolo: proc?.dataProtocolo,
        isArchived: proc?.isArchived || false,
        recebido,
        saldo,
        repasses,
        valorContrato,
        hasProcess: !!proc,
      });
    });

    return cards;
  }, [allTransactions, clientes]);

  // Unlinked transactions
  const unlinkedTxs = useMemo(() => {
    return allTransactions.filter(t => !t.isRepasse && (!t.clienteId || t.clienteId === null || t.clienteId === undefined));
  }, [allTransactions]);

  // Filter cards
  const filteredCards = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let cards = processCards;

    if (term) {
      cards = cards.filter(c =>
        c.name.toLowerCase().includes(term) ||
        (c.protocolo ?? '').toLowerCase().includes(term)
      );
    }

    switch (viewFilter) {
      case 'tramite':
        return cards.filter(c => !c.isArchived && c.status !== 'Finalizado');
      case 'concluidos':
        return cards.filter(c => !c.isArchived && c.status === 'Finalizado');
      case 'arquivados':
        return cards.filter(c => c.isArchived);
      default:
        return cards;
    }
  }, [processCards, viewFilter, searchTerm]);

  // Client finances for drawer
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

  // Timeline events for drawer
  const timelineEvents = useMemo(() => {
    if (!activeProcess || !activeProcessClienteId) return [];
    const clientTxs = allTransactions.filter(t => t.clienteId === activeProcessClienteId);
    const combined: any[] = [...activeProcess.notas];
    clientTxs.forEach(t => {
      combined.push({
        id: `tx-${t.id}`,
        data: new Date(t.data + 'T12:00:00').getTime(),
        texto: `💸 ${t.tipo}: R$ ${t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - ${t.descricao}`,
        transaction: t
      });
    });
    return combined.sort((a, b) => b.data - a.data);
  }, [activeProcess, allTransactions, activeProcessClienteId]);

  const lucroLiquido = clientFinances.recebido - clientFinances.repasses;

  function handleNewProcess() {
    setSelectClientOpen(true);
  }

  function handleSelectClient(clienteId: string) {
    setSelectClientOpen(false);
    setActiveProcessClienteId(clienteId);
  }

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
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">Gerencie seus projetos de engenharia</p>
        </div>
        <Button size="sm" onClick={handleNewProcess} className="gap-1.5 font-bold shadow-sm rounded-lg hover:-translate-y-0.5 transition-transform">
          <Plus className="w-4 h-4" /> Novo Processo
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar processo..."
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

      {/* "A Organizar" group */}
      {unlinkedTxs.length > 0 && viewFilter === 'tramite' && (
        <Card className="border-amber-500/30 bg-amber-500/[0.03] hover:shadow-md transition-all rounded-2xl overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black text-sm text-foreground tracking-tight">A Organizar</h4>
                <p className="text-[10px] text-amber-600 font-bold mt-0.5">{unlinkedTxs.length} lançamento(s) sem processo vinculado</p>
              </div>
              <Badge variant="outline" className="text-[9px] h-5 px-2 border-amber-500/30 text-amber-600 font-black uppercase tracking-widest">
                Pendente
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Process Cards */}
      {filteredCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/10 rounded-2xl border border-border/30 border-dashed">
          <FolderClosed className="w-16 h-16 mb-4 opacity-10" />
          <p className="text-xs font-black uppercase tracking-widest opacity-30">
            {viewFilter === 'tramite' ? 'Nenhum processo em trâmite' :
             viewFilter === 'concluidos' ? 'Nenhum processo concluído' :
             'Nenhum processo arquivado'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCards.map(card => (
            <Card
              key={card.id}
              onClick={() => setActiveProcessClienteId(card.clienteId)}
              className={`transition-all border-border/40 hover:border-primary/50 shadow-sm hover:shadow-lg rounded-2xl overflow-hidden cursor-pointer group active:scale-[0.98] ${card.isArchived ? 'opacity-60 grayscale' : 'bg-card'}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 shrink-0 transition-transform group-hover:scale-110 duration-300">
                    <FolderClosed className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-sm text-foreground tracking-tight truncate">{card.name}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={`text-[9px] h-4 px-1.5 py-0 border-current bg-transparent uppercase font-black tracking-wider ${
                        card.status === 'Exigência' ? 'text-destructive' :
                        card.status === 'Finalizado' ? 'text-success' :
                        'text-primary'
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
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end mb-0.5">
                      <TrendingUp className="w-3 h-3 text-success" />
                      <span className="text-xs font-black text-success tabular-nums">
                        R$ {card.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                    {card.valorContrato > 0 && (
                      <span className="text-[9px] text-muted-foreground font-medium">
                        Saldo: R$ {card.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Select Client Dialog for new process */}
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
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {clientes.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectClient(c.id)}
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

      {/* Client Form for creating new client */}
      <ClientForm
        open={clientFormOpen}
        onClose={() => setClientFormOpen(false)}
        onSave={(newClient) => {
          setClientFormOpen(false);
          setClientes(getClients());
          if (newClient) {
            setTimeout(() => setActiveProcessClienteId(newClient.id), 100);
          }
        }}
      />

      {/* Delete Confirmation */}
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

      {/* Process Drawer */}
      <Sheet open={!!activeProcessClienteId} onOpenChange={v => !v && setActiveProcessClienteId(null)}>
        <SheetContent className="w-full sm:max-w-md bg-card p-0 flex flex-col gap-0 border-l border-border/50">
          <SheetHeader className="p-6 pb-4 border-b border-border/30 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <ClipboardList className="w-5 h-5" />
                <SheetTitle className="text-lg font-black tracking-tight uppercase">Gaveta de Processo</SheetTitle>
              </div>
              {activeProcess && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <SheetDescription className="text-xs font-medium text-muted-foreground">
              Gerencie o trâmite para: <span className="text-foreground font-bold">{getClientName(activeProcessClienteId)}</span>
            </SheetDescription>
          </SheetHeader>

          {activeProcess && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              {/* Financial Summary */}
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

              {/* Launch Buttons */}
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Lançamentos Financeiros</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setActiveProcessClienteId(null);
                      setTimeout(() => onOpenTransactionForm({ clienteId: activeProcess.clienteId, tipo: 'Entrada' }), 150);
                    }}
                    className="flex-1 h-10 rounded-xl bg-success hover:bg-success/90 text-success-foreground text-[11px] font-black uppercase tracking-widest gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Receita
                  </Button>
                  <Button
                    onClick={() => {
                      setActiveProcessClienteId(null);
                      setTimeout(() => onOpenTransactionForm({ clienteId: activeProcess.clienteId, tipo: 'Saída' }), 150);
                    }}
                    variant="outline"
                    className="flex-1 h-10 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 text-[11px] font-black uppercase tracking-widest gap-2"
                  >
                    <Plus className="w-4 h-4" /> Despesa/Repasse
                  </Button>
                </div>
              </div>

              {/* Archive Button */}
              {activeProcess.status === 'Finalizado' && (
                <Button
                  variant="outline"
                  onClick={() => handleUpdateProcess({ isArchived: !activeProcess.isArchived })}
                  className={`w-full h-10 rounded-xl text-[11px] font-black uppercase tracking-widest gap-2 ${activeProcess.isArchived ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-muted/50 text-muted-foreground border-border/50'}`}
                >
                  {activeProcess.isArchived ? <><Play className="w-4 h-4" /> Reativar</> : <><Archive className="w-4 h-4" /> Arquivar</>}
                </Button>
              )}

              {/* Status */}
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

              {/* Objeto / Drive / Protocolo */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Objeto do Serviço</Label>
                  <Input
                    value={activeProcess.objeto}
                    onChange={e => handleUpdateProcess({ objeto: e.target.value })}
                    placeholder="Ex: Regularização Cássia Silva"
                    className="h-11 bg-muted/20 border-border/50 rounded-xl font-medium"
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

              {/* Timeline */}
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
                    className="min-h-[80px] bg-muted/20 border-border/50 rounded-xl font-medium p-4 pr-12 resize-none"
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
                    <div className="flex flex-col items-center justify-center py-6 opacity-30">
                      <History className="w-8 h-8 mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Sem eventos registrados</p>
                    </div>
                  ) : (
                    <div className="relative space-y-4 pl-4 before:absolute before:left-1 before:top-2 before:bottom-0 before:w-0.5 before:bg-border/30">
                      {timelineEvents.map(note => {
                        const isFinancial = !!(note as any).transaction;
                        return (
                          <div key={note.id} className="relative">
                            <div className={`absolute -left-[1.35rem] top-1.5 w-3 h-3 rounded-full border-2 border-background shadow-sm ${isFinancial ? 'bg-emerald-500' : 'bg-primary'} transition-transform`}></div>
                            <div className={`${isFinancial ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'bg-muted/30'} p-3 rounded-xl border border-border/30 transition-colors`}>
                              {isFinancial && (
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/80 mb-1">Lançamento Financeiro</p>
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

              {/* Lucro Líquido Footer */}
              <div className="mt-auto p-6 border-t border-border/30 bg-muted/40 sticky bottom-0 -mx-6 -mb-6">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lucro Líquido do Processo</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-success/70">R$</span>
                  <span className="text-3xl font-black text-success tabular-nums tracking-tighter">
                    {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[9px] text-muted-foreground italic mt-1 font-medium opacity-60">Calculado: Recebido - Custos de Repasses</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
