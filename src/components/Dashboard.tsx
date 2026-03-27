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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 font-sans tracking-tight">
      
      {/* Alerta de Risco (Caixa Negativo) */}
      {negativeAlert && (
        <Card className="border-destructive/50 bg-destructive/5 shadow-sm rounded-2xl">
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

      {/* NÍVEL 1: Saldo & Bússola (Maior Destaque) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Saldo Atual */}
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl bg-gradient-to-br from-background to-muted/20">
          <CardContent className="p-6 flex flex-col justify-center h-full gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Saldo Atual
              </h2>
              <Badge variant="secondary" className="bg-success/10 text-success border-0 hover:bg-success/20 transition-colors">Hoje • Realizado</Badge>
            </div>
            <p className={`text-5xl sm:text-6xl font-black tabular-nums tracking-tighter ${saldoAtual >= 0 ? 'text-foreground' : 'text-destructive'}`}>
              R$ {saldoAtual.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {/* Bússola Financeira (O Elemento Mais Importante) */}
        <Card className="relative overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0 group">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
          <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-40 h-40 bg-black/10 rounded-full blur-3xl group-hover:bg-black/20 transition-all duration-500"></div>
          
          <CardContent className="p-6 h-full flex flex-col relative z-10">
            <div className="flex flex-col gap-1 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-primary-foreground drop-shadow-sm">
                  <span className="text-lg">🧭</span> Bússola Financeira
                </h2>
                <div className="flex gap-1 bg-black/10 p-1 rounded-lg backdrop-blur-sm self-start sm:self-auto">
                  {[10, 15, 20, 30].map(p => (
                    <button
                      key={p}
                      onClick={() => setEmpresaPercent(p)}
                      className={`text-xs px-2.5 py-1 rounded-md transition-all font-medium ${
                        empresaPercent === p 
                          ? 'bg-white text-primary shadow-sm' 
                          : 'text-primary-foreground/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-primary-foreground/80 italic font-medium">Baseado apenas no que já entrou</p>
            </div>

            <div className="mb-6 flex-1 flex flex-col justify-center">
              <p className="text-sm font-semibold text-primary-foreground/90 mb-1">Você pode usar até</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl sm:text-5xl font-black tabular-nums tracking-tighter text-white drop-shadow-md">
                  R$ {bussola.pessoal.toFixed(2)}
                </p>
              </div>
              <p className="text-sm text-primary-foreground/90 mt-1 font-semibold">sem comprometer o caixa</p>
            </div>

            <div className="bg-black/10 rounded-xl p-3.5 space-y-3 backdrop-blur-sm border border-white/5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-primary-foreground/90 flex items-center gap-2 font-medium">
                  <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center text-[12px] shadow-sm">🏢</div> 
                  Reserva Empresa
                </span>
                <span className="font-bold tabular-nums">R$ {bussola.empresa.toFixed(2)}</span>
              </div>

              {bussola.recebido > 0 && (
                <div className="pt-2.5 border-t border-white/10">
                  {bussola.isAdjusted ? (
                    <div className="flex items-start gap-2 text-warning font-medium bg-warning/10 p-2 rounded-lg border border-warning/20">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <p className="text-[11px] leading-snug">A retirada desejada é maior do que a folga de segurança. Proceda com cautela.</p>
                    </div>
                  ) : (
                     <div className="flex items-center gap-2 text-green-300 font-medium">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <p className="text-[11px] leading-snug">Caixa saudável. Divisão garantida com folga de margem.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NÍVEL 2: Entradas / Saídas (Realizadas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <Card className="border-border/50 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 rounded-2xl bg-card">
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-success/10 text-success">
                <ArrowUpCircle className="w-5 h-5" />
              </div>
              <span className="text-sm text-muted-foreground font-semibold uppercase tracking-wide">Entradas Realizadas</span>
            </div>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
              R$ {stats.entradas.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 rounded-2xl bg-card">
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
                <ArrowDownCircle className="w-5 h-5" />
              </div>
              <span className="text-sm text-muted-foreground font-semibold uppercase tracking-wide">Saídas Realizadas</span>
            </div>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
              R$ {stats.saidas.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Thermometer de Progresso */}
      <div className="px-2 py-3">
        <div className="flex justify-between items-end mb-2">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">Meta de Recebimentos do Mês</span>
            <span className="text-sm font-semibold text-foreground/80">{stats.percentRecebido.toFixed(0)}% Concluído</span>
          </div>
        </div>
        <Progress value={stats.percentRecebido} className="h-2.5 rounded-full" />
      </div>

      {/* NÍVEL 3: Futuro (Previsto) em linha compacta */}
      <Card className="border-border/30 bg-muted/40 shadow-none hover:bg-muted/60 transition-colors duration-300 rounded-xl mt-4">
        <CardContent className="p-5">
          <div className="flex flex-col xl:flex-row items-center justify-center xl:justify-between gap-4 text-sm">
            
            <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
              <span className="font-bold text-muted-foreground uppercase text-[11px] tracking-wider flex items-center gap-1.5"><Target className="w-3.5 h-3.5"/> Futuro (Previsto)</span>
              <span className="hidden md:inline text-border">•</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ArrowDownLeft className="w-4 h-4 text-primary/60"/> 
                Entradas previstas 
                <span className="font-bold text-foreground/80">R$ {stats.aReceber.toFixed(2)}</span>
              </span>
              <span className="hidden md:inline text-border">•</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ArrowUpRight className="w-4 h-4 text-warning/60"/> 
                Saídas previstas 
                <span className="font-bold text-foreground/80">R$ {stats.aPagar.toFixed(2)}</span>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 bg-background/80 px-4 py-2 rounded-lg border border-border/50 text-muted-foreground w-full xl:w-auto justify-center">
              <span className="font-medium text-xs">Saldo futuro (se tudo acontecer):</span>
              <span className="font-bold text-foreground">R$ {saldoProjetadoFuturo.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="mt-4 text-center flex flex-col items-center justify-center text-[10px] sm:text-[11px] text-muted-foreground/70 border-t border-border/40 pt-3">
            <span className="bg-muted px-2 py-0.5 rounded-md mb-1 font-semibold uppercase tracking-widest text-muted-foreground">Valores ainda não realizados</span>
            <p className="italic">Inclui valores ainda não recebidos e contas não pagas</p>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico e Dica do Dia */}
      <div className="grid grid-cols-1 gap-6 pt-2">
        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Fluxo de Caixa Projetado</CardTitle>
            <CardDescription className="text-xs">Evolução do saldo no decorrer dos próximos dias</CardDescription>
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
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px', zIndex: 100 }}
                  />
                  <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-yellow-500/30 bg-yellow-500/[0.05] rounded-2xl shadow-sm mb-4">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <div className="p-2 sm:p-3 bg-yellow-500/15 rounded-xl text-yellow-600 dark:text-yellow-400">
              <span className="text-xl sm:text-2xl leading-none block">💡</span>
            </div>
            <div className="flex-1 mt-0.5">
              <p className="text-[11px] text-yellow-600 dark:text-yellow-400 font-bold uppercase tracking-widest mb-1.5">Dica do Dia</p>
              <p className="text-sm text-foreground/80 leading-relaxed font-medium">{getTipOfDay()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
