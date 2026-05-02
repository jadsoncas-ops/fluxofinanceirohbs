import { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dashboard } from '@/components/Dashboard';
import { TransactionForm } from '@/components/TransactionForm';
import { PartialPaymentModal } from '@/components/PartialPaymentModal';
import { Settings } from '@/components/Settings';
import { ClientsList } from '@/components/ClientsList';
import { ClientMigrationModal } from '@/components/ClientMigrationModal';
import { ProcessManager } from '@/components/ProcessManager';
import { TransactionHistory } from '@/components/TransactionHistory';
import { TasksPage } from '@/components/TasksPage';
import { TasksWidget } from '@/components/TasksWidget';
import { AppSidebar, DesktopTab } from '@/components/AppSidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { getTransactions, getTasks } from '@/lib/storage';
import { generateMonthlyReport } from '@/lib/pdf';
import { Transaction, Task } from '@/lib/types';
import { LayoutDashboard, Briefcase, Settings as SettingsIcon, FileDown, Building, Users, X, ListTodo, Receipt, Command, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import hbsLogo from '@/assets/hbs-logo.png';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type Tab = DesktopTab;

export default function Index() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<Tab>('dashboard');
  const [txKey, setTxKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Transaction | null>(null);
  const [parentItem, setParentItem] = useState<Transaction | null>(null);
  const [completeItem, setCompleteItem] = useState<Transaction | null>(null);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [activeProcessTab, setActiveProcessTab] = useState<string>('ativos');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [pendingNewTask, setPendingNewTask] = useState<Partial<Task> | null>(null);

  const refresh = useCallback(() => setTxKey(k => k + 1), []);

  // Ctrl+K / Cmd+K → Command Palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handlePrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    }
  };

  const allTransactions = useMemo(() => {
    void txKey;
    return getTransactions();
  }, [txKey]);

  const monthTransactions = useMemo(() => {
    if (month === 12 || year === 0) return allTransactions || [];
    const viewDate = new Date(year, month + 1, 0);
    return (allTransactions || []).filter(t => {
      const d = new Date(t.data + 'T12:00:00');
      const txMonth = d.getMonth();
      const txYear = d.getFullYear();
      if (txMonth === month && txYear === year) return true;
      if (
        (t.tipo === 'A Receber') &&
        (t.status === 'Pendente' || t.status === 'Parcial') &&
        d < viewDate &&
        (year > txYear || (year === txYear && month > txMonth))
      ) {
        return true;
      }
      return false;
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

  // Badges para sidebar
  const sidebarBadges = useMemo(() => {
    void txKey;
    const tasks = getTasks();
    const overdueOrToday = tasks.filter(t => t.status !== 'Concluída' && t.prazo && t.prazo <= today).length;
    return {
      tasks: overdueOrToday > 0 ? overdueOrToday : undefined,
    };
  }, [txKey, today]);

  function handleEdit(tx: Transaction) {
    setEditItem(tx);
    setParentItem(null);
    setFormOpen(true);
  }

  function handleExportPdf() {
    generateMonthlyReport(monthTransactions, month, year);
  }

  // Bottom-nav (mobile) - mesmas tabs principais
  const mobileTabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { key: 'processos', label: 'Processos', icon: Briefcase },
    { key: 'tasks', label: 'Tarefas', icon: ListTodo },
    { key: 'clients', label: 'Clientes', icon: Users },
    { key: 'settings', label: 'Mais', icon: SettingsIcon },
  ];

  const showFilters = tab === 'dashboard' || tab === 'financeiro';

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Desktop Sidebar */}
      <AppSidebar active={tab} onChange={setTab} onOpenCommand={() => setCommandOpen(true)} badges={sidebarBadges} />

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {showInstallBanner && (
          <div className="bg-primary p-2 text-primary-foreground flex justify-between items-center px-4 animate-in slide-in-from-top duration-300">
             <span className="text-[10px] font-black uppercase tracking-widest">Instale o App HBS no seu celular</span>
             <div className="flex gap-2">
               <Button size="sm" variant="secondary" onClick={handleInstallClick} className="h-7 text-[9px] font-black uppercase tracking-tighter">Instalar Agora</Button>
               <Button size="sm" variant="ghost" onClick={() => setShowInstallBanner(false)} className="h-7 w-7 p-0"><X className="w-4 h-4" /></Button>
             </div>
          </div>
        )}

        {/* Mobile Header (only < lg) */}
        <header className="lg:hidden border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-30">
          <div className="px-4 py-3 flex items-center gap-3">
            <img src={hbsLogo} alt="HBS Engenharia" className="h-8 w-auto dark:invert dark:brightness-200" />
            <div className="flex items-center gap-1.5 flex-1">
              <Building className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground font-semibold tracking-wide uppercase">Gestão Financeira</span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Desktop Top Header */}
        <header className="hidden lg:flex items-center gap-4 px-8 h-16 border-b border-border/40 glass-strong sticky top-0 z-20">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">HBS ERP</span>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              {tab === 'dashboard' && 'Dashboard'}
              {tab === 'financeiro' && 'Financeiro — Histórico'}
              {tab === 'processos' && 'Processos'}
              {tab === 'tasks' && 'Tarefas & Agenda'}
              {tab === 'clients' && 'Clientes'}
              {tab === 'settings' && 'Definições'}
            </h1>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/60 bg-card/60 hover:bg-card hover:border-border text-left transition-all text-xs text-muted-foreground min-w-[240px] shadow-soft"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1">Buscar processos, clientes, tarefas...</span>
            <kbd className="text-[9px] font-bold bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded border border-border/60">⌘K</kbd>
          </button>
          {(tab === 'dashboard' || tab === 'financeiro') && (
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 rounded-xl shadow-soft" onClick={handleExportPdf}>
              <FileDown className="w-3.5 h-3.5" /> PDF do mês
            </Button>
          )}
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

        {/* Filters - only Dashboard / Financeiro */}
        {showFilters && (
          <div className="max-w-[1400px] mx-auto w-full px-4 lg:px-8 pt-5 pb-2 flex items-center gap-2">
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="h-9 text-xs w-40 rounded-xl bg-card/60 border-border/60 shadow-soft">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
                <SelectItem value="12">Visão Geral (Tudo)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="h-9 text-xs w-24 rounded-xl bg-card/60 border-border/60 shadow-soft">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y: number) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 lg:hidden" onClick={handleExportPdf}>
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
            </Button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 lg:px-8 pb-24 lg:pb-12 overflow-y-auto mt-2 lg:mt-4">
          {tab === 'dashboard' && (
            <div className="space-y-6">
              <Dashboard
                transactions={allTransactions}
                month={month}
                year={year}
                onProjectClick={() => { setTab('processos'); setActiveProcessTab('ativos'); }}
              />
              <TasksWidget
                onOpenTasks={() => setTab('tasks')}
                onNewTask={() => { setPendingNewTask({}); setTab('tasks'); }}
                refreshKey={txKey}
              />
            </div>
          )}
          {tab === 'financeiro' && (
            <TransactionHistory
              transactions={monthTransactions}
              onEdit={handleEdit}
              onComplete={(tx) => setCompleteItem(tx)}
              onDelete={refresh}
              onAddRepasse={(tx) => { setParentItem(tx); setEditItem(null); setFormOpen(true); }}
            />
          )}
          {tab === 'processos' && (
            <ProcessManager
              allTransactions={allTransactions}
              onRefresh={refresh}
              activeTab={activeProcessTab}
              onTabChange={setActiveProcessTab}
            />
          )}
          {tab === 'tasks' && (
            <TasksPage
              initialTask={pendingNewTask}
              onConsumed={() => setPendingNewTask(null)}
            />
          )}
          {tab === 'clients' && <ClientsList />}
          {tab === 'settings' && <Settings onDataChange={refresh} />}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border/40 z-30 pb-safe transition-colors duration-300">
          <div className="flex px-2 py-1">
            {mobileTabs.map(t => (
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
      </div>

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

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onNavigate={setTab}
        onNewTask={() => { setPendingNewTask({}); setTab('tasks'); }}
      />
    </div>
  );
}
