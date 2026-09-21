import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Command, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { NAV_GROUPS, NAV_BOTTOM, type NavItem } from '@/lib/navigation';

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
}

interface Props {
  onOpenCommand: () => void;
  badges?: Partial<Record<string, number>>;
}

export function AppSidebar({ onOpenCommand, badges = {} }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const nome = profile?.nome || session?.user.email || 'Usuário';
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('hbs_sidebar_collapsed') === '1');

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  function toggle() {
    setCollapsed(c => {
      localStorage.setItem('hbs_sidebar_collapsed', !c ? '1' : '0');
      return !c;
    });
  }

  function isActive(item: NavItem) {
    return item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
  }

  const NavItemLink = ({ item }: { item: NavItem }) => {
    const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
    const link = (
      <NavLink
        to={item.to}
        title={collapsed ? undefined : item.label}
        className={cn(
          'flex items-center gap-[11px] w-full h-9 px-2.5 rounded-[8px] text-white/60 transition-colors duration-[140ms] hover:bg-white/[.08] hover:text-white',
          isActive(item) && '!bg-white/10 !text-white'
        )}
      >
        <item.icon className="w-[17px] h-[17px] shrink-0 opacity-90" strokeWidth={1.6} />
        {!collapsed && <span className="text-[13.5px] font-medium flex-1 text-left truncate">{item.label}</span>}
        {!collapsed && typeof badge === 'number' && badge > 0 && (
          <span className="ml-auto text-[10.5px] font-mono-hbs bg-primary-hover text-white px-[5px] py-[1px] rounded">{badge}</span>
        )}
      </NavLink>
    );
    if (!collapsed) return link;
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'hidden lg:flex flex-col shrink-0 bg-sidebar text-white sticky top-0 h-screen transition-[width] duration-[180ms] ease-out',
          collapsed ? 'w-[66px]' : 'w-[236px]'
        )}
      >
        <div className="h-[62px] flex-none flex items-center gap-2.5 px-[18px] border-b border-white/[.09]">
          <div className="w-[27px] h-[27px] flex-none rounded-[7px] bg-white grid place-items-center text-[10px] font-bold text-primary -tracking-[.02em]">HBS</div>
          {!collapsed && (
            <div className="leading-[1.15] min-w-0">
              <div className="text-[12.5px] font-semibold tracking-[.04em]">HBS ENGINEERING</div>
              <div className="text-[9.5px] tracking-[.16em] text-white/40 font-mono-hbs">PORTAL DE GESTÃO</div>
            </div>
          )}
        </div>

        <div className="p-2.5">
          <button
            onClick={onOpenCommand}
            className={cn(
              'w-full flex items-center gap-2 h-9 px-2.5 rounded-lg border border-white/[.09] bg-white/[.04] text-white/50 transition-colors hover:bg-white/[.08] hover:text-white',
              collapsed && 'justify-center px-0'
            )}
            title="Buscar (⌘K)"
          >
            <Command className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span className="text-xs flex-1 text-left">Buscar…</span>}
          </button>
        </div>

        <nav className="flex-1 px-2.5 py-1 flex flex-col gap-3 overflow-y-auto">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label || gi}>
              {group.label && !collapsed && (
                <div className="text-[10px] font-semibold tracking-[.1em] text-white/35 px-2.5 pb-1">{group.label}</div>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map(item => <NavItemLink key={item.to} item={item} />)}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex-none p-2.5 border-t border-white/[.09] flex flex-col gap-0.5">
          <div className="flex flex-col gap-0.5 mb-0.5">
            {NAV_BOTTOM.map(item => <NavItemLink key={item.to} item={item} />)}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn('flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-colors hover:bg-white/[.08] text-left', collapsed && 'justify-center px-0')}>
                <div className="w-[27px] h-[27px] flex-none rounded-full bg-avatar grid place-items-center text-[10.5px] font-semibold font-mono-hbs">{initials(nome)}</div>
                {!collapsed && (
                  <div className="leading-[1.25] min-w-0">
                    <div className="text-[12.5px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{nome}</div>
                    <div className="text-[10.5px] text-white/40">HBS Engenharia</div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-[180px]">
              <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive focus:text-destructive">
                <LogOut className="w-3.5 h-3.5" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={toggle}
            className="flex items-center gap-1.5 text-white/32 hover:text-white transition-colors text-[11px] font-mono-hbs px-2.5 py-1.5 text-left"
          >
            {collapsed ? <ChevronRight className="w-3 h-3" /> : <><ChevronLeft className="w-3 h-3" /> recolher menu</>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
