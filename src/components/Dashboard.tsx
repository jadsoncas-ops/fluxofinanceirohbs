import { useMemo, useState } from 'react';
import { Transaction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getTipOfDay } from '@/lib/tips';
import { getProcesses, getClients } from '@/lib/storage';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ComposedChart, Line, Legend } from 'recharts';
import { TrendingUp, Wallet, ArrowDownLeft, ArrowUpRight, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Target, Activity, CheckCircle2, BadgeAlert, BarChart3, Clock3, Plus, Search, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  transactions: Transaction[];
  month: number;
  year: number;
  onProjectClick?: () => void;
}

export function Dashboard({ transactions, month, year, onProjectClick }: Props) {
  const { stats, projectProfits, cashFlowPoints, negativeAlert, saldoAtual, saldoProjetadoFuturo, annualData } = useMemo(() => {
    const processes = getProcesses() || [];
    const clients = getClients() || [];
    
    // 1. AUDITORIA GLOBAL E PROJEÇÕES (Calculado primeiro para servir de lastro)
    const auditList: { name: string; id: string; saldo: number; custos: number; lucro: number }[] = [];
    const assignedTxIdsAudit = new Set<string>();

    (processes).filter(p => !p.isArchived).forEach(p => {
      const client = clients.find(c => c.id === p.clienteId);
      const processTxs = (transactions || []).filter(t => {
        if (t.processId) return t.processId === p.id;
        if (!t.processId && t.clienteId === p.clienteId && !assignedTxIdsAudit.has(t.id)) {
          assignedTxIdsAudit.add(t.id);
          return true;
        }
        return false;
      });

      const totalRecebidoP = processTxs
        .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído')
        .reduce((s, t) => s + t.valor, 0);
      
      const receitasPendentesParaProc = processTxs
        .filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Pendente')
        .reduce((s, t) => s + t.valor, 0);

      const custosPendentesProc = processTxs
        .filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status !== 'Concluído')
        .reduce((s, t) => s + t.valor, 0);

      const saldoTotalProc = Math.max(0, (p.valorContrato || 0) - totalRecebidoP) + receitasPendentesParaProc;
      
      if (saldoTotalProc > 0 || custosPendentesProc > 0) {
        auditList.push({
          id: p.id,
          name: `${client?.nome || 'Cliente s/ nome'} — ${p.objeto || 'Serviço'}`,
          saldo: saldoTotalProc,
          custos: custosPendentesProc,
          lucro: saldoTotalProc - custosPendentesProc
        });
      }
    });

    const entradasPrevistas = auditList.reduce((sum, p) => sum + p.saldo, 0);
    const saidasPrevistas = auditList.reduce((sum, p) => sum + p.custos, 0);
    const lucroFuturoPendente = entradasPrevistas - saidasPrevistas;

    // 2. LUCRO POR PROJETO (Mês/Ano)
    const projMap = new Map<string, { receita: number; custo: number }>();
    const txIdToName = new Map<string, string>();

    (transactions || []).forEach(t => {
      const isReceita = t.tipo === 'Entrada' || t.tipo === 'A Receber';
      if (isReceita) {
        const projName = t.descricao.replace(/ \(Restante\)$/, '').trim();
        txIdToName.set(t.id, projName);
        if (!projMap.has(projName)) projMap.set(projName, { receita: 0, custo: 0 });
        projMap.get(projName)!.receita += t.valor;
      }
    });

    (transactions || []).forEach(t => {
      const isCusto = (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.isRepasse;
      if (isCusto) {
        let projName = '';
        if (t.parentId && txIdToName.has(t.parentId)) {
           projName = txIdToName.get(t.parentId)!;
        } else {
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

    // 3. FLUXO DE CAIXA PROJETADO E ALERTAS
    const today = new Date().toISOString().slice(0, 10);
    const sorted = [...transactions].sort((a, b) => a.data.localeCompare(b.data));
    
    let runningTotal = 0;
    let actualBalance = 0;
    const dateMap = new Map<string, number>();
    
    sorted.forEach(t => {
      const isReceita = t.tipo === 'Entrada' || t.tipo === 'A Receber';
      const isDespesa = t.tipo === 'Saída' || t.tipo === 'A Pagar';
      const val = isReceita ? t.valor : (isDespesa ? -t.valor : 0);
      dateMap.set(t.data, (dateMap.get(t.data) || 0) + val);
      if (t.status === 'Concluído') actualBalance += val;
    });

    const uniqueDates = Array.from(dateMap.keys()).sort();
    const cashFlowPoints: { date: string; balance: number }[] = [];
    let negativeAlert: { date: string; balance: number } | null = null;

    // Backing (Lastro): Quanto ainda temos para receber de contratos ativos
    const entriesPotenciaisTotal = entradasPrevistas; 

    uniqueDates.forEach(d => {
      runningTotal += dateMap.get(d)!;
      const [y, m, day] = d.split('-');
      cashFlowPoints.push({ date: `${day}/${m}`, balance: runningTotal });
      
      // ALERTA INTELIGENTE: Só avisa se o saldo + lastro de contratos for negativo
      if (runningTotal + entriesPotenciaisTotal < 0 && d >= today && !negativeAlert) {
         negativeAlert = { date: `${day}/${m}/${y}`, balance: runningTotal };
      }
    });

    // 4. ESTATÍSTICAS MENSAIS — filtro rigoroso por data ou previsão
    const monthTxs = (transactions || []).filter(t => {
      const dateToUse = (t.status === 'Pendente' && t.previsaoData) ? t.previsaoData : t.data;
      const d = new Date(dateToUse + 'T12:00:00');
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const processRecebidoMap = new Map<string, number>();
    const clientRecebidoMap = new Map<string, number>();
    (transactions || []).forEach(t => {
      if ((t.tipo === 'Entrada' || t.tipo === 'A Receber') && (t.status === 'Concluído' || t.status === 'Parcial')) {
        const val = t.status === 'Concluído' ? t.valor : 0.0001;
        if (t.processId) processRecebidoMap.set(t.processId, (processRecebidoMap.get(t.processId) || 0) + val);
        if (t.clienteId) clientRecebidoMap.set(t.clienteId, (clientRecebidoMap.get(t.clienteId) || 0) + val);
      }
    });

    const archivedProcessIds = new Set(processes.filter(p => p.isArchived).map(p => p.id));
    const archivedClientIds = new Set(processes.filter(p => p.isArchived).map(p => p.clienteId));

    const entradas = monthTxs.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído').reduce((s, t) => s + t.valor, 0);
    
    const shouldShowCostInDashboard = (t: Transaction) => {
      if (!t.processId && !t.clienteId) return true;
      if (t.processId) return (processRecebidoMap.get(t.processId) || 0) > 0 || archivedProcessIds.has(t.processId);
      if (t.clienteId) return (clientRecebidoMap.get(t.clienteId) || 0) > 0 || archivedClientIds.has(t.clienteId);
      return true;
    };

    const saidas = monthTxs.filter(t => 
      (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status === 'Concluído' && shouldShowCostInDashboard(t)
    ).reduce((s, t) => s + t.valor, 0);

    const totalPrevistoNoMes = monthTxs
      .filter(t => t.tipo === 'Entrada' || t.tipo === 'A Receber')
      .reduce((s, t) => s + t.valor, 0);

    const percentRecebido = totalPrevistoNoMes > 0 ? (entradas / totalPrevistoNoMes) * 100 : 0;
    const aReceber = Math.max(0, totalPrevistoNoMes - entradas);
    const lucroLiquidoMensal = entradas - saidas;

    const stats = { 
      entradas, saidas, aReceber, percentRecebido, lucroLiquidoMensal,
      entradasPrevistas, saidasPrevistas, lucroFuturoPendente,
      custosFuturos: saidasPrevistas,
      auditList
    };

    const saldoAtual = actualBalance;
    const saldoProjetadoFuturo = runningTotal;

    // 5. ESTATÍSTICAS ANUAIS
    const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const annualData = monthsNames.map(m => ({ name: m, Receita: 0, Saída: 0, Resultado: 0 }));

    (transactions || []).forEach(t => {
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
                <span className="text-xl">📊</span> Resultado do Mês
              </h2>
              <p className="text-xs text-white/60 italic font-medium leading-relaxed">
                Receitas realizadas <span className="font-bold text-white/80">menos</span> despesas do período
              </p>
            </div>

            <div className="flex flex-col justify-center">
              <p className="text-xs sm:text-sm font-semibold text-emerald-400 mb-1 lg:mb-2 uppercase tracking-widest flex items-center gap-2">
                <Wallet className="w-4 h-4"/> Lucro Líquido do Mês
              </p>
              <div className={`flex items-baseline flex-wrap gap-2 ${stats.lucroLiquidoMensal >= 0 ? 'text-white' : 'text-rose-400'}`}>
                <span className="text-xl sm:text-2xl lg:text-3xl font-bold opacity-80 drop-shadow-md">R$</span>
                <span className="text-5xl sm:text-6xl md:text-7xl lg:text-[5rem] font-black tabular-nums tracking-tighter drop-shadow-lg leading-none break-all">
                  {stats.lucroLiquidoMensal.toFixed(2)}
                </span>
              </div>
              <div className="flex gap-4 mt-3">
                <div className="text-xs text-white/60">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest block">Bruto Recebido</span>
                  <span className="font-bold text-emerald-400">R$ {stats.entradas.toFixed(2)}</span>
                </div>
                <div className="text-xs text-white/60">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest block">Total Gasto</span>
                  <span className="font-bold text-rose-400">R$ {stats.saidas.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Lado Direito: Divisões (35-40%) */}
          <div className="lg:col-span-5 w-full bg-black/20 rounded-2xl p-4 sm:p-5 border border-white/5 backdrop-blur-sm shadow-inner overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 shrink-0 rounded overflow-hidden bg-white/10 flex items-center justify-center text-[11px] shadow-sm">🏢</div> 
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-emerald-400/90 leading-tight">Se você guardar p/ Empresa (sobre o Líquido):</p>
            </div>
            
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {[10, 15, 20, 30].map(pct => {
                const base = Math.max(0, stats.lucroLiquidoMensal);
                const valorGuardado = base * (pct / 100);
                const sobrando = base - valorGuardado;
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

      {/* NÍVEL 3: Visão de Futuro Avançada (Lucro Pendente) */}
      <Card className="border-border/40 bg-muted/20 shadow-sm rounded-3xl mt-4 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-center">
            
            {/* Esquerda: Entradas e Saídas (Lógica Global) */}
            <div className="lg:col-span-6 w-full flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-muted-foreground uppercase text-[10px] tracking-[0.2em]">
                  <Plus className="w-3 h-3 text-emerald-500" /> Projeções Ativas (Geral)
                </div>
                
                <Sheet>
                  <SheetTrigger asChild>
                    <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/50 border border-border/60 text-[10px] font-black uppercase text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                      <Search className="w-3 h-3" /> Detalhar Auditoria
                    </button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-xl p-0 overflow-hidden flex flex-col">
                    <SheetHeader className="p-6 bg-muted/20 border-b">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                          <Eye className="w-5 h-5" />
                        </div>
                        <div>
                          <SheetTitle className="text-lg font-black uppercase tracking-widest leading-none">Auditoria de Lucro</SheetTitle>
                          <SheetDescription className="text-xs font-medium">Breakdown de {stats.auditList.length} processos ativos</SheetDescription>
                        </div>
                      </div>
                    </SheetHeader>
                    
                    <div className="flex-1 overflow-y-auto p-4">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/50 bg-muted/10">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Cliente — Objeto</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-right h-10">À Receber</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-right h-10">Custos Pend.</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-right h-10">Margem Futura</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.auditList.sort((a,b) => b.lucro - a.lucro).map((p) => (
                            <TableRow key={p.id} className="hover:bg-muted/30 border-border/30">
                              <TableCell className="py-3 font-bold text-xs truncate max-w-[180px]">{p.name}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs font-bold text-emerald-600">R$ {p.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs font-medium text-rose-500">R$ {p.custos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs font-black">R$ {p.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {stats.auditList.length === 0 && (
                        <div className="py-20 text-center text-muted-foreground italic text-xs">
                          Nenhum processo com saldo pendente encontrado.
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6 border-t bg-muted/10 shadow-inner">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black uppercase text-muted-foreground">Total de Entradas:</span>
                        <span className="text-sm font-black text-emerald-600">R$ {stats.entradasPrevistas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[11px] font-black uppercase text-muted-foreground">Total de Saídas:</span>
                        <span className="text-sm font-black text-rose-600">R$ {stats.saidasPrevistas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-2xl bg-primary/10 border border-primary/20">
                        <span className="text-xs font-black uppercase text-primary">Lucro Futuro Pendente:</span>
                        <span className="text-xl font-black text-primary">R$ {stats.lucroFuturoPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              
              <div className="flex bg-emerald-500/5 p-4 rounded-3xl border border-emerald-500/20 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mr-3 shrink-0">
                  <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600/60 mb-1 leading-none">Entradas Previstas</span>
                  <div className="text-xl font-black text-emerald-600 tabular-nums tracking-tight">
                    <span className="text-sm opacity-50 mr-1">R$</span>{stats.entradasPrevistas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="flex bg-rose-500/5 p-4 rounded-3xl border border-rose-500/20 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 mr-3 shrink-0">
                  <ArrowDownCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500/60 mb-1 leading-none">Saídas Previstas</span>
                  <div className="text-xl font-black text-rose-600 tabular-nums tracking-tight">
                    <span className="text-sm opacity-50 mr-1">R$</span>{stats.saidasPrevistas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Direita: Lucro Futuro Pendente (O "Net") */}
            <div className="lg:col-span-6 w-full flex flex-col items-center justify-center p-8 bg-primary/[0.03] rounded-[2.5rem] border border-primary/10 relative shadow-inner space-y-4">
               <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-[2.5rem]"></div>
               <div className="flex items-center gap-2 relative z-10">
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Lucro Futuro Pendente</span>
                 <Target className="w-3 h-3 text-primary/50" />
               </div>
               <div className={`text-4xl sm:text-5xl font-black tabular-nums tracking-tighter relative z-10 ${stats.lucroFuturoPendente >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                 <span className="text-xl opacity-50 mr-2">R$</span>{stats.lucroFuturoPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
               </div>
               <p className="text-[10px] font-bold text-muted-foreground/80 text-center uppercase tracking-widest leading-relaxed relative z-10 max-w-[250px] pt-2 border-t border-primary/10">
                 Quanto você ainda lucrará ao finalizar todos os contratos atuais.
               </p>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Dica do Dia */}
      <div className="grid grid-cols-1 gap-6 pt-2">
        {/* Desempenho Anual (Gráfico de Barras Agrupadas + Linha de Lucro) */}

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

      <Card className="border-amber-500/30 bg-amber-500/[0.05] rounded-2xl shadow-sm">
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
