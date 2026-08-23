import { useState, useCallback, useMemo, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TransactionForm } from '@/components/TransactionForm';
import { PartialPaymentModal } from '@/components/PartialPaymentModal';
import { NovoRecebimentoDialog } from '@/components/NovoRecebimentoDialog';
import { ClientMigrationModal } from '@/components/ClientMigrationModal';
import { ClientForm } from '@/components/ClientForm';
import { NovoCompromissoDialog } from '@/components/dashboard/NovoCompromissoDialog';
import { AppSidebar } from '@/components/AppSidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { NotificationsDropdown } from '@/components/NotificationsDropdown';
import { getTransactions, getTasks, getClients, getProcesses, getPropostas, onStorageChange } from '@/lib/storage';
import { computeAttentionItems } from '@/lib/attention';
import { Transaction, Task, TransactionType } from '@/lib/types';
import { Search, X, LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth';
import hbsLogo from '@/assets/hbs-logo.png';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export interface ShellContext {
  month: number;
  year: number;
  setMonth: (m: number) => void;
  setYear: (y: number) => void;
  allTransactions: Transaction[];
  monthTransactions: Transaction[];
  refreshKey: number;
  refresh: () => void;
  openNewTransaction: (opts?: { tipo?: TransactionType }) => void;
  openEditTransaction: (tx: Transaction) => void;
  openCompleteTransaction: (tx: Transaction) => void;
  openNovoRecebimento: () => void;
  pendingNewTask: Partial<Task> | null;
  consumePendingNewTask: () => void;
  requestNewTask: () => void;
}

function useRouteMeta(pathname: string, clientCount: number, trabalhosAtivos: number) {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  if (pathname === '/') return { title: 'Início', meta: hoje };
  if (pathname.match(/^\/clientes\/[^/]+/)) return { title: 'Clientes', meta: null };
  if (pathname.startsWith('/clientes')) return { title: 'Clientes', meta: `${clientCount} ativo${clientCount !== 1 ? 's' : ''}` };
  if (pathname.match(/^\/trabalhos\/[^/]+/)) return { title: 'Trabalhos', meta: null };
  if (pathname.startsWith('/trabalhos')) return { title: 'Trabalhos', meta: `${trabalhosAtivos} ativo${trabalhosAtivos !== 1 ? 's' : ''}` };
  if (pathname.startsWith('/producao')) return { title: 'Produção Técnica', meta: null };
  if (pathname.startsWith('/comercial')) return { title: 'Comercial', meta: null };
  if (pathname.startsWith('/caixa/visao-geral')) return { title: 'Fluxo de Caixa', meta: 'Visão geral' };
  if (pathname.startsWith('/caixa/receitas')) return { title: 'Fluxo de Caixa', meta: 'Receitas & despesas' };
  if (pathname.startsWith('/caixa/contas')) return { title: 'Fluxo de Caixa', meta: 'Contas' };
  if (pathname.startsWith('/relatorios')) return { title: 'Relatórios', meta: null };
  if (pathname.match(/^\/avaliacoes\/[^/]+/)) return { title: 'Avaliações', meta: null };
  if (pathname.startsWith('/avaliacoes')) return { title: 'Avaliações', meta: 'Aluguel — Prefeitura/CIUB' };
  if (pathname.startsWith('/tarefas')) return { title: 'Tarefas & agenda', meta: null };
  if (pathname.startsWith('/configuracoes')) return { title: 'Configurações', meta: 'HBS Engenharia' };
  return { title: 'HBS Engineering', meta: null };
}

export function AppShell() {
  const now = new Date();
  const location = useLocation();
  const navigate = useNavigate();
  const today = now.toISOString().slice(0, 10);

  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [txKey, setTxKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Transaction | null>(null);
  const [completeItem, setCompleteItem] = useState<Transaction | null>(null);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [recebimentoOpen, setRecebimentoOpen] = useState(false);
  const [compromissoOpen, setCompromissoOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingNewTask, setPendingNewTask] = useState<Partial<Task> | null>(null);

  const refresh = useCallback(() => setTxKey(k => k + 1), []);

  useEffect(() => onStorageChange(refresh), [refresh]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setNotifOpen(false);
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

  const { clientCount, trabalhosAtivos, attentionItems } = useMemo(() => {
    void txKey;
    const clients = getClients();
    const processes = getProcesses();
    const tasks = getTasks();
    const propostas = getPropostas();
    return {
      clientCount: clients.length,
      trabalhosAtivos: processes.filter(p => !p.isArchived).length,
      attentionItems: computeAttentionItems(allTransactions, clients, tasks, processes, propostas),
    };
  }, [txKey, allTransactions]);

  const sidebarBadges = useMemo(() => {
    const financeiroAtrasado = attentionItems.filter(i => i.id.startsWith('receber-') || i.id === 'pagar-atrasado').length;
    return { financeiroAtrasado: financeiroAtrasado > 0 ? financeiroAtrasado : undefined };
  }, [attentionItems]);

  function openNewTransaction(opts?: { tipo?: TransactionType }) {
    setEditItem(opts?.tipo ? ({ tipo: opts.tipo } as any) : null);
    setFormOpen(true);
  }

  function openEditTransaction(tx: Transaction) {
    setEditItem(tx);
    setFormOpen(true);
  }

  const showMonthFilter = location.pathname.startsWith('/caixa');
  const { title, meta } = useRouteMeta(location.pathname, clientCount, trabalhosAtivos);

  const ctx: ShellContext = {
    month, year, setMonth, setYear,
    allTransactions, monthTransactions,
    refreshKey: txKey, refresh,
    openNewTransaction, openEditTransaction,
    openCompleteTransaction: setCompleteItem,
    openNovoRecebimento: () => setRecebimentoOpen(true),
    pendingNewTask,
    consumePendingNewTask: () => setPendingNewTask(null),
    requestNewTask: () => setPendingNewTask({}),
  };

  return (
    <div className="app-shell-root h-screen bg-background flex overflow-hidden">
      <AppSidebar onOpenCommand={() => setCommandOpen(true)} badges={sidebarBadges} />

      <div className="app-shell-column flex-1 flex flex-col overflow-hidden min-w-0">
        {showInstallBanner && (
          <div className="bg-primary p-2 text-primary-foreground flex justify-between items-center px-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest">Instale o app HBS no seu celular</span>
            <div className="flex gap-2">
              <button onClick={handleInstallClick} className="h-7 px-2.5 rounded-md bg-white/15 text-[11px] font-medium">Instalar</button>
              <button onClick={() => setShowInstallBanner(false)} className="h-7 w-7 grid place-items-center"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        <header className="lg:hidden border-b border-border bg-background/90 backdrop-blur-md sticky top-0 z-30">
          <div className="px-4 py-3 flex items-center gap-3">
            <img src={hbsLogo} alt="HBS Engenharia" className="h-7 w-auto dark:invert dark:brightness-200" />
            <span className="text-[13px] font-semibold flex-1 truncate">{title}</span>
            <button onClick={() => setCommandOpen(true)} className="w-8 h-8 grid place-items-center rounded-lg border-2 text-mute-2"><Search className="w-3.5 h-3.5" /></button>
            <button onClick={() => signOut().then(() => navigate('/login', { replace: true }))} className="w-8 h-8 grid place-items-center rounded-lg border-2 text-mute-2"><LogOut className="w-3.5 h-3.5" /></button>
          </div>
        </header>

        <header className="hidden lg:flex items-center gap-3.5 px-5 h-[60px] sticky top-0 z-40 bg-background/[.88] backdrop-blur-md border-b border-border">
          <div className="min-w-0 flex items-baseline gap-2.5">
            <span className="text-[15px] font-semibold -tracking-[.015em] whitespace-nowrap">{title}</span>
            {meta && <span className="text-[11.5px] text-mute-2 font-mono-hbs whitespace-nowrap overflow-hidden text-ellipsis">{meta}</span>}
          </div>

          <button
            onClick={() => setCommandOpen(true)}
            className="ml-auto flex items-center gap-2.5 min-w-0 w-[340px] h-[34px] px-[11px] bg-card border-2 rounded-lg text-mute-2 text-left transition-colors hover:border-hover"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="text-[12.5px] flex-1 whitespace-nowrap overflow-hidden">Buscar ou executar…</span>
            <span className="text-[10px] font-mono-hbs border-2 rounded px-[5px] py-px bg-background">⌘K</span>
          </button>

          <NotificationsDropdown open={notifOpen} onOpenChange={o => { setNotifOpen(o); if (o) setCommandOpen(false); }} items={attentionItems} />

          <NovoDropdown
            onNewClient={() => setClientFormOpen(true)}
            onNewTrabalho={() => navigate('/trabalhos')}
            onNewProposta={() => navigate('/comercial')}
            onNewDocumento={() => navigate('/producao')}
            onNewReceita={() => setRecebimentoOpen(true)}
            onNewDespesa={() => openNewTransaction({ tipo: 'Saída' })}
            onNewCompromisso={() => setCompromissoOpen(true)}
          />
        </header>

        {unlinkedCount > 0 && (
          <div className="bg-accent-soft border-b border-border px-5 py-2.5 flex justify-between items-center gap-3">
            <p className="text-xs text-foreground">
              <strong className="font-semibold">{unlinkedCount} lançamento{unlinkedCount > 1 ? 's' : ''}</strong> sem cliente vinculado.
            </p>
            <button onClick={() => setMigrationOpen(true)} className="text-xs font-medium text-accent hover:text-accent-hover whitespace-nowrap">Organizar agora →</button>
          </div>
        )}

        {showMonthFilter && (
          <div className="max-w-[1360px] mx-auto w-full px-4 lg:px-[26px] pt-4 pb-1 flex items-center gap-2">
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="h-8 text-xs w-36 border-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                <SelectItem value="12">Visão geral (tudo)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="h-8 text-xs w-20 border-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y: number) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <main className="app-shell-main flex-1 max-w-[1360px] mx-auto w-full px-4 lg:px-[26px] pb-24 lg:pb-10 overflow-y-auto mt-3 lg:mt-4">
          <Outlet context={ctx} />
        </main>

        <MobileBottomNav />
      </div>

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
      <ClientForm open={clientFormOpen} onClose={() => setClientFormOpen(false)} onSave={() => { setClientFormOpen(false); refresh(); }} />
      <NovoRecebimentoDialog open={recebimentoOpen} onClose={() => setRecebimentoOpen(false)} onCreated={refresh} />

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
        onNavigate={(path) => navigate(path)}
        onNewTask={() => { setPendingNewTask({}); navigate('/tarefas'); }}
        onNewTransaction={(tipo) => { if (tipo === 'Entrada') setRecebimentoOpen(true); else openNewTransaction({ tipo }); }}
        onNewClient={() => setClientFormOpen(true)}
      />

      <NovoCompromissoDialog open={compromissoOpen} onClose={() => setCompromissoOpen(false)} />
    </div>
  );
}

import { Compass, Landmark, Layers, Users, FileStack, UserPlus, Handshake, ArrowUpCircle, ArrowDownCircle, ChevronDown, CalendarPlus } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface NovoDropdownProps {
  onNewClient: () => void;
  onNewTrabalho: () => void;
  onNewProposta: () => void;
  onNewDocumento: () => void;
  onNewReceita: () => void;
  onNewDespesa: () => void;
  onNewCompromisso: () => void;
}

function NovoDropdown({ onNewClient, onNewTrabalho, onNewProposta, onNewDocumento, onNewReceita, onNewDespesa, onNewCompromisso }: NovoDropdownProps) {
  const items = [
    { label: 'Novo cliente', icon: UserPlus, onClick: onNewClient },
    { label: 'Novo trabalho', icon: Layers, onClick: onNewTrabalho },
    { label: 'Nova proposta', icon: Handshake, onClick: onNewProposta },
    { label: 'Novo documento', icon: FileStack, onClick: onNewDocumento },
    { label: 'Nova receita', icon: ArrowUpCircle, onClick: onNewReceita },
    { label: 'Nova despesa', icon: ArrowDownCircle, onClick: onNewDespesa },
    { label: 'Novo compromisso', icon: CalendarPlus, onClick: onNewCompromisso },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex-none h-[34px] px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium whitespace-nowrap transition-colors hover:bg-primary-hover flex items-center gap-1.5">
          + Novo <ChevronDown className="w-3 h-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[254px]">
        {items.map(item => (
          <DropdownMenuItem key={item.label} onClick={item.onClick} className="gap-2.5 py-2">
            <span className="w-[22px] h-[22px] rounded-[5px] bg-neutral-soft grid place-items-center flex-none">
              <item.icon className="w-3.5 h-3.5 text-mute-2" strokeWidth={1.75} />
            </span>
            <span className="text-[13px]">{item.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileBottomNav() {
  const items = [
    { to: '/', label: 'Início', icon: Compass, exact: true },
    { to: '/clientes', label: 'Clientes', icon: Users },
    { to: '/trabalhos', label: 'Trabalhos', icon: Layers },
    { to: '/producao', label: 'Produção', icon: FileStack },
    { to: '/comercial', label: 'Comercial', icon: Handshake },
    { to: '/caixa', label: 'Caixa', icon: Landmark },
  ];
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-sidebar flex px-1 pt-1.5" style={{ paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}>
      {items.map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.exact}
          className="flex-1 flex flex-col items-center gap-[3px] py-[7px] px-0.5 text-white/50"
          activeClassName="!text-white"
        >
          <t.icon className="w-[15px] h-[15px]" strokeWidth={1.75} />
          <span className="text-[10px] font-medium">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
