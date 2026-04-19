import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListTodo, AlertTriangle, CalendarDays, ChevronRight, Plus, CheckCircle2, Circle } from 'lucide-react';
import { Task } from '@/lib/types';
import { getTasks, updateTask } from '@/lib/storage';

interface Props {
  onOpenTasks: () => void;
  onNewTask: () => void;
  refreshKey?: number;
}

export function TasksWidget({ onOpenTasks, onNewTask, refreshKey = 0 }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [localKey, setLocalKey] = useState(0);

  const tasks = useMemo(() => {
    void refreshKey; void localKey;
    return getTasks();
  }, [refreshKey, localKey]);

  const overdue = tasks.filter(t => t.status !== 'Concluída' && t.prazo && t.prazo < today)
    .sort((a, b) => (a.prazo || '').localeCompare(b.prazo || ''));
  const todayList = tasks.filter(t => t.status !== 'Concluída' && t.prazo === today);
  const upcoming = tasks.filter(t => {
    if (t.status === 'Concluída' || !t.prazo) return false;
    if (t.prazo <= today) return false;
    const d = new Date(t.prazo + 'T12:00:00');
    const diff = (d.getTime() - new Date(today + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).sort((a, b) => (a.prazo || '').localeCompare(b.prazo || ''));

  function toggle(t: Task) {
    updateTask({
      ...t,
      status: t.status === 'Concluída' ? 'Pendente' : 'Concluída',
      completedAt: t.status === 'Concluída' ? undefined : Date.now(),
      updatedAt: Date.now(),
    });
    setLocalKey(k => k + 1);
  }

  const display = [...overdue, ...todayList, ...upcoming].slice(0, 6);
  const totalOpen = tasks.filter(t => t.status !== 'Concluída').length;

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-primary" /> Tarefas & Prazos
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{totalOpen} abertas • {overdue.length} atrasadas</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-[10px] font-bold" onClick={onNewTask}><Plus className="w-3 h-3" />Nova</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 gap-0.5 text-[10px] font-bold" onClick={onOpenTasks}>Ver tudo<ChevronRight className="w-3 h-3" /></Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-1.5">
        {display.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-semibold">Nenhuma tarefa pendente</p>
            <p className="text-[10px] opacity-70 mt-0.5">Tudo em dia. Crie uma para acompanhar prazos.</p>
          </div>
        ) : (
          display.map(t => {
            const isLate = t.prazo && t.prazo < today;
            const isToday = t.prazo === today;
            return (
              <button
                key={t.id}
                onClick={() => toggle(t)}
                className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors ${
                  isLate ? 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10' : 'border-border/50 hover:bg-muted/40'
                }`}
              >
                <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate text-foreground">{t.titulo}</p>
                  {t.prazo && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {isLate ? <AlertTriangle className="w-2.5 h-2.5 text-rose-600" /> : <CalendarDays className="w-2.5 h-2.5 text-muted-foreground" />}
                      <span className={`text-[9px] font-bold ${isLate ? 'text-rose-600' : isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {new Date(t.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {isLate && ' • Atrasada'}
                        {isToday && ' • Hoje'}
                      </span>
                    </div>
                  )}
                </div>
                <Badge variant="outline" className={`text-[9px] py-0 h-4 shrink-0 ${
                  t.prioridade === 'Alta' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                  t.prioridade === 'Média' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                  'bg-muted text-muted-foreground border-border'
                }`}>
                  {t.prioridade}
                </Badge>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
