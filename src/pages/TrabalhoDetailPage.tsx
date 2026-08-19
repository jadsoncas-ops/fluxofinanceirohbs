import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, FilePlus2, Trash2, CheckCircle2, Pencil, Clock3, Check } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import {
  getProcesses, getClients, getTasks, getDocuments, getHistorico, getContratos,
  updateProcess, addTask, updateTask, deleteTask, deleteProcess, deleteDocument, deleteTransaction, addTransaction, registrarEvento,
} from '@/lib/storage';
import { computeTrabalhoFinancials } from '@/lib/financials';
import { TrabalhoEtapa } from '@/lib/types';
import { DOCUMENT_REGISTRY } from '@/lib/producao/registry';
import { NovoRepasseDialog } from '@/components/trabalhos/NovoRepasseDialog';
import { NovoRecebimentoDialog } from '@/components/NovoRecebimentoDialog';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
  const [repasseOpen, setRepasseOpen] = useState(false);
  const [recebimentoOpen, setRecebimentoOpen] = useState(false);
  const [recebimentoValorInicial, setRecebimentoValorInicial] = useState<number | undefined>(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editandoContratado, setEditandoContratado] = useState(false);
  const [contratadoInput, setContratadoInput] = useState('');
  const [novoLancamentoAberto, setNovoLancamentoAberto] = useState(false);
  const [novoTipo, setNovoTipo] = useState<'Receita' | 'Despesa'>('Receita');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [novaData, setNovaData] = useState(() => new Date().toISOString().slice(0, 10));
  const [novoJaAconteceu, setNovoJaAconteceu] = useState(false);

  const { trabalho, cliente, fin, tasks, documentos, historico, contrato, lancamentos } = useMemo(() => {
    void key; void shell.refreshKey;
    const trabalho = getProcesses().find(p => p.id === trabalhoId) || null;
    if (!trabalho) return { trabalho: null, cliente: null, fin: null, tasks: [], documentos: [], historico: [], contrato: null, lancamentos: [] };
    const cliente = getClients().find(c => c.id === trabalho.clienteId) || null;
    const fin = computeTrabalhoFinancials(trabalho, shell.allTransactions);
    const tasks = getTasks().filter(t => t.processId === trabalho.id).sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
    const documentos = getDocuments().filter(d => d.processId === trabalho.id);
    const historico = getHistorico({ trabalhoId: trabalho.id });
    const contrato = trabalho.contratoId ? getContratos().find(c => c.id === trabalho.contratoId) || null : null;
    const lancamentos = shell.allTransactions.filter(t => t.processId === trabalho.id && !t.parentId).sort((a, b) => a.data.localeCompare(b.data));
    return { trabalho, cliente, fin, tasks, documentos, historico, contrato, lancamentos };
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

  function removerTarefa(id: string) {
    deleteTask(id);
    setKey(k => k + 1);
  }

  function salvarContratado() {
    const valor = parseFloat(contratadoInput.replace(',', '.')) || 0;
    updateProcess({ ...trabalho, valorContrato: valor });
    setEditandoContratado(false);
    setKey(k => k + 1);
  }

  function adicionarLancamentoRapido() {
    if (!novaDescricao.trim()) { toast.error('Descreva o lançamento.'); return; }
    const valor = parseFloat(novoValor.replace(',', '.')) || 0;
    if (valor <= 0) { toast.error('Informe um valor.'); return; }
    const isIncome = novoTipo === 'Receita';
    addTransaction({
      id: crypto.randomUUID(),
      data: novaData,
      tipo: isIncome ? 'A Receber' : 'A Pagar',
      categoria: isIncome ? '📐 Elaboração de Projeto' : '⚙️ Custos operacionais',
      descricao: novaDescricao.trim(),
      valor,
      status: novoJaAconteceu ? 'Concluído' : 'Pendente',
      isRepasse: false,
      clienteId: trabalho.clienteId,
      processId: trabalho.id,
    });
    registrarEvento({
      modulo: 'Financeiro',
      texto: `${isIncome ? 'Receita' : 'Despesa'} ${novoJaAconteceu ? 'registrada' : 'prevista'} — ${novaDescricao.trim()} — ${fmt(valor)}`,
      clienteId: trabalho.clienteId,
      trabalhoId: trabalho.id,
    });
    toast.success('Lançamento adicionado.');
    setNovaDescricao(''); setNovoValor(''); setNovaData(new Date().toISOString().slice(0, 10)); setNovoJaAconteceu(false);
    setNovoLancamentoAberto(false);
    shell.refresh();
  }

  function removerLancamento(id: string, descricao: string) {
    if (confirm(`Excluir o lançamento "${descricao}"? Esta ação não pode ser desfeita.`)) {
      deleteTransaction(id);
      toast.success('Lançamento excluído.');
      shell.refresh();
    }
  }

  function removerDocumento(id: string, nome: string) {
    if (confirm(`Remover "${nome}"? Isso não afeta o Trabalho, só o registro do documento.`)) {
      deleteDocument(id);
      toast.success('Documento removido.');
      setKey(k => k + 1);
    }
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

  function handleDeleteTrabalho() {
    documentos.forEach(d => deleteDocument(d.id));
    deleteProcess(trabalho.id);
    toast.success('Trabalho excluído.');
    navigate('/trabalhos');
  }

  return (
    <div className="flex flex-col gap-[18px] pb-10 animate-hbs-in">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/trabalhos')} className="self-start text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Trabalhos
        </button>
        <button onClick={() => setDeleteOpen(true)} className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
          <Trash2 className="w-3.5 h-3.5" /> Excluir trabalho
        </button>
      </div>

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
            <div key={t.id} className="group flex items-center gap-[11px] px-[18px] py-[11px] border-t border-3 hover:bg-surface-3 transition-colors">
              <label className="flex items-center gap-[11px] flex-1 min-w-0 cursor-pointer">
                <input type="checkbox" checked={t.status === 'Concluída'} onChange={e => toggleTarefa(t.id, e.target.checked)} className="w-4 h-4 accent-primary flex-none" />
                <span className={cn('text-[12.5px] flex-1 min-w-0', t.status === 'Concluída' && 'line-through text-muted-foreground')}>{t.titulo}</span>
              </label>
              {t.prazo && <span className={cn('text-[11px] font-mono-hbs text-mute-2', t.prazo < new Date().toISOString().slice(0, 10) && t.status !== 'Concluída' && 'text-destructive')}>{new Date(t.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
              <button onClick={() => removerTarefa(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-mute-3 hover:text-destructive flex-none">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
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
                <div key={d.id} className={cn('group flex items-center gap-[11px] px-[18px] py-[10px] border-t border-3 hover:bg-surface-3 transition-colors')}>
                  <FileText className="w-3.5 h-3.5 text-mute-2 flex-none" />
                  <div className="flex-1 min-w-0">
                    <button onClick={() => d.tipoTecnico && navigate(`/producao/${trabalho.id}/${d.tipoTecnico}`)} className={cn('text-[12.5px] block truncate text-left', d.tipoTecnico && 'hover:underline')}>{d.nome}</button>
                    <div className="text-[10.5px] text-mute-3 font-mono-hbs">{d.versao ? `v${d.versao} · ` : ''}atualizado {new Date(d.updatedAt).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <span className="text-[11px] text-mute-2">{d.situacao}</span>
                  <button onClick={() => removerDocumento(d.id, d.nome)} className="opacity-0 group-hover:opacity-100 transition-opacity text-mute-3 hover:text-destructive flex-none">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </section>

          {/* Financeiro */}
          <section className="bg-card border border-border rounded-xl p-[17px_18px]">
            <div className="text-[13.5px] font-semibold">Financeiro do trabalho</div>

            <div className="flex gap-[22px] mt-3.5 flex-wrap items-start">
              <div>
                <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">Contratado</div>
                {editandoContratado ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Input
                      type="number"
                      autoFocus
                      value={contratadoInput}
                      onChange={e => setContratadoInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && salvarContratado()}
                      className="h-8 w-28 text-[15px] font-mono-hbs px-2"
                    />
                    <button onClick={salvarContratado} className="h-7 w-7 grid place-items-center rounded-lg bg-primary text-primary-foreground flex-none"><Check className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button onClick={() => { setContratadoInput(String(fin.contratado || '')); setEditandoContratado(true); }} className="font-mono-hbs text-[18px] mt-1 hover:text-accent transition-colors flex items-center gap-1.5 group">
                    {fmt(fin.contratado)}
                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                )}
              </div>
              <div><div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">Recebido</div><div className="font-mono-hbs text-[18px] mt-1 text-success">{fmt(fin.recebido)}</div></div>
              <div><div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">A receber</div><div className="font-mono-hbs text-[18px] mt-1 text-destructive">{fmt(fin.aReceber)}</div></div>
              <div><div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">Sobrou até agora</div><div className="font-mono-hbs text-[18px] mt-1">{fmt(fin.resultadoRealizado)}</div></div>
            </div>

            {fin.semParcelaRegistrada > 0 && (
              <div className="flex items-center justify-between gap-3 bg-warning-soft text-warning rounded-lg px-3 py-2.5 mt-3 text-[12px]">
                <span>{fmt(fin.semParcelaRegistrada)} do valor contratado ainda não tem parcela registrada como a receber.</span>
                <button onClick={() => { setRecebimentoValorInicial(fin.semParcelaRegistrada); setRecebimentoOpen(true); }} className="h-7 px-2.5 rounded-lg bg-warning text-white text-[11px] font-medium flex-none whitespace-nowrap">Registrar como a receber</button>
              </div>
            )}

            {(fin.repassado > 0 || fin.repasseAPagar > 0 || fin.proximoVencimento || fin.atrasado > 0) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground mt-3 pt-3 border-t border-3">
                {(fin.repassado > 0 || fin.repasseAPagar > 0) && <span>Repassado a parceiros: <strong className="text-foreground font-medium">{fmt(fin.repassado)}</strong>{fin.repasseAPagar > 0 && ` (+ ${fmt(fin.repasseAPagar)} previsto)`}</span>}
                {fin.proximoVencimento && <span>Próximo vencimento: <strong className="text-foreground font-medium">{fmt(fin.proximoVencimento.valor)} em {new Date(fin.proximoVencimento.data + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>}
                {fin.atrasado > 0 && <span className="text-destructive">{fmt(fin.atrasado)} em atraso</span>}
              </div>
            )}
            {contrato && (
              <div className="text-[11.5px] text-mute-2 mt-2">Origem: contrato {contrato.codigo}{contrato.assinadoEm ? ` · assinado em ${new Date(contrato.assinadoEm).toLocaleDateString('pt-BR')}` : ''}</div>
            )}

            <div className="mt-4 pt-4 border-t border-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-[.07em] text-mute-2">Lançamentos</div>
                <div className="flex items-center gap-3">
                  {!novoLancamentoAberto && (
                    <button onClick={() => setNovoLancamentoAberto(true)} className="text-[11.5px] font-medium text-accent flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  )}
                </div>
              </div>

              {novoLancamentoAberto && (
                <div className="bg-surface-2 border border-3 rounded-lg p-3 mb-3 space-y-2.5">
                  <div className="flex bg-card border-2 rounded-lg overflow-hidden w-fit">
                    <button onClick={() => setNovoTipo('Receita')} className={cn('px-3 py-1.5 text-[11.5px] font-medium', novoTipo === 'Receita' ? 'bg-success text-white' : 'text-muted-foreground')}>Receita</button>
                    <button onClick={() => setNovoTipo('Despesa')} className={cn('px-3 py-1.5 text-[11.5px] font-medium', novoTipo === 'Despesa' ? 'bg-warning text-white' : 'text-muted-foreground')}>Despesa</button>
                  </div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                    <Input value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} placeholder="Descrição (ex: Parcela 2)" className="h-8 text-xs" autoFocus />
                    <Input type="number" value={novoValor} onChange={e => setNovoValor(e.target.value)} placeholder="Valor" className="h-8 text-xs" />
                    <Input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-[11.5px] text-mute-2 cursor-pointer">
                      <input type="checkbox" checked={novoJaAconteceu} onChange={e => setNovoJaAconteceu(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
                      {novoTipo === 'Receita' ? 'Já recebi' : 'Já paguei'}
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => setNovoLancamentoAberto(false)} className="h-7 px-2.5 rounded-lg text-[11.5px] text-muted-foreground">Cancelar</button>
                      <button onClick={adicionarLancamentoRapido} className="h-7 px-3 bg-primary text-primary-foreground rounded-lg text-[11.5px] font-medium">Adicionar</button>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1 border-t border-3">
                    <button onClick={() => { setNovoLancamentoAberto(false); setRecebimentoValorInicial(undefined); setRecebimentoOpen(true); }} className="text-[10.5px] text-mute-2 hover:text-accent underline">Receita parcelada em várias vezes</button>
                    <button onClick={() => { setNovoLancamentoAberto(false); setRepasseOpen(true); }} className="text-[10.5px] text-mute-2 hover:text-accent underline">Repasse a um parceiro</button>
                  </div>
                </div>
              )}

              {lancamentos.length === 0 && !novoLancamentoAberto ? (
                <div className="text-xs text-muted-foreground py-2">Nenhum lançamento ainda.</div>
              ) : (
                lancamentos.map(t => {
                  const isIncome = t.tipo === 'Entrada' || t.tipo === 'A Receber';
                  const isPendente = t.status !== 'Concluído';
                  const isAtrasado = isPendente && t.data < new Date().toISOString().slice(0, 10);
                  return (
                    <div key={t.id} className="group flex items-center gap-2.5 py-2 border-t border-3 first:border-t-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-medium truncate">{t.descricao}</div>
                        <div className="text-[10.5px] text-mute-3 font-mono-hbs">{new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                      </div>
                      <span className={cn('font-mono-hbs text-[12.5px]', isIncome ? 'text-success' : 'text-warning')}>{fmt(t.valor)}</span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-[2px] rounded-[4px] font-medium flex items-center gap-1 flex-none',
                        t.status === 'Concluído' ? 'bg-success-soft text-success' : isAtrasado ? 'bg-destructive-soft text-destructive' : 'bg-warning-soft text-warning'
                      )}>
                        {t.status === 'Concluído' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock3 className="w-2.5 h-2.5" />}
                        {t.status === 'Concluído' ? (isIncome ? 'Recebida' : 'Paga') : isAtrasado ? 'Atrasada' : 'Prevista'}
                      </span>
                      <div className="flex-none flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isPendente && (
                          <button onClick={() => shell.openCompleteTransaction(t)} className="h-6 w-6 grid place-items-center rounded-md hover:bg-success-soft text-mute-2 hover:text-success" title={isIncome ? 'Marcar como recebida' : 'Marcar como paga'}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => shell.openEditTransaction(t)} className="h-6 w-6 grid place-items-center rounded-md hover:bg-surface-3 text-mute-2" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removerLancamento(t.id, t.descricao)} className="h-6 w-6 grid place-items-center rounded-md hover:bg-destructive-soft text-mute-2 hover:text-destructive" title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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

      <NovoRepasseDialog open={repasseOpen} onClose={() => setRepasseOpen(false)} trabalho={trabalho} onCreated={() => shell.refresh()} />
      <NovoRecebimentoDialog
        open={recebimentoOpen}
        onClose={() => setRecebimentoOpen(false)}
        trabalhoFixo={trabalho}
        valorInicial={recebimentoValorInicial}
        descricaoInicial={recebimentoValorInicial ? 'Saldo restante do contrato' : undefined}
        onCreated={() => shell.refresh()}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir trabalho</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{trabalho.objeto}"? Isso remove o trabalho, suas tarefas e os documentos vinculados. Os lançamentos financeiros deste trabalho também são removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTrabalho} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
