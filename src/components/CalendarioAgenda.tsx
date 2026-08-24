import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Compromisso, Task, Transaction, Client, CORES_COMPROMISSO } from '@/lib/types';
import { getProcesses, updateCompromisso } from '@/lib/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_SEMANA_MES = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MAX_ITENS_DIA = 6;

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

/** Widget único de agenda — alterna entre visão Semana (compromissos com horário, tarefas,
 *  cobranças, em colunas por dia) e Mês (calendário compacto com indicador de pendência).
 *  Cada dia mostra no máximo MAX_ITENS_DIA itens pra manter a altura previsível — sem isso,
 *  um dia lotado de compromissos empurraria o resto da dashboard e quebraria a tela única.
 *  Clicar na data abre um popup com o dia completo (sem esse limite); arrastar um compromisso
 *  pra outra coluna do dia move ele (mesmo padrão de drag-and-drop do kanban de Trabalhos). */
export function CalendarioAgenda({ compromissos, tasks, transactions, clients, onNovo, onEditar }: Props) {
  const navigate = useNavigate();
  const [modo, setModo] = useState<'semana' | 'mes'>('semana');
  const [dragId, setDragId] = useState<string | null>(null);
  const [diaDetalhe, setDiaDetalhe] = useState<string | null>(null);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const todayStr = toKey(hoje);

  const [inicioSemana, setInicioSemana] = useState(() => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });
  const [mes, setMes] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  const processes = useMemo(() => getProcesses(), []);

  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicioSemana);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [inicioSemana]
  );

  const rotuloSemana = `${dias[0].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${dias[6].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;

  const porDiaSemana = useMemo(() => {
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

  const porDiaMes = useMemo(() => {
    const map = new Map<string, number>();
    const add = (data: string | undefined) => { if (data) map.set(data, (map.get(data) || 0) + 1); };
    tasks.filter(t => t.status !== 'Concluída' && t.prazo).forEach(t => add(t.prazo));
    transactions.filter(t => t.status !== 'Concluído').forEach(t => add(t.data));
    processes.filter(p => !p.isArchived && (p.etapa || 'Levantamento') !== 'Concluído' && p.prazo).forEach(p => add(p.prazo));
    compromissos.forEach(c => add(c.data));
    return map;
  }, [tasks, transactions, processes, compromissos]);

  const primeiroDiaSemanaMes = (mes.getDay() + 6) % 7;
  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celulasMes: (Date | null)[] = [
    ...Array(primeiroDiaSemanaMes).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1)),
  ];

  function moverCompromisso(id: string, novaData: string) {
    const c = compromissos.find(x => x.id === id);
    if (!c || c.data === novaData) return;
    updateCompromisso({ ...c, data: novaData, updatedAt: Date.now() });
  }

  function itensDoDia(key: string) {
    const comp = compromissos.filter(c => c.data === key).sort((a, b) => (a.horaInicio || '99:99').localeCompare(b.horaInicio || '99:99'));
    const tarefasDia = tasks.filter(t => t.status !== 'Concluída' && t.prazo === key);
    const cobrancasDia = transactions
      .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído' && t.clienteId && t.data === key)
      .map(t => ({ titulo: `${clients.find(c => c.id === t.clienteId)?.nome || 'Cliente'} — ${t.descricao}`, valor: t.valor }));
    return { comp, tarefasDia, cobrancasDia };
  }

  const detalhe = diaDetalhe ? itensDoDia(diaDetalhe) : null;

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-full">
      <div className="px-[16px] py-[10px] border-b border-3 flex items-center justify-between gap-2 flex-wrap flex-none">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center rounded-lg bg-surface-3 p-0.5">
            <button onClick={() => setModo('semana')} className={cn('px-2.5 h-6 rounded-md text-[11px] font-medium transition-colors', modo === 'semana' ? 'bg-card shadow-sm' : 'text-mute-2')}>Semana</button>
            <button onClick={() => setModo('mes')} className={cn('px-2.5 h-6 rounded-md text-[11px] font-medium transition-colors', modo === 'mes' ? 'bg-card shadow-sm' : 'text-mute-2')}>Mês</button>
          </div>
          <div className="text-[10.5px] text-mute-2 font-mono-hbs">{modo === 'semana' ? rotuloSemana : `${MESES[mes.getMonth()]} ${mes.getFullYear()}`}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onNovo()} className="h-7 px-2.5 rounded-lg border-2 text-[11px] font-medium hover:border-hover transition-colors flex items-center gap-1">
            <Plus className="w-3 h-3" /> Compromisso
          </button>
          <button
            onClick={() => modo === 'semana'
              ? setInicioSemana(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })
              : setMes(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="h-6 w-6 grid place-items-center rounded-md hover:bg-surface-3 text-mute-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => modo === 'semana'
              ? setInicioSemana(() => { const d = new Date(hoje); d.setDate(d.getDate() - d.getDay()); return d; })
              : setMes(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
            className="text-[10.5px] text-accent font-medium px-1"
          >
            hoje
          </button>
          <button
            onClick={() => modo === 'semana'
              ? setInicioSemana(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })
              : setMes(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="h-6 w-6 grid place-items-center rounded-md hover:bg-surface-3 text-mute-2"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {modo === 'semana' ? (
        <div className="grid grid-cols-7 divide-x divide-border flex-1 min-h-0 overflow-hidden">
          {dias.map(d => {
            const key = toKey(d);
            const bucket = porDiaSemana.get(key)!;
            const todosItens = [
              ...bucket.compromissos.map(c => ({ tipo: 'compromisso' as const, c })),
              ...bucket.tarefas.map(t => ({ tipo: 'tarefa' as const, t })),
              ...bucket.cobrancas.map(c => ({ tipo: 'cobranca' as const, c })),
            ];
            const visiveis = todosItens.slice(0, MAX_ITENS_DIA);
            const restante = todosItens.length - visiveis.length;
            const isHoje = key === todayStr;
            return (
              <div
                key={key}
                className={cn('flex flex-col min-h-0', isHoje && 'bg-accent-soft/40')}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragId) moverCompromisso(dragId, key); setDragId(null); }}
              >
                <button onClick={() => setDiaDetalhe(key)} className="px-2 py-1.5 text-center border-b border-3 hover:bg-surface-3 transition-colors flex-none">
                  <div className="text-[9px] uppercase tracking-[.05em] text-mute-2">{DIAS[d.getDay()]}</div>
                  <div className={cn('text-[12.5px] font-semibold', isHoje && 'text-accent')}>{d.getDate()}</div>
                </button>
                <div className={cn('flex-1 min-h-0 overflow-hidden', todosItens.length === 0 ? 'flex' : 'p-1 space-y-1')}>
                  {todosItens.length === 0 && (
                    <button
                      onClick={() => onNovo(key)}
                      className="flex-1 flex flex-col items-center justify-center gap-1 text-mute-3 hover:text-accent hover:bg-surface-3 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="text-[9.5px]">agendar</span>
                    </button>
                  )}
                  {visiveis.map((item, i) => {
                    if (item.tipo === 'compromisso') {
                      const hsl = CORES_COMPROMISSO[item.c.cor] || CORES_COMPROMISSO.roxo;
                      return (
                        <button
                          key={i}
                          draggable
                          onDragStart={() => setDragId(item.c.id)}
                          onDragEnd={() => setDragId(null)}
                          onClick={() => onEditar(item.c)}
                          className="w-full text-left rounded-md px-1.5 py-1 text-[10px] leading-[1.25] transition-opacity hover:opacity-80 cursor-grab active:cursor-grabbing"
                          style={{ backgroundColor: `hsl(${hsl} / .16)`, color: `hsl(${hsl})` }}
                        >
                          <div className="font-medium truncate">{item.c.titulo}</div>
                        </button>
                      );
                    }
                    if (item.tipo === 'tarefa') {
                      return (
                        <div key={i} onClick={() => navigate('/tarefas')} className="flex items-center gap-1 px-1 text-[10px] cursor-pointer hover:text-accent transition-colors">
                          <span className={cn('w-1 h-1 rounded-full flex-none', key < todayStr ? 'bg-destructive' : 'bg-warning')} />
                          <span className="truncate">{item.t.titulo}</span>
                        </div>
                      );
                    }
                    return <div key={i} className="px-1 text-[9.5px] text-destructive truncate">💰 {item.c.titulo}</div>;
                  })}
                  {restante > 0 && (
                    <button onClick={() => setDiaDetalhe(key)} className="px-1 text-[9.5px] text-mute-3 hover:text-accent transition-colors">+{restante} mais</button>
                  )}
                  {todosItens.length > 0 && restante === 0 && (
                    <button
                      onClick={() => onNovo(key)}
                      className="w-full flex items-center gap-1 px-1.5 py-1 rounded-md text-[9.5px] text-mute-3 hover:text-accent hover:bg-surface-3 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> agendar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-[12px] pt-[8px] pb-[8px] flex-1 min-h-0 flex flex-col justify-center">
          <div className="grid grid-cols-7 gap-[3px] text-center">
            {DIAS_SEMANA_MES.map((d, i) => (
              <div key={i} className="text-[9px] text-mute-3 font-medium py-0.5">{d}</div>
            ))}
            {celulasMes.map((d, i) => {
              if (!d) return <div key={i} />;
              const key = toKey(d);
              const qtd = porDiaMes.get(key) || 0;
              const atrasado = qtd > 0 && key < todayStr;
              const isHoje = key === todayStr;
              return (
                <button
                  key={i}
                  onClick={() => setDiaDetalhe(key)}
                  className={cn(
                    'h-[26px] rounded-md flex flex-col items-center justify-center gap-[2px] text-[11px] transition-colors',
                    isHoje ? 'bg-accent-soft text-accent font-semibold' : 'hover:bg-surface-3'
                  )}
                >
                  {d.getDate()}
                  {qtd > 0 && <span className={cn('w-[3px] h-[3px] rounded-full flex-none', atrasado ? 'bg-destructive' : 'bg-warning')} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!diaDetalhe} onOpenChange={v => !v && setDiaDetalhe(null)}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {diaDetalhe && new Date(diaDetalhe + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </DialogTitle>
          </DialogHeader>

          <button
            onClick={() => { if (diaDetalhe) onNovo(diaDetalhe); setDiaDetalhe(null); }}
            className="h-9 px-3 rounded-lg border-2 text-[12.5px] font-medium hover:border-hover transition-colors flex items-center gap-1.5 w-fit"
          >
            <Plus className="w-3.5 h-3.5" /> Novo compromisso
          </button>

          {detalhe && detalhe.comp.length === 0 && detalhe.tarefasDia.length === 0 && detalhe.cobrancasDia.length === 0 && (
            <p className="text-[12.5px] text-muted-foreground py-2">Nada agendado nesse dia.</p>
          )}

          {detalhe && detalhe.comp.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2">Compromissos</div>
              {detalhe.comp.map(c => {
                const hsl = CORES_COMPROMISSO[c.cor] || CORES_COMPROMISSO.roxo;
                return (
                  <button
                    key={c.id}
                    onClick={() => { onEditar(c); setDiaDetalhe(null); }}
                    className="w-full text-left rounded-lg px-3 py-2 text-[12.5px] leading-[1.35] transition-opacity hover:opacity-80"
                    style={{ backgroundColor: `hsl(${hsl} / .16)`, color: `hsl(${hsl})` }}
                  >
                    <div className="font-medium">{c.titulo}</div>
                    {(c.horaInicio || c.comQuem) && (
                      <div className="opacity-80 text-[11px]">
                        {c.horaInicio}{c.horaFim ? `–${c.horaFim}` : ''}{c.comQuem ? `${c.horaInicio ? ' · ' : ''}${c.comQuem}` : ''}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {detalhe && detalhe.tarefasDia.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2">Tarefas</div>
              {detalhe.tarefasDia.map(t => (
                <div key={t.id} onClick={() => navigate('/tarefas')} className="flex items-center gap-2 px-1 text-[12.5px] cursor-pointer hover:text-accent transition-colors">
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-none', diaDetalhe! < todayStr ? 'bg-destructive' : 'bg-warning')} />
                  <span>{t.titulo}</span>
                </div>
              ))}
            </div>
          )}

          {detalhe && detalhe.cobrancasDia.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2">Cobranças</div>
              {detalhe.cobrancasDia.map((c, i) => (
                <div key={i} className="px-1 text-[12.5px] text-destructive">💰 {c.titulo}</div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
