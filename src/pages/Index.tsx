import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dashboard } from '@/components/Dashboard';
import { TransactionHistory } from '@/components/TransactionHistory';
import { TransactionForm } from '@/components/TransactionForm';
import { PartialPaymentModal } from '@/components/PartialPaymentModal';
import { Settings } from '@/components/Settings';
import { ClientsList } from '@/components/ClientsList';
import { ClientMigrationModal } from '@/components/ClientMigrationModal';
import { ClientForm } from '@/components/ClientForm';
import { getTransactions } from '@/lib/storage';
import { generateMonthlyReport } from '@/lib/pdf';
import { Transaction } from '@/lib/types';
import { LayoutDashboard, List, Settings as SettingsIcon, Plus, FileDown, Building, Users, UserPlus } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import hbsLogo from '@/assets/hbs-logo.png';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type Tab = 'dashboard' | 'history' | 'clients' | 'settings';

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
  const [clientFormOpen, setClientFormOpen] = useState(false);

  const refresh = useCallback(() => setTxKey(k => k + 1), []);

  const allTransactions = useMemo(() => {
    void txKey; // dependency trigger
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
    setFormOpen(true);
  }

  function handleAddRepasse(tx: Transaction) {
    setParentItem(tx);
    setEditItem(null);
    setFormOpen(true);
  }

  function handleExportPdf() {
    generateMonthlyReport(monthTransactions, month, year);
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'history', label: 'Histórico', icon: List },
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

      {/* Filters */}
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
        <Button variant="outline" size="sm" className="h-8 text-[11px] sm:text-xs gap-1 sm:gap-1.5 border-border shadow-sm text-foreground/80 hover:text-foreground hidden sm:flex" onClick={() => setTab('clients')}>
          <Users className="w-3.5 h-3.5" />
          <span>Clientes</span>
        </Button>
        <Button variant="secondary" size="sm" className="h-8 text-[11px] sm:text-xs gap-1 sm:gap-1.5 bg-muted/50 hover:bg-muted font-bold text-muted-foreground hover:text-foreground shrink-0" onClick={() => setClientFormOpen(true)}>
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Novo Cliente</span>
        </Button>
        <Button size="sm" className="h-8 text-[11px] sm:text-xs gap-1 sm:gap-1.5 font-bold shadow-sm shrink-0" onClick={() => { setEditItem(null); setParentItem(null); setFormOpen(true); }}>
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Novo Lançamento</span>
        </Button>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-20">
        {tab === 'dashboard' && <Dashboard transactions={monthTransactions} month={month} year={year} />}
        {tab === 'history' && (
          <TransactionHistory
            transactions={monthTransactions}
            onEdit={handleEdit}
            onComplete={tx => setCompleteItem(tx)}
            onDelete={refresh}
            onAddRepasse={handleAddRepasse}
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
        onClose={() => { setFormOpen(false); setEditItem(null); setParentItem(null); }}
        onSave={refresh}
        editItem={editItem}
        parentItem={parentItem}
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
      <ClientForm
         open={clientFormOpen}
         onClose={() => setClientFormOpen(false)}
         onSave={(newC) => { 
           // If they create it here, it will just show up in the history/CRM. No transaction mapping needed.
         }}
      />
    </div>
  );
}
