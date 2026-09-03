import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShell } from '@/hooks/use-shell';
import { ArrowLeft, Plus, ExternalLink, ArrowRight, Trash2, MessageCircle } from 'lucide-react';
import {
  getClients, getProcesses, getDocuments, getPropostas, getContratos, getHistorico, deleteClient, getCompanyConfig,
  getTasks, addTask, updateTask, deleteTask, addTransaction, registrarEvento,
} from '@/lib/storage';
import { computeClientFinancials, computeTrabalhoFinancials } from '@/lib/financials';
import { formatBRL } from '@/lib/comercial/precificacao';
import { montarMensagemBoasVindas, linkWhatsApp } from '@/lib/mensagens';
import { ClientForm } from '@/components/ClientForm';
import { PropostaDetailDialog } from '@/components/comercial/PropostaDetailDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const propostaBadge: Record<string, string> = {
  Rascunho: 'bg-neutral-soft text-mute-2',
  Enviada: 'bg-accent-soft text-accent',
  'Em aprovação': 'bg-warning-soft text-warning',
  Aprovada: 'bg-success-soft text-success',
  Perdida: 'bg-destructive-soft text-destructive',
};

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const etapaBadge: Record<string, string> = {
  'Aguardando cliente': 'bg-warning-soft text-warning',
  Levantamento: 'bg-neutral-soft text-mute-2',
  Tramitando: 'bg-accent-soft text-accent',
  Devolutiva: 'bg-destructive-soft text-destructive',
  Concluído: 'bg-success-soft text-success',
};

export default function ClienteDetailPage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  const shell = useShell();
  const [editOpen, setEditOpen] = useState(false);
  const [localKey, setLocalKey] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [propostaAberta, setPropostaAberta] = useState<string | null>(null);
  const [boasVindasOpen, setBoasVindasOpen] = useState(false);
  const [mensagemBoasVindas, setMensagemBoasVindas] = useState('');
  const [novaTarefa, setNovaTarefa] = useState('');
  const [novaTarefaPrazo, setNovaTarefaPrazo] = useState('');
  const [novoLancamentoAberto, setNovoLancamentoAberto] = useState(false);
  const [novoTipo, setNovoTipo] = useState<'Receita' | 'Despesa'>('Receita');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [novaData, setNovaData] = useState(() => new Date().toISOString().slice(0, 10));
  const [novoJaAconteceu, setNovoJaAconteceu] = useState(false);

  const { client, processes, financials, txs, documents, propostas, contratos, eventos, trabalhoPendente, tasks } = useMemo(() => {
    void shell.refreshKey;
    void localKey;
    const clients = getClients();
    const client = clients.find(c => c.id === clienteId) || null;
    const processes = getProcesses().filter(p => p.clienteId === clienteId);
    const txs = shell.allTransactions
      .filter(t => t.clienteId === clienteId)
      .sort((a, b) => b.data.localeCompare(a.data));
    const financials = clienteId ? computeClientFinancials(clienteId, shell.allTransactions, getProcesses()) : null;
    const documents = getDocuments().filter(d => d.clienteId === clienteId || processes.some(p => p.id === d.processId));
    const propostas = clienteId ? getPropostas().filter(p => p.clienteId === clienteId) : [];
    const contratos = clienteId ? getContratos().filter(c => c.clienteId === clienteId) : [];
    const eventos = clienteId ? getHistorico({ clienteId }) : [];
    const tasks = clienteId ? getTasks().filter(t => t.clienteId === clienteId).sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999')) : [];

    // Trabalho com a pendência mais urgente deste cliente — pra ir direto lá da caixa de
    // Financeiro em vez de precisar achar na lista de Trabalhos (é lá que se edita o valor).
    const trabalhoPendente = processes
      .map(p => ({ p, fin: computeTrabalhoFinancials(p, shell.allTransactions) }))
      .filter(x => x.fin.atrasado > 0 || x.fin.aReceber > 0)
      .sort((a, b) => (b.fin.atrasado - a.fin.atrasado) || (b.fin.aReceber - a.fin.aReceber))[0] || null;

    return { client, processes, financials, txs, documents, propostas, contratos, eventos, trabalhoPendente, tasks };
  }, [clienteId, shell.allTransactions, shell.refreshKey, localKey]);

  if (!client) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="text-sm font-semibold">Cliente não encontrado</p>
        <button onClick={() => navigate('/clientes')} className="mt-4 h-9 px-3.5 border-2 rounded-lg text-xs">Voltar para clientes</button>
      </div>
    );
  }

  const hasWhatsApp = client.telefone?.ddd && client.telefone?.numero;
  const linkWa = hasWhatsApp ? `https://wa.me/55${client.telefone!.ddd}${client.telefone!.numero}` : null;
  const desde = client.createdAt ? new Date(client.createdAt).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '—';
  const pctFin = financials && financials.totalContratado > 0 ? Math.min(100, Math.round((financials.recebido / financials.totalContratado) * 100)) : 0;

  const txsAvulsos = txs.filter(t => !t.processId);
  const trabalhosAtivos = processes.filter(p => !p.isArchived && (p.etapa || 'Levantamento') !== 'Concluído').length;
  const propostasAprovadas = propostas.filter(p => p.status === 'Aprovada').length;
  const docsPendentes = documents.filter(d => d.situacao === 'Pendente' || d.situacao === 'Em produção').length;
  const podeExcluir = processes.length === 0 && txs.length === 0 && propostas.length === 0;

  function abrirBoasVindas() {
    const trabalhoRef = processes.find(p => !p.isArchived) || processes[0];
    const config = getCompanyConfig();
    const msg = montarMensagemBoasVindas({
      clienteNome: client!.nome,
      trabalhoObjeto: trabalhoRef?.objeto || 'o trabalho contratado',
      empresa: { nome: config.razaoSocial || 'HBS Engenharia', telefone: config.telefone, email: config.email, endereco: config.endereco },
    });
    setMensagemBoasVindas(msg);
    setBoasVindasOpen(true);
  }

  function handleDeleteCliente() {
    deleteClient(client!.id);
    toast.success('Cliente excluído.');
    navigate('/clientes');
  }

  // Ações rápidas em contexto — mesmo padrão comprovado em TrabalhoDetailPage.tsx:
  // lançamento e tarefa direto na página do cliente, sem precisar abrir um trabalho
  // específico ou passar por /tarefas.
  function adicionarTarefa() {
    if (!novaTarefa.trim() || !client) return;
    addTask({
      id: crypto.randomUUID(), titulo: novaTarefa.trim(), status: 'Pendente', prioridade: 'Média', prazo: novaTarefaPrazo || undefined,
      clienteId: client.id, createdAt: Date.now(), updatedAt: Date.now(),
    });
    setNovaTarefa('');
    setNovaTarefaPrazo('');
    setLocalKey(k => k + 1);
  }

  function toggleTarefa(id: string, done: boolean) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    updateTask({ ...t, status: done ? 'Concluída' : 'Pendente', completedAt: done ? Date.now() : undefined });
    setLocalKey(k => k + 1);
  }

  function removerTarefa(id: string) {
    deleteTask(id);
    setLocalKey(k => k + 1);
  }

  function adicionarLancamentoRapido() {
    if (!client) return;
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
      clienteId: client.id,
    });
    registrarEvento({
      modulo: 'Financeiro',
      texto: `${isIncome ? 'Receita' : 'Despesa'} ${novoJaAconteceu ? 'registrada' : 'prevista'} — ${novaDescricao.trim()} — ${fmt(valor)}`,
      clienteId: client.id,
    });
    toast.success('Lançamento adicionado.');
    setNovaDescricao(''); setNovoValor(''); setNovaData(new Date().toISOString().slice(0, 10)); setNovoJaAconteceu(false);
    setNovoLancamentoAberto(false);
    shell.refresh();
  }

  // Eventos são a fonte principal (proposta/contrato/trabalho/pagamento já vêm daqui).
  // Lançamentos concluídos antes de existir o registro de eventos entram como fallback,
  // só nas datas em que não há evento nenhum, pra não duplicar pagamentos recentes.
  const primeiroEvento = eventos.length > 0 ? Math.min(...eventos.map(e => e.createdAt)) : Date.now();
  const historico = [
    ...eventos.map(e => ({ key: e.id, texto: e.texto, ts: e.createdAt, modulo: e.modulo as string })),
    ...txs.filter(t => t.status === 'Concluído' && new Date(t.data + 'T12:00:00').getTime() < primeiroEvento).map(t => ({
      key: t.id,
      texto: `${t.tipo === 'Entrada' || t.tipo === 'A Receber' ? 'Recebido' : 'Pago'} — ${t.descricao} — ${fmt(t.valor)}`,
      ts: new Date(t.data + 'T12:00:00').getTime(),
      modulo: 'Financeiro',
    })),
  ].sort((a, b) => b.ts - a.ts).slice(0, 10);

  return (
    <div className="flex flex-col gap-[18px] pb-10 animate-hbs-in">
      <button onClick={() => navigate('/clientes')} className="self-start text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Clientes
      </button>

      <div className="flex flex-wrap gap-4 items-center bg-card border border-border rounded-xl p-[18px]">
        <span className="w-[46px] h-[46px] flex-none rounded-full bg-accent-soft text-accent grid place-items-center text-[15px] font-semibold font-mono-hbs">{initials(client.nome)}</span>
        <div className="min-w-0">
          <div className="text-[20px] font-semibold -tracking-[.02em]">{client.nome}</div>
          <div className="text-[12.5px] text-mute-2 mt-[3px] font-mono-hbs">
            {client.documento || 'sem documento'} · {client.endereco?.cidade || 'sem cidade'} · cliente desde {desde}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {hasWhatsApp && (
            <>
              <button onClick={abrirBoasVindas} className="h-[34px] px-3.5 bg-card border-2 rounded-lg text-[12.5px] flex items-center gap-1.5 hover:border-hover transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> Enviar boas-vindas
              </button>
              <a href={linkWa!} target="_blank" rel="noreferrer" className="h-[34px] px-3.5 bg-card border-2 rounded-lg text-[12.5px] flex items-center hover:border-hover transition-colors">
                Registrar contato
              </a>
            </>
          )}
          <button onClick={() => setEditOpen(true)} className="h-[34px] px-3.5 bg-card border-2 rounded-lg text-[12.5px] hover:border-hover transition-colors">Editar</button>
          <button
            onClick={() => podeExcluir ? setDeleteOpen(true) : toast.error('Este cliente tem trabalhos, propostas ou lançamentos vinculados — remova-os primeiro.')}
            className={cn('h-[34px] w-[34px] flex-none grid place-items-center rounded-lg border-2 transition-colors', podeExcluir ? 'text-destructive hover:border-destructive' : 'text-mute-3 hover:border-hover')}
            title="Excluir cliente"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid gap-px bg-border border border-border rounded-xl overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="bg-card px-4 py-3"><div className="text-[10px] uppercase tracking-[.06em] text-mute-2">Trabalhos ativos</div><div className="font-mono-hbs text-[17px] mt-1">{trabalhosAtivos}</div></div>
        <div className="bg-card px-4 py-3"><div className="text-[10px] uppercase tracking-[.06em] text-mute-2">Propostas aprovadas</div><div className="font-mono-hbs text-[17px] mt-1">{propostasAprovadas}</div></div>
        <div className="bg-card px-4 py-3"><div className="text-[10px] uppercase tracking-[.06em] text-mute-2">Contratado</div><div className="font-mono-hbs text-[17px] mt-1">{fmt(financials?.totalContratado || 0)}</div></div>
        <div className="bg-card px-4 py-3"><div className="text-[10px] uppercase tracking-[.06em] text-mute-2">Recebido</div><div className="font-mono-hbs text-[17px] mt-1 text-success">{fmt(financials?.recebido || 0)}</div></div>
        <div className="bg-card px-4 py-3"><div className="text-[10px] uppercase tracking-[.06em] text-mute-2">Docs pendentes</div><div className={cn('font-mono-hbs text-[17px] mt-1', docsPendentes > 0 && 'text-warning')}>{docsPendentes}</div></div>
      </div>

      <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
        {/* Financeiro */}
        <section className="bg-card border border-border rounded-xl p-[17px_18px]">
          <div className="text-[13.5px] font-semibold">Financeiro</div>
          <div className="flex gap-[18px] mt-3.5 flex-wrap">
            <div>
              <div className="text-[10.5px] tracking-[.07em] uppercase text-mute-2">Contratado</div>
              <div className="font-mono-hbs text-[18px] mt-1">{fmt(financials?.totalContratado || 0)}</div>
            </div>
            <div>
              <div className="text-[10.5px] tracking-[.07em] uppercase text-mute-2">Recebido</div>
              <div className="font-mono-hbs text-[18px] mt-1 text-success">{fmt(financials?.recebido || 0)}</div>
            </div>
            <div>
              <div className="text-[10.5px] tracking-[.07em] uppercase text-mute-2">A receber</div>
              <div className="font-mono-hbs text-[18px] mt-1 text-destructive">{fmt(financials?.aReceber || 0)}</div>
            </div>
          </div>
          <div className="h-1.5 rounded-[3px] bg-bar-track mt-3.5 overflow-hidden">
            <div className="h-full bg-accent" style={{ width: `${pctFin}%` }} />
          </div>
          <div className="text-[11.5px] text-muted-foreground mt-2.5">
            {financials && financials.totalContratado > 0
              ? (pctFin >= 100 ? 'Contrato integralmente quitado.' : `${pctFin}% recebido.${financials.atrasado > 0 ? ` ${fmt(financials.atrasado)} em atraso.` : ''}`)
              : 'Sem contrato de valor definido ainda.'}
          </div>
          <div className="text-[11px] text-mute-2 mt-3 pt-3 border-t border-3 flex items-center justify-between gap-2 flex-wrap">
            <span>Este resumo é a soma dos Trabalhos deste cliente. Para lançar ou editar valores, entre no Trabalho correspondente.</span>
            {trabalhoPendente && (
              <button
                onClick={() => navigate(`/trabalhos/${trabalhoPendente.p.id}`)}
                className="flex-none h-7 px-2.5 rounded-lg border-2 text-[11px] font-medium hover:border-hover transition-colors flex items-center gap-1"
              >
                Ir para {trabalhoPendente.p.objeto || 'o trabalho'} <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          {txsAvulsos.length > 0 && (
            <div className="text-[11px] text-warning bg-warning-soft rounded-lg px-2.5 py-2 mt-2.5">
              {txsAvulsos.length} lançamento{txsAvulsos.length > 1 ? 's' : ''} deste cliente sem trabalho vinculado. Edite em{' '}
              <button onClick={() => navigate('/caixa/receitas')} className="underline font-medium">Fluxo de Caixa</button> (busque pelo nome do cliente).
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-3">
            {!novoLancamentoAberto ? (
              <button onClick={() => setNovoLancamentoAberto(true)} className="text-[11.5px] font-medium text-accent flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Lançamento avulso pra este cliente
              </button>
            ) : (
              <div className="bg-surface-2 border border-3 rounded-lg p-3 space-y-2.5">
                <div className="flex bg-card border-2 rounded-lg overflow-hidden w-fit">
                  <button onClick={() => setNovoTipo('Receita')} className={cn('px-3 py-1.5 text-[11.5px] font-medium', novoTipo === 'Receita' ? 'bg-success text-white' : 'text-muted-foreground')}>Receita</button>
                  <button onClick={() => setNovoTipo('Despesa')} className={cn('px-3 py-1.5 text-[11.5px] font-medium', novoTipo === 'Despesa' ? 'bg-warning text-white' : 'text-muted-foreground')}>Despesa</button>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                  <Input value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} placeholder="Descrição" className="h-8 text-xs" autoFocus />
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
              </div>
            )}
          </div>
        </section>

        {/* Trabalhos */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-[18px] pt-[15px] pb-[13px] text-[13.5px] font-semibold">Trabalhos</div>
          {processes.length === 0 ? (
            <div className="px-[18px] pb-4 text-xs text-muted-foreground">Nenhum trabalho vinculado ainda.</div>
          ) : (
            processes.map(p => (
              <div key={p.id} onClick={() => navigate(`/trabalhos/${p.id}`)} className={cn('flex items-center gap-3 px-[18px] py-[11px] border-t border-3 cursor-pointer hover:bg-surface-3 transition-colors', p.isArchived && 'opacity-60')}>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{p.objeto || '(sem descrição)'}{p.isArchived && ' · arquivado'}</div>
                  <div className="text-[11px] text-mute-2 font-mono-hbs mt-0.5">{typeof p.valorContrato === 'number' && p.valorContrato > 0 ? fmt(p.valorContrato) : 'sem valor definido'}</div>
                </div>
                <span className={cn('flex-none text-[11px] px-2 py-[3px] rounded-[5px] font-medium', etapaBadge[p.etapa || 'Levantamento'])}>{p.etapa || 'Levantamento'}</span>
              </div>
            ))
          )}
        </section>

        {/* Tarefas */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-[18px] pt-[15px] pb-[13px] text-[13.5px] font-semibold">Tarefas</div>
          {tasks.length === 0 && <div className="px-[18px] pb-4 text-xs text-muted-foreground">Nenhuma tarefa ainda.</div>}
          {tasks.map(t => (
            <div key={t.id} className="group flex items-center gap-[11px] px-[18px] py-[10px] border-t border-3 hover:bg-surface-3 transition-colors">
              <label className="flex items-center gap-[11px] flex-1 min-w-0 cursor-pointer">
                <input type="checkbox" checked={t.status === 'Concluída'} onChange={e => toggleTarefa(t.id, e.target.checked)} className="w-4 h-4 accent-primary flex-none" />
                <span className={cn('text-[12.5px] flex-1 min-w-0 truncate', t.status === 'Concluída' && 'line-through text-muted-foreground')}>{t.titulo}</span>
              </label>
              {t.prazo && <span className={cn('text-[11px] font-mono-hbs text-mute-2 flex-none', t.prazo < new Date().toISOString().slice(0, 10) && t.status !== 'Concluída' && 'text-destructive')}>{new Date(t.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
              <button onClick={() => removerTarefa(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-mute-3 hover:text-destructive flex-none">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2 px-[18px] py-3 border-t border-3">
            <Input value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionarTarefa()} placeholder="Nova tarefa…" className="h-8 text-xs flex-1" />
            <Input type="date" value={novaTarefaPrazo} onChange={e => setNovaTarefaPrazo(e.target.value)} className="h-8 text-xs w-[130px] font-mono-hbs" />
            <button onClick={adicionarTarefa} className="h-8 w-8 flex-none grid place-items-center rounded-lg border-2 hover:border-hover transition-colors"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </section>

        {/* Comercial */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-[18px] pt-[15px] pb-[13px] text-[13.5px] font-semibold">Comercial</div>
          {propostas.length === 0 && contratos.length === 0 ? (
            <div className="px-[18px] pb-4 text-xs text-muted-foreground">Nenhuma proposta ou contrato ainda.</div>
          ) : (
            <>
              {propostas.map(p => (
                <div key={p.id} onClick={() => setPropostaAberta(p.id)} className="flex items-center gap-3 px-[18px] py-[11px] border-t border-3 cursor-pointer hover:bg-surface-3 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium truncate">{p.codigo} · {p.titulo}</div>
                    <div className="text-[11px] text-mute-2 font-mono-hbs mt-0.5">{formatBRL(p.resultado.precoVenda)}</div>
                  </div>
                  <span className={cn('flex-none text-[11px] px-2 py-[3px] rounded-[5px] font-medium', propostaBadge[p.status])}>{p.status}</span>
                </div>
              ))}
              {contratos.map(c => (
                <div key={c.id} onClick={() => c.trabalhoId && navigate(`/trabalhos/${c.trabalhoId}`)} className="flex items-center gap-3 px-[18px] py-[11px] border-t border-3 cursor-pointer hover:bg-surface-3 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium truncate">Contrato {c.codigo}</div>
                    <div className="text-[11px] text-mute-2 font-mono-hbs mt-0.5">{formatBRL(c.valor)}</div>
                  </div>
                  {c.trabalhoId ? <ArrowRight className="w-3.5 h-3.5 text-mute-2" /> : <span className="text-[11px] text-mute-2">Sem trabalho</span>}
                </div>
              ))}
            </>
          )}
        </section>

        {/* Documentos */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-[18px] pt-[15px] pb-[13px] flex items-baseline justify-between">
            <span className="text-[13.5px] font-semibold">Documentos</span>
            <span className="text-[11px] text-mute-2 font-mono-hbs">{documents.length} · {documents.filter(d => d.situacao === 'Pendente').length} pendentes</span>
          </div>
          {documents.length === 0 ? (
            <div className="px-[18px] pb-4 text-xs text-muted-foreground">Nenhum documento vinculado. Envie um em Documentos.</div>
          ) : (
            documents.slice(0, 6).map(d => (
              <div key={d.id} className="flex items-center gap-[11px] px-[18px] py-[10px] border-t border-3">
                <span className="text-[11px] font-mono-hbs text-mute-2 w-[30px] flex-none">{(d.nome.match(/\.([a-zA-Z0-9]{2,4})$/)?.[1] || '—').toUpperCase()}</span>
                <span className="text-[12.5px] flex-1 min-w-0 truncate">{d.nome}</span>
                <span className={cn('text-[11px]', d.situacao === 'Pendente' ? 'text-warning' : d.situacao === 'Vigente' ? 'text-success' : 'text-mute-2')}>{d.situacao}</span>
              </div>
            ))
          )}
          {processes.filter(p => p.driveLink).map(p => (
            <a key={p.id} href={p.driveLink} target="_blank" rel="noreferrer" className="flex items-center gap-[11px] px-[18px] py-[10px] border-t border-3 hover:bg-surface-3 transition-colors">
              <ExternalLink className="w-3.5 h-3.5 text-accent flex-none" />
              <span className="text-[12.5px] flex-1 min-w-0 truncate">Pasta do trabalho — {p.objeto || 'link externo'}</span>
            </a>
          ))}
        </section>

        {/* Histórico */}
        <section className="bg-card border border-border rounded-xl p-[17px_18px]">
          <div className="text-[13.5px] font-semibold mb-3.5">Histórico</div>
          {historico.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</div>
          ) : (
            historico.map((h, i) => (
              <div key={h.key} className="flex gap-3">
                <div className="flex flex-col items-center flex-none">
                  <span className="w-[7px] h-[7px] rounded-full bg-border-hover mt-[5px]" />
                  {i < historico.length - 1 && <span className="flex-1 w-px bg-border" />}
                </div>
                <div className="pb-[15px] min-w-0">
                  <div className="text-[12.5px] leading-[1.4]">{h.texto}</div>
                  <div className="text-[10.5px] text-mute-3 font-mono-hbs mt-[3px]">{new Date(h.ts).toLocaleDateString('pt-BR')}</div>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      <Dialog open={boasVindasOpen} onOpenChange={setBoasVindasOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Boas-vindas para {client.nome}</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-muted-foreground -mt-2">Revise ou ajuste o texto antes de enviar.</p>
          <Textarea value={mensagemBoasVindas} onChange={e => setMensagemBoasVindas(e.target.value)} className="min-h-[220px] text-[13px]" />
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setBoasVindasOpen(false)} className="h-9 px-3.5 rounded-lg text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
            <button
              onClick={() => {
                if (!client.telefone?.ddd || !client.telefone?.numero) return;
                window.open(linkWhatsApp(client.telefone.ddd, client.telefone.numero, mensagemBoasVindas), '_blank', 'noreferrer');
                setBoasVindasOpen(false);
              }}
              className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-opacity flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Abrir no WhatsApp
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ClientForm open={editOpen} onClose={() => setEditOpen(false)} onSave={() => { setEditOpen(false); setLocalKey(k => k + 1); }} editItem={client} />
      <PropostaDetailDialog propostaId={propostaAberta} onClose={() => setPropostaAberta(null)} onChanged={() => setLocalKey(k => k + 1)} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{client.nome}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCliente} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
