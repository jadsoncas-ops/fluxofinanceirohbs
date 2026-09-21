import {
  Compass, Users, Layers, FileStack, Handshake, ScrollText, CalendarDays, ListTodo,
  LayoutDashboard, ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, Wallet, UserCog,
  BarChart3, Scale, Settings as SettingsIcon, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Só o item de "Início" usa match exato — todos os outros usam prefixo (pathname.startsWith). */
  exact?: boolean;
  /** Chave em ShellContext/sidebarBadges cujo número (se > 0) aparece como badge neste item. */
  badgeKey?: string;
}

export interface NavGroup {
  /** null = grupo sem cabeçalho (usado só para "Início"). */
  label: string | null;
  items: NavItem[];
}

/** Fonte única da navegação — sidebar desktop, breadcrumb do header e (parcialmente) a navegação
 *  mobile leem daqui. Antes eram 3 listas hardcoded independentes (AppSidebar, MobileBottomNav,
 *  useRouteMeta); qualquer rota nova precisava ser lembrada em 3 lugares. Consolidado na Fase 2
 *  do redesign HBS 2.0. */
export const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [
    { to: '/', label: 'Início', icon: Compass, exact: true },
  ] },
  { label: 'RELACIONAMENTO', items: [
    { to: '/clientes', label: 'Clientes', icon: Users },
  ] },
  { label: 'COMERCIAL', items: [
    { to: '/comercial', label: 'Comercial', icon: Handshake },
  ] },
  { label: 'PRODUÇÃO', items: [
    { to: '/trabalhos', label: 'Trabalhos', icon: Layers, badgeKey: 'trabalhosAtencao' },
    { to: '/producao', label: 'Produção Técnica', icon: FileStack, badgeKey: 'producaoEmAndamento' },
  ] },
  { label: 'FINANCEIRO', items: [
    { to: '/caixa/visao-geral', label: 'Visão geral', icon: LayoutDashboard, badgeKey: 'caixaAtrasado' },
    { to: '/caixa/receitas', label: 'Movimentações', icon: ArrowLeftRight },
    { to: '/caixa/cobranca', label: 'A receber', icon: ArrowDownCircle },
    { to: '/caixa/apagar', label: 'A pagar', icon: ArrowUpCircle },
    { to: '/caixa/contas', label: 'Contas', icon: Wallet },
    { to: '/caixa/parceiros', label: 'Parceiros', icon: UserCog },
  ] },
  { label: 'CARTÓRIO', items: [
    { to: '/cartorio', label: 'Cartório & Registros', icon: ScrollText, badgeKey: 'cartorioAtencao' },
  ] },
  // "Tarefas" não apareceu na lista de sidebar aprovada — mantido aqui, agrupado com Agenda, porque
  // é uma rota real e funcional hoje (/tarefas, lista de tarefas) e removê-la da navegação a
  // deixaria inacessível, o que contraria a regra de preservar funcionalidades existentes.
  { label: 'AGENDA', items: [
    { to: '/agenda', label: 'Agenda', icon: CalendarDays },
    { to: '/tarefas', label: 'Tarefas', icon: ListTodo },
  ] },
];

/** Itens de rodapé da sidebar — fora dos grupos principais. "Meu perfil" não virou item próprio
 *  porque não existe uma rota de perfil hoje (só o dropdown do avatar, que já mostra nome + Sair);
 *  criar essa página seria escopo novo, não consolidação de navegação. */
export const NAV_BOTTOM: NavItem[] = [
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/avaliacoes', label: 'Avaliações', icon: Scale },
  { to: '/configuracoes', label: 'Configurações', icon: SettingsIcon },
];

/** Todos os itens navegáveis, grupo+rodapé, numa lista só — usada pelo breadcrumb do header pra
 *  achar o título da rota atual sem manter uma segunda lista de labels. */
export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap(g => g.items),
  ...NAV_BOTTOM,
];

/** Acha o item de navegação cujo `to` é o prefixo mais específico (mais longo) que bate com
 *  `pathname` — usado pelo breadcrumb pra derivar o título a partir da mesma fonte da sidebar. */
export function findNavItem(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const item of ALL_NAV_ITEMS) {
    const matches = item.exact ? pathname === item.to : pathname.startsWith(item.to);
    if (matches && (!best || item.to.length > best.to.length)) best = item;
  }
  return best;
}
