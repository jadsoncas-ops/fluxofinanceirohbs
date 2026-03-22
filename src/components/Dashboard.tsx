import { useMemo } from 'react';
import { Transaction } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getTipOfDay } from '@/lib/tips';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ArrowDownLeft, ArrowUpRight, Lightbulb, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Scale } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  month: number;
  year: number;
}

export function Dashboard({ transactions, month, year }: Props) {
  const stats = useMemo(() => {
    const entradas = transactions.filter(t => t.tipo === 'Entrada' && t.status === 'Concluído').reduce((s, t) => s + t.valor, 0);
    const saidas = transactions.filter(t => t.tipo === 'Saída' && t.status === 'Concluído').reduce((s, t) => s + t.valor, 0);
    const aReceber = transactions.filter(t => t.tipo === 'A Receber').reduce((s, t) => s + t.valor, 0);
    const aPagar = transactions.filter(t => t.tipo === 'A Pagar').reduce((s, t) => s + t.valor, 0);
    const saldo = entradas - saidas;
    const saldoPendente = aReceber - aPagar;
    const totalPrevisto = entradas + aReceber;
    const percentRecebido = totalPrevisto > 0 ? (entradas / totalPrevisto) * 100 : 0;
    return { entradas, saidas, aReceber, aPagar, saldo, saldoPendente, percentRecebido };
  }, [transactions]);

  const today = new Date().toISOString().slice(0, 10);
  const todayParsed = new Date(today + 'T12:00:00');

  const alerts = useMemo(() => {
    const threeDays = new Date(todayParsed);
    threeDays.setDate(threeDays.getDate() + 3);
    return transactions.filter(t => {
      if (t.status !== 'Pendente') return false;
      const d = new Date(t.data + 'T12:00:00');
      return d <= threeDays;
    });
  }, [transactions, today]);

  const chartData = [
    { name: 'Receitas', value: stats.entradas },
    { name: 'Despesas', value: stats.saidas },
  ];

  // Calendar data
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: { date: number; status: 'none' | 'green' | 'yellow' | 'red' }[] = [];

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTxs = transactions.filter(t => t.data === dateStr);
      if (dayTxs.length === 0) {
        days.push({ date: d, status: 'none' });
      } else {
        const hasOverdue = dayTxs.some(t => t.status === 'Pendente' && dateStr < today);
        const hasUpcoming = dayTxs.some(t => {
          if (t.status !== 'Pendente') return false;
          const diff = (new Date(dateStr + 'T12:00:00').getTime() - todayParsed.getTime()) / 86400000;
          return diff >= 0 && diff <= 3;
        });
        const allDone = dayTxs.every(t => t.status === 'Concluído');
        if (hasOverdue) days.push({ date: d, status: 'red' });
        else if (hasUpcoming) days.push({ date: d, status: 'yellow' });
        else if (allDone) days.push({ date: d, status: 'green' });
        else days.push({ date: d, status: 'none' });
      }
    }
    return { days, startPad };
  }, [transactions, month, year, today]);

  const cards = [
    { label: 'Saldo do Mês', value: stats.saldo, icon: Wallet, color: stats.saldo >= 0 ? 'text-success' : 'text-destructive', emoji: '💰' },
    { label: 'Entradas', value: stats.entradas, icon: ArrowUpCircle, color: 'text-success', emoji: '📈' },
    { label: 'Saídas', value: stats.saidas, icon: ArrowDownCircle, color: 'text-destructive', emoji: '📉' },
    { label: 'A Receber', value: stats.aReceber, icon: ArrowDownLeft, color: 'text-primary', emoji: '🔜' },
    { label: 'A Pagar', value: stats.aPagar, icon: ArrowUpRight, color: 'text-warning', emoji: '⏳' },
    { label: 'Saldo Pendente', value: stats.saldoPendente, icon: Scale, color: stats.saldoPendente >= 0 ? 'text-primary' : 'text-destructive', emoji: '⚖️', legend: 'Resultado líquido das contas pendentes' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {cards.map(c => (
          <Card key={c.label} className="border-border/50 relative overflow-hidden">
            <CardContent className="p-3">
              <span className="absolute top-1.5 right-2 text-2xl opacity-15 select-none">{c.emoji}</span>
              <div className="flex items-center gap-1.5 mb-1">
                <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.label}</span>
              </div>
              <p className={`text-lg font-bold tabular-nums ${c.color}`}>
                R$ {c.value.toFixed(2)}
              </p>
              {'legend' in c && (c as any).legend && (
                <p className="text-[9px] text-muted-foreground mt-1 leading-tight">{(c as any).legend}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Thermometer */}
      <Card className="border-border/50">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Termómetro do Mês</span>
            <span className="text-xs font-medium tabular-nums">{stats.percentRecebido.toFixed(0)}%</span>
          </div>
          <Progress value={stats.percentRecebido} className="h-2" />
          <p className="text-[10px] text-muted-foreground mt-1">Recebido vs Total Previsto (Entradas + A Receber)</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Chart */}
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-3">Receitas vs Despesas</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    <Cell fill="hsl(160, 50%, 38%)" />
                    <Cell fill="hsl(0, 45%, 55%)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Calendar */}
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-2">Calendário do Mês</p>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <span key={i} className="text-[9px] text-muted-foreground font-medium py-1">{d}</span>
              ))}
              {Array.from({ length: calendarDays.startPad }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {calendarDays.days.map(d => (
                <div
                  key={d.date}
                  className={`text-[10px] py-1 rounded ${
                    d.status === 'green' ? 'bg-success/15 text-success font-medium' :
                    d.status === 'yellow' ? 'bg-warning/15 text-warning font-medium' :
                    d.status === 'red' ? 'bg-destructive/15 text-destructive font-medium' :
                    'text-foreground/70'
                  }`}
                >
                  {d.date}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-2">
              {[{ c: 'bg-success', l: 'Concluído' }, { c: 'bg-warning', l: 'Próximo' }, { c: 'bg-destructive', l: 'Atrasado' }].map(x => (
                <div key={x.l} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${x.c}`} />
                  <span className="text-[9px] text-muted-foreground">{x.l}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              <span className="text-xs font-semibold text-warning">Ações Pendentes</span>
            </div>
            <div className="space-y-1">
              {alerts.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <span className="truncate mr-2">{t.descricao}</span>
                  <span className="shrink-0 font-medium tabular-nums">R$ {t.valor.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Tip */}
      <Card className="border-yellow-500/20 bg-yellow-500/[0.04]">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none mt-0.5">💡</span>
            <div>
              <p className="text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold uppercase tracking-wider mb-1">Dica do Dia</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{getTipOfDay()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
