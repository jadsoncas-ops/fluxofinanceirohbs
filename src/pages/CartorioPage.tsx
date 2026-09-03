import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollText, ShieldAlert, ChevronRight } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getProcesses, getClients, getTasks, getPropostas } from '@/lib/storage';
import { computeAttentionItems } from '@/lib/attention';
import { computeCartorioProgress } from '@/lib/cartorio';
import { Stepper } from '@/components/ui/Stepper';
import { cn } from '@/lib/utils';

export default function CartorioPage() {
  const shell = useShell();
  const navigate = useNavigate();

  const { itensAtencao, trabalhos } = useMemo(() => {
    void shell.refreshKey;
    const processes = getProcesses().filter(p => !p.isArchived);
    const clients = getClients();
    const tasks = getTasks();
    const propostas = getPropostas();
    const itensAtencao = computeAttentionItems(shell.allTransactions, clients, tasks, processes, propostas)
      .filter(i => i.tipo === 'Cartorio');

    const trabalhos = processes
      .map(p => {
        const progress = computeCartorioProgress(p.registro);
        if (!progress.temRegistro) return null;
        const cliente = clients.find(c => c.id === p.clienteId);
        return { processo: p, cliente, progress };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => {
        const urgenciaA = a.progress.exigenciasAbertas.length > 0 ? 0 : (a.progress.prenotacaoDiasRestantes ?? 999) < 7 ? 1 : 2;
        const urgenciaB = b.progress.exigenciasAbertas.length > 0 ? 0 : (b.progress.prenotacaoDiasRestantes ?? 999) < 7 ? 1 : 2;
        return urgenciaA - urgenciaB;
      });

    return { itensAtencao, trabalhos };
  }, [shell.allTransactions, shell.refreshKey]);

  return (
    <div className="flex flex-col gap-[18px] pb-10 animate-hbs-in">
      <div>
        <h1 className="text-[19px] font-semibold -tracking-[.02em] leading-tight">Cartório & Registros</h1>
        <p className="text-[11px] text-mute-2 font-mono-hbs mt-0.5">Visão cross-projeto do trâmite em cartório — {trabalhos.length} trabalho{trabalhos.length !== 1 ? 's' : ''} com registro em andamento.</p>
      </div>

      {itensAtencao.length > 0 && (
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-[18px] py-[13px] border-b border-3 text-[13px] font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-warning" /> Precisa de atenção
          </div>
          {itensAtencao.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.to)}
              className="w-full flex items-center gap-3 px-[18px] py-[11px] border-t border-3 first:border-t-0 hover:bg-surface-3 transition-colors text-left"
            >
              <span className={cn('w-1.5 h-1.5 rounded-full flex-none', item.severity === 'critical' ? 'bg-destructive' : 'bg-warning')} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium truncate">{item.title}</div>
                <div className="text-[11px] text-mute-2 truncate">{item.sub}</div>
              </div>
              <span className="text-[11px] text-accent font-medium flex-none flex items-center gap-0.5">{item.cta} <ChevronRight className="w-3 h-3" /></span>
            </button>
          ))}
        </section>
      )}

      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-[18px] py-[13px] border-b border-3 text-[13px] font-semibold flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-mute-2" /> Trabalhos em trâmite
        </div>
        {trabalhos.length === 0 ? (
          <div className="px-[18px] py-8 text-center text-xs text-muted-foreground">Nenhum trabalho com registro em cartório iniciado ainda.</div>
        ) : (
          trabalhos.map(({ processo, cliente, progress }) => (
            <button
              key={processo.id}
              onClick={() => navigate(`/trabalhos/${processo.id}`)}
              className="w-full flex flex-col gap-2 px-[18px] py-[13px] border-t border-3 first:border-t-0 hover:bg-surface-3 transition-colors text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{processo.objeto}</div>
                  <div className="text-[11px] text-mute-2 truncate">{cliente?.nome || 'Cliente'}{processo.registro?.protocolo ? ` · protocolo ${processo.registro.protocolo}` : ''}</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-mute-3 flex-none" />
              </div>
              <Stepper stages={progress.stages} />
            </button>
          ))
        )}
      </section>
    </div>
  );
}
