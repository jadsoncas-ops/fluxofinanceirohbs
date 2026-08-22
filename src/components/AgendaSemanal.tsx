import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Compromisso, Task, Transaction, Client, CORES_COMPROMISSO } from '@/lib/types';
import { cn } from '@/lib/utils';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function toKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

interface DiaBucket {
  compromissos: Compromisso[];
  tarefas: Task[];
  cobrancas: { titulo: string; valor: number }[];
}

interface Props {
  compromissos: Compromisso[];
  tasks: Task[];
  transactions: Transaction[];
  clients: Client[];
  onNovo: (data?: string) => void;
  onEditar: (c: Compromisso) => void;
}

/** Widget de agenda semanal (dom-sáb) — compromissos com horário, tarefas com prazo e
 *  cobranças vencendo, todos agrupados por dia da semana corrente (navegável). */
export function AgendaSemanal({ compromissos, tasks, transactions, clients, onNovo, onEditar }: Props) {
  const navigate = useNavigate();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const todayStr = toKey(hoje);

  const [inicioSemana, setInicioSemana] = useState(() => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });

  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicioSemana);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [inicioSemana]
  );

  const rotuloSemana = `${dias[0].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${dias[6].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;

  const porDia = useMemo(() => {
    const map = new Map<string, DiaBucket>();
    dias.forEach(d => map.set(toKey(d), { compromissos: [], tarefas: [], cobrancas: [] }));

    compromissos.forEach(c => { map.get(c.data)?.compromissos.push(c); });

    tasks
      .filter(t => t.status !== 'Concluída' && t.prazo)
      .forEach(t => { map.get(t.prazo!)?.tarefas.push(t); });

    transactions
      .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído' && t.clienteId)
      .forEach(t => {
        const bucket = map.get(t.data);
        if (!bucket) return;
        const nome = clients.find(c => c.id === t.clienteId)?.nome || 'Cliente';
        bucket.cobrancas.push({ titulo: `${nome} — ${t.descricao}`, valor: t.valor });
      });

    map.forEach(b => b.compromissos.sort((a, b2) => (a.horaInicio || '99:99').localeCompare(b2.horaInicio || '99:99')));
    return map;
  }, [dias, compromissos, tasks, transactions, clients]);

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-[18px] py-[15px] border-b border-3 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-[13.5px] font-semibold">Semana</div>
          <div className="text-[10.5px] text-mute-2 font-mono-hbs mt-0.5">{rotuloSemana}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onNovo()} className="h-7 px-2.5 rounded-lg border-2 text-[11px] font-medium hover:border-hover transition-colors flex items-center gap-1">
            <Plus className="w-3 h-3" /> Compromisso
          </button>
          <button onClick={() => setInicioSemana(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })} className="h-6 w-6 grid place-items-center rounded-md hover:bg-surface-3 text-mute-2">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { const d = new Date(hoje); d.setDate(d.getDate() - d.getDay()); setInicioSemana(d); }}
            className="text-[10.5px] text-accent font-medium px-1"
          >
            hoje
          </button>
          <button onClick={() => setInicioSemana(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })} className="h-6 w-6 grid place-items-center rounded-md hover:bg-surface-3 text-mute-2">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 divide-x divide-border overflow-x-auto">
        {dias.map(d => {
          const key = toKey(d);
          const bucket = porDia.get(key)!;
          const isHoje = key === todayStr;
          const vazio = bucket.compromissos.length === 0 && bucket.tarefas.length === 0 && bucket.cobrancas.length === 0;
          return (
            <div key={key} className={cn('min-w-[128px] flex flex-col', isHoje && 'bg-accent-soft/40')}>
              <button onClick={() => onNovo(key)} className="px-2 py-2 text-center border-b border-3 hover:bg-surface-3 transition-colors">
                <div className="text-[9.5px] uppercase tracking-[.05em] text-mute-2">{DIAS[d.getDay()]}</div>
                <div className={cn('text-[13px] font-semibold mt-0.5', isHoje && 'text-accent')}>{d.getDate()}</div>
              </button>
              <div className="flex-1 p-1.5 space-y-1.5 min-h-[90px]">
                {bucket.compromissos.map(c => {
                  const hsl = CORES_COMPROMISSO[c.cor] || CORES_COMPROMISSO.roxo;
                  return (
                    <button
                      key={c.id}
                      onClick={() => onEditar(c)}
                      className="w-full text-left rounded-lg px-2 py-1.5 text-[10.5px] leading-[1.3] transition-opacity hover:opacity-80"
                      style={{ backgroundColor: `hsl(${hsl} / .16)`, color: `hsl(${hsl})` }}
                    >
                      <div className="font-medium truncate">{c.titulo}</div>
                      {(c.horaInicio || c.comQuem) && (
                        <div className="opacity-80 truncate">
                          {c.horaInicio}{c.horaFim ? `–${c.horaFim}` : ''}{c.comQuem ? `${c.horaInicio ? ' · ' : ''}${c.comQuem}` : ''}
                        </div>
                      )}
                    </button>
                  );
                })}
                {bucket.tarefas.map(t => (
                  <div key={t.id} onClick={() => navigate('/tarefas')} className="flex items-center gap-1.5 px-1 text-[10.5px] cursor-pointer hover:text-accent transition-colors">
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-none', key < todayStr ? 'bg-destructive' : 'bg-warning')} />
                    <span className="truncate">{t.titulo}</span>
                  </div>
                ))}
                {bucket.cobrancas.map((c, i) => (
                  <div key={i} className="px-1 text-[10px] text-destructive truncate">💰 {c.titulo}</div>
                ))}
                {vazio && <div className="text-[10px] text-mute-3 text-center pt-3">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
