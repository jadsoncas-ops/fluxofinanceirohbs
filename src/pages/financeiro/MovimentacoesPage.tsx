import { Plus } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { TransactionList } from '@/components/TransactionList';

export default function FinanceiroMovimentacoesPage() {
  const shell = useShell();
  return (
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
  );
}
