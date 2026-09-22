import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { getProcesses, getClients, getTransactions, updateProcess, registrarEvento } from '@/lib/storage';
import { Process, TrabalhoEtapa } from '@/lib/types';
import { NovoTrabalhoDiretoDialog } from '@/components/trabalhos/NovoTrabalhoDiretoDialog';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const COLUNAS: TrabalhoEtapa[] = ['Aguardando cliente', 'Levantamento', 'Tramitando', 'Devolutiva', 'Concluído'];

// Mesmo padrão de tom por etapa já usado em ClienteDetailPage.tsx (Fase Clientes) — reaproveitado
// aqui tal como está, sem virar um util compartilhado ainda. Se essa duplicação (2 arquivos até
// agora) crescer, uma fase futura de Design System/limpeza pode extrair um único ETAPA_TONE.
const ETAPA_TONE: Record<string, BadgeTone> = {
  'Aguardando cliente': 'warning',
  Levantamento: 'neutral',
  Tramitando: 'accent',
  Devolutiva: 'destructive',
  Concluído: 'success',
};
const TONE_TEXT_CLASS: Record<BadgeTone, string> = {
  destructive: 'text-destructive', warning: 'text-warning', success: 'text-success', neutral: 'text-mute-2', accent: 'text-accent',
};

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function prazoInfo(prazo?: string, etapa?: TrabalhoEtapa): { label: string; tone: BadgeTone } {
  if (etapa === 'Concluído') return { label: 'Entregue', tone: 'success' };
  if (!prazo) return { label: '—', tone: 'neutral' };
  const dias = Math.round((new Date(prazo + 'T12:00:00').getTime() - Date.now()) / 86400000);
  if (dias < 0) return { label: `Vencido há ${Math.abs(dias)}d`, tone: 'destructive' };
  if (dias <= 7) return { label: `${dias}d`, tone: 'warning' };
  return { label: new Date(prazo + 'T12:00:00').toLocaleDateString('pt-BR'), tone: 'neutral' };
}

export default function TrabalhosPage() {
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [key, setKey] = useState(0);
  const [novoOpen, setNovoOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { trabalhos, clients, ativos, aguardando, proximoPagamentoPorTrabalho } = useMemo(() => {
    void key;
    const trabalhos = getProcesses().filter(p => !p.isArchived);
    const clients = getClients();

    const proximoPagamentoPorTrabalho = new Map<string, { data: string; valor: number }>();
    getTransactions()
      .filter(t => t.processId && t.tipo === 'A Receber' && (t.status === 'Pendente' || t.status === 'Parcial'))
      .sort((a, b) => a.data.localeCompare(b.data))
      .forEach(t => {
        if (!proximoPagamentoPorTrabalho.has(t.processId!)) {
          proximoPagamentoPorTrabalho.set(t.processId!, { data: t.data, valor: t.valor });
        }
      });

    return {
      trabalhos, clients, proximoPagamentoPorTrabalho,
      ativos: trabalhos.filter(t => (t.etapa || 'Levantamento') !== 'Concluído').length,
      aguardando: trabalhos.filter(t => t.etapa === 'Aguardando cliente').length,
    };
  }, [key]);

  const clienteNome = (id: string) => clients.find(c => c.id === id)?.nome || 'Cliente';

  // Busca simples client-side — cliente/objeto/tipo de trabalho, mesmo padrão de ClientsList.
  // Aplicada antes de Kanban/Lista lerem os dados, então os dois modos sempre mostram o mesmo
  // conjunto filtrado.
  const trabalhosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trabalhos;
    return trabalhos.filter(t =>
      t.objeto.toLowerCase().includes(q) ||
      (t.tipoTrabalho || '').toLowerCase().includes(q) ||
      clienteNome(t.clienteId).toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabalhos, clients, search]);

  const semResultado = search.trim().length > 0 && trabalhosFiltrados.length === 0;

  function moverEtapa(id: string, etapa: TrabalhoEtapa) {
    const t = trabalhos.find(x => x.id === id);
    if (!t || (t.etapa || 'Levantamento') === etapa) return;
    updateProcess({ ...t, etapa });
    registrarEvento({ modulo: 'Trabalhos', texto: `"${t.objeto}" movido para ${etapa}`, clienteId: t.clienteId, trabalhoId: t.id });
    toast.success(`Movido para ${etapa}.`);
    setKey(k => k + 1);
  }

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-surface-2 p-1 rounded-xl border border-3">
            <button onClick={() => setView('kanban')} className={cn('px-3 py-[6px] rounded-lg text-[12px] font-medium transition-colors', view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>Kanban</button>
            <button onClick={() => setView('lista')} className={cn('px-3 py-[6px] rounded-lg text-[12px] font-medium transition-colors', view === 'lista' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>Lista</button>
          </div>
          <span className="text-[12px] text-mute-2 font-mono-hbs">{ativos} ativos · {aguardando} aguardando cliente</span>
        </div>
        <button onClick={() => setNovoOpen(true)} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Novo trabalho
        </button>
      </div>

      <Input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por cliente, objeto ou tipo de trabalho..."
        className="h-9 text-[13px] border-2 max-w-md"
      />

      {semResultado ? (
        <div className="bg-card border border-dash border-2 rounded-xl py-16 text-center">
          <p className="text-sm font-semibold">Nenhum trabalho encontrado</p>
          <p className="text-xs text-muted-foreground mt-1.5">Tente buscar por outro cliente, objeto ou tipo de trabalho.</p>
        </div>
      ) : view === 'kanban' ? (
        <div className="grid gap-3.5 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(228px, 1fr))' }}>
          {COLUNAS.map(col => {
            const items = trabalhosFiltrados.filter(t => (t.etapa || 'Levantamento') === col);
            return (
              <div
                key={col}
                onDragOver={e => e.preventDefault()}
                onDrop={() => dragId && moverEtapa(dragId, col)}
                className="bg-kanban border border-border rounded-xl p-3 flex flex-col max-h-[calc(100vh-280px)] min-h-[160px]"
              >
                <div className="flex items-center justify-between px-1 pb-2.5 flex-none">
                  <span className="text-[12px] font-semibold">{col}</span>
                  <span className="text-[10.5px] font-mono-hbs text-mute-2">{items.length}</span>
                </div>
                {/* Só esta lista rola — o cabeçalho da coluna (nome + contador) fica sempre visível,
                    então dá pra ver todas as colunas ao arrastar um card mesmo quando uma delas tem
                    muitos itens (ex.: Tramitando). */}
                <div className="flex flex-col gap-2.5 overflow-y-auto pr-0.5">
                  {items.map(t => {
                    const pi = prazoInfo(t.prazo, col);
                    const proximo = proximoPagamentoPorTrabalho.get(t.id);
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => navigate(`/trabalhos/${t.id}`)}
                        className="bg-card border border-border rounded-[9px] p-3 cursor-grab active:cursor-grabbing hover:shadow-card-hover hover:-translate-y-px transition-all"
                      >
                        {t.tipoTrabalho && <div className="text-[10px] uppercase tracking-[.06em] text-mute-2 mb-1">{t.tipoTrabalho}</div>}
                        <div className="text-[12.5px] font-medium leading-[1.35]">{t.objeto}</div>
                        <div className="text-[11px] text-mute-2 mt-1">{clienteNome(t.clienteId)}</div>
                        <div className="flex items-center justify-between mt-2.5">
                          <StatusBadge tone={pi.tone}>{pi.label}</StatusBadge>
                          {typeof t.valorContrato === 'number' && <span className="text-[11px] font-mono-hbs text-mute-2">{fmt(t.valorContrato)}</span>}
                        </div>
                        {proximo && (
                          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/60">
                            <span className="text-[9.5px] uppercase tracking-[.04em] text-mute-2">Próx. recebimento</span>
                            <span className="text-[10.5px] font-mono-hbs text-accent">
                              {new Date(proximo.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {fmt(proximo.valor)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="border border-dash border-2 rounded-[9px] py-4 px-3 text-center text-[11.5px] text-mute-2 leading-[1.4]">Nenhum trabalho nesta etapa.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="hidden sm:flex gap-3.5 px-[18px] py-[11px] border-b border-border bg-surface-2 text-[10.5px] tracking-[.07em] uppercase text-mute-2">
            <span className="flex-[2.4] min-w-0">Trabalho</span>
            <span className="flex-[1.3] min-w-0">Cliente</span>
            <span className="w-[112px] flex-none">Etapa</span>
            <span className="w-[84px] flex-none">Prazo</span>
            <span className="w-[92px] flex-none text-right">Valor</span>
          </div>
          {trabalhos.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm text-muted-foreground">Nenhum trabalho cadastrado ainda.</p>
            </div>
          ) : (
            trabalhosFiltrados.map(t => {
              const etapa = t.etapa || 'Levantamento';
              const pi = prazoInfo(t.prazo, etapa);
              return (
                <div key={t.id} onClick={() => navigate(`/trabalhos/${t.id}`)} className="flex flex-col sm:flex-row gap-1.5 sm:gap-3.5 sm:items-center px-[18px] py-3 border-b border-3 last:border-b-0 cursor-pointer hover:bg-surface-3 transition-colors">
                  <div className="flex-[2.4] min-w-0">
                    <div className="text-[12.5px] font-medium sm:truncate">{t.objeto}</div>
                    {t.tipoTrabalho && <div className="text-[10.5px] uppercase tracking-[.05em] text-mute-2">{t.tipoTrabalho}</div>}
                  </div>
                  <span className="hidden sm:block flex-[1.3] min-w-0 text-[12.5px] text-muted-foreground truncate">{clienteNome(t.clienteId)}</span>

                  {/* Mobile: cliente + etapa + prazo + valor numa linha só, com legenda embutida */}
                  <div className="flex sm:hidden flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px]">
                    <span className="text-muted-foreground">{clienteNome(t.clienteId)}</span>
                    <StatusBadge tone={ETAPA_TONE[etapa]}>{etapa}</StatusBadge>
                    <span className={cn('font-mono-hbs', TONE_TEXT_CLASS[pi.tone])}>{pi.label}</span>
                    {typeof t.valorContrato === 'number' && <span className="font-mono-hbs text-mute-2">{fmt(t.valorContrato)}</span>}
                  </div>

                  <span className="hidden sm:block w-[112px] flex-none"><StatusBadge tone={ETAPA_TONE[etapa]}>{etapa}</StatusBadge></span>
                  <span className={cn('hidden sm:block w-[84px] flex-none text-[11px] font-mono-hbs', TONE_TEXT_CLASS[pi.tone])}>{pi.label}</span>
                  <span className="hidden sm:block w-[92px] flex-none text-right text-[12px] font-mono-hbs text-mute-2">{typeof t.valorContrato === 'number' ? fmt(t.valorContrato) : '—'}</span>
                </div>
              );
            })
          )}
        </div>
      )}

      <NovoTrabalhoDiretoDialog open={novoOpen} onClose={() => setNovoOpen(false)} onCreated={(id) => { setKey(k => k + 1); navigate(`/trabalhos/${id}`); }} />
    </div>
  );
}
