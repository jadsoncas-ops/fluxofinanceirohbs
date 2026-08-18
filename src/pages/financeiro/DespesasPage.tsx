import { useShell } from '@/hooks/use-shell';
import { TransactionHistory } from '@/components/TransactionHistory';

export default function FinanceiroDespesasPage() {
  const shell = useShell();
  return (
    <TransactionHistory
      transactions={shell.monthTransactions}
      initialFilter="Despesas"
      onEdit={shell.openEditTransaction}
      onComplete={shell.openCompleteTransaction}
      onDelete={shell.refresh}
      onAddRepasse={shell.openAddRepasse}
    />
  );
}
