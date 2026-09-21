import { type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ValorMonetario } from '@/components/ValorMonetario';
import { cn } from '@/lib/utils';

export type KpiTone = 'default' | 'success' | 'destructive' | 'warning' | 'accent';

const TONE_TEXT: Record<KpiTone, string> = {
  default: 'text-foreground',
  success: 'text-success',
  destructive: 'text-destructive',
  warning: 'text-warning',
  accent: 'text-accent',
};

const SIZE_STYLE = {
  hero: { pad: 'px-[20px] py-[18px]', label: 'text-[11px]', value: 'text-[30px] mt-1.5' },
  default: { pad: 'px-[16px] py-[18px]', label: 'text-[10.5px]', value: 'text-[17px] mt-1.5' },
  // Responsivo: telas que empilham em 1 coluna (grid-cols-1 sm:...) nunca precisariam disso, mas
  // quem usa grid fixo (ex.: grid-cols-3 sem breakpoint) depende do valor encolher em mobile pra
  // não truncar — mesmo ajuste que "default"/"hero" não precisam porque têm mais espaço.
  compact: { pad: 'px-[8px] sm:px-[14px] py-[11px]', label: 'text-[10px]', value: 'text-[12.5px] sm:text-[14px] mt-1' },
} as const;

interface Props {
  label: string;
  /** Já formatado (ex. "R$ 1.234,56") — o card cuida de aplicar o modo privacidade. */
  value: string;
  size?: keyof typeof SIZE_STYLE;
  tone?: KpiTone;
  subtext?: ReactNode;
  info?: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

/** Card de KPI (rótulo + valor monetário grande) — mesmo padrão visual reimplementado à mão em
 *  Visão Geral, Dashboard, A Receber e A Pagar (cada um com seu próprio JSX de label/valor/
 *  padding). Consolidado na Fase 2 do redesign HBS 2.0; adoção nessas telas fica pras fases
 *  seguintes (Dashboard / Financeiro), pra não redesenhar página nenhuma nesta fase. */
export function KpiCard({ label, value, size = 'default', tone = 'default', subtext, info, onClick, active, className }: Props) {
  const s = SIZE_STYLE[size];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'bg-card min-w-0 text-left',
        onClick && 'hover:bg-surface-2 transition-colors',
        active && 'bg-surface-2',
        s.pad,
        className
      )}
    >
      <div className="flex items-center gap-1 min-w-0">
        <div className={cn('uppercase tracking-[.07em] text-mute-2 truncate', s.label)}>{label}</div>
        {info && (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild><Info className="w-3 h-3 text-mute-3 flex-none cursor-help" /></TooltipTrigger>
            <TooltipContent className="max-w-[260px] text-[11.5px]">{info}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className={cn('font-mono-hbs truncate', s.value, TONE_TEXT[tone])}>
        <ValorMonetario value={value} />
      </div>
      {subtext && <div className="text-[11px] text-muted-foreground mt-0.5">{subtext}</div>}
    </Comp>
  );
}
