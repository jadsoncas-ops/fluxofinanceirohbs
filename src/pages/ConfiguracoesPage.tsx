import { useShell } from '@/hooks/use-shell';
import { Settings } from '@/components/Settings';

export default function ConfiguracoesPage() {
  const shell = useShell();
  return <Settings onDataChange={shell.refresh} />;
}
