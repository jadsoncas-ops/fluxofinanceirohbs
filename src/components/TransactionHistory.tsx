import { useState } from 'react';
import { Transaction } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, CheckCircle2, Clock, Banknote, FileText, Car, Users, Briefcase, Building2, ClipboardCheck } from 'lucide-react';

const FILTERS = ['Tudo', 'Entradas', 'Saídas', 'Pendentes'] as const;

const ICON_MAP: Record<string, React.ElementType> = {
  'Elaboração de Projeto': FileText,
  'Vistoria': ClipboardCheck,
  'Regularização Parcial': Building2,
  'Regularização Total': Building2,
  'Administração de Obra': Briefcase,
  'Projetista': Users,
  'Despachante': Users,
  'Comissão': Banknote,
  'Taxas e Emolumentos': Banknote,
  'Deslocamento/Combustível': Car,
  'Outros': FileText,
};

interface Props {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onComplete: (tx: Transaction) => void;
}

export function TransactionHistory({ transactions, onEdit, onComplete }: Props) {
  const [filter, setFilter] = useState<typeof FILTERS[number]>('Tudo');

  const filtered = transactions.filter(tx => {
    if (filter === 'Entradas') return tx.tipo === 'Entrada' || tx.tipo === 'A Receber';
    if (filter === 'Saídas') return tx.tipo === 'Saída' || tx.tipo === 'A Pagar';
    if (filter === 'Pendentes') return tx.status === 'Pendente';
    return true;
  }).sort((a, b) => b.data.localeCompare(a.data));

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7 px-3 shrink-0"
            onClick={() => setFilter(f)}
          >
            {f}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">Nenhum lançamento encontrado.</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(tx => {
            const Icon = ICON_MAP[tx.categoria] || FileText;
            const isIncome = tx.tipo === 'Entrada' || tx.tipo === 'A Receber';
            const isPending = tx.status === 'Pendente';

            const iconBg = isPending
              ? 'bg-muted text-muted-foreground'
              : isIncome ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive';

            const valorColor = isPending
              ? 'text-muted-foreground'
              : isIncome ? 'text-success' : 'text-destructive';

            return (
              <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 hover:border-border transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.descricao}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{new Date(tx.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{tx.categoria}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm font-semibold tabular-nums ${valorColor}`}>
                      {isIncome ? '+' : '-'} R$ {tx.valor.toFixed(2)}
                    </p>
                    <Badge variant={tx.status === 'Concluído' ? 'default' : 'secondary'} className={`text-[10px] h-4 ${tx.status === 'Concluído' ? 'bg-success/15 text-success border-0' : 'bg-warning/15 text-warning border-0'}`}>
                      {tx.status === 'Concluído' ? <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> : <Clock className="w-2.5 h-2.5 mr-0.5" />}
                      {tx.status}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(tx)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {tx.status === 'Pendente' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => onComplete(tx)}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
