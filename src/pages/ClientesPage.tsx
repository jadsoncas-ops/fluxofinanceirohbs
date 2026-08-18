import { ClientsList } from '@/components/ClientsList';
import { useShell } from '@/hooks/use-shell';

export default function ClientesPage() {
  const shell = useShell();
  return <ClientsList refreshSignal={shell.refreshKey} />;
}
