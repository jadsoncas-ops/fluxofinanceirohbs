import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getClients, getProcesses, getPartners } from '@/lib/storage';
import { isIncome, agruparLancamentos, LancamentoGrupo } from '@/lib/lancamentos';
import { DetalheLancamentoDialog } from '@/components/financeiro/DetalheLancamentoDialog';
import { ValorMonetario } from '@/components/ValorMonetario';
import { Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';

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

/** A Pagar — "quem eu preciso pagar e quanto?". Usa o mesmo critério que já alimenta
 *  totalAPagar (lib/financials.ts, usado na Visão Geral/Dashboard): qualquer Saída/A Pagar
 *  ainda não Concluído, sem exigir vínculo com parceiro — uma despesa geral sem parceiro
 *  cadastrado continua sendo "a pagar" (nem toda Saída pendente é repasse). Isso garante que
 *  o total aqui sempre bate com o KPI "A pagar" do resto do app. */
export default function FinanceiroAPagarPage() {
  const shell = useShell();
  const navigate = useNavigate();
  const [filtroBucket, setFiltroBucket] = useState<Bucket | null>(null);
  const [detalhe, setDetalhe] = useState<Transaction | null>(null);

  const { grupos, totalPorBucket, totalGeral, clientesMap, partnersMap, processes } = useMemo(() => {
    const clients = getClients();
    const processes = getProcesses();
    const partners = getPartners();
    const clientesMap = new Map(clients.map(c => [c.id, c]));
    const partnersMap = new Map(partners.map(p => [p.id, p]));
    const hoje = new Date().toISOString().slice(0, 10);
    const em7 = new Date(); em7.setDate(em7.getDate() + 7);
    const em7Str = em7.toISOString().slice(0, 10);
    const em30 = new Date(); em30.setDate(em30.getDate() + 30);
    const em30Str = em30.toISOString().slice(0, 10);

    const pagaveis = shell.allTransactions.filter(t => !isIncome(t));
    const grupos = agruparLancamentos(pagaveis)
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

    return { grupos: gruposComBucket, totalPorBucket, totalGeral, clientesMap, partnersMap, processes };
  }, [shell.allTransactions]);

  const gruposVisiveis = filtroBucket ? grupos.filter(g => g.bucket === filtroBucket) : grupos;

  function toggleBucket(b: Bucket) {
    setFiltroBucket(prev => (prev === b ? null : b));
  }

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div>
        <h1 className="text-[16px] font-semibold">A Pagar</h1>
        <p className="text-[12px] text-mute-2 mt-0.5">Quem você precisa pagar e quanto.</p>
      </div>

      <div className="bg-card border border-border rounded-xl px-[20px] py-[18px]">
        <div className="text-[11px] uppercase tracking-[.07em] text-mute-2">Total a pagar</div>
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
          {filtroBucket ? 'Nada nesse período.' : 'Nenhum pagamento pendente agora — tudo em dia.'}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {gruposVisiveis.map(({ grupo, bucket }, i) => {
            const primeiro = grupo.itens[0];
            const parceiro = primeiro.partnerId ? partnersMap.get(primeiro.partnerId) : undefined;
            const cliente = primeiro.clienteId ? clientesMap.get(primeiro.clienteId) : undefined;
            const trabalho = primeiro.processId ? processes.find(p => p.id === primeiro.processId) : undefined;
            return (
              <LinhaAPagar
                key={grupo.chave}
                grupo={grupo}
                bucket={bucket}
                isFirst={i === 0}
                beneficiario={parceiro?.nome || cliente?.nome || null}
                trabalho={trabalho}
                onAbrirDetalhe={() => setDetalhe(grupo.itens.find(t => t.status !== 'Concluído') || grupo.itens[0])}
                onPagar={() => shell.openCompleteTransaction(grupo.itens.find(t => t.status !== 'Concluído')!)}
                onAbrirTrabalho={() => trabalho && navigate(`/trabalhos/${trabalho.id}`)}
              />
            );
          })}
        </div>
      )}

      <DetalheLancamentoDialog transaction={detalhe} onClose={() => setDetalhe(null)} />
    </div>
  );
}

function LinhaAPagar({ grupo, bucket, isFirst, beneficiario, trabalho, onAbrirDetalhe, onPagar, onAbrirTrabalho }: {
  grupo: LancamentoGrupo;
  bucket: Bucket | null;
  isFirst: boolean;
  beneficiario: string | null;
  trabalho?: { id: string; objeto: string };
  onAbrirDetalhe: () => void;
  onPagar: () => void;
  onAbrirTrabalho: () => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const v = grupo.proximoVencimento;
  const diasDiff = v ? Math.round((new Date(v + 'T12:00:00').getTime() - new Date(hoje + 'T12:00:00').getTime()) / 86400000) : null;
  const statusTexto = v == null ? '—' : diasDiff! < 0 ? `Vencido há ${Math.abs(diasDiff!)}d` : diasDiff === 0 ? 'Vence hoje' : `Vence em ${diasDiff}d`;
  const descricaoBase = grupo.itens[0].descricao.replace(/\s*\(Restante\)\s*$/i, '');

  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center gap-2.5 px-[18px] py-[13px]', !isFirst && 'border-t border-3')}>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onAbrirDetalhe}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-medium">{beneficiario || descricaoBase}</span>
          <span className={cn('text-[9.5px] px-1.5 py-[1px] rounded-[4px] font-medium uppercase tracking-wide',
            bucket === 'vencido' ? 'bg-destructive-soft text-destructive' : bucket === 'hoje' ? 'bg-warning-soft text-warning' : 'bg-neutral-soft text-mute-2')}>
            {statusTexto}
          </span>
        </div>
        <div className="text-[11px] text-mute-2 mt-0.5 truncate">
          {beneficiario ? descricaoBase : 'Sem beneficiário cadastrado'}{trabalho && <> · {trabalho.objeto}</>}
        </div>
        {grupo.parcelado && (
          <div className="text-[11px] text-mute-3 mt-0.5">Pago {fmt(grupo.valorRecebido)} de {fmt(grupo.valorTotal)}</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap pl-0 sm:pl-2">
        <span className="font-mono-hbs text-[14px] flex-none"><ValorMonetario value={fmt(grupo.valorRestante)} /></span>
        <div className="flex flex-wrap items-center gap-1">
          <button onClick={onPagar} className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-colors flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Pagar
          </button>
          {trabalho && (
            <button onClick={onAbrirTrabalho} className="h-7 px-2.5 rounded-lg border-2 text-[11px] font-medium hover:border-hover transition-colors flex items-center gap-1">
              Trabalho <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
