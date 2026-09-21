import { Outlet } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useShell } from '@/hooks/use-shell';
import { NAV_GROUPS } from '@/lib/navigation';

const items = NAV_GROUPS.find(g => g.label === 'FINANCEIRO')!.items;

/** No desktop a sidebar já lista as 6 sub-páginas do Financeiro (NAV_GROUPS) — repetir isso aqui
 *  como abas horizontais seria navegação duplicada. No mobile a sidebar não existe (só a barra
 *  inferior, com um único item "Caixa"), então essa faixa de abas continua sendo o único jeito de
 *  trocar entre Visão geral/Movimentações/A Receber/A Pagar/Contas/Parceiros lá — por isso fica
 *  visível só até o breakpoint `lg`. */
export default function FinanceiroLayout() {
  const shell = useShell();

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="lg:hidden flex flex-wrap gap-1 border-b border-border overflow-x-auto">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className="border-0 bg-transparent px-3 py-[9px] text-[13px] font-medium text-muted-foreground -mb-px border-b-2 border-transparent whitespace-nowrap transition-colors hover:text-foreground"
            activeClassName="!text-foreground !border-foreground"
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      <Outlet context={shell} />
    </div>
  );
}
