import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { TransactionList } from '@/components/TransactionList';
import { ValorMonetario } from '@/components/ValorMonetario';
import { getClients, getProcesses } from '@/lib/storage';
import { dataEfetiva } from '@/lib/financials';
import { cn } from '@/lib/utils';

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type ResumoAba = 'recebido' | 'pago' | 'resultado';

export default function FinanceiroMovimentacoesPage() {
  const shell = useShell();
  const [abaAberta, setAbaAberta] = useState<ResumoAba | null>(null);

  const clientes = useMemo(() => getClients(), []);
  const processos = useMemo(() => getProcesses(), []);

  // Mesmo critério de "Realizado" que cada coluna já calcula sozinha (status Concluído) —
  // aqui só soma os dois lados pra responder "quanto sobrou" sem precisar fazer conta de cabeça.
  // realizadosOrdenados vira a fonte do detalhamento clicável logo abaixo dos 3 números.
  const { recebido, pago, resultado, realizadosOrdenados } = useMemo(() => {
    const realizados = shell.monthTransactions.filter(t => t.status === 'Concluído');
    let recebido = 0, pago = 0;
    for (const t of realizados) {
      const isIncome = t.tipo === 'Entrada' || t.tipo === 'A Receber';
      if (isIncome) recebido += t.valor; else pago += t.valor;
    }
    const realizadosOrdenados = [...realizados].sort((a, b) => dataEfetiva(b).localeCompare(dataEfetiva(a)));
    return { recebido, pago, resultado: recebido - pago, realizadosOrdenados };
  }, [shell.monthTransactions]);

  const itensDetalhe = useMemo(() => {
    if (!abaAberta) return [];
    return realizadosOrdenados.filter(t => {
      const isIncome = t.tipo === 'Entrada' || t.tipo === 'A Receber';
      if (abaAberta === 'recebido') return isIncome;
      if (abaAberta === 'pago') return !isIncome;
      return true; // resultado = recebido e pago juntos, já líquido
    });
  }, [abaAberta, realizadosOrdenados]);

  function toggleAba(aba: ResumoAba) {
    setAbaAberta(prev => (prev === aba ? null : aba));
  }

  return (
    <div className="space-y-[18px]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border border border-border rounded-xl overflow-hidden">
        <button type="button" onClick={() => toggleAba('recebido')} className={cn('bg-card px-[16px] py-[14px] min-w-0 text-left hover:bg-surface-2 transition-colors', abaAberta === 'recebido' && 'bg-surface-2')}>
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 truncate">Recebido no mês</div>
          <div className="font-mono-hbs text-[19px] mt-1.5 truncate text-success"><ValorMonetario value={fmt(recebido)} /></div>
        </button>
        <button type="button" onClick={() => toggleAba('pago')} className={cn('bg-card px-[16px] py-[14px] min-w-0 text-left hover:bg-surface-2 transition-colors', abaAberta === 'pago' && 'bg-surface-2')}>
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 truncate">Pago no mês</div>
          <div className="font-mono-hbs text-[19px] mt-1.5 truncate text-destructive"><ValorMonetario value={fmt(pago)} /></div>
        </button>
        <button type="button" onClick={() => toggleAba('resultado')} className={cn('bg-card px-[16px] py-[14px] min-w-0 text-left hover:bg-surface-2 transition-colors', abaAberta === 'resultado' && 'bg-surface-2')}>
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 truncate">Resultado do mês</div>
          <div className={cn('font-mono-hbs text-[19px] mt-1.5 truncate', resultado >= 0 ? 'text-success' : 'text-destructive')}><ValorMonetario value={fmt(resultado)} /></div>
        </button>
      </div>

      {abaAberta && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-[11px] border-b border-3 bg-surface-2">
            <span className="text-[12px] font-semibold">
              {abaAberta === 'recebido' && 'Recebido no mês — lançamentos'}
              {abaAberta === 'pago' && 'Pago no mês — lançamentos'}
              {abaAberta === 'resultado' && 'Resultado do mês — recebido e pago juntos, já líquido'}
            </span>
            <button onClick={() => setAbaAberta(null)} className="h-6 w-6 grid place-items-center rounded-md hover:bg-surface-3 text-mute-2" title="Fechar">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {itensDetalhe.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Nada realizado ainda neste mês.</div>
          ) : (
            itensDetalhe.map(t => {
              const isIncome = t.tipo === 'Entrada' || t.tipo === 'A Receber';
              const clienteNome = clientes.find(c => c.id === t.clienteId)?.nome;
              const trabalho = t.processId ? processos.find(p => p.id === t.processId) : undefined;
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 px-[18px] py-[11px] border-t border-3 first:border-t-0">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium truncate">{t.descricao}</div>
                    <div className="text-[11px] text-mute-2 truncate">
                      {clienteNome || 'Sem cliente'}{trabalho && ` · ${trabalho.objeto}`} · {new Date(dataEfetiva(t) + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <span className={cn('font-mono-hbs text-[13px] flex-none', isIncome ? 'text-success' : 'text-destructive')}>
                    {isIncome ? '+ ' : '- '}{fmt(t.valor)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="grid gap-[22px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
        <div className="space-y-[14px]">
          <div className="flex items-center justify-between">
            <div className="text-[13.5px] font-semibold">Receitas</div>
            <button onClick={() => shell.openNovoRecebimento()} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Novo recebimento
            </button>
          </div>
          <TransactionList
            transactions={shell.monthTransactions}
            tipo="Receitas"
            onEdit={shell.openEditTransaction}
            onComplete={shell.openCompleteTransaction}
            onDelete={shell.refresh}
          />
        </div>

        <div className="space-y-[14px]">
          <div className="flex items-center justify-between">
            <div className="text-[13.5px] font-semibold">Despesas</div>
            <button onClick={() => shell.openNewTransaction({ tipo: 'Saída' })} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Nova despesa
            </button>
          </div>
          <TransactionList
            transactions={shell.monthTransactions}
            tipo="Despesas"
            onEdit={shell.openEditTransaction}
            onComplete={shell.openCompleteTransaction}
            onDelete={shell.refresh}
          />
        </div>
      </div>
    </div>
  );
}
