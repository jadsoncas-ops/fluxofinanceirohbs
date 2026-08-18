import { useNavigate } from 'react-router-dom';
import { useShell } from '@/hooks/use-shell';
import { Dashboard } from '@/components/Dashboard';

export default function FinanceiroVisaoGeralPage() {
  const shell = useShell();
  const navigate = useNavigate();

  return (
    <Dashboard
      transactions={shell.allTransactions}
      month={shell.month}
      year={shell.year}
      onProjectClick={() => navigate('/processos')}
    />
  );
}
