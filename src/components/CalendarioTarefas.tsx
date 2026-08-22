import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Task, Transaction } from '@/lib/types';
import { getProcesses, getClients } from '@/lib/storage';
import { cn } from '@/lib/utils';

const DIAS_SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function toKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

interface CalendarEvent {
  id: string;
  titulo: string;
  vinculo: string | null;
  navegarPara: string;
}

/** Calendário mensal com bolinha nos dias que têm tarefa, prazo de trabalho ou lançamento
 *  financeiro pendente — clique num dia pra ver a lista. Vermelho indica atraso, âmbar indica
 *  previsto. Só considera itens ainda não concluídos/pagos/recebidos. */
export function CalendarioTarefas({ tasks, transactions }: { tasks: Task[]; transactions: Transaction[] }) {
  const navigate = useNavigate();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const todayStr = toKey(hoje);
  const [mes, setMes] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaSel, setDiaSel] = useState<string | null>(null);

  const processes = useMemo(() => getProcesses(), []);
  const clients = useMemo(() => getClients(), []);

  const porDia = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    function add(data: string | undefined, evento: CalendarEvent) {
      if (!data) return;
      const arr = map.get(data) || [];
      arr.push(evento);
      map.set(data, arr);
    }

    tasks
      .filter(t => t.status !== 'Concluída' && t.prazo)
      .forEach(t => {
        const vinculo = t.processId ? processes.find(p => p.id === t.processId)?.objeto : t.clienteId ? clients.find(c => c.id === t.clienteId)?.nome : null;
        add(t.prazo, { id: `tarefa-${t.id}`, titulo: t.titulo, vinculo: vinculo || null, navegarPara: t.processId ? `/trabalhos/${t.processId}` : '/tarefas' });
      });

    transactions
      .filter(t => t.status !== 'Concluído')
      .forEach(t => {
        const isEntrada = t.tipo === 'Entrada' || t.tipo === 'A Receber';
        const cliente = t.clienteId ? clients.find(c => c.id === t.clienteId)?.nome : null;
        add(t.data, {
          id: `tx-${t.id}`,
          titulo: `${isEntrada ? 'Receber' : 'Pagar'}: ${t.descricao}`,
          vinculo: cliente,
          navegarPara: t.processId ? `/trabalhos/${t.processId}` : '/caixa/receitas',
        });
      });

    processes
      .filter(p => !p.isArchived && (p.etapa || 'Levantamento') !== 'Concluído' && p.prazo)
      .forEach(p => {
        add(p.prazo, { id: `trabalho-${p.id}`, titulo: `Prazo: ${p.objeto}`, vinculo: clients.find(c => c.id === p.clienteId)?.nome || null, navegarPara: `/trabalhos/${p.id}` });
      });

    return map;
  }, [tasks, transactions, processes, clients]);

  const primeiroDiaSemana = (mes.getDay() + 6) % 7; // segunda-feira = 0
  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celulas: (Date | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1)),
  ];

  const eventosDoDia = diaSel ? porDia.get(diaSel) || [] : [];

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-[14px] py-[9px] border-b border-3 flex items-center justify-between">
        <div className="text-[12px] font-semibold">
          {MESES[mes.getMonth()]} {mes.getFullYear()}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="h-5 w-5 grid place-items-center rounded-md hover:bg-surface-3 text-mute-2">
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button onClick={() => setMes(new Date(hoje.getFullYear(), hoje.getMonth(), 1))} className="text-[10px] text-accent font-medium px-1.5">
            hoje
          </button>
          <button onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="h-5 w-5 grid place-items-center rounded-md hover:bg-surface-3 text-mute-2">
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="px-[12px] pt-[8px] pb-[4px]">
        <div className="grid grid-cols-7 gap-[3px] text-center">
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="text-[9px] text-mute-3 font-medium py-0.5">{d}</div>
          ))}
          {celulas.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = toKey(d);
            const itens = porDia.get(key) || [];
            const atrasado = itens.length > 0 && key < todayStr;
            const isHoje = key === todayStr;
            const isSel = key === diaSel;
            return (
              <button
                key={i}
                onClick={() => setDiaSel(isSel ? null : key)}
                className={cn(
                  'h-[23px] rounded-md flex flex-col items-center justify-center gap-[2px] text-[10.5px] transition-colors',
                  isSel ? 'bg-primary text-primary-foreground' : isHoje ? 'bg-accent-soft text-accent font-semibold' : 'hover:bg-surface-3'
                )}
              >
                {d.getDate()}
                {itens.length > 0 && (
                  <span className={cn('w-[3px] h-[3px] rounded-full flex-none', isSel ? 'bg-primary-foreground' : atrasado ? 'bg-destructive' : 'bg-warning')} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {diaSel && (
        <div className="border-t border-3 px-[14px] py-[10px]">
          <div className="text-[10.5px] font-mono-hbs text-mute-2 mb-1.5 capitalize">
            {new Date(diaSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </div>
          {eventosDoDia.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nada nesse dia.</div>
          ) : (
            <div className="space-y-2">
              {eventosDoDia.map(e => (
                <div
                  key={e.id}
                  onClick={() => navigate(e.navegarPara)}
                  className="flex items-center gap-2 text-[12.5px] cursor-pointer hover:text-accent transition-colors"
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-none', diaSel < todayStr ? 'bg-destructive' : 'bg-warning')} />
                  <span className="flex-1 min-w-0 truncate">{e.titulo}</span>
                  {e.vinculo && <span className="text-mute-2 text-[11px] flex-none truncate max-w-[130px]">{e.vinculo}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
