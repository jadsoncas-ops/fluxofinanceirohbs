import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, CheckCircle2, ArrowRight, Phone } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getClients, getProcesses, updateClient } from '@/lib/storage';
import { isReceivableFromClient, toggleLembreteCobranca } from '@/lib/attention';
import { dataEfetiva } from '@/lib/financials';
import { montarMensagemLembreteVencimento, linkWhatsApp, ItemVencimento } from '@/lib/mensagens';
import { ValorMonetario } from '@/components/ValorMonetario';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Bucket = 'vencido' | 'hoje' | 'proximos7' | 'recebido';

const BUCKET_INFO: Record<Bucket, { titulo: string; dot: string; vazio: string }> = {
  vencido: { titulo: 'Vencidos', dot: 'bg-destructive', vazio: 'Nada vencido agora.' },
  hoje: { titulo: 'Vencendo hoje', dot: 'bg-warning', vazio: 'Nada vence hoje.' },
  proximos7: { titulo: 'Próximos 7 dias', dot: 'bg-accent', vazio: 'Nada vencendo nos próximos 7 dias.' },
  recebido: { titulo: 'Recebidos este mês', dot: 'bg-success', vazio: 'Nada recebido este mês ainda.' },
};

/** Central de Cobrança — visão dedicada de tudo que é "a receber de cliente", agrupado por
 *  urgência. Não recalcula o que é "vencido": usa exatamente o mesmo critério de
 *  isReceivableFromClient (lib/attention.ts) que alimenta a Fila de hoje do Dashboard, e as
 *  mesmas ações (WhatsApp, marcar cobrado, registrar recebimento) — só muda a superfície,
 *  não a fonte dos dados. */
export default function FinanceiroCobrancaPage() {
  const shell = useShell();
  const navigate = useNavigate();
  const [key, setKey] = useState(0);
  const [lembrete, setLembrete] = useState<{ clienteId: string; clienteNome: string; telefone: { ddd: string; numero: string }; mensagem: string } | null>(null);
  const [mensagemEditada, setMensagemEditada] = useState('');

  const { grupos, totais, clientesMap, processes } = useMemo(() => {
    void key;
    const clients = getClients();
    const processes = getProcesses();
    const clientesMap = new Map(clients.map(c => [c.id, c]));
    const hoje = new Date().toISOString().slice(0, 10);
    const em7dias = new Date();
    em7dias.setDate(em7dias.getDate() + 7);
    const em7diasStr = em7dias.toISOString().slice(0, 10);
    const mesAtual = hoje.slice(0, 7);

    const recebiveis = shell.allTransactions.filter(isReceivableFromClient);

    const grupos: Record<Bucket, typeof recebiveis> = { vencido: [], hoje: [], proximos7: [], recebido: [] };
    recebiveis.forEach(t => {
      if (t.status === 'Concluído') {
        if (dataEfetiva(t).slice(0, 7) === mesAtual) grupos.recebido.push(t);
        return;
      }
      if (t.data < hoje) grupos.vencido.push(t);
      else if (t.data === hoje) grupos.hoje.push(t);
      else if (t.data <= em7diasStr) grupos.proximos7.push(t);
    });
    (Object.keys(grupos) as Bucket[]).forEach(b => grupos[b].sort((a, b2) => dataEfetiva(a).localeCompare(dataEfetiva(b2))));

    const totais: Record<Bucket, number> = {
      vencido: grupos.vencido.reduce((s, t) => s + t.valor, 0),
      hoje: grupos.hoje.reduce((s, t) => s + t.valor, 0),
      proximos7: grupos.proximos7.reduce((s, t) => s + t.valor, 0),
      recebido: grupos.recebido.reduce((s, t) => s + t.valor, 0),
    };

    return { grupos, totais, clientesMap, processes };
  }, [shell.allTransactions, key]);

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

  const totalGeralAberto = totais.vencido + totais.hoje + totais.proximos7;

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div className="grid gap-px bg-border border border-border rounded-xl overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {(['vencido', 'hoje', 'proximos7', 'recebido'] as Bucket[]).map(b => (
          <div key={b} className="bg-card px-[16px] py-[14px]">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[.07em] text-mute-2">
              <span className={cn('w-1.5 h-1.5 rounded-full', BUCKET_INFO[b].dot)} /> {BUCKET_INFO[b].titulo}
            </div>
            <div className={cn('font-mono-hbs text-[19px] mt-1.5', b === 'vencido' && totais[b] > 0 && 'text-destructive', b === 'recebido' && 'text-success')}>
              <ValorMonetario value={fmt(totais[b])} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{grupos[b].length} parcela{grupos[b].length !== 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>

      {totalGeralAberto === 0 ? (
        <div className="bg-success-soft border border-success/30 rounded-xl p-[18px] text-[13px] text-success font-medium">
          Nenhuma cobrança pendente agora — tudo em dia.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-[14px_18px] flex items-center gap-2 text-[12.5px]">
          <span className="text-muted-foreground">Total em aberto (vencido + vencendo em até 7 dias):</span>
          <span className="font-mono-hbs font-semibold"><ValorMonetario value={fmt(totalGeralAberto)} /></span>
        </div>
      )}

      {(['vencido', 'hoje', 'proximos7', 'recebido'] as Bucket[]).map(b => (
        <Grupo
          key={b}
          bucket={b}
          itens={grupos[b]}
          clientesMap={clientesMap}
          processes={processes}
          ultimaCobranca={ultimaCobranca}
          onCobrar={abrirLembrete}
          onRegistrarContato={registrarContato}
          onRegistrarRecebimento={tx => shell.openCompleteTransaction(tx)}
          onAbrirCliente={id => navigate(`/clientes/${id}`)}
          onAbrirTrabalho={id => navigate(`/trabalhos/${id}`)}
        />
      ))}

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

interface GrupoProps {
  bucket: Bucket;
  itens: ReturnType<typeof useShell>['allTransactions'];
  clientesMap: Map<string, ReturnType<typeof getClients>[number]>;
  processes: ReturnType<typeof getProcesses>;
  ultimaCobranca: (clienteId?: string | null) => string | null;
  onCobrar: (clienteId: string) => void;
  onRegistrarContato: (clienteId?: string | null) => void;
  onRegistrarRecebimento: (tx: ReturnType<typeof useShell>['allTransactions'][number]) => void;
  onAbrirCliente: (clienteId: string) => void;
  onAbrirTrabalho: (processId: string) => void;
}

function Grupo({ bucket, itens, clientesMap, processes, ultimaCobranca, onCobrar, onRegistrarContato, onRegistrarRecebimento, onAbrirCliente, onAbrirTrabalho }: GrupoProps) {
  const info = BUCKET_INFO[bucket];
  const isRecebido = bucket === 'recebido';
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-[18px] py-[13px] border-b border-3 flex items-center gap-2">
        <span className={cn('w-2 h-2 rounded-full', info.dot)} />
        <span className="text-[13.5px] font-semibold">{info.titulo}</span>
        <span className="text-[11.5px] text-mute-2 font-mono-hbs">{itens.length}</span>
      </div>
      {itens.length === 0 ? (
        <div className="px-[18px] py-[22px] text-[12.5px] text-muted-foreground">{info.vazio}</div>
      ) : (
        itens.map(t => {
          const cliente = t.clienteId ? clientesMap.get(t.clienteId) : undefined;
          const trabalho = t.processId ? processes.find(p => p.id === t.processId) : undefined;
          const diasAtraso = bucket === 'vencido' ? Math.round((new Date(hoje + 'T12:00:00').getTime() - new Date(t.data + 'T12:00:00').getTime()) / 86400000) : 0;
          const ultima = ultimaCobranca(t.clienteId);
          const temTelefone = !!(cliente?.telefone?.ddd && cliente?.telefone?.numero);

          return (
            <div key={t.id} className="flex items-center gap-3 px-[18px] py-[12px] border-t border-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[13px] font-medium">{cliente?.nome || 'Cliente'}</span>
                  {t.status === 'Parcial' && <span className="text-[9.5px] px-1.5 py-[1px] rounded-[4px] bg-accent-soft text-accent font-medium uppercase tracking-wide">Parcial</span>}
                  {bucket === 'vencido' && <span className="text-[9.5px] px-1.5 py-[1px] rounded-[4px] bg-destructive-soft text-destructive font-medium uppercase tracking-wide">{diasAtraso}d de atraso</span>}
                </div>
                <div className="text-[11px] text-mute-2 mt-0.5 truncate">
                  {t.descricao}{trabalho && <> · {trabalho.objeto}</>} · {new Date(dataEfetiva(t) + 'T12:00:00').toLocaleDateString('pt-BR')}
                  {ultima && !isRecebido && <> · última cobrança {ultima}</>}
                </div>
              </div>
              <span className={cn('font-mono-hbs text-[14px] flex-none', isRecebido ? 'text-success' : 'text-foreground')}>
                <ValorMonetario value={fmt(t.valor)} />
              </span>
              <div className="flex-none flex items-center gap-1">
                {!isRecebido && (
                  <>
                    {temTelefone && t.clienteId && (
                      <button onClick={() => onCobrar(t.clienteId!)} title="Cobrar por WhatsApp" className="h-7 w-7 grid place-items-center rounded-lg hover:bg-warning-soft text-mute-2 hover:text-warning">
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => onRegistrarContato(t.clienteId)} title="Registrar contato (já cobrei)" className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-mute-2">
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onRegistrarRecebimento(t)} title="Registrar recebimento" className="h-7 w-7 grid place-items-center rounded-lg hover:bg-success-soft text-mute-2 hover:text-success">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {trabalho ? (
                  <button onClick={() => onAbrirTrabalho(trabalho.id)} className="h-7 px-2.5 rounded-lg border-2 text-[11px] font-medium hover:border-hover transition-colors flex items-center gap-1">
                    Trabalho <ArrowRight className="w-3 h-3" />
                  </button>
                ) : t.clienteId ? (
                  <button onClick={() => onAbrirCliente(t.clienteId!)} className="h-7 px-2.5 rounded-lg border-2 text-[11px] font-medium hover:border-hover transition-colors flex items-center gap-1">
                    Cliente <ArrowRight className="w-3 h-3" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
