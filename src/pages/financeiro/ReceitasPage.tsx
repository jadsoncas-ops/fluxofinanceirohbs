import { useShell } from '@/hooks/use-shell';
import { TransactionHistory } from '@/components/TransactionHistory';

export default function FinanceiroReceitasPage() {
  const shell = useShell();
  return (
    <TransactionHistory
      transactions={shell.monthTransactions}
      initialFilter="Receitas"
      onEdit={shell.openEditTransaction}
      onComplete={shell.openCompleteTransaction}
      onDelete={shell.refresh}
      onAddRepasse={shell.openAddRepasse}
    />
  );
}
