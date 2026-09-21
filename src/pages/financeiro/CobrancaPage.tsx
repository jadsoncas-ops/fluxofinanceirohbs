import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, CheckCircle2, ArrowRight, Phone, SlidersHorizontal } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getClients, getProcesses, updateClient } from '@/lib/storage';
import { isReceivableFromClient, toggleLembreteCobranca } from '@/lib/attention';
import { agruparLancamentos, LancamentoGrupo } from '@/lib/lancamentos';
import { montarMensagemLembreteVencimento, linkWhatsApp, ItemVencimento } from '@/lib/mensagens';
import { DetalheLancamentoDialog } from '@/components/financeiro/DetalheLancamentoDialog';
import { ValorMonetario } from '@/components/ValorMonetario';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtData(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

type Bucket = 'vencido' | 'hoje' | 'proximos7' | 'proximos30' | 'adiante';

const BUCKET_ORDER: Bucket[] = ['vencido', 'hoje', 'proximos7', 'proximos30', 'adiante'];
const BUCKET_INFO: Record<Bucket, { titulo: string; dot: string }> = {
  vencido: { titulo: 'Vencidos', dot: 'bg-destructive' },
  hoje: { titulo: 'Hoje', dot: 'bg-warning' },
  proximos7: { titulo: 'Próximos 7 dias', dot: 'bg-accent' },
  proximos30: { titulo: 'Próximos 30 dias', dot: 'bg-mute-3' },
  adiante: { titulo: 'Mais adiante', dot: 'bg-mute-3' },
};

type GrupoComBucket = { grupo: LancamentoGrupo; bucket: Bucket };

/** A Receber — "quem precisa me pagar e quanto?". Usa exatamente o mesmo critério de
 *  isReceivableFromClient (lib/attention.ts) que já alimenta a Fila de hoje do Dashboard — só
 *  muda a apresentação. Agrupa parcelamentos com o mesmo helper de Movimentações
 *  (lib/lancamentos.ts), pra "Valor / Recebido / Restante" bater com o resto do app. Fase 4C:
 *  lista sempre segmentada por urgência (Vencidos/Hoje/Próximos 7/Próximos 30/Mais adiante) em
 *  vez do filtro por clique de antes — nada fica escondido atrás de um toggle. */
export default function FinanceiroCobrancaPage() {
  const shell = useShell();
  const navigate = useNavigate();
  const [key, setKey] = useState(0);
  const [search, setSearch] = useState('');
  const [filtroCliente, setFiltroCliente] = useState<string | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [detalhe, setDetalhe] = useState<Transaction | null>(null);
  const [lembrete, setLembrete] = useState<{ clienteId: string; clienteNome: string; telefone: { ddd: string; numero: string }; mensagem: string } | null>(null);
  const [mensagemEditada, setMensagemEditada] = useState('');

  const { grupos, totalPorBucket, totalGeral, clientesMap, processes, clientesComPendencia } = useMemo(() => {
    void key;
    const clients = getClients();
    const processes = getProcesses();
    const clientesMap = new Map(clients.map(c => [c.id, c]));
    const hoje = new Date().toISOString().slice(0, 10);
    const em7 = new Date(); em7.setDate(em7.getDate() + 7);
    const em7Str = em7.toISOString().slice(0, 10);
    const em30 = new Date(); em30.setDate(em30.getDate() + 30);
    const em30Str = em30.toISOString().slice(0, 10);

    const recebiveis = shell.allTransactions.filter(isReceivableFromClient);
    // valorRestante > 0: só o que ainda falta receber — um grupo cujas duas metades já foram
    // recebidas (ex.: parcial quitado por completo) não é mais "a receber", some da lista.
    const gruposBrutos = agruparLancamentos(recebiveis).filter(g => g.valorRestante > 0);

    function bucketDe(g: LancamentoGrupo): Bucket {
      const v = g.proximoVencimento;
      if (!v) return 'adiante';
      if (v < hoje) return 'vencido';
      if (v === hoje) return 'hoje';
      if (v <= em7Str) return 'proximos7';
      if (v <= em30Str) return 'proximos30';
      return 'adiante';
    }

    const totalPorBucket: Record<Bucket, number> = { vencido: 0, hoje: 0, proximos7: 0, proximos30: 0, adiante: 0 };
    const grupos: GrupoComBucket[] = gruposBrutos.map(g => ({ grupo: g, bucket: bucketDe(g) }));
    grupos.forEach(({ grupo, bucket }) => { totalPorBucket[bucket] += grupo.valorRestante; });

    const totalGeral = gruposBrutos.reduce((s, g) => s + g.valorRestante, 0);

    const idsUnicos = Array.from(new Set(grupos.map(g => g.grupo.itens[0].clienteId).filter((id): id is string => !!id)));
    const clientesComPendencia = idsUnicos
      .map(id => clientesMap.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => a.nome.localeCompare(b.nome));

    return { grupos, totalPorBucket, totalGeral, clientesMap, processes, clientesComPendencia };
  }, [shell.allTransactions, key]);

  const gruposFiltrados = useMemo(() => {
    let items = grupos;
    if (filtroCliente) items = items.filter(g => g.grupo.itens[0].clienteId === filtroCliente);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(({ grupo }) => {
        const cliente = grupo.itens[0].clienteId ? clientesMap.get(grupo.itens[0].clienteId) : undefined;
        const trabalho = grupo.itens[0].processId ? processes.find(p => p.id === grupo.itens[0].processId) : undefined;
        const descricaoBase = grupo.itens[0].descricao.replace(/\s*\(Restante\)\s*$/i, '');
        return (cliente?.nome || '').toLowerCase().includes(q) || descricaoBase.toLowerCase().includes(q) || (trabalho?.objeto || '').toLowerCase().includes(q);
      });
    }
    return items;
  }, [grupos, search, filtroCliente, clientesMap, processes]);

  const blocos = useMemo(() => {
    const mapa = new Map<Bucket, GrupoComBucket[]>();
    for (const item of gruposFiltrados) {
      const arr = mapa.get(item.bucket);
      if (arr) arr.push(item); else mapa.set(item.bucket, [item]);
    }
    for (const arr of mapa.values()) arr.sort((a, b) => (a.grupo.proximoVencimento || '9999').localeCompare(b.grupo.proximoVencimento || '9999'));
    return BUCKET_ORDER.filter(b => mapa.has(b)).map(b => [b, mapa.get(b)!] as const);
  }, [gruposFiltrados]);

  const filtrosAtivos = !!filtroCliente;

  function refresh() {
    setKey(k => k + 1);
    shell.refresh();
  }

  function ultimaCobranca(clienteId?: string | null): string | null {
    if (!clienteId) return null;
    const cliente = clientesMap.get(clienteId);
    const historico = cliente?.lembretesCobranca || [];
    if (historico.length === 0) return null;
    const ultimo = Math.max(...historico);
    return new Date(ultimo).toLocaleDateString('pt-BR');
  }

  function abrirLembrete(clienteId: string) {
    const cliente = clientesMap.get(clienteId);
    if (!cliente?.telefone?.ddd || !cliente?.telefone?.numero) return;
    const itens: ItemVencimento[] = shell.allTransactions
      .filter(t => t.clienteId === clienteId && isReceivableFromClient(t) && t.status !== 'Concluído')
      .map(t => ({ descricao: t.descricao, valor: t.valor, trabalho: processes.find(p => p.id === t.processId)?.objeto, data: t.data }));
    const mensagem = montarMensagemLembreteVencimento({ clienteNome: cliente.nome, itens });
    setLembrete({ clienteId, clienteNome: cliente.nome, telefone: { ddd: cliente.telefone.ddd, numero: cliente.telefone.numero }, mensagem });
    setMensagemEditada(mensagem);
  }

  function registrarContato(clienteId?: string | null) {
    if (!clienteId) return;
    const cliente = clientesMap.get(clienteId);
    if (!cliente) return;
    updateClient(toggleLembreteCobranca(cliente));
    toast.success('Contato registrado.');
    refresh();
  }

  function enviarWhatsApp() {
    if (!lembrete) return;
    window.open(linkWhatsApp(lembrete.telefone.ddd, lembrete.telefone.numero, mensagemEditada), '_blank', 'noreferrer');
    const cliente = clientesMap.get(lembrete.clienteId);
    if (cliente) updateClient(toggleLembreteCobranca(cliente));
    setLembrete(null);
    refresh();
  }

  function statusDoGrupo(grupo: LancamentoGrupo, bucket: Bucket): { label: string; tone: BadgeTone } {
    if (grupo.parcelado) return { label: 'Parcial', tone: 'accent' };
    if (bucket === 'vencido') return { label: 'Vencido', tone: 'destructive' };
    if (bucket === 'hoje') return { label: 'Vence hoje', tone: 'warning' };
    return { label: 'A vencer', tone: 'neutral' };
  }

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div>
        <h1 className="text-[16px] font-semibold">A receber</h1>
        <p className="text-[12px] text-mute-2 mt-0.5">Quem precisa te pagar e quanto.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border border border-border rounded-xl overflow-hidden">
        <KpiCard label="Total a receber" value={fmt(totalGeral)} size="hero" />
        <KpiCard label="Total vencido" value={fmt(totalPorBucket.vencido)} size="hero" tone={totalPorBucket.vencido > 0 ? 'destructive' : 'default'} />
      </div>

      <div className="flex items-center gap-2">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente ou lançamento..." className="flex-1 h-9 text-[13px] border-2" />
        <Popover open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
          <PopoverTrigger asChild>
            <button className={cn('h-9 px-3 rounded-lg border-2 text-[12.5px] font-medium flex items-center gap-1.5 flex-none transition-colors', filtrosAtivos ? 'border-primary text-primary' : 'hover:border-hover')}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros {filtrosAtivos && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[240px] space-y-3">
            <div>
              <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2 mb-1.5">Cliente</div>
              <div className="flex gap-1 flex-wrap max-h-[220px] overflow-y-auto">
                <button onClick={() => setFiltroCliente(null)} className={cn('px-2.5 py-1 rounded-md text-[11px] font-medium border', !filtroCliente ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-mute-2 hover:border-hover')}>Todos</button>
                {clientesComPendencia.map(c => (
                  <button key={c.id} onClick={() => setFiltroCliente(prev => (prev === c.id ? null : c.id))} className={cn('px-2.5 py-1 rounded-md text-[11px] font-medium border', filtroCliente === c.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-mute-2 hover:border-hover')}>{c.nome}</button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {blocos.length === 0 ? (
        <div className="bg-success-soft border border-success/30 rounded-xl p-[18px] text-[13px] text-success font-medium">
          {search || filtroCliente ? 'Nada encontrado.' : 'Nenhuma cobrança pendente agora — tudo em dia.'}
        </div>
      ) : (
        <div className="space-y-[18px]">
          {blocos.map(([bucket, itens]) => {
            const subtotal = itens.reduce((s, { grupo }) => s + grupo.valorRestante, 0);
            return (
              <div key={bucket}>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-mute-2 mb-2 px-0.5">
                  <span className={cn('w-1.5 h-1.5 rounded-full', BUCKET_INFO[bucket].dot)} />
                  {BUCKET_INFO[bucket].titulo}
                  <span className="ml-auto font-mono-hbs text-[11px] normal-case tracking-normal text-foreground"><ValorMonetario value={fmt(subtotal)} /></span>
                </div>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {itens.map(({ grupo, bucket: b }, i) => (
                    <LinhaAReceber
                      key={grupo.chave}
                      grupo={grupo}
                      status={statusDoGrupo(grupo, b)}
                      isFirst={i === 0}
                      cliente={grupo.itens[0].clienteId ? clientesMap.get(grupo.itens[0].clienteId) : undefined}
                      trabalho={grupo.itens[0].processId ? processes.find(p => p.id === grupo.itens[0].processId) : undefined}
                      ultimaCobranca={ultimaCobranca(grupo.itens[0].clienteId)}
                      onAbrirDetalhe={() => setDetalhe(grupo.itens.find(t => t.status !== 'Concluído') || grupo.itens[0])}
                      onCobrar={() => grupo.itens[0].clienteId && abrirLembrete(grupo.itens[0].clienteId)}
                      onRegistrarContato={() => registrarContato(grupo.itens[0].clienteId)}
                      onRegistrarRecebimento={() => shell.openCompleteTransaction(grupo.itens.find(t => t.status !== 'Concluído')!)}
                      onAbrirCliente={() => grupo.itens[0].clienteId && navigate(`/clientes/${grupo.itens[0].clienteId}`)}
                      onAbrirTrabalho={() => grupo.itens[0].processId && navigate(`/trabalhos/${grupo.itens[0].processId}`)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DetalheLancamentoDialog transaction={detalhe} onClose={() => setDetalhe(null)} />

      <Dialog open={!!lembrete} onOpenChange={v => !v && setLembrete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cobrar {lembrete?.clienteNome}</DialogTitle></DialogHeader>
          <Textarea value={mensagemEditada} onChange={e => setMensagemEditada(e.target.value)} rows={10} className="text-[13px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLembrete(null)}>Cancelar</Button>
            <Button onClick={enviarWhatsApp} className="flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> Abrir no WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LinhaAReceber({ grupo, status, isFirst, cliente, trabalho, ultimaCobranca, onAbrirDetalhe, onCobrar, onRegistrarContato, onRegistrarRecebimento, onAbrirCliente, onAbrirTrabalho }: {
  grupo: LancamentoGrupo;
  status: { label: string; tone: BadgeTone };
  isFirst: boolean;
  cliente?: { nome: string; telefone?: { ddd: string; numero: string } | null };
  trabalho?: { id: string; objeto: string };
  ultimaCobranca: string | null;
  onAbrirDetalhe: () => void;
  onCobrar: () => void;
  onRegistrarContato: () => void;
  onRegistrarRecebimento: () => void;
  onAbrirCliente: () => void;
  onAbrirTrabalho: () => void;
}) {
  const temTelefone = !!(cliente?.telefone?.ddd && cliente?.telefone?.numero);
  const descricaoBase = grupo.itens[0].descricao.replace(/\s*\(Restante\)\s*$/i, '');

  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center gap-2.5 px-[18px] py-[13px]', !isFirst && 'border-t border-3')}>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onAbrirDetalhe}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-medium">{cliente?.nome || 'Cliente'}</span>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <div className="text-[11px] text-mute-2 mt-0.5 truncate">
          {descricaoBase}{trabalho && <> · {trabalho.objeto}</>}
        </div>
        <div className="text-[11px] text-mute-3 mt-0.5">
          Vencimento {grupo.proximoVencimento ? fmtData(grupo.proximoVencimento) : '—'}
          {grupo.parcelado && <> · Total {fmt(grupo.valorTotal)} · Recebido {fmt(grupo.valorRecebido)}</>}
          {ultimaCobranca && <> · última cobrança {ultimaCobranca}</>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap pl-0 sm:pl-2">
        <span className="font-mono-hbs text-[14px] flex-none"><ValorMonetario value={fmt(grupo.valorRestante)} /></span>
        <div className="flex flex-wrap items-center gap-1">
          <button onClick={onRegistrarRecebimento} className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-colors flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Receber
          </button>
          {temTelefone && (
            <button onClick={onCobrar} title="Cobrar por WhatsApp" className="h-7 w-7 grid place-items-center rounded-lg hover:bg-warning-soft text-mute-2 hover:text-warning">
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onRegistrarContato} title="Registrar contato (já cobrei)" className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-mute-2">
            <Phone className="w-3.5 h-3.5" />
          </button>
          {trabalho ? (
            <button onClick={onAbrirTrabalho} className="h-7 px-2.5 rounded-lg border-2 text-[11px] font-medium hover:border-hover transition-colors flex items-center gap-1">
              Trabalho <ArrowRight className="w-3 h-3" />
            </button>
          ) : cliente ? (
            <button onClick={onAbrirCliente} className="h-7 px-2.5 rounded-lg border-2 text-[11px] font-medium hover:border-hover transition-colors flex items-center gap-1">
              Cliente <ArrowRight className="w-3 h-3" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
