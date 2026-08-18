import { Plus } from 'lucide-react';
import { useShell } from '@/hooks/use-shell';
import { TransactionHistory } from '@/components/TransactionHistory';

export default function FinanceiroReceitasPage() {
  const shell = useShell();
  return (
    <div className="space-y-[14px]">
      <div className="flex justify-end">
        <button onClick={() => shell.openNovoRecebimento()} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Novo recebimento
        </button>
      </div>
      <TransactionHistory
        transactions={shell.monthTransactions}
        initialFilter="Receitas"
        onEdit={shell.openEditTransaction}
        onComplete={shell.openCompleteTransaction}
        onDelete={shell.refresh}
        onAddRepasse={shell.openAddRepasse}
      />
    </div>
  );
}
