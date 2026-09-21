import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, CheckCircle2, ArrowRight, Phone } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getClients, getProcesses, updateClient } from '@/lib/storage';
import { isReceivableFromClient, toggleLembreteCobranca } from '@/lib/attention';
import { dataEfetiva } from '@/lib/financials';
import { agruparLancamentos, LancamentoGrupo } from '@/lib/lancamentos';
import { montarMensagemLembreteVencimento, linkWhatsApp, ItemVencimento } from '@/lib/mensagens';
import { DetalheLancamentoDialog } from '@/components/financeiro/DetalheLancamentoDialog';
import { ValorMonetario } from '@/components/ValorMonetario';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Bucket = 'vencido' | 'hoje' | 'proximos7' | 'proximos30';

const BUCKET_INFO: Record<Bucket, { titulo: string; dot: string }> = {
  vencido: { titulo: 'Vencidos', dot: 'bg-destructive' },
  hoje: { titulo: 'Hoje', dot: 'bg-warning' },
  proximos7: { titulo: 'Próximos 7 dias', dot: 'bg-accent' },
  proximos30: { titulo: 'Próximos 30 dias', dot: 'bg-mute-3' },
};

/** A Receber — "quem precisa me pagar e quanto?". Usa exatamente o mesmo critério de
 *  isReceivableFromClient (lib/attention.ts) que já alimenta a Fila de hoje do Dashboard — só
 *  muda a apresentação. Agrupa parcelamentos com o mesmo helper de Movimentações
 *  (lib/lancamentos.ts), pra "Valor / Recebido / Restante" bater com o resto do app. */
export default function FinanceiroCobrancaPage() {
  const shell = useShell();
  const navigate = useNavigate();
  const [key, setKey] = useState(0);
  const [filtroBucket, setFiltroBucket] = useState<Bucket | null>(null);
  const [detalhe, setDetalhe] = useState<Transaction | null>(null);
  const [lembrete, setLembrete] = useState<{ clienteId: string; clienteNome: string; telefone: { ddd: string; numero: string }; mensagem: string } | null>(null);
  const [mensagemEditada, setMensagemEditada] = useState('');

  const { grupos, totalPorBucket, totalGeral, clientesMap, processes } = useMemo(() => {
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
    const grupos = agruparLancamentos(recebiveis)
      .filter(g => g.valorRestante > 0)
      .sort((a, b) => (a.proximoVencimento || '9999').localeCompare(b.proximoVencimento || '9999'));

    function bucketDe(g: LancamentoGrupo): Bucket | null {
      const v = g.proximoVencimento;
      if (!v) return null;
      if (v < hoje) return 'vencido';
      if (v === hoje) return 'hoje';
      if (v <= em7Str) return 'proximos7';
      if (v <= em30Str) return 'proximos30';
      return null;
    }

    const totalPorBucket: Record<Bucket, number> = { vencido: 0, hoje: 0, proximos7: 0, proximos30: 0 };
    const gruposComBucket = grupos.map(g => ({ grupo: g, bucket: bucketDe(g) }));
    gruposComBucket.forEach(({ grupo, bucket }) => { if (bucket) totalPorBucket[bucket] += grupo.valorRestante; });

    const totalGeral = grupos.reduce((s, g) => s + g.valorRestante, 0);

    return { grupos: gruposComBucket, totalPorBucket, totalGeral, clientesMap, processes };
  }, [shell.allTransactions, key]);

  const gruposVisiveis = filtroBucket ? grupos.filter(g => g.bucket === filtroBucket) : grupos;

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

  function toggleBucket(b: Bucket) {
    setFiltroBucket(prev => (prev === b ? null : b));
  }

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div>
        <h1 className="text-[16px] font-semibold">A Receber</h1>
        <p className="text-[12px] text-mute-2 mt-0.5">Quem precisa te pagar e quanto.</p>
      </div>

      <div className="bg-card border border-border rounded-xl px-[20px] py-[18px]">
        <div className="text-[11px] uppercase tracking-[.07em] text-mute-2">Total a receber</div>
        <div className="font-mono-hbs text-[28px] mt-1.5 text-foreground"><ValorMonetario value={fmt(totalGeral)} /></div>
      </div>

      <div className="grid gap-px bg-border border border-border rounded-xl overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {(['vencido', 'hoje', 'proximos7', 'proximos30'] as Bucket[]).map(b => (
          <button
            key={b}
            type="button"
            onClick={() => toggleBucket(b)}
            className={cn('bg-card px-[14px] py-[12px] text-left hover:bg-surface-2 transition-colors', filtroBucket === b && 'bg-surface-2')}
          >
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[.07em] text-mute-2">
              <span className={cn('w-1.5 h-1.5 rounded-full', BUCKET_INFO[b].dot)} /> {BUCKET_INFO[b].titulo}
            </div>
            <div className={cn('font-mono-hbs text-[15px] mt-1', b === 'vencido' && totalPorBucket[b] > 0 && 'text-destructive')}>
              <ValorMonetario value={fmt(totalPorBucket[b])} />
            </div>
          </button>
        ))}
      </div>

      {gruposVisiveis.length === 0 ? (
        <div className="bg-success-soft border border-success/30 rounded-xl p-[18px] text-[13px] text-success font-medium">
          {filtroBucket ? 'Nada nesse período.' : 'Nenhuma cobrança pendente agora — tudo em dia.'}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {gruposVisiveis.map(({ grupo, bucket }, i) => (
            <LinhaAReceber
              key={grupo.chave}
              grupo={grupo}
              bucket={bucket}
              isFirst={i === 0}
              cliente={grupo.itens[0].clienteId ? clientesMap.get(grupo.itens[0].clienteId!) : undefined}
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

function LinhaAReceber({ grupo, bucket, isFirst, cliente, trabalho, ultimaCobranca, onAbrirDetalhe, onCobrar, onRegistrarContato, onRegistrarRecebimento, onAbrirCliente, onAbrirTrabalho }: {
  grupo: LancamentoGrupo;
  bucket: Bucket | null;
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
  const hoje = new Date().toISOString().slice(0, 10);
  const v = grupo.proximoVencimento;
  const diasDiff = v ? Math.round((new Date(v + 'T12:00:00').getTime() - new Date(hoje + 'T12:00:00').getTime()) / 86400000) : null;
  const statusTexto = v == null ? '—' : diasDiff! < 0 ? `Vencido há ${Math.abs(diasDiff!)}d` : diasDiff === 0 ? 'Vence hoje' : `Vence em ${diasDiff}d`;
  const temTelefone = !!(cliente?.telefone?.ddd && cliente?.telefone?.numero);
  const descricaoBase = grupo.itens[0].descricao.replace(/\s*\(Restante\)\s*$/i, '');

  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center gap-2.5 px-[18px] py-[13px]', !isFirst && 'border-t border-3')}>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onAbrirDetalhe}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-medium">{cliente?.nome || 'Cliente'}</span>
          <span className={cn('text-[9.5px] px-1.5 py-[1px] rounded-[4px] font-medium uppercase tracking-wide',
            bucket === 'vencido' ? 'bg-destructive-soft text-destructive' : bucket === 'hoje' ? 'bg-warning-soft text-warning' : 'bg-neutral-soft text-mute-2')}>
            {statusTexto}
          </span>
        </div>
        <div className="text-[11px] text-mute-2 mt-0.5 truncate">
          {descricaoBase}{trabalho && <> · {trabalho.objeto}</>}
          {ultimaCobranca && <> · última cobrança {ultimaCobranca}</>}
        </div>
        {grupo.parcelado && (
          <div className="text-[11px] text-mute-3 mt-0.5">Recebido {fmt(grupo.valorRecebido)} de {fmt(grupo.valorTotal)}</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap pl-0 sm:pl-2">
        <span className="font-mono-hbs text-[14px] flex-none"><ValorMonetario value={fmt(grupo.valorRestante)} /></span>
        <div className="flex flex-wrap items-center gap-1">
          {temTelefone && (
            <button onClick={onCobrar} title="Cobrar por WhatsApp" className="h-7 w-7 grid place-items-center rounded-lg hover:bg-warning-soft text-mute-2 hover:text-warning">
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onRegistrarContato} title="Registrar contato (já cobrei)" className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-mute-2">
            <Phone className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRegistrarRecebimento} className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-colors flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Receber
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
