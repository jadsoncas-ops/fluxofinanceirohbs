import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check } from 'lucide-react';
import { AttentionItem } from '@/lib/attention';
import { contarNaoVistos, marcarTodosVistos } from '@/lib/notificacoesVistas';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AttentionItem[];
}

const dotColor: Record<AttentionItem['severity'], string> = {
  critical: 'bg-destructive',
  warning: 'bg-warning',
  info: 'bg-info',
};

export function NotificationsDropdown({ open, onOpenChange, items }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [naoVistosKey, setNaoVistosKey] = useState(0);
  const naoVistos = (() => { void naoVistosKey; return contarNaoVistos(items); })();

  function limparNotificacoes() {
    marcarTodosVistos(items);
    setNaoVistosKey(k => k + 1);
  }

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative flex-none" ref={ref}>
      <button
        onClick={() => onOpenChange(!open)}
        className={cn(
          'w-[34px] h-[34px] grid place-items-center bg-card border rounded-lg relative transition-colors',
          open ? 'border-border-hover' : 'border-2 hover:border-hover'
        )}
      >
        <Bell className="w-[15px] h-[15px] text-mute-2" strokeWidth={1.75} />
        {naoVistos > 0 && (
          <span className="absolute -top-[3px] -right-[3px] min-w-[16px] h-4 rounded-full bg-destructive text-white text-[9.5px] font-mono-hbs grid place-items-center border-2 border-background px-[3px]">
            {naoVistos}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[42px] w-[348px] max-w-[calc(100vw-32px)] bg-card border border-border rounded-xl shadow-popover overflow-hidden animate-hbs-pop z-50">
          <div className="px-3.5 py-3 border-b border-3 flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-semibold">Notificações</span>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-mute-2 font-mono-hbs">{items.length === 0 ? 'tudo em dia' : `${items.length} pendente${items.length > 1 ? 's' : ''}`}</span>
              {items.length > 0 && naoVistos > 0 && (
                <button onClick={limparNotificacoes} className="text-[11px] font-medium text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
                  <Check className="w-3 h-3" /> Limpar
                </button>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="px-3.5 py-8 text-center text-xs text-muted-foreground">Nenhuma pendência agora. Bom trabalho.</div>
          ) : (
            items.slice(0, 8).map(item => (
              <div
                key={item.id}
                onClick={() => { onOpenChange(false); navigate(item.to); }}
                className="flex gap-[11px] px-3.5 py-3 border-b border-3 last:border-b-0 cursor-pointer hover:bg-surface-3 transition-colors"
              >
                <span className={cn('w-[7px] h-[7px] flex-none mt-[5px] rounded-full', dotColor[item.severity])} />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium leading-[1.35]">{item.title}</div>
                  <div className="text-[11.5px] text-muted-foreground leading-[1.4] mt-0.5">{item.sub}</div>
                  <div className="text-[10.5px] text-mute-3 font-mono-hbs mt-1">{item.cta}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
