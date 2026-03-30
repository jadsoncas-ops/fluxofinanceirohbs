import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dashboard } from '@/components/Dashboard';
import { TransactionForm } from '@/components/TransactionForm';
import { PartialPaymentModal } from '@/components/PartialPaymentModal';
import { Settings } from '@/components/Settings';
import { ClientsList } from '@/components/ClientsList';
import { ClientMigrationModal } from '@/components/ClientMigrationModal';
import { ProcessManager } from '@/components/ProcessManager';
import { getTransactions } from '@/lib/storage';
import { generateMonthlyReport } from '@/lib/pdf';
import { Transaction, TransactionType } from '@/lib/types';
import { LayoutDashboard, Briefcase, Settings as SettingsIcon, FileDown, Building, Users } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import hbsLogo from '@/assets/hbs-logo.png';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type Tab = 'dashboard' | 'processos' | 'clients' | 'settings';

export default function Index() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<Tab>('dashboard');
  const [txKey, setTxKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Transaction | null>(null);
  const [parentItem, setParentItem] = useState<Transaction | null>(null);
  const [completeItem, setCompleteItem] = useState<Transaction | null>(null);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [prefilledClienteId, setPrefilledClienteId] = useState<string | undefined>(undefined);
  const [prefilledTipo, setPrefilledTipo] = useState<TransactionType | undefined>(undefined);

  const refresh = useCallback(() => setTxKey(k => k + 1), []);

  const allTransactions = useMemo(() => {
    void txKey;
    return getTransactions();
  }, [txKey]);

  const monthTransactions = useMemo(() => {
    return (allTransactions || []).filter(t => {
      const d = new Date(t.data + 'T12:00:00');
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [allTransactions, month, year]);

  const years = useMemo(() => {
    const set = new Set((allTransactions || []).map(t => new Date(t.data + 'T12:00:00').getFullYear()));
    set.add(now.getFullYear());
    return Array.from(set).sort();
  }, [allTransactions]);

  const unlinkedCount = useMemo(() => {
    return (allTransactions || []).filter(t => !t.isRepasse && t.clienteId === undefined).length;
  }, [allTransactions]);

  function handleEdit(tx: Transaction) {
    setEditItem(tx);
    setParentItem(null);
    setPrefilledClienteId(undefined);
    setPrefilledTipo(undefined);
    setFormOpen(true);
  }

  function handleExportPdf() {
    generateMonthlyReport(monthTransactions, month, year);
  }

  function handleOpenTransactionForm(opts: { clienteId?: string; tipo?: TransactionType; parentItem?: Transaction | null }) {
    setEditItem(null);
    setParentItem(opts.parentItem || null);
    setPrefilledClienteId(opts.clienteId);
    setPrefilledTipo(opts.tipo);
    setFormOpen(true);
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'processos', label: 'Processos', icon: Briefcase },
    { key: 'clients', label: 'Clientes', icon: Users },
    { key: 'settings', label: 'Definições', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-30 transition-colors duration-300">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={hbsLogo} alt="HBS Engenharia" className="h-8 w-auto dark:invert dark:brightness-200 transition-all duration-300" />
          <div className="flex items-center gap-1.5 flex-1">
            <Building className="w-3.5 h-3.5 text-muted-foreground/60" />
            <span className="text-[11px] text-muted-foreground font-semibold tracking-wide uppercase">Gestão Financeira</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {unlinkedCount > 0 && (
        <div className="bg-primary/10 border-b border-primary/20 p-3 flex justify-between items-center sm:px-6">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-primary/20 rounded-full shrink-0"><Users className="w-5 h-5 text-primary" /></div>
             <div>
               <p className="text-sm font-bold text-foreground">Ação Necessária ({unlinkedCount} pendências)</p>
               <p className="text-[11px] text-muted-foreground leading-snug max-w-sm hidden sm:block">Você possui registros sem cliente vinculado. Vincule-os à base corporativa.</p>
             </div>
           </div>
           <Button size="sm" onClick={() => setMigrationOpen(true)} className="ml-4 shrink-0 shadow-sm font-semibold h-9 rounded-md">Organizar Agora</Button>
        </div>
      )}

      {/* Filters - only show for Dashboard */}
      {tab === 'dashboard' && (
        <div className="max-w-2xl mx-auto w-full px-4 py-3 flex items-center gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="h-8 text-xs w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y: number) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 hidden sm:flex" onClick={handleExportPdf}>
            <FileDown className="w-3.5 h-3.5" />
            <span>PDF</span>
          </Button>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-20">
        {tab === 'dashboard' && <Dashboard transactions={monthTransactions} month={month} year={year} />}
        {tab === 'processos' && (
          <ProcessManager
            allTransactions={allTransactions}
            onRefresh={refresh}
            onOpenTransactionForm={handleOpenTransactionForm}
          />
        )}
        {tab === 'clients' && <ClientsList />}
        {tab === 'settings' && <Settings onDataChange={refresh} />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border/40 z-30 pb-safe transition-colors duration-300">
        <div className="max-w-2xl mx-auto flex px-2 py-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-lg transition-all duration-200 ${
                tab === t.key 
                ? 'text-primary bg-primary/10 font-bold' 
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium'
              }`}
            >
              <t.icon className={`w-5 h-5 ${tab === t.key ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] tracking-wide">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Modals */}
      <TransactionForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditItem(null); setParentItem(null); setPrefilledClienteId(undefined); setPrefilledTipo(undefined); }}
        onSave={refresh}
        editItem={editItem}
        parentItem={parentItem}
        prefilledClienteId={prefilledClienteId}
        prefilledTipo={prefilledTipo}
      />
      <PartialPaymentModal
        open={!!completeItem}
        onClose={() => setCompleteItem(null)}
        onSave={refresh}
        transaction={completeItem}
      />
      
      {migrationOpen && (
         <ClientMigrationModal 
           open={migrationOpen} 
           onClose={() => setMigrationOpen(false)} 
           transactions={allTransactions || []} 
           onComplete={refresh} 
         />
      )}
    </div>
  );
}
