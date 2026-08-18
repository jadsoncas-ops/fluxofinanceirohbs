import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight } from 'lucide-react';
import { getPropostas, getContratos, getClients } from '@/lib/storage';
import { formatBRL } from '@/lib/comercial/precificacao';
import { Proposta, PropostaStatus, ContratoStatus } from '@/lib/types';
import { NovaPropostaDialog } from '@/components/comercial/NovaPropostaDialog';
import { PropostaDetailDialog } from '@/components/comercial/PropostaDetailDialog';
import { cn } from '@/lib/utils';

const statusBadge: Record<PropostaStatus, string> = {
  Rascunho: 'bg-neutral-soft text-mute-2',
  Enviada: 'bg-accent-soft text-accent',
  'Em aprovação': 'bg-warning-soft text-warning',
  Aprovada: 'bg-success-soft text-success',
  Perdida: 'bg-destructive-soft text-destructive',
};

const contratoBadge: Record<ContratoStatus, string> = {
  Ativo: 'bg-accent-soft text-accent',
  Concluído: 'bg-success-soft text-success',
  Cancelado: 'bg-destructive-soft text-destructive',
};

function diasDesde(ts: number) {
  return Math.floor((Date.now() - ts) / 86400000);
}

export default function ComercialPage() {
  const [key, setKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [propostaAberta, setPropostaAberta] = useState<string | null>(null);
  const navigate = useNavigate();

  const { propostas, contratos, clients, funil, propostasAbertas, totalAberto, conversao } = useMemo(() => {
    void key;
    const propostas = getPropostas();
    const contratos = getContratos();
    const clients = getClients();
    const now = new Date();

    const oportunidades = propostas;
    const orcamentos = propostas.filter(p => p.status === 'Rascunho');
    const enviadas = propostas.filter(p => p.status === 'Enviada');
    const emAprovacao = propostas.filter(p => p.status === 'Em aprovação');
    const contratosNoMes = contratos.filter(c => {
      const d = new Date(c.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const sum = (list: Proposta[]) => list.reduce((s, p) => s + p.resultado.precoVenda, 0);
    const funil = [
      { n: '01', nome: 'Oportunidades', qtd: oportunidades.length, valor: sum(oportunidades) },
      { n: '02', nome: 'Orçamentos', qtd: orcamentos.length, valor: sum(orcamentos) },
      { n: '03', nome: 'Propostas enviadas', qtd: enviadas.length, valor: sum(enviadas) },
      { n: '04', nome: 'Em aprovação', qtd: emAprovacao.length, valor: sum(emAprovacao) },
      { n: '05', nome: 'Contratos no mês', qtd: contratosNoMes.length, valor: contratosNoMes.reduce((s, c) => s + c.valor, 0) },
    ];
    const maxQtd = Math.max(1, ...funil.map(f => f.qtd));

    const propostasAbertas = propostas.filter(p => p.status === 'Enviada' || p.status === 'Em aprovação' || p.status === 'Rascunho');
    const totalAberto = propostasAbertas.reduce((s, p) => s + p.resultado.precoVenda, 0);

    const decididas = propostas.filter(p => p.status === 'Aprovada' || p.status === 'Perdida');
    const aprovadas = propostas.filter(p => p.status === 'Aprovada');
    const conversao = decididas.length > 0 ? Math.round((aprovadas.length / decididas.length) * 100) : null;

    return { propostas, contratos, clients, funil: { stages: funil, maxQtd }, propostasAbertas, totalAberto, conversao };
  }, [key]);

  const clienteNome = (id: string) => clients.find(c => c.id === id)?.nome || 'Cliente';

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold -tracking-[.02em]">Comercial</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Do preço ao contrato. Quando a proposta é aprovada, o trabalho e as parcelas nascem automaticamente.</p>
        </div>
        <button onClick={() => setOpen(true)} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Nova proposta
        </button>
      </div>

      {/* Funil */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 1, background: 'hsl(var(--border))' }}>
          {funil.stages.map(s => (
            <div key={s.n} className="bg-card px-[17px] pt-4 pb-[15px]">
              <span className="text-[10.5px] font-mono-hbs text-mute-2">{s.n}</span>
              <div className="text-[13.5px] font-medium mt-1">{s.nome}</div>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="font-mono-hbs text-[20px]">{s.qtd}</span>
                <span className="text-[11.5px] text-mute-2 font-mono-hbs">{formatBRL(s.valor)}</span>
              </div>
              <div className="h-[3px] rounded-full bg-bar-track mt-2 overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${(s.qtd / funil.maxQtd) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {/* Propostas em aberto */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-[18px] py-[15px] border-b border-3 flex items-center justify-between">
            <span className="text-[13.5px] font-semibold">Propostas em aberto</span>
            <span className="text-[11.5px] text-mute-2 font-mono-hbs">{formatBRL(totalAberto)}</span>
          </div>
          {propostasAbertas.length === 0 ? (
            <div className="px-[18px] py-10 text-center">
              <p className="text-sm font-medium">Nenhuma proposta em aberto</p>
              <p className="text-xs text-muted-foreground mt-1">Crie a primeira proposta reaproveitando os dados de um cliente já cadastrado.</p>
            </div>
          ) : (
            propostasAbertas.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-[18px] py-[12px] border-b border-3 last:border-b-0 hover:bg-surface-3 transition-colors cursor-pointer" onClick={() => setPropostaAberta(p.id)}>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{p.codigo} · {p.titulo}</div>
                  <div className="text-[11px] text-mute-2 mt-0.5">{clienteNome(p.clienteId)} · {formatBRL(p.resultado.precoVenda)}</div>
                </div>
                <span className={cn('flex-none text-[11px] px-2 py-[3px] rounded-[5px] font-medium', statusBadge[p.status])}>
                  {p.status === 'Enviada' && p.enviadaEm ? `Sem resposta ${diasDesde(p.enviadaEm)}d` : p.status}
                </span>
              </div>
            ))
          )}
        </section>

        <div className="flex flex-col gap-[18px]">
          {/* Conversão */}
          <section className="bg-card border border-border rounded-xl p-[17px_18px]">
            <div className="text-[13.5px] font-semibold mb-2">Conversão</div>
            {conversao === null ? (
              <p className="text-xs text-muted-foreground">Ainda não há propostas aprovadas ou perdidas suficientes para calcular a conversão.</p>
            ) : (
              <>
                <div className="font-mono-hbs text-[26px] -tracking-[.03em]">{conversao}%</div>
                <p className="text-[12.5px] text-muted-foreground mt-2">das propostas decididas viraram contrato.</p>
              </>
            )}
          </section>

          {/* Precificação */}
          <section className="bg-card border border-border rounded-xl p-[17px_18px]">
            <div className="text-[13.5px] font-semibold">Precificação</div>
            <p className="text-[12.5px] text-muted-foreground mt-2 leading-[1.5]">Monte o preço a partir de horas técnicas, custos diretos e margem. O valor calculado alimenta a proposta sem redigitação.</p>
            <button onClick={() => setOpen(true)} className="mt-3.5 h-[34px] px-3.5 bg-card border-2 rounded-lg text-[12.5px] hover:border-hover transition-colors">Abrir precificação</button>
          </section>
        </div>
      </div>

      {/* Contratos */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-[18px] py-[15px] border-b border-3 text-[13.5px] font-semibold">Contratos</div>
        {contratos.length === 0 ? (
          <div className="px-[18px] py-8 text-center text-xs text-muted-foreground">Nenhum contrato ainda. Aprove uma proposta para gerar o primeiro.</div>
        ) : (
          contratos.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-[18px] py-[12px] border-b border-3 last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium truncate">{c.codigo} · {clienteNome(c.clienteId)}</div>
                <div className="text-[11px] text-mute-2 mt-0.5 font-mono-hbs">{formatBRL(c.valor)} · {new Date(c.createdAt).toLocaleDateString('pt-BR')}</div>
              </div>
              <span className={cn('flex-none text-[11px] px-2 py-[3px] rounded-[5px] font-medium', contratoBadge[c.status])}>{c.status}</span>
              {c.trabalhoId ? (
                <button onClick={() => navigate(`/trabalhos/${c.trabalhoId}`)} className="flex-none text-[11.5px] font-medium text-accent flex items-center gap-1">Ver trabalho <ArrowRight className="w-3 h-3" /></button>
              ) : (
                <button onClick={() => setPropostaAberta(c.propostaId)} className="flex-none text-[11.5px] font-medium text-accent">Criar trabalho</button>
              )}
            </div>
          ))
        )}
      </section>

      <NovaPropostaDialog open={open} onClose={() => setOpen(false)} onSaved={() => setKey(k => k + 1)} />
      <PropostaDetailDialog propostaId={propostaAberta} onClose={() => setPropostaAberta(null)} onChanged={() => setKey(k => k + 1)} />
    </div>
  );
}
