import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { getClients, getAccounts, getProcesses } from '@/lib/storage';
import { computeTrabalhoFinancials, dataEfetiva } from '@/lib/financials';
import { ValorMonetario } from '@/components/ValorMonetario';
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
  const { allTransactions } = useShell();
  const navigate = useNavigate();
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(HORIZONS[2]);

  const { kpis, points, negativeAlert, receitasPrevisto, receitasRealizado, despesasPrevisto, despesasRealizado, clientes, lucroTrabalhos, lucroLiquidoRealizadoTotal } = useMemo(() => {
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

    const entradasMes = realizadas.filter(t => isIncome(t) && dataEfetiva(t).slice(0, 7) === monthStr).reduce((s, t) => s + t.valor, 0);
    const saidasMes = realizadas.filter(t => isExpense(t) && dataEfetiva(t).slice(0, 7) === monthStr).reduce((s, t) => s + t.valor, 0);

    const pendentes = allTransactions.filter(t => t.status !== 'Concluído');
    const aReceber = pendentes.filter(isIncome).reduce((s, t) => s + t.valor, 0);
    const aPagar = pendentes.filter(isExpense).reduce((s, t) => s + t.valor, 0);
    const saldoProjetado = saldoAtual + aReceber - aPagar;

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

    const receitasPrevisto = pendentes.filter(isIncome).sort((a, b) => a.data.localeCompare(b.data))
      .map(t => ({ ...t, atrasado: t.data < todayStr, clienteNome: nomeCliente(t.clienteId) }));
    const despesasPrevisto = pendentes.filter(isExpense).sort((a, b) => a.data.localeCompare(b.data))
      .map(t => ({ ...t, atrasado: t.data < todayStr, clienteNome: nomeCliente(t.clienteId) }));
    const receitasRealizado = realizadas.filter(isIncome).sort((a, b) => dataEfetiva(b).localeCompare(dataEfetiva(a)))
      .map(t => ({ ...t, data: dataEfetiva(t), atrasado: false, clienteNome: nomeCliente(t.clienteId) }));
    const despesasRealizado = realizadas.filter(isExpense).sort((a, b) => dataEfetiva(b).localeCompare(dataEfetiva(a)))
      .map(t => ({ ...t, data: dataEfetiva(t), atrasado: false, clienteNome: nomeCliente(t.clienteId) }));

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
    const lucroLiquidoPrevistoTotal = aReceber - aPagar;
    const lucroLiquidoRealizadoTotal = lucroTrabalhos.reduce((s, t) => s + t.realizado, 0);
    // Resultado líquido do mês = entradas realizadas − saídas realizadas, ambas já calculadas
    // acima (dataEfetiva, sem duplicar critério nenhum) — não é a mesma coisa que "lucro por
    // trabalho" (que já desconta repasse por trabalho); aqui é só o extrato bruto do mês, líquido
    // entre os dois lados. Não muda como Receitas/Despesas mostram valor bruto lançamento a
    // lançamento — é só a soma final das duas colunas.
    const resultadoLiquidoMes = entradasMes - saidasMes;

    return {
      kpis: { saldoAtual, entradasMes, saidasMes, resultadoLiquidoMes, aReceber, aPagar, saldoProjetado, lucroLiquidoPrevistoTotal },
      points, negativeAlert, receitasPrevisto, receitasRealizado, despesasPrevisto, despesasRealizado, clientes, lucroTrabalhos, lucroLiquidoRealizadoTotal,
    };
  }, [allTransactions, horizon]);

  const kpiCards = [
    { label: 'Saldo atual', value: kpis.saldoAtual, cls: kpis.saldoAtual >= 0 ? 'text-foreground' : 'text-destructive' },
    { label: 'Entradas do mês', value: kpis.entradasMes, cls: 'text-success' },
    { label: 'Saídas do mês', value: kpis.saidasMes, cls: 'text-destructive' },
    { label: 'Resultado líquido do mês', value: kpis.resultadoLiquidoMes, cls: kpis.resultadoLiquidoMes >= 0 ? 'text-success' : 'text-destructive' },
    { label: 'A receber', value: kpis.aReceber, cls: 'text-accent' },
    { label: 'A pagar', value: kpis.aPagar, cls: 'text-warning' },
    { label: 'Saldo projetado', value: kpis.saldoProjetado, cls: kpis.saldoProjetado >= 0 ? 'text-foreground' : 'text-destructive' },
    { label: 'Lucro líquido previsto', value: kpis.lucroLiquidoPrevistoTotal, cls: 'text-accent' },
  ];

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border rounded-xl overflow-hidden">
        {kpiCards.map(k => (
          <div key={k.label} className="bg-card px-[16px] py-[14px] min-w-0">
            <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 truncate">{k.label}</div>
            <div className={cn('font-mono-hbs text-[19px] mt-1.5 truncate', k.cls)}><ValorMonetario value={fmt(k.value)} /></div>
          </div>
        ))}
      </div>

      {negativeAlert && (
        <div className="bg-destructive-soft border border-destructive/30 rounded-xl p-[14px_18px] flex items-center gap-3">
          <AlertTriangle className="w-4.5 h-4.5 text-destructive flex-none" />
          <p className="text-[12.5px] text-foreground">
            Seu caixa projetado fica <strong className="text-destructive">negativo em {fmt(Math.abs(negativeAlert.saldo))}</strong> por volta de <strong>{negativeAlert.date}</strong>, considerando os lançamentos previstos até {horizon.label.toLowerCase()}.
          </p>
        </div>
      )}

      {lucroTrabalhos.length > 0 && (
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-[18px] py-[15px] border-b border-3 flex items-center justify-between">
            <div>
              <div className="text-[13.5px] font-semibold">Lucro líquido por trabalho</div>
              <div className="text-[11.5px] text-mute-2 mt-0.5">a receber − repasse pendente, por trabalho — soma exatamente com os cards acima</div>
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

      <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <ColunaFinanceira titulo="Receitas" cls="text-success" previsto={receitasPrevisto} realizado={receitasRealizado} />
        <ColunaFinanceira titulo="Despesas" cls="text-destructive" previsto={despesasPrevisto} realizado={despesasRealizado} />
      </div>
    </div>
  );
}

interface LinhaFinanceira { id: string; descricao: string; valor: number; data: string; atrasado: boolean; clienteNome: string }

function ColunaFinanceira({ titulo, cls, previsto, realizado }: { titulo: string; cls: string; previsto: LinhaFinanceira[]; realizado: LinhaFinanceira[] }) {
  const totalPrevisto = previsto.reduce((s, t) => s + t.valor, 0);
  const totalRealizado = realizado.reduce((s, t) => s + t.valor, 0);
  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-[18px] py-[15px] border-b border-3 text-[13.5px] font-semibold">{titulo}</div>

      <div className="px-[18px] pt-[13px] pb-2 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[.07em] text-mute-2">Previsto</span>
        <span className={cn('font-mono-hbs text-[12px]', cls)}><ValorMonetario value={fmt(totalPrevisto)} /></span>
      </div>
      {previsto.length === 0 ? (
        <div className="px-[18px] pb-3 text-xs text-muted-foreground">Nada previsto.</div>
      ) : (
        <div className="max-h-[280px] overflow-y-auto">
          {previsto.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-[18px] py-[9px] border-t border-3">
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium truncate">{t.descricao}</div>
                <div className="text-[11px] text-mute-2 truncate">{t.clienteNome}</div>
              </div>
              <div className="text-right flex-none">
                <div className={cn('font-mono-hbs text-[12.5px]', cls)}><ValorMonetario value={fmt(t.valor)} /></div>
                <div className={cn('text-[10.5px] mt-0.5', t.atrasado ? 'text-destructive font-medium' : 'text-mute-3')}>
                  {t.atrasado ? 'Atrasada' : new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-[18px] pt-[13px] pb-2 flex items-center justify-between border-t border-3">
        <span className="text-[11px] uppercase tracking-[.07em] text-mute-2">Realizado</span>
        <span className={cn('font-mono-hbs text-[12px]', cls)}><ValorMonetario value={fmt(totalRealizado)} /></span>
      </div>
      {realizado.length === 0 ? (
        <div className="px-[18px] pb-4 text-xs text-muted-foreground">Nada realizado ainda.</div>
      ) : (
        <div className="max-h-[280px] overflow-y-auto">
          {realizado.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-[18px] py-[9px] border-t border-3">
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium truncate">{t.descricao}</div>
                <div className="text-[11px] text-mute-2 truncate">{t.clienteNome}</div>
              </div>
              <div className="text-right flex-none">
                <div className={cn('font-mono-hbs text-[12.5px]', cls)}><ValorMonetario value={fmt(t.valor)} /></div>
                <div className="text-[10.5px] mt-0.5 text-mute-3">{new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
