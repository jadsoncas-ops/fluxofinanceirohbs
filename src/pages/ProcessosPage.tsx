import { useState } from 'react';
import { useShell } from '@/hooks/use-shell';
import { ProcessManager } from '@/components/ProcessManager';

export default function ProcessosPage() {
  const shell = useShell();
  const [activeTab, setActiveTab] = useState('ativos');

  return (
    <ProcessManager
      allTransactions={shell.allTransactions}
      onRefresh={shell.refresh}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  );
}
