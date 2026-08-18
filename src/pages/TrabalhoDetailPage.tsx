import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, FilePlus2 } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import {
  getProcesses, getClients, getTasks, getDocuments, getHistorico, getContratos,
  updateProcess, addTask, updateTask,
} from '@/lib/storage';
import { computeTrabalhoFinancials } from '@/lib/financials';
import { TrabalhoEtapa } from '@/lib/types';
import { DOCUMENT_REGISTRY } from '@/lib/producao/registry';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ETAPAS: TrabalhoEtapa[] = ['Planejamento', 'Em andamento', 'Aguardando cliente', 'Revisão', 'Concluído'];
const ETAPA_BADGE: Record<TrabalhoEtapa, string> = {
  Planejamento: 'bg-neutral-soft text-mute-2',
  'Em andamento': 'bg-accent-soft text-accent',
  'Aguardando cliente': 'bg-warning-soft text-warning',
  Revisão: 'bg-warning-soft text-warning',
  Concluído: 'bg-success-soft text-success',
};

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TrabalhoDetailPage() {
  const { trabalhoId } = useParams<{ trabalhoId: string }>();
  const navigate = useNavigate();
  const shell = useShell();
  const [key, setKey] = useState(0);
  const [novaTarefa, setNovaTarefa] = useState('');

  const { trabalho, cliente, fin, tasks, documentos, historico, contrato } = useMemo(() => {
    void key; void shell.refreshKey;
    const trabalho = getProcesses().find(p => p.id === trabalhoId) || null;
    if (!trabalho) return { trabalho: null, cliente: null, fin: null, tasks: [], documentos: [], historico: [], contrato: null };
    const cliente = getClients().find(c => c.id === trabalho.clienteId) || null;
    const fin = computeTrabalhoFinancials(trabalho, shell.allTransactions);
    const tasks = getTasks().filter(t => t.processId === trabalho.id).sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
    const documentos = getDocuments().filter(d => d.processId === trabalho.id);
    const historico = getHistorico({ trabalhoId: trabalho.id });
    const contrato = trabalho.contratoId ? getContratos().find(c => c.id === trabalho.contratoId) || null : null;
    return { trabalho, cliente, fin, tasks, documentos, historico, contrato };
  }, [trabalhoId, key, shell.allTransactions, shell.refreshKey]);

  if (!trabalho || !fin) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="text-sm font-semibold">Trabalho não encontrado</p>
        <button onClick={() => navigate('/trabalhos')} className="mt-4 h-9 px-3.5 border-2 rounded-lg text-xs">Voltar para trabalhos</button>
      </div>
    );
  }

  const etapaAtual = trabalho.etapa || 'Planejamento';
  const idxEtapa = ETAPAS.indexOf(etapaAtual);
  const proximaEtapa = ETAPAS[Math.min(idxEtapa + 1, ETAPAS.length - 1)];

  function avancarEtapa() {
    updateProcess({ ...trabalho, etapa: proximaEtapa });
    toast.success(`Trabalho movido para "${proximaEtapa}".`);
    setKey(k => k + 1);
  }

  function toggleTarefa(id: string, done: boolean) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    updateTask({ ...t, status: done ? 'Concluída' : 'Pendente', completedAt: done ? Date.now() : undefined });
    setKey(k => k + 1);
  }

  function adicionarTarefa() {
    if (!novaTarefa.trim()) return;
    addTask({
      id: crypto.randomUUID(), titulo: novaTarefa.trim(), status: 'Pendente', prioridade: 'Média',
      processId: trabalho.id, clienteId: trabalho.clienteId, createdAt: Date.now(), updatedAt: Date.now(),
    });
    setNovaTarefa('');
    setKey(k => k + 1);
  }

  const tarefasConcluidas = tasks.filter(t => t.status === 'Concluída').length;
  const prazoInfo = trabalho.prazo ? Math.round((new Date(trabalho.prazo + 'T12:00:00').getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="flex flex-col gap-[18px] pb-10 animate-hbs-in">
      <button onClick={() => navigate('/trabalhos')} className="self-start text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Trabalhos
      </button>

      <div className="bg-card border border-border rounded-xl p-[18px]">
        <div className="flex flex-wrap gap-3.5 items-start">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[.07em] text-mute-2">{trabalho.tipoTrabalho || 'Trabalho'}</div>
            <div className="text-[20px] font-semibold -tracking-[.02em] mt-1">{trabalho.objeto}</div>
            <div className="text-[12.5px] text-muted-foreground mt-1">
              {trabalho.endereco && <>{trabalho.endereco} · </>}
              Cliente: <button onClick={() => navigate(`/clientes/${trabalho.clienteId}`)} className="text-accent font-medium hover:underline">{cliente?.nome || 'Cliente'}</button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <span className={cn('text-[11.5px] px-2.5 py-[5px] rounded-md font-medium', ETAPA_BADGE[etapaAtual])}>{etapaAtual}</span>
            {etapaAtual !== 'Concluído' && (
              <button onClick={avancarEtapa} className="h-[34px] px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] hover:bg-primary-hover transition-colors">Avançar etapa</button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-px bg-border border border-border rounded-xl overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(212px, 1fr))' }}>
        <div className="bg-card px-[18px] py-[15px]">
          <div className="text-[11px] uppercase tracking-[.07em] text-mute-2">Valor do trabalho</div>
          <div className="font-mono-hbs text-[20px] mt-1.5">{fmt(fin.contratado)}</div>
          <div className="text-[11.5px] text-muted-foreground mt-1">{fmt(fin.recebido)} recebidos</div>
        </div>
        <div className="bg-card px-[18px] py-[15px]">
          <div className="text-[11px] uppercase tracking-[.07em] text-mute-2">Prazo</div>
          <div className={cn('font-mono-hbs text-[20px] mt-1.5', prazoInfo !== null && prazoInfo < 0 && 'text-destructive', prazoInfo !== null && prazoInfo >= 0 && prazoInfo <= 7 && 'text-warning')}>
            {prazoInfo === null ? '—' : prazoInfo < 0 ? `${Math.abs(prazoInfo)}d atraso` : `${prazoInfo} dias`}
          </div>
          <div className="text-[11.5px] text-muted-foreground mt-1">{trabalho.prazo ? `Entrega ${new Date(trabalho.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Sem prazo definido'}</div>
        </div>
        <div className="bg-card px-[18px] py-[15px]">
          <div className="text-[11px] uppercase tracking-[.07em] text-mute-2">Documentação</div>
          <div className="font-mono-hbs text-[20px] mt-1.5">{documentos.filter(d => d.situacao === 'Concluído' || d.situacao === 'Vigente' || d.situacao === 'Entregue').length} / {documentos.length}</div>
          <div className="text-[11.5px] text-muted-foreground mt-1">{documentos.filter(d => d.situacao === 'Pendente' || d.situacao === 'Em produção').length} pendentes</div>
        </div>
        <div className="bg-card px-[18px] py-[15px]">
          <div className="text-[11px] uppercase tracking-[.07em] text-mute-2">Tarefas</div>
          <div className="font-mono-hbs text-[20px] mt-1.5">{tarefasConcluidas} / {tasks.length}</div>
          <div className="text-[11.5px] text-muted-foreground mt-1 truncate">{tasks.find(t => t.status !== 'Concluída')?.titulo || 'Tudo em dia'}</div>
        </div>
      </div>

      <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* Etapas / Tarefas */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-[18px] py-[15px] border-b border-3 text-[13.5px] font-semibold">Tarefas</div>
          {tasks.length === 0 && <div className="px-[18px] py-6 text-xs text-muted-foreground">Nenhuma tarefa ainda.</div>}
          {tasks.map(t => (
            <label key={t.id} className="flex items-center gap-[11px] px-[18px] py-[11px] border-t border-3 cursor-pointer hover:bg-surface-3 transition-colors">
              <input type="checkbox" checked={t.status === 'Concluída'} onChange={e => toggleTarefa(t.id, e.target.checked)} className="w-4 h-4 accent-primary" />
              <span className={cn('text-[12.5px] flex-1 min-w-0', t.status === 'Concluída' && 'line-through text-muted-foreground')}>{t.titulo}</span>
              {t.prazo && <span className={cn('text-[11px] font-mono-hbs text-mute-2', t.prazo < new Date().toISOString().slice(0, 10) && t.status !== 'Concluída' && 'text-destructive')}>{new Date(t.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
            </label>
          ))}
          <div className="flex gap-2 px-[18px] py-3 border-t border-3">
            <Input value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionarTarefa()} placeholder="Nova tarefa…" className="h-8 text-xs" />
            <button onClick={adicionarTarefa} className="h-8 w-8 flex-none grid place-items-center rounded-lg border-2 hover:border-hover transition-colors"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </section>

        <div className="flex flex-col gap-[18px]">
          {/* Documentação */}
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-[18px] py-[15px] border-b border-3 flex items-center justify-between">
              <span className="text-[13.5px] font-semibold">Documentação técnica</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-[11.5px] font-medium text-accent flex items-center gap-1">
                    <FilePlus2 className="w-3.5 h-3.5" /> Gerar documento
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {DOCUMENT_REGISTRY.map(d => (
                    <DropdownMenuItem key={d.slug} onClick={() => navigate(`/producao/${trabalho.id}/${d.slug}`)} className="flex items-center justify-between gap-2">
                      <span>{d.icon} {d.label}</span>
                      {!d.disponivel && <span className="text-[9.5px] text-mute-3 uppercase tracking-wide">em breve</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {documentos.length === 0 ? (
              <div className="px-[18px] py-6 text-xs text-muted-foreground">Nenhum documento vinculado ainda.</div>
            ) : (
              documentos.map(d => (
                <div key={d.id} onClick={() => d.tipoTecnico && navigate(`/producao/${trabalho.id}/${d.tipoTecnico}`)} className={cn('flex items-center gap-[11px] px-[18px] py-[10px] border-t border-3', d.tipoTecnico && 'cursor-pointer hover:bg-surface-3 transition-colors')}>
                  <FileText className="w-3.5 h-3.5 text-mute-2 flex-none" />
                  <span className="text-[12.5px] flex-1 min-w-0 truncate">{d.nome}</span>
                  <span className="text-[11px] text-mute-2">{d.situacao}</span>
                </div>
              ))
            )}
          </section>

          {/* Financeiro */}
          <section className="bg-card border border-border rounded-xl p-[17px_18px]">
            <div className="text-[13.5px] font-semibold">Financeiro do trabalho</div>
            <div className="flex gap-[18px] mt-3.5 flex-wrap">
              <div><div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">Contratado</div><div className="font-mono-hbs text-[18px] mt-1">{fmt(fin.contratado)}</div></div>
              <div><div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">Recebido</div><div className="font-mono-hbs text-[18px] mt-1 text-success">{fmt(fin.recebido)}</div></div>
              <div><div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">A receber</div><div className="font-mono-hbs text-[18px] mt-1 text-destructive">{fmt(fin.aReceber)}</div></div>
            </div>
            {fin.proximoVencimento && (
              <div className="text-[12px] text-muted-foreground mt-3 pt-3 border-t border-3">Próximo vencimento · <strong className="text-foreground font-medium">{fmt(fin.proximoVencimento.valor)} em {new Date(fin.proximoVencimento.data + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>
            )}
            {fin.atrasado > 0 && <div className="text-[12px] text-destructive mt-1.5">{fmt(fin.atrasado)} em atraso</div>}
            {contrato && (
              <div className="text-[11.5px] text-mute-2 mt-3 pt-3 border-t border-3">Origem: contrato {contrato.codigo}{contrato.assinadoEm ? ` · assinado em ${new Date(contrato.assinadoEm).toLocaleDateString('pt-BR')}` : ''}</div>
            )}
          </section>
        </div>
      </div>

      {/* Histórico */}
      <section className="bg-card border border-border rounded-xl p-[17px_18px]">
        <div className="text-[13.5px] font-semibold mb-3.5">Histórico</div>
        {historico.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</p>
        ) : (
          historico.map((h, i) => (
            <div key={h.id} className="flex gap-3">
              <div className="flex flex-col items-center flex-none">
                <span className="w-[7px] h-[7px] rounded-full bg-border-hover mt-[5px]" />
                {i < historico.length - 1 && <span className="flex-1 w-px bg-border" />}
              </div>
              <div className="pb-[15px] min-w-0">
                <div className="text-[12.5px] leading-[1.4]">{h.texto} <span className="text-mute-3">· {h.modulo}</span></div>
                <div className="text-[10.5px] text-mute-3 font-mono-hbs mt-[3px]">{new Date(h.createdAt).toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
