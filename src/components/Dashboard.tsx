import { useMemo, useState } from 'react';
import { Transaction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getTipOfDay } from '@/lib/tips';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ComposedChart, Line, Legend } from 'recharts';
import { TrendingUp, Wallet, ArrowDownLeft, ArrowUpRight, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Target, Activity, CheckCircle2, BadgeAlert, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

    const entradas = monthTxs.filter(t => t.tipo === 'Entrada' && t.status === 'Concluído').reduce((s, t) => s + t.valor, 0);
    const saidas = monthTxs.filter(t => t.tipo === 'Saída' && t.status === 'Concluído').reduce((s, t) => s + t.valor, 0);
    const aReceber = monthTxs.filter(t => t.tipo === 'A Receber').reduce((s, t) => s + t.valor, 0);
    const aPagar = monthTxs.filter(t => t.tipo === 'A Pagar').reduce((s, t) => s + t.valor, 0);

    const totalPrevisto = entradas + aReceber;
    const percentRecebido = totalPrevisto > 0 ? (entradas / totalPrevisto) * 100 : 0;

    // 4. BÚSSOLA FINANCEIRA
    // A bússola gora cálcula on the fly no componente usando o saldoAtual global (que já desconta despesas, repasses e retiradas)
    
    const margemSeguranca = saidas * 1.2;
    const caixaDisponivelReal = entradas - saidas;

    const stats = { entradas, saidas, aReceber, aPagar, percentRecebido };
    const saldoAtual = actualBalance;
    const saldoProjetadoFuturo = runningTotal;

    // 5. ESTATÍSTICAS ANUAIS
    const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const annualData = monthsNames.map(m => ({ name: m, Receita: 0, Saída: 0, Resultado: 0 }));

    transactions.forEach(t => {
      if (t.status === 'Concluído') {
        const date = new Date(t.data + 'T12:00:00');
        if (date.getFullYear() === year) {
          const isReceita = t.tipo === 'Entrada' || t.tipo === 'A Receber';
          const isDespesa = t.tipo === 'Saída' || t.tipo === 'A Pagar';
          const mIdx = date.getMonth();

          if (isReceita) annualData[mIdx].Receita += t.valor;
          if (isDespesa) annualData[mIdx].Saída += t.valor;
        }
      }
    });

    annualData.forEach(d => {
      d.Resultado = d.Receita - d.Saída;
    });

    return { 
      stats, 
      projectProfits, 
      cashFlowPoints, 
      negativeAlert,
      saldoAtual,
      saldoProjetadoFuturo,
      annualData
    };
  }, [transactions, month, year]);

  const burnRate = stats.entradas > 0 ? (stats.saidas / stats.entradas) : 0;
  const isHealthyMargin = burnRate <= 0.8 && stats.entradas > 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 font-sans tracking-tight">
      
      {/* Alerta de Risco (Caixa Negativo) */}
      {negativeAlert && (
        <Card className="border-rose-500/50 bg-rose-500/10 shadow-sm rounded-2xl animate-pulse">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-rose-500/20 p-2 rounded-full hidden sm:block">
              <BadgeAlert className="w-8 h-8 text-rose-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-rose-600 text-sm uppercase tracking-tight flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 sm:hidden" />Atenção: Risco de Caixa Negativo</h3>
              <p className="text-sm text-foreground/80 mt-1">
                Seu caixa ficará negativo em <strong>R$ {Math.abs(negativeAlert.balance).toFixed(2)}</strong> na data de <strong>{negativeAlert.date}</strong> de acordo com os lançamentos pendentes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* NÍVEL 1: Bússola Financeira (Saldo Líquido Real e Divisão) */}
      <Card className="relative overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-900 text-white border-0 group">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
        <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-48 h-48 bg-black/20 rounded-full blur-3xl group-hover:bg-black/40 transition-all duration-700"></div>
        
        <CardContent className="p-5 sm:p-7 h-full grid grid-cols-1 lg:grid-cols-12 relative z-10 gap-6 lg:gap-8 lg:items-center">
          
          {/* Lado Esquerdo: Saldo Atual (60-65%) */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="flex flex-col gap-1.5 mb-5 md:mb-6">
              <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white/90 drop-shadow-sm">
                <span className="text-xl">🧭</span> Bússola Financeira
              </h2>
              <p className="text-xs text-white/60 italic font-medium leading-relaxed">
                Cálculo enraizado no seu caixa líquido real de <span className="font-bold text-white/80">Hoje</span>
              </p>
            </div>

            <div className="flex flex-col justify-center">
              <p className="text-xs sm:text-sm font-semibold text-emerald-400 mb-1 lg:mb-2 uppercase tracking-widest flex items-center gap-2"><Wallet className="w-4 h-4"/> Saldo Atual Disponível</p>
              <div className={`flex items-baseline flex-wrap ${saldoAtual >= 0 ? 'text-white' : 'text-rose-400'}`}>
                <span className="text-xl sm:text-2xl lg:text-3xl font-bold mr-2 opacity-80 drop-shadow-md">R$</span>
                <span className="text-5xl sm:text-6xl md:text-7xl lg:text-[5rem] font-black tabular-nums tracking-tighter drop-shadow-lg leading-none break-all">
                  {Math.max(0, saldoAtual).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Lado Direito: Divisões (35-40%) */}
          <div className="lg:col-span-5 w-full bg-black/20 rounded-2xl p-4 sm:p-5 border border-white/5 backdrop-blur-sm shadow-inner overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 shrink-0 rounded overflow-hidden bg-white/10 flex items-center justify-center text-[11px] shadow-sm">🏢</div> 
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-emerald-400/90 leading-tight">Se você guardar p/ Empresa:</p>
            </div>
            
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {[10, 15, 20, 30].map(pct => {
                const valorGuardado = Math.max(0, saldoAtual) * (pct / 100);
                const sobrando = Math.max(0, saldoAtual) - valorGuardado;
                return (
                  <div key={pct} className="bg-white/5 hover:bg-white/10 transition-colors cursor-default rounded-xl p-3 sm:p-3.5 border border-white/5 flex flex-col justify-between shadow-[0_2px_10px_rgba(0,0,0,0.1)] h-full">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] sm:text-[11px] font-black text-white/80 bg-white/10 px-2 py-0.5 rounded-full">{pct}%</span>
                    </div>
                    <span className="font-black text-base sm:text-lg text-white tabular-nums drop-shadow-sm tracking-tight break-words leading-none my-1">
                      R$ {valorGuardado.toFixed(2)}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-white/50 font-bold mt-1 uppercase tracking-wider whitespace-normal break-words leading-tight">
                      Sobram: R$ {sobrando.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NÍVEL 2: Entradas / Saídas (Realizadas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <Card className="border-border/50 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 rounded-2xl bg-card">
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <ArrowUpCircle className="w-5 h-5" />
                </div>
                <span className="text-sm text-muted-foreground font-semibold uppercase tracking-wide">Recebido neste Mês</span>
              </div>
            </div>
            <div className="flex items-baseline text-slate-900 dark:text-gray-100">
              <span className="text-xl font-bold mr-1.5 opacity-60">R$</span>
              <span className="text-3xl font-black tabular-nums tracking-tight">
                {stats.entradas.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 rounded-2xl bg-card group">
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                  <ArrowDownCircle className="w-5 h-5" />
                </div>
                <span className="text-sm text-muted-foreground font-semibold uppercase tracking-wide">Gasto neste Mês</span>
              </div>
              {stats.entradas > 0 && (
                isHealthyMargin 
                  ? <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-0 flex items-center gap-1 text-[10px] py-0"><CheckCircle2 className="w-3 h-3"/> {Math.round(burnRate*100)}% de gasto da receita</Badge>
                  : <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-0 flex items-center gap-1 text-[10px] py-0"><AlertTriangle className="w-3 h-3"/> {Math.round(burnRate*100)}% comprometido!</Badge>
              )}
            </div>
            <div className="flex items-baseline text-slate-900 dark:text-gray-100">
              <span className="text-xl font-bold mr-1.5 opacity-60">R$</span>
              <span className="text-3xl font-black tabular-nums tracking-tight">
                {stats.saidas.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Thermometer de Progresso */}
      <div className="px-2 py-3">
        <div className="flex justify-between items-end mb-2">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">Meta de Recebimentos do Mês</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm font-semibold ${stats.percentRecebido >= 100 ? 'text-emerald-500' : 'text-foreground/80'}`}>{stats.percentRecebido.toFixed(0)}% Concluído</span>
              {stats.percentRecebido >= 100 ? (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/20"><Target className="w-3 h-3"/> Meta Superada! Mês de sucesso.</span>
              ) : stats.percentRecebido >= 50 ? (
                <span className="text-[10px] text-primary/80 font-medium italic hidden sm:inline-flex">Falta pouco para você bater a meta. Estamos no caminho!</span>
              ) : null}
            </div>
          </div>
        </div>
        <Progress value={stats.percentRecebido} className="h-2.5 rounded-full" />
      </div>

      {/* NÍVEL 3: Futuro (Previsto) em linha compacta */}
      <Card className="border-border/30 bg-muted/40 shadow-none hover:bg-muted/60 transition-colors duration-300 rounded-xl mt-4">
        <CardContent className="p-5">
          <div className="flex flex-col xl:flex-row items-center justify-center xl:justify-between gap-4 text-sm">
            
            <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
              <span className="font-bold text-muted-foreground uppercase text-[11px] tracking-wider flex items-center gap-1.5"><Target className="w-3.5 h-3.5"/> Visão de Futuro</span>
              <span className="hidden md:inline text-border">•</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ArrowDownLeft className="w-4 h-4 text-primary/60"/> 
                Entradas previstas 
                <span className="font-bold text-foreground/80 flex items-baseline"><span className="text-[10px] mr-0.5">R$</span>{stats.aReceber.toFixed(2)}</span>
              </span>
              <span className="hidden md:inline text-border">•</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ArrowUpRight className="w-4 h-4 text-amber-500/60"/> 
                Saídas previstas 
                <span className="font-bold text-foreground/80 flex items-baseline"><span className="text-[10px] mr-0.5">R$</span>{stats.aPagar.toFixed(2)}</span>
              </span>
            </div>

            <div className={`flex flex-col sm:flex-row items-center gap-2 px-4 py-2 rounded-lg border w-full xl:w-auto justify-center ${saldoProjetadoFuturo >= 0 ? 'bg-background/80 border-border/50 text-muted-foreground' : 'bg-rose-500/5 border-rose-500/20 text-rose-600'}`}>
              <span className="font-medium text-xs">Projeção de Caixa (Com pagamentos futuros):</span>
              <span className="font-bold text-foreground flex items-baseline">
                <span className="text-[10px] mr-0.5 opacity-60">R$</span>{saldoProjetadoFuturo.toFixed(2)}
              </span>
            </div>
          </div>
          
          <div className="mt-4 text-center flex flex-col items-center justify-center text-[10px] sm:text-[11px] text-muted-foreground/70 border-t border-border/40 pt-3">
            <span className="bg-muted px-2 py-0.5 rounded-md mb-1 font-semibold uppercase tracking-widest text-muted-foreground">O que falta entrar e sair para a sua conta fechar</span>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico e Dica do Dia */}
      <div className="grid grid-cols-1 gap-6 pt-2">
        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Fluxo de Caixa Projetado</CardTitle>
            <CardDescription className="text-xs">Evolução do Saldo Projetado nos Próximos Dias</CardDescription>
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

        {/* Desempenho Anual (Gráfico de Barras Agrupadas + Linha de Lucro) */}
        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Desempenho Anual ({year})</CardTitle>
            <CardDescription className="text-xs">Receitas, saídas e resultado consolidado mês a mês (apenas transações concluídas)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={annualData} margin={{ top: 10, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} dy={5} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `R$ ${value.toFixed(2)}`,
                      name === 'Resultado' && value > 0 ? 'Lucro Líquido' : name === 'Resultado' && value < 0 ? 'Prejuízo' : name
                    ]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px', zIndex: 100 }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} />
                  <Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Saída" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Line type="monotone" dataKey="Resultado" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/[0.05] rounded-2xl shadow-sm mb-4">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <div className="p-2 sm:p-3 bg-amber-500/15 rounded-xl text-amber-600 dark:text-amber-400">
              <span className="text-xl sm:text-2xl leading-none block">💡</span>
            </div>
            <div className="flex-1 mt-0.5">
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mb-1.5">Dica do Dia</p>
              <p className="text-sm text-foreground/80 leading-relaxed font-medium">{getTipOfDay()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
