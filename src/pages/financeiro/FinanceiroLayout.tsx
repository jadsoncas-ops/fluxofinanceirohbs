import { Outlet } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useShell } from '@/hooks/use-shell';

const items = [
  { to: '/caixa/visao-geral', label: 'Visão geral' },
  { to: '/caixa/cobranca', label: 'Cobrança' },
  { to: '/caixa/receitas', label: 'Receitas & despesas' },
  { to: '/caixa/contas', label: 'Contas' },
  { to: '/caixa/parceiros', label: 'Parceiros' },
];

export default function FinanceiroLayout() {
  const shell = useShell();

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap gap-1 border-b border-border overflow-x-auto">
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
