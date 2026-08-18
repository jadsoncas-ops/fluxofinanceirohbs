import { useMemo, useState } from 'react';
import { useShell } from '@/hooks/use-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const HORIZONS = [
  { key: '0', label: 'Hoje', days: 0 },
  { key: '7', label: 'Semana', days: 7 },
  { key: '30', label: 'Mês', days: 30 },
  { key: '90', label: '3 meses', days: 90 },
  { key: '180', label: '6 meses', days: 180 },
  { key: '365', label: '12 meses', days: 365 },
] as const;

export default function FinanceiroFluxoDeCaixaPage() {
  const { allTransactions } = useShell();
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(HORIZONS[3]);

  const { points, saldoAtual, saldoProjetado, negativeAlert } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const saldoAtual = allTransactions
      .filter(t => t.status === 'Concluído')
      .reduce((s, t) => {
        const isEntrada = t.tipo === 'Entrada' || t.tipo === 'A Receber';
        return s + (isEntrada ? t.valor : -t.valor);
      }, 0);

    const horizonEnd = new Date(today);
    horizonEnd.setDate(horizonEnd.getDate() + horizon.days);
    const horizonEndStr = horizonEnd.toISOString().slice(0, 10);

    const pending = allTransactions
      .filter(t => t.status !== 'Concluído' && t.data >= todayStr && t.data <= horizonEndStr)
      .sort((a, b) => a.data.localeCompare(b.data));

    const byDate = new Map<string, number>();
    pending.forEach(t => {
      const isEntrada = t.tipo === 'Entrada' || t.tipo === 'A Receber';
      const delta = isEntrada ? t.valor : -t.valor;
      byDate.set(t.data, (byDate.get(t.data) || 0) + delta);
    });

    const dates = Array.from(byDate.keys()).sort();
    let running = saldoAtual;
    const points: { date: string; saldo: number }[] = [{ date: 'Hoje', saldo: saldoAtual }];
    let negativeAlert: { date: string; saldo: number } | null = null;

    dates.forEach(d => {
      running += byDate.get(d)!;
      const [, m, day] = d.split('-');
      points.push({ date: `${day}/${m}`, saldo: running });
      if (running < 0 && !negativeAlert) {
        negativeAlert = { date: `${day}/${m}`, saldo: running };
      }
    });

    return { points, saldoAtual, saldoProjetado: running, negativeAlert };
  }, [allTransactions, horizon]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight">Fluxo de Caixa</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Saldo realizado hoje + entradas e saídas previstas no período</p>
        </div>
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
          {HORIZONS.map(h => (
            <button
              key={h.key}
              onClick={() => setHorizon(h)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all',
                horizon.key === h.key ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {negativeAlert && (
        <Card className="border-destructive/40 bg-destructive/5 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-destructive/10 p-2 rounded-full hidden sm:block">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm text-foreground/90">
              Seu caixa projetado fica <strong className="text-destructive">negativo em R$ {Math.abs(negativeAlert.saldo).toFixed(2)}</strong> por volta de <strong>{negativeAlert.date}</strong>, considerando os lançamentos previstos até {horizon.label.toLowerCase()}.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Saldo atual (realizado)</span>
            <div className="text-3xl font-black tabular-nums mt-1">R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Saldo projetado — {horizon.label.toLowerCase()}</span>
            <div className={cn('text-3xl font-black tabular-nums mt-1', saldoProjetado < 0 ? 'text-destructive' : 'text-success')}>
              R$ {saldoProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Projeção de saldo</CardTitle>
          <CardDescription className="text-xs">Considera apenas lançamentos pendentes (previstos) dentro do horizonte selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Saldo projetado']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#saldoFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
