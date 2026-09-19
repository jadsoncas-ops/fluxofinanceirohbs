import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { TransactionList } from '@/components/TransactionList';
import { ValorMonetario } from '@/components/ValorMonetario';
import { cn } from '@/lib/utils';

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FinanceiroMovimentacoesPage() {
  const shell = useShell();

  // Mesmo critério de "Realizado" que cada coluna já calcula sozinha (status Concluído) —
  // aqui só soma os dois lados pra responder "quanto sobrou" sem precisar fazer conta de cabeça.
  const { recebido, pago, resultado } = useMemo(() => {
    let recebido = 0, pago = 0;
    for (const t of shell.monthTransactions) {
      if (t.status !== 'Concluído') continue;
      const isIncome = t.tipo === 'Entrada' || t.tipo === 'A Receber';
      if (isIncome) recebido += t.valor; else pago += t.valor;
    }
    return { recebido, pago, resultado: recebido - pago };
  }, [shell.monthTransactions]);

  return (
    <div className="space-y-[18px]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border border border-border rounded-xl overflow-hidden">
        <div className="bg-card px-[16px] py-[14px] min-w-0">
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 truncate">Recebido no mês</div>
          <div className="font-mono-hbs text-[19px] mt-1.5 truncate text-success"><ValorMonetario value={fmt(recebido)} /></div>
        </div>
        <div className="bg-card px-[16px] py-[14px] min-w-0">
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 truncate">Pago no mês</div>
          <div className="font-mono-hbs text-[19px] mt-1.5 truncate text-destructive"><ValorMonetario value={fmt(pago)} /></div>
        </div>
        <div className="bg-card px-[16px] py-[14px] min-w-0">
          <div className="text-[10.5px] uppercase tracking-[.07em] text-mute-2 truncate">Resultado do mês</div>
          <div className={cn('font-mono-hbs text-[19px] mt-1.5 truncate', resultado >= 0 ? 'text-success' : 'text-destructive')}><ValorMonetario value={fmt(resultado)} /></div>
        </div>
      </div>

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
