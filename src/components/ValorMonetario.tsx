import { useValoresOcultos } from '@/lib/privacidade';

/** Envolve qualquer valor em R$ já formatado — quando o modo privacidade está ligado, mostra
 *  bolinhas no lugar do número, mantendo o layout (mesma largura aproximada). */
export function ValorMonetario({ value, className }: { value: string; className?: string }) {
  const ocultos = useValoresOcultos();
  return <span className={className}>{ocultos ? '••••••' : value}</span>;
}
