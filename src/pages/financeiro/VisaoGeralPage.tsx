import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getClients, getAccounts } from '@/lib/storage';
import { cn } from '@/lib/utils';

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FinanceiroVisaoGeralPage() {
  const { allTransactions } = useShell();
  const navigate = useNavigate();

  const { kpis, points, negativeAlert, proximasReceber, proximasPagar, movimentacoes, clientes } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const monthStr = todayStr.slice(0, 7);
    const clientes = getClients();
    const contasSaldo = getAccounts().filter(a => a.ativo).reduce((s, a) => s + a.saldo, 0);

    const isIncome = (t: typeof allTransactions[number]) => t.tipo === 'Entrada' || t.tipo === 'A Receber';
    const isExpense = (t: typeof allTransactions[number]) => t.tipo === 'Saída' || t.tipo === 'A Pagar';

    const realizadas = allTransactions.filter(t => t.status === 'Concluído');
    const saldoRealizado = realizadas.reduce((s, t) => s + (isIncome(t) ? t.valor : -t.valor), 0);
    const saldoAtual = contasSaldo || saldoRealizado;

    const entradasMes = realizadas.filter(t => isIncome(t) && t.data.slice(0, 7) === monthStr).reduce((s, t) => s + t.valor, 0);
    const saidasMes = realizadas.filter(t => isExpense(t) && t.data.slice(0, 7) === monthStr).reduce((s, t) => s + t.valor, 0);

    const pendentes = allTransactions.filter(t => t.status !== 'Concluído');
    const aReceber = pendentes.filter(isIncome).reduce((s, t) => s + t.valor, 0);
    const aPagar = pendentes.filter(isExpense).reduce((s, t) => s + t.valor, 0);
    const saldoProjetado = saldoAtual + aReceber - aPagar;

    // Projeção 90 dias (usada no gráfico)
    const horizonEnd = new Date(today);
    horizonEnd.setDate(horizonEnd.getDate() + 90);
    const horizonEndStr = horizonEnd.toISOString().slice(0, 10);
    const futuras = pendentes.filter(t => t.data >= todayStr && t.data <= horizonEndStr).sort((a, b) => a.data.localeCompare(b.data));
    const byDate = new Map<string, number>();
    futuras.forEach(t => byDate.set(t.data, (byDate.get(t.data) || 0) + (isIncome(t) ? t.valor : -t.valor)));
    const dates = Array.from(byDate.keys()).sort();
    let running = saldoAtual;
    const points: { date: string; saldo: number }[] = [{ date: 'Hoje', saldo: saldoAtual }];
    let negativeAlert: { date: string; saldo: number } | null = null;
    dates.forEach(d => {
      running += byDate.get(d)!;
      const [, m, day] = d.split('-');
      points.push({ date: `${day}/${m}`, saldo: running });
      if (running < 0 && !negativeAlert) negativeAlert = { date: `${day}/${m}`, saldo: running };
    });

    const nomeCliente = (id?: string | null) => clientes.find(c => c.id === id)?.nome || 'Sem cliente';

    const proximasReceber = pendentes.filter(isIncome).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 6)
      .map(t => ({ ...t, atrasado: t.data < todayStr, clienteNome: nomeCliente(t.clienteId) }));
    const proximasPagar = pendentes.filter(isExpense).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 6)
      .map(t => ({ ...t, atrasado: t.data < todayStr, clienteNome: nomeCliente(t.clienteId) }));
    const movimentacoes = realizadas.sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8)
      .map(t => ({ ...t, clienteNome: nomeCliente(t.clienteId) }));

    return {
      kpis: { saldoAtual, entradasMes, saidasMes, aReceber, aPagar, saldoProjetado },
      points, negativeAlert, proximasReceber, proximasPagar, movimentacoes, clientes,
    };
  }, [allTransactions]);

  const kpiCards = [
    { label: 'Saldo atual', value: kpis.saldoAtual, cls: kpis.saldoAtual >= 0 ? 'text-foreground' : 'text-destructive' },
    { label: 'Entradas do mês', value: kpis.entradasMes, cls: 'text-success' },
    { label: 'Saídas do mês', value: kpis.saidasMes, cls: 'text-destructive' },
    { label: 'A receber', value: kpis.aReceber, cls: 'text-accent' },
    { label: 'A pagar', value: kpis.aPagar, cls: 'text-warning' },
    { label: 'Saldo projetado', value: kpis.saldoProjetado, cls: kpis.saldoProjetado >= 0 ? 'text-foreground' : 'text-destructive' },
  ];

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div className="grid gap-px bg-border border border-border rounded-xl overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {kpiCards.map(k => (
          <div key={k.label} className="bg-card px-[16px] py-[14px]">
            <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">{k.label}</div>
            <div className={cn('font-mono-hbs text-[19px] mt-1.5', k.cls)}>{fmt(k.value)}</div>
          </div>
        ))}
      </div>

      {negativeAlert && (
        <div className="bg-destructive-soft border border-destructive/30 rounded-xl p-[14px_18px] flex items-center gap-3">
          <AlertTriangle className="w-4.5 h-4.5 text-destructive flex-none" />
          <p className="text-[12.5px] text-foreground">
            Seu caixa projetado fica <strong className="text-destructive">negativo em {fmt(Math.abs(negativeAlert.saldo))}</strong> por volta de <strong>{negativeAlert.date}</strong>.
          </p>
        </div>
      )}

      <section className="bg-card border border-border rounded-xl p-[17px_18px]">
        <div className="flex items-center justify-between">
          <div className="text-[13.5px] font-semibold">Fluxo dos próximos meses</div>
          <button onClick={() => navigate('/caixa/fluxo-de-caixa')} className="text-[11.5px] font-medium text-accent">Ver detalhado →</button>
        </div>
        <div className="h-[220px] mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="saldoFillVG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
              <Tooltip formatter={(value: number) => [fmt(value), 'Saldo projetado']} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
              <Area type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#saldoFillVG)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <ListaSection titulo="Contas a receber" itens={proximasReceber} vazio="Nada a receber no momento." verHref="/caixa/receitas" navigate={navigate} tipo="receber" />
        <ListaSection titulo="Contas a pagar" itens={proximasPagar} vazio="Nada a pagar no momento." verHref="/caixa/despesas" navigate={navigate} tipo="pagar" />
      </div>

      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-[18px] py-[15px] border-b border-3 text-[13.5px] font-semibold">Movimentações recentes</div>
        {movimentacoes.length === 0 ? (
          <div className="px-[18px] py-8 text-center text-xs text-muted-foreground">Nenhuma movimentação concluída ainda.</div>
        ) : (
          movimentacoes.map(t => {
            const isIncome = t.tipo === 'Entrada' || t.tipo === 'A Receber';
            return (
              <div key={t.id} className="flex items-center gap-3 px-[18px] py-[10px] border-t border-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{t.descricao}</div>
                  <div className="text-[11px] text-mute-2">{t.clienteNome} · {new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                </div>
                <span className={cn('font-mono-hbs text-[12.5px] flex-none', isIncome ? 'text-success' : 'text-destructive')}>{isIncome ? '+' : '−'} {fmt(t.valor)}</span>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function ListaSection({ titulo, itens, vazio, verHref, navigate, tipo }: {
  titulo: string;
  itens: { id: string; descricao: string; valor: number; data: string; atrasado: boolean; clienteNome: string }[];
  vazio: string;
  verHref: string;
  navigate: (href: string) => void;
  tipo: 'receber' | 'pagar';
}) {
  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-[18px] py-[15px] border-b border-3">
        <span className="text-[13.5px] font-semibold">{titulo}</span>
        <button onClick={() => navigate(verHref)} className="text-[11.5px] font-medium text-accent">Ver todas →</button>
      </div>
      {itens.length === 0 ? (
        <div className="px-[18px] py-8 text-center text-xs text-muted-foreground">{vazio}</div>
      ) : (
        itens.map(t => (
          <div key={t.id} className="flex items-center gap-3 px-[18px] py-[10px] border-t border-3">
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium truncate">{t.descricao}</div>
              <div className="text-[11px] text-mute-2">{t.clienteNome}</div>
            </div>
            <div className="text-right flex-none">
              <div className={cn('font-mono-hbs text-[12.5px]', tipo === 'receber' ? 'text-accent' : 'text-warning')}>{fmt(t.valor)}</div>
              <div className={cn('text-[10.5px] mt-0.5', t.atrasado ? 'text-destructive font-medium' : 'text-mute-3')}>
                {t.atrasado ? 'Atrasada' : new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
