import { useMemo, useState } from 'react';
import { Transaction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getTipOfDay } from '@/lib/tips';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, Wallet, ArrowDownLeft, ArrowUpRight, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Target, Activity, CheckCircle2, BadgeAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  transactions: Transaction[];
  month: number;
  year: number;
}

export function Dashboard({ transactions, month, year }: Props) {
  const [empresaPercent, setEmpresaPercent] = useState(20);

  const { stats, projectProfits, cashFlowPoints, negativeAlert, saldoAtual, saldoProjetadoFuturo, bussola } = useMemo(() => {
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

    const entradas = monthTxs.filter(t => t.tipo === 'Entrada' && t.status === 'Concluído').reduce((s, t) => s + t.valor, 0);
    const saidas = monthTxs.filter(t => t.tipo === 'Saída' && t.status === 'Concluído').reduce((s, t) => s + t.valor, 0);
    const aReceber = monthTxs.filter(t => t.tipo === 'A Receber').reduce((s, t) => s + t.valor, 0);
    const aPagar = monthTxs.filter(t => t.tipo === 'A Pagar').reduce((s, t) => s + t.valor, 0);

    const totalPrevisto = entradas + aReceber;
    const percentRecebido = totalPrevisto > 0 ? (entradas / totalPrevisto) * 100 : 0;

    // 4. BÚSSOLA FINANCEIRA (Lógica de Retirada Sob Demanda)
    const ratio = empresaPercent / 100;
    const reservaEmpresaTeorica = entradas * ratio;
    const disponivelPessoalReal = Math.max(0, entradas - reservaEmpresaTeorica);
    
    const margemSeguranca = saidas * 1.2;
    const caixaDisponivelReal = entradas - saidas;
    const isSafetyAlert = caixaDisponivelReal < margemSeguranca && entradas > 0;
    
    const bussola = {
      recebido: entradas,
      empresa: reservaEmpresaTeorica,
      pessoal: disponivelPessoalReal,
      isAdjusted: isSafetyAlert,
      statusColor: isSafetyAlert ? 'text-warning' : 'text-success',
      statusBg: isSafetyAlert ? 'bg-warning/10' : 'bg-success/10'
    };

    const stats = { entradas, saidas, aReceber, aPagar, percentRecebido };
    const saldoAtual = actualBalance;
    const saldoProjetadoFuturo = runningTotal;

    return { 
      stats, 
      projectProfits, 
      cashFlowPoints, 
      negativeAlert,
      saldoAtual,
      saldoProjetadoFuturo,
      bussola
    };
  }, [transactions, month, year, empresaPercent]);

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

        {/* Bússola Financeira */}
        <Card className="border-border/50 shadow-sm col-span-1 md:col-span-2 lg:col-span-1 overflow-hidden">
          <CardHeader className="pb-2 bg-muted/20 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">🧭 Bússola Financeira</CardTitle>
                <CardDescription className="text-[10px] mt-0.5">Sugestão de divisão de retiradas</CardDescription>
              </div>
              <div className="flex gap-1">
                {[10, 15, 20, 30].map(p => (
                  <button
                    key={p}
                    onClick={() => setEmpresaPercent(p)}
                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${
                      empresaPercent === p 
                        ? 'bg-primary border-primary text-primary-foreground font-bold' 
                        : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Recebido no Mês</span>
              <span className="text-xl font-black tabular-nums">R$ {bussola.recebido.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <div className="p-3 rounded-lg border border-border/40 bg-background flex justify-between items-center group hover:border-primary/20 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-lg">🏢</div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Reserva Empresa</p>
                    <p className="text-sm font-bold tabular-nums">R$ {bussola.empresa.toFixed(2)}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] border-primary/20 text-primary bg-primary/5">Pilar</Badge>
              </div>

              <div className={`p-3 rounded-lg border flex justify-between items-center transition-all ${
                bussola.isAdjusted ? 'border-warning/30 bg-warning/[0.03]' : 'border-success/30 bg-success/[0.03]'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center text-lg bg-background shadow-sm border border-border/20">💼</div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Disponível para Você</p>
                    <p className={`text-sm font-black tabular-nums ${bussola.pessoal > 0 ? bussola.statusColor : 'text-muted-foreground'}`}>R$ {bussola.pessoal.toFixed(2)}</p>
                  </div>
                </div>
                {bussola.pessoal > 0 && !bussola.isAdjusted && <Badge className="text-[10px] bg-success text-success-foreground border-0">Livre</Badge>}
                {bussola.pessoal > 0 && bussola.isAdjusted && <Badge className="text-[10px] bg-warning text-warning-foreground animate-pulse border-0">Atenção</Badge>}
              </div>
            </div>

            {bussola.recebido > 0 ? (
              <div className="pt-1">
                {bussola.isAdjusted ? (
                  <div className="flex items-start gap-2 text-warning p-2 rounded bg-warning/5 border border-warning/10">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <p className="text-[10px] font-medium leading-tight">A retirada desejada é maior do que a folga de segurança do seu caixa mensal. Proceda com cautela.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-success px-2 py-1.5 rounded bg-success/5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <p className="text-[10px] font-medium">Caixa saudável. Divisão garantida com folga de margem.</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-center text-muted-foreground italic py-2">Sem entradas confirmadas neste mês para cálculo.</p>
            )}
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
