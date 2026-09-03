import { cn } from '@/lib/utils';

export interface StepperStage {
  label: string;
  state: 'done' | 'current' | 'upcoming' | 'blocked';
}

// Padrão visual copiado de RequerimentoAverbacaoWizard.tsx (dots + conector),
// mas aqui o estado de cada dot reflete dado real do registro — não é
// navegação livre por clique, é só leitura de "onde estamos".
export function Stepper({ stages }: { stages: StepperStage[] }) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'w-2 h-2 rounded-full transition-colors flex-none',
                s.state === 'done' && 'bg-success',
                s.state === 'current' && 'bg-primary',
                s.state === 'blocked' && 'bg-destructive',
                s.state === 'upcoming' && 'bg-border'
              )}
            />
            <span className={cn('text-[11.5px] font-medium', s.state === 'upcoming' ? 'text-mute-3' : 'text-foreground')}>{s.label}</span>
          </div>
          {i < stages.length - 1 && <span className={cn('w-6 h-px flex-none', s.state === 'done' ? 'bg-success' : 'bg-border')} />}
        </div>
      ))}
    </div>
  );
}
