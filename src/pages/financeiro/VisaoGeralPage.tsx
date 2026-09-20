import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertTriangle, CheckCircle2, Plus, ArrowDownCircle, ArrowUpCircle, ArrowRight } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getClients, getAccounts, getProcesses } from '@/lib/storage';
import { computeTrabalhoFinancials, dataEfetiva, entradasNoMes, saidasNoMes, totalAReceber, totalAPagar } from '@/lib/financials';
import { ValorMonetario } from '@/components/ValorMonetario';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const HORIZONS = [
  { key: '7', label: 'Semana', days: 7 },
  { key: '30', label: 'Mês', days: 30 },
  { key: '90', label: '3 meses', days: 90 },
  { key: '180', label: '6 meses', days: 180 },
  { key: '365', label: '12 meses', days: 365 },
] as const;

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FinanceiroVisaoGeralPage() {
  const { allTransactions, openNewTransaction, openNovoRecebimento } = useShell();
  const navigate = useNavigate();
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(HORIZONS[2]);

  const {
    kpis, points, negativeAlert, clientes, lucroTrabalhos, lucroLiquidoRealizadoTotal,
    ultimas, status,
  } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const em7 = new Date(today); em7.setDate(em7.getDate() + 7);
    const em7Str = em7.toISOString().slice(0, 10);
    const clientes = getClients();
    const contasSaldo = getAccounts().filter(a => a.ativo).reduce((s, a) => s + a.saldo, 0);

    const isIncome = (t: typeof allTransactions[number]) => t.tipo === 'Entrada' || t.tipo === 'A Receber';
    const isExpense = (t: typeof allTransactions[number]) => t.tipo === 'Saída' || t.tipo === 'A Pagar';

    const realizadas = allTransactions.filter(t => t.status === 'Concluído');
    const saldoRealizado = realizadas.reduce((s, t) => s + (isIncome(t) ? t.valor : -t.valor), 0);
    const saldoAtual = contasSaldo || saldoRealizado;

    const entradasMes = entradasNoMes(allTransactions, today.getFullYear(), today.getMonth());
    const saidasMes = saidasNoMes(allTransactions, today.getFullYear(), today.getMonth());

    const pendentes = allTransactions.filter(t => t.status !== 'Concluído');
    const aReceber = totalAReceber(allTransactions);
    const aPagar = totalAPagar(allTransactions);
    const saldoProjetado = saldoAtual + aReceber - aPagar;

    // Status do caixa em 1 linha — mesma prioridade da Dashboard (attention.ts): vencido pra
    // receber > vencido pra pagar > pagamento próximo > tudo em dia. Não é um cálculo novo, só
    // reaproveita os mesmos lançamentos pendentes já filtrados acima.
    const receberVencido = pendentes.filter(isIncome).filter(t => t.data < todayStr).reduce((s, t) => s + t.valor, 0);
    const pagarVencido = pendentes.filter(isExpense).filter(t => t.data < todayStr).reduce((s, t) => s + t.valor, 0);
    const pagarProximo = pendentes.filter(isExpense).filter(t => t.data >= todayStr && t.data <= em7Str).reduce((s, t) => s + t.valor, 0);
    let status: { tone: 'critical' | 'warning' | 'success'; text: string };
    if (receberVencido > 0) status = { tone: 'critical', text: `Você tem ${fmt(receberVencido)} em recebimentos vencidos.` };
    else if (pagarVencido > 0) status = { tone: 'warning', text: `Você tem ${fmt(pagarVencido)} em pagamentos vencidos.` };
    else if (pagarProximo > 0) status = { tone: 'warning', text: `${fmt(pagarProximo)} em pagamentos vencem nos próximos 7 dias.` };
    else status = { tone: 'success', text: 'Seu caixa está em dia — nada vencido ou vencendo esta semana.' };

    // Projeção de saldo no horizonte selecionado (usada no gráfico)
    const horizonEnd = new Date(today);
    horizonEnd.setDate(horizonEnd.getDate() + horizon.days);
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

    // Últimas movimentações — só as mais recentes já concluídas, pela data real (dataEfetiva), pra
    // dar um resumo rápido do que aconteceu. O extrato completo com previsto/realizado por
    // categoria já vive em Movimentações — não duplica aqui.
    const ultimas = realizadas
      .slice()
      .sort((a, b) => dataEfetiva(b).localeCompare(dataEfetiva(a)))
      .slice(0, 6)
      .map(t => ({ ...t, dataReal: dataEfetiva(t), clienteNome: nomeCliente(t.clienteId), isIncome: isIncome(t) }));

    // Lucro previsto por trabalho = a receber (só o que já está lançado) − repasse pendente daquele
    // trabalho. Antes usava o valor total do contrato, que incluía parcelas nem lançadas ainda —
    // isso fazia o total daqui não bater com os cards "A receber"/"A pagar" ali em cima. Agora bate
    // sempre, porque vem exatamente dos mesmos lançamentos.
    const lucroTrabalhos = getProcesses()
      .filter(p => !p.isArchived)
      .map(p => {
        const fin = computeTrabalhoFinancials(p, allTransactions);
        return { id: p.id, nome: p.objeto || 'Trabalho', clienteNome: nomeCliente(p.clienteId), previsto: fin.aReceber - fin.repasseAPagar, realizado: fin.resultadoRealizado };
      })
      .filter(t => t.previsto !== 0 || t.realizado !== 0)
      .sort((a, b) => b.previsto - a.previsto);
    const lucroLiquidoRealizadoTotal = lucroTrabalhos.reduce((s, t) => s + t.realizado, 0);
    // Resultado líquido do mês = entradas realizadas − saídas realizadas, ambas já calculadas
    // acima (dataEfetiva, sem duplicar critério nenhum) — não é a mesma coisa que "lucro por
    // trabalho" (que já desconta repasse por trabalho); aqui é só o extrato bruto do mês, líquido
    // entre os dois lados.
    const resultadoLiquidoMes = entradasMes - saidasMes;

    return {
      kpis: { saldoAtual, entradasMes, saidasMes, resultadoLiquidoMes, aReceber, aPagar, saldoProjetado },
      points, negativeAlert, clientes, lucroTrabalhos, lucroLiquidoRealizadoTotal, ultimas, status,
    };
  }, [allTransactions, horizon]);

  const statusStyle = {
    critical: { icon: AlertTriangle, wrap: 'bg-destructive-soft border-destructive/30', icon_: 'text-destructive', text: 'text-foreground' },
    warning: { icon: AlertTriangle, wrap: 'bg-warning-soft border-warning/30', icon_: 'text-warning', text: 'text-foreground' },
    success: { icon: CheckCircle2, wrap: 'bg-success-soft border-success/30', icon_: 'text-success', text: 'text-foreground' },
  }[status.tone];
  const StatusIcon = statusStyle.icon;

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[19px] font-semibold">Financeiro</h1>
          <p className="text-[12.5px] text-mute-2 mt-0.5">Acompanhe seu caixa, recebimentos e pagamentos.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 px-[14px] py-[9px] rounded-xl bg-primary text-primary-foreground text-[12.5px] font-medium hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> Nova movimentação
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openNovoRecebimento()} className="text-[12.5px] gap-2">
              <ArrowDownCircle className="w-3.5 h-3.5 text-success" /> Entrada / recebimento
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openNewTransaction({ tipo: 'Saída' })} className="text-[12.5px] gap-2">
              <ArrowUpCircle className="w-3.5 h-3.5 text-destructive" /> Saída / pagamento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPIs primários — Saldo disponível com destaque visual maior que os outros 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr_1fr] gap-px bg-border border border-border rounded-xl overflow-hidden">
        <div className="bg-card px-[20px] py-[18px] min-w-0">
          <div className="text-[11px] uppercase tracking-[.07em] text-mute-2">Saldo disponível</div>
          <div className={cn('font-mono-hbs text-[30px] mt-1.5 truncate', kpis.saldoAtual >= 0 ? 'text-foreground' : 'text-destructive')}>
            <ValorMonetario value={fmt(kpis.saldoAtual)} />
          </div>
        </div>
        <div className="bg-card px-[16px] py-[18px] min-w-0 flex flex-col justify-center">
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 truncate">Entradas do mês</div>
          <div className="font-mono-hbs text-[17px] mt-1.5 truncate text-success"><ValorMonetario value={fmt(kpis.entradasMes)} /></div>
        </div>
        <div className="bg-card px-[16px] py-[18px] min-w-0 flex flex-col justify-center">
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 truncate">Saídas do mês</div>
          <div className="font-mono-hbs text-[17px] mt-1.5 truncate text-destructive"><ValorMonetario value={fmt(kpis.saidasMes)} /></div>
        </div>
        <div className="bg-card px-[16px] py-[18px] min-w-0 flex flex-col justify-center">
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 truncate">Resultado do mês</div>
          <div className={cn('font-mono-hbs text-[17px] mt-1.5 truncate', kpis.resultadoLiquidoMes >= 0 ? 'text-success' : 'text-destructive')}>
            <ValorMonetario value={fmt(kpis.resultadoLiquidoMes)} />
          </div>
        </div>
      </div>

      {/* KPIs secundários — visualmente subordinados aos 4 de cima */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border border border-border rounded-xl overflow-hidden">
        <button onClick={() => navigate('/caixa/cobranca')} className="bg-surface-2 px-[14px] py-[11px] min-w-0 text-left hover:bg-surface-3 transition-colors">
          <div className="text-[10px] uppercase tracking-[.07em] text-mute-2 truncate">A receber</div>
          <div className="font-mono-hbs text-[14px] mt-1 truncate text-accent"><ValorMonetario value={fmt(kpis.aReceber)} /></div>
        </button>
        <button onClick={() => navigate('/caixa/despesas')} className="bg-surface-2 px-[14px] py-[11px] min-w-0 text-left hover:bg-surface-3 transition-colors">
          <div className="text-[10px] uppercase tracking-[.07em] text-mute-2 truncate">A pagar</div>
          <div className="font-mono-hbs text-[14px] mt-1 truncate text-warning"><ValorMonetario value={fmt(kpis.aPagar)} /></div>
        </button>
        <div className="bg-surface-2 px-[14px] py-[11px] min-w-0">
          <div className="text-[10px] uppercase tracking-[.07em] text-mute-2 truncate">Saldo projetado</div>
          <div className={cn('font-mono-hbs text-[14px] mt-1 truncate', kpis.saldoProjetado >= 0 ? 'text-foreground' : 'text-destructive')}>
            <ValorMonetario value={fmt(kpis.saldoProjetado)} />
          </div>
        </div>
      </div>

      {/* Status do caixa em 1 linha */}
      <div className={cn('border rounded-xl p-[13px_18px] flex items-center gap-3', statusStyle.wrap)}>
        <StatusIcon className={cn('w-4.5 h-4.5 flex-none', statusStyle.icon_)} />
        <p className={cn('text-[12.5px]', statusStyle.text)}>{status.text}</p>
      </div>

      {negativeAlert && (
        <div className="bg-destructive-soft border border-destructive/30 rounded-xl p-[14px_18px] flex items-center gap-3">
          <AlertTriangle className="w-4.5 h-4.5 text-destructive flex-none" />
          <p className="text-[12.5px] text-foreground">
            Seu caixa projetado fica <strong className="text-destructive">negativo em {fmt(Math.abs(negativeAlert.saldo))}</strong> por volta de <strong>{negativeAlert.date}</strong>, considerando os lançamentos previstos até {horizon.label.toLowerCase()}.
          </p>
        </div>
      )}

      {/* Ações rápidas */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => openNovoRecebimento()} className="flex items-center gap-1.5 px-3 py-[8px] rounded-xl border border-border bg-card text-[12px] font-medium hover:bg-surface-3 transition-colors">
          <ArrowDownCircle className="w-3.5 h-3.5 text-success" /> Nova entrada
        </button>
        <button onClick={() => openNewTransaction({ tipo: 'Saída' })} className="flex items-center gap-1.5 px-3 py-[8px] rounded-xl border border-border bg-card text-[12px] font-medium hover:bg-surface-3 transition-colors">
          <ArrowUpCircle className="w-3.5 h-3.5 text-destructive" /> Nova saída
        </button>
        <button onClick={() => navigate('/caixa/cobranca')} className="flex items-center gap-1.5 px-3 py-[8px] rounded-xl border border-border bg-card text-[12px] font-medium hover:bg-surface-3 transition-colors">
          Receber
        </button>
        <button onClick={() => navigate('/caixa/despesas')} className="flex items-center gap-1.5 px-3 py-[8px] rounded-xl border border-border bg-card text-[12px] font-medium hover:bg-surface-3 transition-colors">
          Pagar
        </button>
      </div>

      <section className="bg-card border border-border rounded-xl p-[17px_18px]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-[13.5px] font-semibold">Projeção de saldo</div>
          <div className="flex gap-1 bg-surface-2 p-1 rounded-xl border border-3">
            {HORIZONS.map(h => (
              <button
                key={h.key}
                onClick={() => setHorizon(h)}
                className={cn(
                  'px-2.5 py-[6px] rounded-lg text-[10.5px] font-medium uppercase tracking-wide transition-colors whitespace-nowrap',
                  horizon.key === h.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[200px] mt-3">
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

      {/* Últimas movimentações — resumo curto; extrato completo fica em Movimentações */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-[18px] py-[15px] border-b border-3 flex items-center justify-between">
          <div className="text-[13.5px] font-semibold">Últimas movimentações</div>
          <button onClick={() => navigate('/caixa/receitas')} className="flex items-center gap-1 text-[11.5px] text-accent hover:underline">
            Ver todas <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {ultimas.length === 0 ? (
          <div className="px-[18px] py-4 text-xs text-muted-foreground">Nenhuma movimentação concluída ainda.</div>
        ) : (
          ultimas.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-[18px] py-[10px] border-b border-3 last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium truncate">{t.descricao}</div>
                <div className="text-[11px] text-mute-2 truncate">{t.clienteNome} · {new Date(t.dataReal + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
              </div>
              <div className={cn('font-mono-hbs text-[13px] flex-none', t.isIncome ? 'text-success' : 'text-destructive')}>
                {t.isIncome ? '+' : '−'} <ValorMonetario value={fmt(t.valor)} />
              </div>
            </div>
          ))
        )}
      </section>

      {lucroTrabalhos.length > 0 && (
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-[18px] py-[15px] border-b border-3 flex items-center justify-between">
            <div>
              <div className="text-[13.5px] font-semibold">Lucro líquido por trabalho</div>
              <div className="text-[11.5px] text-mute-2 mt-0.5">a receber − repasse pendente, por trabalho</div>
            </div>
            <div className="text-right">
              <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2">até agora</div>
              <div className="font-mono-hbs text-[15px]"><ValorMonetario value={fmt(lucroLiquidoRealizadoTotal)} /></div>
            </div>
          </div>
          {lucroTrabalhos.map(t => (
            <div key={t.id} onClick={() => navigate(`/trabalhos/${t.id}`)} className="flex items-center gap-[13px] px-[18px] py-[11px] border-b border-3 last:border-b-0 cursor-pointer hover:bg-surface-3 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium truncate">{t.nome}</div>
                <div className="text-[11px] text-mute-2 mt-0.5 truncate">{t.clienteNome}</div>
              </div>
              <div className="text-right flex-none">
                <div className="text-[10px] text-mute-2">previsto</div>
                <div className="font-mono-hbs text-[13.5px]"><ValorMonetario value={fmt(t.previsto)} /></div>
              </div>
              <div className="text-right flex-none">
                <div className="text-[10px] text-mute-2">até agora</div>
                <div className="font-mono-hbs text-[13.5px] text-success"><ValorMonetario value={fmt(t.realizado)} /></div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
