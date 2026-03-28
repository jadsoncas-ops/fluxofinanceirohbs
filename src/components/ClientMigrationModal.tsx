import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Client, Transaction } from '@/lib/types';
import { getClients, bulkUpdateTransactions } from '@/lib/storage';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onComplete: () => void;
}

export function ClientMigrationModal({ open, onClose, transactions, onComplete }: Props) {
  const [clientes, setClientes] = useState<Client[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setClientes(getClients());
  }, [open]);

  const unlinked = useMemo(() => {
    return transactions
      .filter(t => !t.isRepasse && t.clienteId === undefined)
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [transactions]);

  function handleSave() {
    const updates = unlinked.map(tx => ({
      id: tx.id,
      clienteId: mapping[tx.id] === 'none' || mapping[tx.id] === undefined ? null : mapping[tx.id]
    }));
    
    // As in typescript hack above, it returns an array of { id: string, clienteId: string | null }
    // @ts-ignore
    bulkUpdateTransactions(updates);
    
    toast.success('Lançamentos organizados com sucesso!');
    onComplete();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="shrink-0 mb-4">
          <DialogTitle className="text-lg">Vincular Clientes Antigos</DialogTitle>
          <DialogDescription className="text-sm">
            Selecione o cliente para os lançamentos anteriores. Se deixar em branco, será marcado como <strong>"Sem cliente"</strong> automaticamente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {unlinked.map(tx => (
            <div key={tx.id} className="flex justify-between items-center gap-4 border border-border/50 p-3 rounded-lg bg-muted/20">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold truncate text-foreground/90 leading-tight">{tx.descricao}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">{tx.tipo}</span>
                  <span className="text-[11px] text-muted-foreground">{new Date(tx.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  <span className="text-[11px] font-medium opacity-80 pl-1 border-l border-border/40 ml-1">R$ {tx.valor.toFixed(2)}</span>
                </div>
              </div>
              <div className="w-[180px] shrink-0">
                <Select value={mapping[tx.id] || 'none'} onValueChange={v => setMapping(prev => ({...prev, [tx.id]: v}))}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Sem cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none"><span className="italic text-muted-foreground mr-2">Sem cliente</span></SelectItem>
                    {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 pt-4 mt-2 border-t border-border/40">
           <Button onClick={handleSave} className="w-full font-semibold max-w-sm mx-auto block shadow-md">Salvar Organização ({unlinked.length} concluídos)</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
