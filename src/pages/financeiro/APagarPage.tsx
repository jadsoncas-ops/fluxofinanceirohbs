import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, SlidersHorizontal } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getClients, getProcesses, getPartners } from '@/lib/storage';
import { isIncome, agruparLancamentos, LancamentoGrupo } from '@/lib/lancamentos';
import { DetalheLancamentoDialog } from '@/components/financeiro/DetalheLancamentoDialog';
import { ValorMonetario } from '@/components/ValorMonetario';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';

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

/** A Pagar — "quem eu preciso pagar e quanto?". Usa o mesmo critério que já alimenta
 *  totalAPagar (lib/financials.ts, usado na Visão Geral/Dashboard): qualquer Saída/A Pagar
 *  ainda não Concluído, sem exigir vínculo com parceiro — uma despesa geral sem parceiro
 *  cadastrado continua sendo "a pagar" (nem toda Saída pendente é repasse). Isso garante que
 *  o total aqui sempre bate com o KPI "A pagar" do resto do app. Fase 4D: espelha a estrutura
 *  de A Receber (lib/lancamentos.ts + seções por urgência), com semântica de saída — "Pago"/
 *  "Restante", nunca "Recebido". Sem ação de WhatsApp aqui: Partner (lib/types.ts) não tem
 *  telefone estruturado como Client, e a Fase 4D não pede lembrete de pagamento. */
export default function FinanceiroAPagarPage() {
  const shell = useShell();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filtroBeneficiario, setFiltroBeneficiario] = useState<string | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [detalhe, setDetalhe] = useState<Transaction | null>(null);

  const { grupos, totalPorBucket, totalGeral, clientesMap, partnersMap, processes, beneficiariosComPendencia } = useMemo(() => {
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
    const gruposBrutos = agruparLancamentos(pagaveis).filter(g => g.valorRestante > 0);

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

    function beneficiarioDe(t: Transaction): string | null {
      if (t.partnerId) return partnersMap.get(t.partnerId)?.nome || null;
      if (t.clienteId) return clientesMap.get(t.clienteId)?.nome || null;
      return null;
    }
    const beneficiariosComPendencia = Array.from(new Set(
      grupos.map(g => beneficiarioDe(g.grupo.itens[0])).filter((n): n is string => !!n)
    )).sort((a, b) => a.localeCompare(b));

    return { grupos, totalPorBucket, totalGeral, clientesMap, partnersMap, processes, beneficiariosComPendencia };
  }, [shell.allTransactions]);

  function beneficiarioDoGrupo(grupo: LancamentoGrupo): string | null {
    const primeiro = grupo.itens[0];
    if (primeiro.partnerId) return partnersMap.get(primeiro.partnerId)?.nome || null;
    if (primeiro.clienteId) return clientesMap.get(primeiro.clienteId)?.nome || null;
    return null;
  }

  const gruposFiltrados = useMemo(() => {
    let items = grupos;
    if (filtroBeneficiario) items = items.filter(g => beneficiarioDoGrupo(g.grupo) === filtroBeneficiario);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(({ grupo }) => {
        const beneficiario = beneficiarioDoGrupo(grupo);
        const trabalho = grupo.itens[0].processId ? processes.find(p => p.id === grupo.itens[0].processId) : undefined;
        const descricaoBase = grupo.itens[0].descricao.replace(/\s*\(Restante\)\s*$/i, '');
        return (beneficiario || '').toLowerCase().includes(q) || descricaoBase.toLowerCase().includes(q) || (trabalho?.objeto || '').toLowerCase().includes(q);
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupos, search, filtroBeneficiario, processes]);

  const blocos = useMemo(() => {
    const mapa = new Map<Bucket, GrupoComBucket[]>();
    for (const item of gruposFiltrados) {
      const arr = mapa.get(item.bucket);
      if (arr) arr.push(item); else mapa.set(item.bucket, [item]);
    }
    for (const arr of mapa.values()) arr.sort((a, b) => (a.grupo.proximoVencimento || '9999').localeCompare(b.grupo.proximoVencimento || '9999'));
    return BUCKET_ORDER.filter(b => mapa.has(b)).map(b => [b, mapa.get(b)!] as const);
  }, [gruposFiltrados]);

  const filtrosAtivos = !!filtroBeneficiario;

  function statusDoGrupo(grupo: LancamentoGrupo, bucket: Bucket): { label: string; tone: BadgeTone } {
    if (grupo.parcelado) return { label: 'Parcial', tone: 'accent' };
    if (bucket === 'vencido') return { label: 'Vencido', tone: 'destructive' };
    if (bucket === 'hoje') return { label: 'Vence hoje', tone: 'warning' };
    return { label: 'A vencer', tone: 'neutral' };
  }

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div>
        <h1 className="text-[16px] font-semibold">A pagar</h1>
        <p className="text-[12px] text-mute-2 mt-0.5">Quem você precisa pagar e quanto.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border border border-border rounded-xl overflow-hidden">
        <KpiCard label="Total a pagar" value={fmt(totalGeral)} size="hero" />
        <KpiCard label="Total vencido" value={fmt(totalPorBucket.vencido)} size="hero" tone={totalPorBucket.vencido > 0 ? 'destructive' : 'default'} />
      </div>

      <div className="flex items-center gap-2">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar fornecedor ou lançamento..." className="flex-1 h-9 text-[13px] border-2" />
        <Popover open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
          <PopoverTrigger asChild>
            <button className={cn('h-9 px-3 rounded-lg border-2 text-[12.5px] font-medium flex items-center gap-1.5 flex-none transition-colors', filtrosAtivos ? 'border-primary text-primary' : 'hover:border-hover')}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros {filtrosAtivos && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[240px] space-y-3">
            <div>
              <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2 mb-1.5">Fornecedor/parceiro</div>
              <div className="flex gap-1 flex-wrap max-h-[220px] overflow-y-auto">
                <button onClick={() => setFiltroBeneficiario(null)} className={cn('px-2.5 py-1 rounded-md text-[11px] font-medium border', !filtroBeneficiario ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-mute-2 hover:border-hover')}>Todos</button>
                {beneficiariosComPendencia.map(nome => (
                  <button key={nome} onClick={() => setFiltroBeneficiario(prev => (prev === nome ? null : nome))} className={cn('px-2.5 py-1 rounded-md text-[11px] font-medium border', filtroBeneficiario === nome ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-mute-2 hover:border-hover')}>{nome}</button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {blocos.length === 0 ? (
        <div className="bg-success-soft border border-success/30 rounded-xl p-[18px] text-[13px] text-success font-medium">
          {search || filtroBeneficiario ? 'Nada encontrado.' : 'Nenhum pagamento pendente agora — tudo em dia.'}
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
                  {itens.map(({ grupo, bucket: b }, i) => {
                    const trabalho = grupo.itens[0].processId ? processes.find(p => p.id === grupo.itens[0].processId) : undefined;
                    return (
                      <LinhaAPagar
                        key={grupo.chave}
                        grupo={grupo}
                        status={statusDoGrupo(grupo, b)}
                        isFirst={i === 0}
                        beneficiario={beneficiarioDoGrupo(grupo)}
                        trabalho={trabalho}
                        onAbrirDetalhe={() => setDetalhe(grupo.itens.find(t => t.status !== 'Concluído') || grupo.itens[0])}
                        onPagar={() => shell.openCompleteTransaction(grupo.itens.find(t => t.status !== 'Concluído')!)}
                        onAbrirTrabalho={() => trabalho && navigate(`/trabalhos/${trabalho.id}`)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DetalheLancamentoDialog transaction={detalhe} onClose={() => setDetalhe(null)} />
    </div>
  );
}

function LinhaAPagar({ grupo, status, isFirst, beneficiario, trabalho, onAbrirDetalhe, onPagar, onAbrirTrabalho }: {
  grupo: LancamentoGrupo;
  status: { label: string; tone: BadgeTone };
  isFirst: boolean;
  beneficiario: string | null;
  trabalho?: { id: string; objeto: string };
  onAbrirDetalhe: () => void;
  onPagar: () => void;
  onAbrirTrabalho: () => void;
}) {
  const descricaoBase = grupo.itens[0].descricao.replace(/\s*\(Restante\)\s*$/i, '');

  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center gap-2.5 px-[18px] py-[13px]', !isFirst && 'border-t border-3')}>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onAbrirDetalhe}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-medium">{beneficiario || 'Sem beneficiário cadastrado'}</span>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <div className="text-[11px] text-mute-2 mt-0.5 truncate">
          {descricaoBase}{trabalho && <> · {trabalho.objeto}</>}
        </div>
        <div className="text-[11px] text-mute-3 mt-0.5">
          Vencimento {grupo.proximoVencimento ? fmtData(grupo.proximoVencimento) : '—'}
          {grupo.parcelado && <> · Total {fmt(grupo.valorTotal)} · Pago {fmt(grupo.valorRecebido)}</>}
        </div>
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
