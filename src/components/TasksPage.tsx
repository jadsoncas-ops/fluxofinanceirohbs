import { useState, useMemo, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Task, TaskStatus, TaskPriority, Client, Process } from '@/lib/types';
import { getTasks, addTask, updateTask, deleteTask, getClients, getProcesses } from '@/lib/storage';
import { toast } from 'sonner';
import { Plus, CheckCircle2, Clock3, AlertTriangle, Trash2, Pencil, CalendarDays, Briefcase, Circle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterTab = 'todas' | 'hoje' | 'atrasadas' | 'semana' | 'concluidas';

const FILTROS: { key: FilterTab; label: string }[] = [
  { key: 'todas', label: 'Abertas' },
  { key: 'hoje', label: 'Hoje' },
  { key: 'atrasadas', label: 'Atrasadas' },
  { key: 'semana', label: 'Semana' },
  { key: 'concluidas', label: 'Concluídas' },
];

interface Props {
  initialTask?: Partial<Task> | null;
  onConsumed?: () => void;
}

export function TasksPage({ initialTask, onConsumed }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<FilterTab>('todas');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
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

  // Abre o formulário com initialTask como semente (ex.: vindo do Command Palette ou do "+Novo")
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
    setFormOpen(true);
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
    setFormOpen(true);
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
    setFormOpen(false);
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

  function statusIcon(s: TaskStatus) {
    if (s === 'Concluída') return <CheckCircle2 className="w-4 h-4 text-success" />;
    if (s === 'Em Andamento') return <PlayCircle className="w-4 h-4 text-accent" />;
    return <Circle className="w-4 h-4 text-muted-foreground" />;
  }

  return (
    <div className="flex flex-col gap-[18px] pb-10 animate-hbs-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[19px] font-semibold -tracking-[.02em] leading-tight">Tarefas & Agenda</h1>
          <p className="text-[11px] text-mute-2 font-mono-hbs mt-0.5">Prazos, follow-ups e checklists vinculados aos trabalhos</p>
        </div>
        <button onClick={() => openCreate()} className="h-[34px] px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] hover:bg-primary-hover transition-colors flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Nova tarefa
        </button>
      </div>

      {/* Stats — também funcionam como filtro, mesmo padrão da KPI strip do Início */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-xl overflow-hidden">
        {[
          { key: 'hoje' as const, label: 'Hoje', value: counts.hoje, hintColor: undefined },
          { key: 'atrasadas' as const, label: 'Atrasadas', value: counts.atrasadas, hintColor: counts.atrasadas > 0 ? 'text-destructive' : undefined },
          { key: 'semana' as const, label: 'Semana', value: counts.semana, hintColor: counts.semana > 0 ? 'text-warning' : undefined },
          { key: 'todas' as const, label: 'Abertas', value: counts.todas, hintColor: undefined },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={cn('bg-card px-3 pt-2.5 pb-2.5 text-left hover:bg-surface-3 transition-colors', filter === s.key && 'bg-surface-3')}
          >
            <div className="text-[9.5px] tracking-[.06em] uppercase text-mute-2 font-medium">{s.label}</div>
            <div className={cn('font-mono-hbs text-[20px] font-medium -tracking-[.03em] mt-1', s.hintColor)}>{s.value}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 flex-1 min-w-0 flex-wrap">
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn('px-2.5 h-7 rounded-full text-[11px] font-medium border', filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-mute-2 hover:border-hover')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…" className="h-8 text-xs w-44" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl px-[18px] py-8 text-center">
          <p className="text-sm font-medium">Nenhuma tarefa</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">Crie a primeira tarefa para acompanhar prazos, follow-ups e pendências dos seus trabalhos.</p>
          <button onClick={() => openCreate()} className="mt-3 h-8 px-3 rounded-lg border-2 text-[11.5px] font-medium hover:border-hover transition-colors inline-flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nova tarefa
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.map((t, i) => {
            const isLate = t.status !== 'Concluída' && !!t.prazo && t.prazo < today;
            const isToday = t.prazo === today && t.status !== 'Concluída';
            const procName = getProcessName(t.processId);
            const cliName = procName ? null : getClientName(t.clienteId);
            return (
              <div key={t.id} className={cn('group flex items-start gap-[11px] px-[18px] py-[11px] hover:bg-surface-3 transition-colors', i > 0 && 'border-t border-3', isLate && 'bg-destructive-soft')}>
                <button onClick={() => toggleComplete(t)} className="mt-0.5 shrink-0 hover:scale-110 transition-transform" aria-label="Alternar conclusão">
                  {statusIcon(t.status)}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-[13px] font-medium leading-tight break-words', t.status === 'Concluída' && 'line-through text-muted-foreground')}>{t.titulo}</p>
                  {t.descricao && <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2 break-words">{t.descricao}</p>}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className={cn(
                      'text-[10px] px-1.5 py-[2px] rounded-[4px] font-medium',
                      t.prioridade === 'Alta' ? 'bg-destructive-soft text-destructive' : t.prioridade === 'Média' ? 'bg-warning-soft text-warning' : 'bg-neutral-soft text-mute-2'
                    )}>
                      {t.prioridade}
                    </span>
                    {t.prazo && (
                      <span className={cn(
                        'text-[10px] px-1.5 py-[2px] rounded-[4px] font-medium flex items-center gap-1',
                        isLate ? 'bg-destructive-soft text-destructive' : isToday ? 'bg-accent-soft text-accent' : 'bg-neutral-soft text-mute-2'
                      )}>
                        {isLate ? <AlertTriangle className="w-2.5 h-2.5" /> : <CalendarDays className="w-2.5 h-2.5" />}
                        {new Date(t.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {isLate && ' · atrasada'}
                        {isToday && ' · hoje'}
                      </span>
                    )}
                    {procName && (
                      <span className="text-[10px] px-1.5 py-[2px] rounded-[4px] font-medium bg-accent-soft text-accent flex items-center gap-1 max-w-[220px]">
                        <Briefcase className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{procName}</span>
                      </span>
                    )}
                    {cliName && <span className="text-[10px] px-1.5 py-[2px] rounded-[4px] font-medium bg-neutral-soft text-mute-2">{cliName}</span>}
                  </div>
                </div>
                <div className="flex-none flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(t)} className="h-6 w-6 grid place-items-center rounded-md hover:bg-surface-3 text-mute-2" title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(t)} className="h-6 w-6 grid place-items-center rounded-md hover:bg-destructive-soft text-mute-2 hover:text-destructive" title="Excluir">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] text-mute-2 uppercase tracking-[.06em]">Título *</label>
              <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Enviar ART para cliente" className="h-9 text-[12.5px] mt-1" autoFocus />
            </div>
            <div>
              <label className="text-[11px] text-mute-2 uppercase tracking-[.06em]">Descrição (opcional)</label>
              <Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes, links, contexto…" rows={3} className="text-[12.5px] mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-mute-2 uppercase tracking-[.06em]">Prazo</label>
                <Input type="date" value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })} className="h-9 text-[12.5px] mt-1 font-mono-hbs" />
              </div>
              <div>
                <label className="text-[11px] text-mute-2 uppercase tracking-[.06em]">Prioridade</label>
                <Select value={form.prioridade} onValueChange={v => setForm({ ...form, prioridade: v as TaskPriority })}>
                  <SelectTrigger className="h-9 text-[12.5px] mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-mute-2 uppercase tracking-[.06em]">Status</label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as TaskStatus })}>
                <SelectTrigger className="h-9 text-[12.5px] mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Concluída">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-mute-2 uppercase tracking-[.06em]">Vincular a trabalho</label>
              <Select value={form.processId} onValueChange={v => {
                const proc = processes.find(p => p.id === v);
                setForm({ ...form, processId: v, clienteId: proc ? proc.clienteId : form.clienteId });
              }}>
                <SelectTrigger className="h-9 text-[12.5px] mt-1"><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none"><span className="italic text-muted-foreground">Sem vínculo</span></SelectItem>
                  {processes.filter(p => !p.isArchived).map(p => {
                    const c = clientes.find(c => c.id === p.clienteId);
                    return <SelectItem key={p.id} value={p.id}>{c?.nome || '?'} — {p.objeto || 'Serviço'}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-mute-2 uppercase tracking-[.06em]">Vincular a cliente (opcional)</label>
              <Select value={form.clienteId} onValueChange={v => setForm({ ...form, clienteId: v })}>
                <SelectTrigger className="h-9 text-[12.5px] mt-1"><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none"><span className="italic text-muted-foreground">Sem vínculo</span></SelectItem>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setFormOpen(false)} className="h-9 px-3.5 rounded-lg text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
            <button onClick={handleSave} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors">{editing ? 'Salvar' : 'Criar tarefa'}</button>
          </div>
        </DialogContent>
      </Dialog>

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
