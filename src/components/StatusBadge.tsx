import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'success' | 'warning' | 'destructive' | 'accent' | 'neutral';

const TONE_STYLE: Record<BadgeTone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  destructive: 'bg-destructive-soft text-destructive',
  accent: 'bg-accent-soft text-accent',
  neutral: 'bg-neutral-soft text-mute-2',
};

interface Props {
  tone: BadgeTone;
  children: ReactNode;
  size?: 'sm' | 'md';
  uppercase?: boolean;
  icon?: LucideIcon;
  className?: string;
}

/** Badge de status pequeno — mesma pílula (cor de fundo suave + texto na cor cheia) que já
 *  aparecia reimplementada à mão em Movimentações, A Receber, A Pagar, Dashboard (status de
 *  trabalho) e Trabalhos. Consolidado na Fase 2 do redesign HBS 2.0; ainda não adotado nessas
 *  telas — isso é trabalho das fases seguintes, pra não misturar "extrair componente" com
 *  "redesenhar tela". */
export function StatusBadge({ tone, children, size = 'sm', uppercase, icon: Icon, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[5px] font-medium flex-none whitespace-nowrap',
        size === 'sm' ? 'text-[9.5px] px-1.5 py-[1px]' : 'text-[10.5px] px-2 py-[3px]',
        uppercase && 'uppercase tracking-wide',
        TONE_STYLE[tone],
        className
      )}
    >
      {Icon && <Icon className="w-2.5 h-2.5" />}
      {children}
    </span>
  );
}
