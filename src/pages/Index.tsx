import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dashboard } from '@/components/Dashboard';
import { TransactionHistory } from '@/components/TransactionHistory';
import { TransactionForm } from '@/components/TransactionForm';
import { PartialPaymentModal } from '@/components/PartialPaymentModal';
import { Settings } from '@/components/Settings';
import { getTransactions } from '@/lib/storage';
import { generateMonthlyReport } from '@/lib/pdf';
import { Transaction } from '@/lib/types';
import { LayoutDashboard, List, Settings as SettingsIcon, Plus, FileDown, Building } from 'lucide-react';
import hbsLogo from '@/assets/hbs-logo.png';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type Tab = 'dashboard' | 'history' | 'settings';

export default function Index() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<Tab>('dashboard');
  const [txKey, setTxKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Transaction | null>(null);
  const [completeItem, setCompleteItem] = useState<Transaction | null>(null);

  const refresh = useCallback(() => setTxKey(k => k + 1), []);

  const allTransactions = useMemo(() => getTransactions(), [txKey]);
  const monthTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      const d = new Date(t.data + 'T12:00:00');
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [allTransactions, month, year]);

  const years = useMemo(() => {
    const set = new Set(allTransactions.map(t => new Date(t.data + 'T12:00:00').getFullYear()));
    set.add(now.getFullYear());
    return Array.from(set).sort();
  }, [allTransactions]);

  function handleEdit(tx: Transaction) {
    setEditItem(tx);
    setFormOpen(true);
  }

  function handleExportPdf() {
    generateMonthlyReport(monthTransactions, month, year);
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'history', label: 'Histórico', icon: List },
    { key: 'settings', label: 'Definições', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={hbsLogo} alt="HBS Engenharia" className="h-8 w-auto" />
          <div className="flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground/70 font-medium tracking-wide">Gestão Financeira</span>
          </div>
        </div>
      </header>

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
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleExportPdf}>
          <FileDown className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Relatório PDF</span>
        </Button>
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => { setEditItem(null); setFormOpen(true); }}>
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Novo</span>
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
          />
        )}
        {tab === 'settings' && <Settings onDataChange={refresh} />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border/50 z-30">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                tab === t.key ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <t.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Modals */}
      <TransactionForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditItem(null); }}
        onSave={refresh}
        editItem={editItem}
      />
      <PartialPaymentModal
        open={!!completeItem}
        onClose={() => setCompleteItem(null)}
        onSave={refresh}
        transaction={completeItem}
      />
    </div>
  );
}
