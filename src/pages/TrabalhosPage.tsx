import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { getProcesses, getClients, updateProcess, registrarEvento } from '@/lib/storage';
import { Process, TrabalhoEtapa } from '@/lib/types';
import { NovoTrabalhoDiretoDialog } from '@/components/trabalhos/NovoTrabalhoDiretoDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const COLUNAS: TrabalhoEtapa[] = ['Planejamento', 'Em andamento', 'Aguardando cliente', 'Revisão', 'Concluído'];

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function prazoInfo(prazo?: string): { label: string; color: string } {
  if (!prazo) return { label: '—', color: 'text-mute-2' };
  const dias = Math.round((new Date(prazo + 'T12:00:00').getTime() - Date.now()) / 86400000);
  if (dias < 0) return { label: `parado há ${Math.abs(dias)}d`, color: 'text-destructive' };
  if (dias <= 7) return { label: `${dias}d`, color: 'text-warning' };
  return { label: new Date(prazo + 'T12:00:00').toLocaleDateString('pt-BR'), color: 'text-mute-2' };
}

export default function TrabalhosPage() {
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [key, setKey] = useState(0);
  const [novoOpen, setNovoOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const navigate = useNavigate();

  const { trabalhos, clients, ativos, aguardando } = useMemo(() => {
    void key;
    const trabalhos = getProcesses().filter(p => !p.isArchived);
    const clients = getClients();
    return {
      trabalhos, clients,
      ativos: trabalhos.filter(t => (t.etapa || 'Planejamento') !== 'Concluído').length,
      aguardando: trabalhos.filter(t => t.etapa === 'Aguardando cliente').length,
    };
  }, [key]);

  const clienteNome = (id: string) => clients.find(c => c.id === id)?.nome || 'Cliente';

  function moverEtapa(id: string, etapa: TrabalhoEtapa) {
    const t = trabalhos.find(x => x.id === id);
    if (!t || (t.etapa || 'Planejamento') === etapa) return;
    updateProcess({ ...t, etapa });
    registrarEvento({ modulo: 'Trabalhos', texto: `"${t.objeto}" movido para ${etapa}`, clienteId: t.clienteId, trabalhoId: t.id });
    toast.success(`Movido para ${etapa}.`);
    setKey(k => k + 1);
  }

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-card border-2 rounded-lg overflow-hidden">
            <button onClick={() => setView('kanban')} className={cn('px-3.5 py-2 text-[12.5px]', view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>Kanban</button>
            <button onClick={() => setView('lista')} className={cn('px-3.5 py-2 text-[12.5px]', view === 'lista' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>Lista</button>
          </div>
          <span className="text-[12px] text-mute-2 font-mono-hbs">{ativos} ativos · {aguardando} aguardando cliente</span>
        </div>
        <button onClick={() => setNovoOpen(true)} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Novo trabalho
        </button>
      </div>

      {view === 'kanban' ? (
        <div className="grid gap-3.5 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(228px, 1fr))' }}>
          {COLUNAS.map(col => {
            const items = trabalhos.filter(t => (t.etapa || 'Planejamento') === col);
            return (
              <div
                key={col}
                onDragOver={e => e.preventDefault()}
                onDrop={() => dragId && moverEtapa(dragId, col)}
                className="bg-kanban border border-border rounded-xl p-3"
              >
                <div className="flex items-center justify-between px-1 pb-2.5">
                  <span className="text-[12px] font-semibold">{col}</span>
                  <span className="text-[10.5px] font-mono-hbs text-mute-2">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {items.map(t => {
                    const pi = prazoInfo(t.prazo);
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
                          <span className={cn('text-[10.5px] font-mono-hbs', pi.color)}>{pi.label}</span>
                          {typeof t.valorContrato === 'number' && <span className="text-[11px] font-mono-hbs text-mute-2">{fmt(t.valorContrato)}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && col === 'Concluído' && (
                    <div className="border border-dash border-2 rounded-[9px] py-4 px-3 text-center text-[11.5px] text-mute-2 leading-[1.4]">Nada concluído neste mês.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex gap-3.5 px-[18px] py-[11px] border-b border-border bg-surface-2 text-[10.5px] tracking-[.07em] uppercase text-mute-2">
            <span className="flex-[2.4] min-w-0">Trabalho</span>
            <span className="flex-[1.3] min-w-0">Cliente</span>
            <span className="w-[112px] flex-none">Etapa</span>
            <span className="w-[84px] flex-none">Prazo</span>
            <span className="w-[92px] flex-none text-right">Valor</span>
          </div>
          {trabalhos.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">Nenhum trabalho cadastrado ainda.</div>
          ) : (
            trabalhos.map(t => {
              const pi = prazoInfo(t.prazo);
              const etapa = t.etapa || 'Planejamento';
              return (
                <div key={t.id} onClick={() => navigate(`/trabalhos/${t.id}`)} className="flex gap-3.5 items-center px-[18px] py-3 border-b border-3 last:border-b-0 cursor-pointer hover:bg-surface-3 transition-colors">
                  <div className="flex-[2.4] min-w-0">
                    <div className="text-[12.5px] font-medium truncate">{t.objeto}</div>
                    {t.tipoTrabalho && <div className="text-[10.5px] uppercase tracking-[.05em] text-mute-2">{t.tipoTrabalho}</div>}
                  </div>
                  <span className="flex-[1.3] min-w-0 text-[12.5px] text-muted-foreground truncate">{clienteNome(t.clienteId)}</span>
                  <span className="w-[112px] flex-none text-[11px] px-2 py-[3px] rounded-[5px] bg-neutral-soft text-mute-2 font-medium">{etapa}</span>
                  <span className={cn('w-[84px] flex-none text-[11px] font-mono-hbs', pi.color)}>{pi.label}</span>
                  <span className="w-[92px] flex-none text-right text-[12px] font-mono-hbs text-mute-2">{typeof t.valorContrato === 'number' ? fmt(t.valorContrato) : '—'}</span>
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
