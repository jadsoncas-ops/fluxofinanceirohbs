import { LayoutDashboard, Briefcase, Users, ListTodo, Settings as SettingsIcon, Receipt, Building, Command } from 'lucide-react';
import hbsLogo from '@/assets/hbs-logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

export type DesktopTab = 'dashboard' | 'financeiro' | 'processos' | 'clients' | 'tasks' | 'settings';

interface Props {
  active: DesktopTab;
  onChange: (tab: DesktopTab) => void;
  onOpenCommand: () => void;
  badges?: Partial<Record<DesktopTab, number>>;
}

const items: { key: DesktopTab; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'financeiro', label: 'Financeiro', icon: Receipt },
  { key: 'processos', label: 'Processos', icon: Briefcase },
  { key: 'tasks', label: 'Tarefas', icon: ListTodo },
  { key: 'clients', label: 'Clientes', icon: Users },
  { key: 'settings', label: 'Definições', icon: SettingsIcon },
];

export function AppSidebar({ active, onChange, onOpenCommand, badges = {} }: Props) {
  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border/40 glass h-screen sticky top-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border/40 flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-primary blur-md opacity-40 rounded-lg" />
          <img src={hbsLogo} alt="HBS Engenharia" className="relative h-9 w-auto dark:invert dark:brightness-200 transition-all" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-black tracking-[0.18em] uppercase text-foreground">HBS ERP</span>
          <span className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1"><Building className="w-2.5 h-2.5" />Gestão Integrada</span>
        </div>
      </div>

      {/* Command palette trigger */}
      <div className="p-3">
        <button
          onClick={onOpenCommand}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-border/60 bg-card/60 hover:bg-card hover:border-border text-left transition-all group shadow-soft"
        >
          <Command className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground flex-1">Buscar...</span>
          <kbd className="text-[9px] font-bold bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded border border-border/60">⌘K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-2 mb-2 mt-2">Operação</p>
        {items.map(item => {
          const isActive = active === item.key;
          const badge = badges[item.key];
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-primary/15 to-primary/5 text-primary font-bold shadow-soft'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground font-medium'
              }`}
            >
              {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-primary" />}
              <item.icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {typeof badge === 'number' && badge > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/80 group-hover:bg-background'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/40 p-3 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-semibold tracking-wider">v1.1.0 ERP</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border/40 flex items-center gap-2.5">
        <img src={hbsLogo} alt="HBS Engenharia" className="h-8 w-auto dark:invert dark:brightness-200 transition-all" />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-black tracking-widest uppercase text-foreground">HBS ERP</span>
          <span className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1"><Building className="w-2.5 h-2.5" />Gestão Integrada</span>
        </div>
      </div>

      {/* Command palette trigger */}
      <div className="p-3">
        <button
          onClick={onOpenCommand}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-background hover:bg-muted/50 text-left transition-colors group"
        >
          <Command className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground flex-1">Buscar...</span>
          <kbd className="text-[9px] font-bold bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded border border-border/60">⌘K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-2 mb-1.5 mt-2">Operação</p>
        {items.map(item => {
          const isActive = active === item.key;
          const badge = badges[item.key];
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 group ${
                isActive
                  ? 'bg-primary/10 text-primary font-bold shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {typeof badge === 'number' && badge > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/80 group-hover:bg-background'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/40 p-3 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-semibold">v1.1.0 ERP</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
