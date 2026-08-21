import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Task } from '@/lib/types';
import { getProcesses, getClients } from '@/lib/storage';
import { cn } from '@/lib/utils';

const DIAS_SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function toKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Calendário mensal com bolinha nos dias que têm tarefa pendente com prazo — clique num dia pra ver a
 *  lista. Roxo/laranja indica atraso, âmbar indica previsto. Só considera tarefas não concluídas. */
export function CalendarioTarefas({ tasks }: { tasks: Task[] }) {
  const navigate = useNavigate();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const todayStr = toKey(hoje);
  const [mes, setMes] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaSel, setDiaSel] = useState<string | null>(null);

  const processes = useMemo(() => getProcesses(), []);
  const clients = useMemo(() => getClients(), []);

  const porDia = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks
      .filter(t => t.status !== 'Concluída' && t.prazo)
      .forEach(t => {
        const arr = map.get(t.prazo!) || [];
        arr.push(t);
        map.set(t.prazo!, arr);
      });
    return map;
  }, [tasks]);

  const primeiroDiaSemana = (mes.getDay() + 6) % 7; // segunda-feira = 0
  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celulas: (Date | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1)),
  ];

  function nomeVinculo(t: Task): string | null {
    if (t.processId) return processes.find(p => p.id === t.processId)?.objeto || null;
    if (t.clienteId) return clients.find(c => c.id === t.clienteId)?.nome || null;
    return null;
  }

  const tarefasDoDia = diaSel ? porDia.get(diaSel) || [] : [];

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-[18px] py-[15px] border-b border-3 flex items-center justify-between">
        <div className="text-[13.5px] font-semibold">
          {MESES[mes.getMonth()]} {mes.getFullYear()}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="h-6 w-6 grid place-items-center rounded-md hover:bg-surface-3 text-mute-2">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setMes(new Date(hoje.getFullYear(), hoje.getMonth(), 1))} className="text-[10.5px] text-accent font-medium px-1.5">
            hoje
          </button>
          <button onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="h-6 w-6 grid place-items-center rounded-md hover:bg-surface-3 text-mute-2">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-[14px] pt-[12px] pb-[6px]">
        <div className="grid grid-cols-7 gap-1 text-center">
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="text-[10px] text-mute-3 font-medium py-1">{d}</div>
          ))}
          {celulas.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = toKey(d);
            const itens = porDia.get(key) || [];
            const atrasada = itens.length > 0 && key < todayStr;
            const isHoje = key === todayStr;
            const isSel = key === diaSel;
            return (
              <button
                key={i}
                onClick={() => setDiaSel(isSel ? null : key)}
                className={cn(
                  'aspect-square rounded-lg flex flex-col items-center justify-center gap-[3px] text-[11.5px] transition-colors',
                  isSel ? 'bg-primary text-primary-foreground' : isHoje ? 'bg-accent-soft text-accent font-semibold' : 'hover:bg-surface-3'
                )}
              >
                {d.getDate()}
                {itens.length > 0 && (
                  <span className={cn('w-1 h-1 rounded-full flex-none', isSel ? 'bg-primary-foreground' : atrasada ? 'bg-destructive' : 'bg-warning')} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {diaSel && (
        <div className="border-t border-3 px-[18px] py-[13px]">
          <div className="text-[11px] font-mono-hbs text-mute-2 mb-2 capitalize">
            {new Date(diaSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </div>
          {tarefasDoDia.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nada nesse dia.</div>
          ) : (
            <div className="space-y-2">
              {tarefasDoDia.map(t => (
                <div
                  key={t.id}
                  onClick={() => navigate(t.processId ? `/trabalhos/${t.processId}` : '/tarefas')}
                  className="flex items-center gap-2 text-[12.5px] cursor-pointer hover:text-accent transition-colors"
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-none', diaSel < todayStr ? 'bg-destructive' : 'bg-warning')} />
                  <span className="flex-1 min-w-0 truncate">{t.titulo}</span>
                  {nomeVinculo(t) && <span className="text-mute-2 text-[11px] flex-none truncate max-w-[130px]">{nomeVinculo(t)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
