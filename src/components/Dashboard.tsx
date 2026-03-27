import { useMemo } from 'react';
import { Transaction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getTipOfDay } from '@/lib/tips';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, Wallet, ArrowDownLeft, ArrowUpRight, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Target, Activity, CheckCircle2, BadgeAlert } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  month: number;
  year: number;
}

export function Dashboard({ transactions, month, year }: Props) {
  const { stats, projectProfits, cashFlowPoints, negativeAlert, saldoAtual, saldoProjetadoFuturo } = useMemo(() => {
    // 1. LUCRO POR PROJETO
    const projMap = new Map<string, { receita: number; custo: number }>();
    const txIdToName = new Map<string, string>();

    // Primeiro mapeia todas as receitas/projetos
    transactions.forEach(t => {
      const isReceita = t.tipo === 'Entrada' || t.tipo === 'A Receber';
      if (isReceita) {
        const projName = t.descricao.replace(/ \(Restante\)$/, '').trim();
        txIdToName.set(t.id, projName);
        if (!projMap.has(projName)) projMap.set(projName, { receita: 0, custo: 0 });
        projMap.get(projName)!.receita += t.valor;
      }
    });

    // Depois computa as despesas (repasses) para abatê-las corretamente da receita
    transactions.forEach(t => {
      const isCusto = (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.isRepasse;
      if (isCusto) {
        let projName = '';
        if (t.parentId && txIdToName.has(t.parentId)) {
           projName = txIdToName.get(t.parentId)!;
        } else {
           // Fallback para repasses soltos antigos
           projName = t.descricao.replace(/ \(Restante\)$/, '').replace(/^Repasse\s*-\s*/i, '').trim();
        }
        
        if (!projMap.has(projName)) projMap.set(projName, { receita: 0, custo: 0 });
        projMap.get(projName)!.custo += t.valor;
      }
    });

    const projectProfits = Array.from(projMap.entries())
      .map(([name, data]) => ({ name, ...data, lucro: data.receita - data.custo }))
      .filter(p => p.receita > 0 || p.custo > 0)
      .sort((a, b) => b.lucro - a.lucro);

    // 2. FLUXO DE CAIXA PROJETADO E ALERTAS
    const today = new Date().toISOString().slice(0, 10);
    const sorted = [...transactions].sort((a, b) => a.data.localeCompare(b.data));
    
    let runningTotal = 0;
    let actualBalance = 0;
    const dateMap = new Map<string, number>();
    
    // Calcular a variação por dia e o saldo de itens já concluídos
    sorted.forEach(t => {
      const isReceita = t.tipo === 'Entrada' || t.tipo === 'A Receber';
      const isDespesa = t.tipo === 'Saída' || t.tipo === 'A Pagar';
      const val = isReceita ? t.valor : (isDespesa ? -t.valor : 0);
      
      dateMap.set(t.data, (dateMap.get(t.data) || 0) + val);

      if (t.status === 'Concluído') {
         actualBalance += isReceita ? t.valor : (isDespesa ? -t.valor : 0);
      }
    });

    const uniqueDates = Array.from(dateMap.keys()).sort();
    const cashFlowPoints: { date: string; balance: number }[] = [];
    let negativeAlert: { date: string; balance: number } | null = null;

    uniqueDates.forEach(d => {
      runningTotal += dateMap.get(d)!;
      const [y, m, day] = d.split('-');
      cashFlowPoints.push({ date: `${day}/${m}`, balance: runningTotal });
      
      if (runningTotal < 0 && d >= today && !negativeAlert) {
         negativeAlert = { date: `${day}/${m}/${y}`, balance: runningTotal };
      }
    });

    // 3. ESTATÍSTICAS MENSAIS
    const monthTxs = transactions.filter(t => {
      const d = new Date(t.data + 'T12:00:00');
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const monthConcluidas = monthTxs.filter(t => t.status === 'Concluído');
    const monthPendentes = monthTxs.filter(t => t.status === 'Pendente');

    // Entradas (Líquidas): soma entradas e subtrai repasses
    const entradasBrutas = monthConcluidas.filter(t => t.tipo === 'Entrada').reduce((s, t) => s + t.valor, 0);
    const repassesPagos = monthConcluidas.filter(t => t.tipo === 'Saída' && t.isRepasse).reduce((s, t) => s + t.valor, 0);
    const entradas = entradasBrutas - repassesPagos;

    // Saídas (Gerais): apenas gastos operacionais (não repasse)
    const saidas = monthConcluidas.filter(t => t.tipo === 'Saída' && !t.isRepasse).reduce((s, t) => s + t.valor, 0);

    // Projetados
    const aReceberBruto = monthPendentes.filter(t => t.tipo === 'A Receber').reduce((s, t) => s + t.valor, 0);
    const repassesPendentes = monthPendentes.filter(t => t.tipo === 'A Pagar' && t.isRepasse).reduce((s, t) => s + t.valor, 0);
    const aReceber = aReceberBruto - repassesPendentes;

    const aPagar = monthPendentes.filter(t => t.tipo === 'A Pagar' && !t.isRepasse).reduce((s, t) => s + t.valor, 0);

    const totalPrevisto = entradas + aReceber;
    const percentRecebido = totalPrevisto > 0 ? (entradas / totalPrevisto) * 100 : 0;

    return { 
      stats: { entradas, saidas, aReceber, aPagar, percentRecebido }, 
      projectProfits, 
      cashFlowPoints, 
      negativeAlert,
      saldoAtual: actualBalance,
      saldoProjetadoFuturo: runningTotal
    };
  }, [transactions, month, year]);

  const cards = [
    { label: 'Saldo Atual (Realizado)', value: saldoAtual, icon: Wallet, color: saldoAtual >= 0 ? 'text-success' : 'text-destructive', bg: 'bg-success/10' },
    { label: 'Saldo Projetado (Futuro)', value: saldoProjetadoFuturo, icon: Target, color: saldoProjetadoFuturo >= 0 ? 'text-primary' : 'text-destructive', bg: 'bg-primary/10' },
    { label: 'Mês - Entradas', value: stats.entradas, icon: ArrowUpCircle, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Mês - Saídas', value: stats.saidas, icon: ArrowDownCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Mês - A Receber', value: stats.aReceber, icon: ArrowDownLeft, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Mês - A Pagar', value: stats.aPagar, icon: ArrowUpRight, color: 'text-warning', bg: 'bg-warning/10' },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* Alerta de Risco (Caixa Negativo) */}
      {negativeAlert && (
        <Card className="border-destructive/50 bg-destructive/5 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-destructive/20 p-2 rounded-full hidden sm:block">
              <BadgeAlert className="w-8 h-8 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-destructive text-sm uppercase tracking-tight flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 sm:hidden" />Atenção: Risco de Caixa Negativo</h3>
              <p className="text-sm text-foreground/80 mt-1">
                Seu caixa ficará negativo em <strong>R$ {Math.abs(negativeAlert.balance).toFixed(2)}</strong> na data de <strong>{negativeAlert.date}</strong> de acordo com os lançamentos pendentes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo de Caixa (Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(c => (
          <Card key={c.label} className="border-border/50 hover:border-border transition-colors">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${c.bg}`}>
                  <c.icon className={`w-4 h-4 ${c.color}`} />
                </div>
                <span className="text-xs text-muted-foreground font-medium">{c.label}</span>
              </div>
              <p className={`text-lg sm:text-2xl font-bold tabular-nums tracking-tight ${c.color}`}>
                R$ {c.value.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Thermometer */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4">
          <div className="flex justify-between items-end mb-2">
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest block mb-1">Meta de Recebimentos</span>
              <span className="text-sm font-semibold">{stats.percentRecebido.toFixed(0)}% Concluído</span>
            </div>
          </div>
          <Progress value={stats.percentRecebido} className="h-2.5 rounded-full" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fluxo de Caixa Projetado */}
        <Card className="border-border/50 shadow-sm col-span-1 md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Fluxo de Caixa Projetado</CardTitle>
            <CardDescription className="text-xs">Evolução do saldo (Realizado + Futuro)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowPoints} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} dy={5} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    formatter={(val: number) => [`R$ ${val.toFixed(2)}`, 'Saldo']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Lucros por Projeto */}
        <Card className="border-border/50 shadow-sm col-span-1 md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-success" /> Lucro por Projeto</CardTitle>
            <CardDescription className="text-xs">Desempenho dos projetos (Receitas - Repasses)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mt-2 pr-1 max-h-48 overflow-y-auto scrollbar-thin">
              {projectProfits.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">Nenhum dado de projeto disponível.</div>
              ) : (
                projectProfits.slice(0, 10).map((p, idx) => (
                  <div key={idx} className="flex flex-col gap-1 border-b border-border/40 pb-2 last:border-0">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm truncate pr-2 max-w-[65%] leading-tight" title={p.name}>{p.name}</span>
                      <span className={`font-semibold text-sm tabular-nums shrink-0 ${p.lucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                        R$ {p.lucro.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Receita: R$ {p.receita.toFixed(2)}</span>
                      <span>Repasses: R$ {p.custo.toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/80 italic mt-0.5">Esse projeto gerou R$ {p.lucro.toFixed(2)} de lucro.</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
