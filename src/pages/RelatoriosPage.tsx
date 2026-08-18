import { useMemo } from 'react';
import { getTransactions, getClients, getProcesses, getTasks } from '@/lib/storage';

function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function Bars({ items, max, format }: { items: { label: string; val: number }[]; max: number; format: (v: number) => string }) {
  return (
    <div className="flex flex-col gap-[7px] mt-3.5">
      {items.map(b => (
        <div key={b.label} className="flex items-center gap-2.5">
          <span className="text-[11.5px] text-muted-foreground w-[108px] flex-none truncate">{b.label}</span>
          <span className="flex-1 h-1.5 bg-bar-track rounded-[3px] overflow-hidden">
            <span className="block h-full bg-accent rounded-[3px]" style={{ width: `${max > 0 ? (b.val / max) * 100 : 0}%` }} />
          </span>
          <span className="text-[11px] font-mono-hbs text-mute-2 w-[62px] flex-none text-right">{format(b.val)}</span>
        </div>
      ))}
    </div>
  );
}

function ReportCard({ titulo, periodo, valor, leitura, bars, format = fmtMoney }: { titulo: string; periodo: string; valor: string; leitura: string; bars: { label: string; val: number }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...bars.map(b => b.val));
  return (
    <section className="bg-card border border-border rounded-xl p-[17px_18px]">
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="text-[13.5px] font-semibold">{titulo}</span>
        <span className="text-[11px] font-mono-hbs text-mute-2">{periodo}</span>
      </div>
      <div className="font-mono-hbs text-[26px] -tracking-[.03em] mt-3">{valor}</div>
      <div className="text-[12.5px] text-muted-foreground mt-2 leading-[1.5]">{leitura}</div>
      <Bars items={bars} max={max} format={format} />
    </section>
  );
}

export default function RelatoriosPage() {
  const { faturamento, faturamentoPorCategoria, clientesPorReceita, despesas, despesasPorCategoria, prazos, leitura } = useMemo(() => {
    const transactions = getTransactions();
    const clients = getClients();
    const tasks = getTasks();
    const today = new Date().toISOString().slice(0, 10);

    const receitas = transactions.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status === 'Concluído');
    const despesasTx = transactions.filter(t => (t.tipo === 'Saída' || t.tipo === 'A Pagar') && t.status === 'Concluído');

    const faturamento = receitas.reduce((s, t) => s + t.valor, 0);
    const despesas = despesasTx.reduce((s, t) => s + t.valor, 0);

    const catMap = new Map<string, number>();
    receitas.forEach(t => catMap.set(t.categoria, (catMap.get(t.categoria) || 0) + t.valor));
    const faturamentoPorCategoria = Array.from(catMap.entries()).map(([label, val]) => ({ label, val })).sort((a, b) => b.val - a.val).slice(0, 4);

    const despCatMap = new Map<string, number>();
    despesasTx.forEach(t => despCatMap.set(t.categoria, (despCatMap.get(t.categoria) || 0) + t.valor));
    const despesasPorCategoria = Array.from(despCatMap.entries()).map(([label, val]) => ({ label, val })).sort((a, b) => b.val - a.val).slice(0, 4);

    const clienteMap = new Map<string, number>();
    receitas.forEach(t => { if (t.clienteId) clienteMap.set(t.clienteId, (clienteMap.get(t.clienteId) || 0) + t.valor); });
    const clientesPorReceita = Array.from(clienteMap.entries())
      .map(([id, val]) => ({ label: clients.find(c => c.id === id)?.nome || 'Cliente', val }))
      .sort((a, b) => b.val - a.val).slice(0, 4);

    const abertas = tasks.filter(t => t.status !== 'Concluída');
    const emDia = abertas.filter(t => !t.prazo || t.prazo >= today).length;
    const atraso7 = abertas.filter(t => t.prazo && t.prazo < today && (new Date(today).getTime() - new Date(t.prazo).getTime()) / 86400000 <= 7).length;
    const atrasoMais7 = abertas.filter(t => t.prazo && t.prazo < today && (new Date(today).getTime() - new Date(t.prazo).getTime()) / 86400000 > 7).length;
    const totalPrazos = Math.max(1, emDia + atraso7 + atrasoMais7);
    const prazos = { pct: Math.round((emDia / totalPrazos) * 100), bars: [{ label: 'Em dia', val: emDia }, { label: 'Atraso < 7 dias', val: atraso7 }, { label: 'Atraso > 7 dias', val: atrasoMais7 }] };

    const aReceber = transactions.filter(t => (t.tipo === 'Entrada' || t.tipo === 'A Receber') && t.status !== 'Concluído').reduce((s, t) => s + t.valor, 0);
    const pctPendente = faturamento + aReceber > 0 ? Math.round((aReceber / (faturamento + aReceber)) * 100) : 0;
    const leitura = faturamento > 0
      ? `Faturamento acumulado de ${fmtMoney(faturamento)}, com ${fmtMoney(aReceber)} ainda pendente de recebimento (${pctPendente}% do total contratado).`
      : 'Ainda não há receitas concluídas registradas para gerar uma leitura do período.';

    return { faturamento, faturamentoPorCategoria, clientesPorReceita, despesas, despesasPorCategoria, prazos, leitura };
  }, []);

  return (
    <div className="space-y-[18px] pb-8">
      <section className="bg-sidebar text-white rounded-xl p-[22px]">
        <div className="text-[11px] tracking-[.09em] uppercase text-white/45 font-mono-hbs">Leitura do período</div>
        <div className="text-[17px] font-semibold -tracking-[.02em] mt-2.5 max-w-[720px] leading-[1.45]">{leitura}</div>
      </section>

      <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <ReportCard titulo="Faturamento" periodo="acumulado" valor={fmtMoney(faturamento)} leitura="Receita concluída, somada por categoria de serviço." bars={faturamentoPorCategoria} />
        <ReportCard titulo="Clientes por receita" periodo={`${clientesPorReceita.length} ativos`} valor={String(clientesPorReceita.length)} leitura="Quem mais contribuiu para a receita concluída." bars={clientesPorReceita} />
        <ReportCard titulo="Despesas" periodo="acumulado" valor={fmtMoney(despesas)} leitura="Para onde o dinheiro da empresa está indo." bars={despesasPorCategoria} />
        <ReportCard titulo="Prazos" periodo="tarefas abertas" valor={`${prazos.pct}% em dia`} leitura="Situação das tarefas com prazo definido." bars={prazos.bars} format={v => String(v)} />
      </div>
    </div>
  );
}
