import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Task, TaskStatus, TaskPriority, Client, Process } from '@/lib/types';
import { getTasks, addTask, updateTask, deleteTask, getClients, getProcesses } from '@/lib/storage';
import { toast } from 'sonner';
import { Plus, CheckCircle2, Clock, AlertTriangle, Trash2, Pencil, CalendarDays, Briefcase, ListTodo, Flame, Search, Circle, PlayCircle } from 'lucide-react';

type FilterTab = 'todas' | 'hoje' | 'atrasadas' | 'semana' | 'concluidas';

interface Props {
  initialTask?: Partial<Task> | null;
  onConsumed?: () => void;
}

export function TasksPage({ initialTask, onConsumed }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<FilterTab>('todas');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const [form, setForm] = useState<{
    titulo: string;
    descricao: string;
    status: TaskStatus;
    prioridade: TaskPriority;
    prazo: string;
    processId: string;
    clienteId: string;
  }>({
    titulo: '',
    descricao: '',
    status: 'Pendente',
    prioridade: 'Média',
    prazo: '',
    processId: 'none',
    clienteId: 'none',
  });

  const [clientes, setClientes] = useState<Client[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);

  useEffect(() => {
    setClientes(getClients());
    setProcesses(getProcesses());
  }, [refreshKey]);

  const tasks = useMemo(() => {
    void refreshKey;
    return getTasks().sort((a, b) => {
      // Concluídas no final
      if (a.status === 'Concluída' && b.status !== 'Concluída') return 1;
      if (b.status === 'Concluída' && a.status !== 'Concluída') return -1;
      // Por prazo (sem prazo no final)
      if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
      if (a.prazo) return -1;
      if (b.prazo) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [refreshKey]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Open drawer with initialTask seed (e.g. from command palette)
  useEffect(() => {
    if (initialTask) {
      openCreate(initialTask);
      onConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTask]);

  function openCreate(seed?: Partial<Task>) {
    setEditing(null);
    setForm({
      titulo: seed?.titulo || '',
      descricao: seed?.descricao || '',
      status: (seed?.status as TaskStatus) || 'Pendente',
      prioridade: (seed?.prioridade as TaskPriority) || 'Média',
      prazo: seed?.prazo || '',
      processId: seed?.processId || 'none',
      clienteId: seed?.clienteId || 'none',
    });
    setDrawerOpen(true);
  }

  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      titulo: t.titulo,
      descricao: t.descricao || '',
      status: t.status,
      prioridade: t.prioridade,
      prazo: t.prazo || '',
      processId: t.processId || 'none',
      clienteId: t.clienteId || 'none',
    });
    setDrawerOpen(true);
  }

  function handleSave() {
    if (!form.titulo.trim()) {
      toast.error('Título é obrigatório.');
      return;
    }
    const payload: Task = {
      id: editing?.id || crypto.randomUUID(),
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || undefined,
      status: form.status,
      prioridade: form.prioridade,
      prazo: form.prazo || undefined,
      processId: form.processId === 'none' ? null : form.processId,
      clienteId: form.clienteId === 'none' ? null : form.clienteId,
      createdAt: editing?.createdAt || Date.now(),
      updatedAt: Date.now(),
      completedAt: form.status === 'Concluída' ? (editing?.completedAt || Date.now()) : undefined,
    };
    if (editing) {
      updateTask(payload);
      toast.success('Tarefa atualizada.');
    } else {
      addTask(payload);
      toast.success('Tarefa criada.');
    }
    setDrawerOpen(false);
    refresh();
  }

  function toggleComplete(t: Task) {
    const updated: Task = {
      ...t,
      status: t.status === 'Concluída' ? 'Pendente' : 'Concluída',
      completedAt: t.status === 'Concluída' ? undefined : Date.now(),
      updatedAt: Date.now(),
    };
    updateTask(updated);
    refresh();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteTask(deleteTarget.id);
    toast.success('Tarefa removida.');
    setDeleteTarget(null);
    refresh();
  }

  const counts = useMemo(() => {
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    return {
      todas: tasks.filter(t => t.status !== 'Concluída').length,
      hoje: tasks.filter(t => t.status !== 'Concluída' && t.prazo === today).length,
      atrasadas: tasks.filter(t => t.status !== 'Concluída' && t.prazo && t.prazo < today).length,
      semana: tasks.filter(t => t.status !== 'Concluída' && t.prazo && t.prazo >= today && t.prazo <= weekEndStr).length,
      concluidas: tasks.filter(t => t.status === 'Concluída').length,
    };
  }, [tasks, today]);

  const filtered = useMemo(() => {
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    let result = tasks;
    switch (filter) {
      case 'hoje':
        result = tasks.filter(t => t.status !== 'Concluída' && t.prazo === today); break;
      case 'atrasadas':
        result = tasks.filter(t => t.status !== 'Concluída' && t.prazo && t.prazo < today); break;
      case 'semana':
        result = tasks.filter(t => t.status !== 'Concluída' && t.prazo && t.prazo >= today && t.prazo <= weekEndStr); break;
      case 'concluidas':
        result = tasks.filter(t => t.status === 'Concluída'); break;
      default:
        result = tasks.filter(t => t.status !== 'Concluída'); break;
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(t => t.titulo.toLowerCase().includes(s) || (t.descricao || '').toLowerCase().includes(s));
    }
    return result;
  }, [tasks, filter, search, today]);

  function getProcessName(id?: string | null) {
    if (!id) return null;
    const p = processes.find(p => p.id === id);
    if (!p) return null;
    const c = clientes.find(c => c.id === p.clienteId);
    return `${c?.nome || '?'} — ${p.objeto || 'Serviço'}`;
  }

  function getClientName(id?: string | null) {
    if (!id) return null;
    return clientes.find(c => c.id === id)?.nome || null;
  }

  function priorityColor(p: TaskPriority) {
    if (p === 'Alta') return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    if (p === 'Média') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    return 'bg-muted text-muted-foreground border-border';
  }

  function statusIcon(s: TaskStatus) {
    if (s === 'Concluída') return <CheckCircle2 className="w-4 h-4 text-success" />;
    if (s === 'Em Andamento') return <PlayCircle className="w-4 h-4 text-primary" />;
    return <Circle className="w-4 h-4 text-muted-foreground" />;
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-primary" /> Tarefas & Agenda
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">Prazos, follow-ups e checklists vinculados aos processos</p>
        </div>
        <Button size="sm" onClick={() => openCreate()} className="gap-1.5 font-bold rounded-lg">
          <Plus className="w-4 h-4" /> Nova Tarefa
        </Button>
      </div>

      {/* Stats compactos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { key: 'hoje', label: 'Hoje', value: counts.hoje, icon: CalendarDays, accent: 'text-primary' },
          { key: 'atrasadas', label: 'Atrasadas', value: counts.atrasadas, icon: Flame, accent: 'text-rose-600' },
          { key: 'semana', label: 'Semana', value: counts.semana, icon: Clock, accent: 'text-amber-600' },
          { key: 'todas', label: 'Abertas', value: counts.todas, icon: ListTodo, accent: 'text-foreground' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key as FilterTab)}
            className={`text-left p-3 rounded-xl border bg-card hover:border-primary/40 transition-all ${filter === s.key ? 'border-primary ring-1 ring-primary/20' : 'border-border/60'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-3.5 h-3.5 ${s.accent}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-2xl font-black tabular-nums ${s.accent}`}>{s.value}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Tabs value={filter} onValueChange={v => setFilter(v as FilterTab)} className="flex-1 min-w-0">
          <TabsList className="h-8">
            <TabsTrigger value="todas" className="text-xs">Abertas</TabsTrigger>
            <TabsTrigger value="hoje" className="text-xs">Hoje</TabsTrigger>
            <TabsTrigger value="atrasadas" className="text-xs">Atrasadas</TabsTrigger>
            <TabsTrigger value="semana" className="text-xs">Semana</TabsTrigger>
            <TabsTrigger value="concluidas" className="text-xs">Concluídas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="h-8 pl-8 w-44 text-xs" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-muted/20">
          <CardContent className="p-10 text-center text-muted-foreground flex flex-col items-center gap-3">
            <div className="bg-primary/5 p-4 rounded-full">
              <ListTodo className="w-10 h-10 text-primary/40" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wide">Nenhuma tarefa</p>
            <p className="text-xs opacity-80 max-w-xs leading-relaxed">Crie a primeira tarefa para acompanhar prazos, follow-ups e pendências dos seus processos.</p>
            <Button variant="outline" size="sm" onClick={() => openCreate()} className="gap-1.5 mt-2"><Plus className="w-3.5 h-3.5" /> Nova Tarefa</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const isLate = t.status !== 'Concluída' && t.prazo && t.prazo < today;
            const isToday = t.prazo === today && t.status !== 'Concluída';
            const procName = getProcessName(t.processId);
            const cliName = procName ? null : getClientName(t.clienteId);
            return (
              <Card key={t.id} className={`group border transition-all hover:shadow-md ${isLate ? 'border-rose-500/40 bg-rose-500/5' : 'border-border/60'}`}>
                <CardContent className="p-3 flex items-start gap-3">
                  <button onClick={() => toggleComplete(t)} className="mt-0.5 shrink-0 hover:scale-110 transition-transform" aria-label="Alternar conclusão">
                    {statusIcon(t.status)}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold leading-tight break-words ${t.status === 'Concluída' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{t.titulo}</p>
                        {t.descricao && <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2 break-words">{t.descricao}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(t)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(t)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] py-0 h-5 ${priorityColor(t.prioridade)}`}>
                        {t.prioridade}
                      </Badge>
                      {t.prazo && (
                        <Badge variant="outline" className={`text-[10px] py-0 h-5 gap-1 ${isLate ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : isToday ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground'}`}>
                          {isLate ? <AlertTriangle className="w-2.5 h-2.5" /> : <CalendarDays className="w-2.5 h-2.5" />}
                          {new Date(t.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}
                          {isLate && ' • Atrasada'}
                          {isToday && ' • Hoje'}
                        </Badge>
                      )}
                      {procName && (
                        <Badge variant="outline" className="text-[10px] py-0 h-5 gap-1 bg-primary/5 text-primary border-primary/20 max-w-[200px]">
                          <Briefcase className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{procName}</span>
                        </Badge>
                      )}
                      {cliName && (
                        <Badge variant="outline" className="text-[10px] py-0 h-5 bg-muted text-muted-foreground">
                          {cliName}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] py-0 h-5 bg-muted/50 text-muted-foreground">
                        {t.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Drawer de criação/edição */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar Tarefa' : 'Nova Tarefa'}</SheetTitle>
            <SheetDescription>{editing ? 'Atualize os detalhes da tarefa.' : 'Defina título, prazo e vínculo a processo se necessário.'}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Enviar ART para cliente" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes, links, contexto..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Prazo</Label>
                <Input type="date" value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm({ ...form, prioridade: v as TaskPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as TaskStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Concluída">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vincular a Processo</Label>
              <Select value={form.processId} onValueChange={v => {
                const proc = processes.find(p => p.id === v);
                setForm({ ...form, processId: v, clienteId: proc ? proc.clienteId : form.clienteId });
              }}>
                <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none"><span className="italic text-muted-foreground">Sem vínculo</span></SelectItem>
                  {processes.filter(p => !p.isArchived).map(p => {
                    const c = clientes.find(c => c.id === p.clienteId);
                    return <SelectItem key={p.id} value={p.id}>{c?.nome || '?'} — {p.objeto || 'Serviço'}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vincular a Cliente (opcional)</Label>
              <Select value={form.clienteId} onValueChange={v => setForm({ ...form, clienteId: v })}>
                <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none"><span className="italic text-muted-foreground">Sem vínculo</span></SelectItem>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setDrawerOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} className="flex-1 font-bold">{editing ? 'Salvar' : 'Criar Tarefa'}</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.titulo}" será removida. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
