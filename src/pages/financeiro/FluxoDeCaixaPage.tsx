import { useMemo, useState } from 'react';
import { useShell } from '@/hooks/use-shell';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const HORIZONS = [
  { key: '0', label: 'Hoje', days: 0 },
  { key: '7', label: 'Semana', days: 7 },
  { key: '30', label: 'Mês', days: 30 },
  { key: '90', label: '3 meses', days: 90 },
  { key: '180', label: '6 meses', days: 180 },
  { key: '365', label: '12 meses', days: 365 },
] as const;

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FinanceiroFluxoDeCaixaPage() {
  const { allTransactions } = useShell();
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(HORIZONS[3]);

  const { points, saldoAtual, saldoProjetado, negativeAlert, aReceberPeriodo, aPagarPeriodo } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const isEntrada = (t: typeof allTransactions[number]) => t.tipo === 'Entrada' || t.tipo === 'A Receber';

    const saldoAtual = allTransactions
      .filter(t => t.status === 'Concluído')
      .reduce((s, t) => s + (isEntrada(t) ? t.valor : -t.valor), 0);

    const horizonEnd = new Date(today);
    horizonEnd.setDate(horizonEnd.getDate() + horizon.days);
    const horizonEndStr = horizonEnd.toISOString().slice(0, 10);

    const pending = allTransactions
      .filter(t => t.status !== 'Concluído' && t.data >= todayStr && t.data <= horizonEndStr)
      .sort((a, b) => a.data.localeCompare(b.data));

    const aReceberPeriodo = pending.filter(isEntrada).reduce((s, t) => s + t.valor, 0);
    const aPagarPeriodo = pending.filter(t => !isEntrada(t)).reduce((s, t) => s + t.valor, 0);

    const byDate = new Map<string, number>();
    pending.forEach(t => byDate.set(t.data, (byDate.get(t.data) || 0) + (isEntrada(t) ? t.valor : -t.valor)));

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

    return { points, saldoAtual, saldoProjetado: running, negativeAlert, aReceberPeriodo, aPagarPeriodo };
  }, [allTransactions, horizon]);

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-semibold">Fluxo de caixa</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">Saldo realizado hoje + entradas e saídas previstas no período</p>
        </div>
        <div className="flex gap-1 bg-surface-2 p-1 rounded-xl border border-3">
          {HORIZONS.map(h => (
            <button
              key={h.key}
              onClick={() => setHorizon(h)}
              className={cn(
                'px-2.5 py-[7px] rounded-lg text-[11px] font-medium uppercase tracking-wide transition-colors whitespace-nowrap',
                horizon.key === h.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {negativeAlert && (
        <div className="bg-destructive-soft border border-destructive/30 rounded-xl p-[14px_18px] flex items-center gap-3">
          <AlertTriangle className="w-4.5 h-4.5 text-destructive flex-none" />
          <p className="text-[12.5px] text-foreground">
            Seu caixa projetado fica <strong className="text-destructive">negativo em {fmt(Math.abs(negativeAlert.saldo))}</strong> por volta de <strong>{negativeAlert.date}</strong>, considerando os lançamentos previstos até {horizon.label.toLowerCase()}.
          </p>
        </div>
      )}

      <div className="grid gap-px bg-border border border-border rounded-xl overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="bg-card px-[16px] py-[14px]">
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">Saldo atual (realizado)</div>
          <div className="font-mono-hbs text-[20px] mt-1.5">{fmt(saldoAtual)}</div>
        </div>
        <div className="bg-card px-[16px] py-[14px]">
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">A receber ({horizon.label.toLowerCase()})</div>
          <div className="font-mono-hbs text-[20px] mt-1.5 text-accent">{fmt(aReceberPeriodo)}</div>
        </div>
        <div className="bg-card px-[16px] py-[14px]">
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">A pagar ({horizon.label.toLowerCase()})</div>
          <div className="font-mono-hbs text-[20px] mt-1.5 text-warning">{fmt(aPagarPeriodo)}</div>
        </div>
        <div className="bg-card px-[16px] py-[14px]">
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">Saldo projetado</div>
          <div className={cn('font-mono-hbs text-[20px] mt-1.5', saldoProjetado < 0 ? 'text-destructive' : 'text-success')}>{fmt(saldoProjetado)}</div>
        </div>
      </div>

      <section className="bg-card border border-border rounded-xl p-[17px_18px]">
        <div className="text-[13.5px] font-semibold">Projeção de saldo</div>
        <p className="text-[11.5px] text-muted-foreground mt-0.5">Considera apenas lançamentos pendentes (previstos) dentro do horizonte selecionado</p>
        <div className="h-[280px] mt-3.5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
              <Tooltip formatter={(value: number) => [fmt(value), 'Saldo projetado']} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
              <Area type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#saldoFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
