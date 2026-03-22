import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Transaction } from '@/lib/types';
import { updateTransaction, addTransaction } from '@/lib/storage';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  transaction: Transaction | null;
}

export function PartialPaymentModal({ open, onClose, onSave, transaction }: Props) {
  const [valorRecebido, setValorRecebido] = useState('');
  const [dataRestante, setDataRestante] = useState('');

  useEffect(() => {
    if (transaction) {
      setValorRecebido(String(transaction.valor));
      setDataRestante('');
    }
  }, [transaction]);

  if (!transaction) return null;

  const recebido = parseFloat(valorRecebido) || 0;
  const diferenca = transaction.valor - recebido;
  const isParcial = recebido > 0 && recebido < transaction.valor;

  const tipoConcluido = transaction.tipo === 'A Receber' ? 'Entrada' : transaction.tipo === 'A Pagar' ? 'Saída' : transaction.tipo;
  const tipoRestante = transaction.tipo === 'A Receber' ? 'A Receber' : transaction.tipo === 'A Pagar' ? 'A Pagar' : transaction.tipo;

  function handleConfirm() {
    if (recebido < 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    if (recebido > transaction!.valor) {
      toast.error('O valor recebido não pode ser maior que o total.');
      return;
    }
    if (isParcial && !dataRestante) {
      toast.error('Selecione a data de vencimento do restante.');
      return;
    }

    updateTransaction({
      ...transaction!,
      valor: recebido,
      status: 'Concluído',
      tipo: tipoConcluido,
    });

    if (isParcial) {
      addTransaction({
        id: crypto.randomUUID(),
        data: dataRestante,
        tipo: tipoRestante,
        categoria: transaction!.categoria,
        descricao: `${transaction!.descricao.replace(/ - Restante$/, '')} - Restante`,
        valor: diferenca,
        status: 'Pendente',
        isRepasse: transaction!.isRepasse,
      });
      toast.success(`Baixa parcial registada. Restante de R$ ${diferenca.toFixed(2)} gerado como pendente.`);
    } else {
      toast.success('Lançamento concluído com sucesso.');
    }

    onSave();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Confirmar Valor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">{transaction.descricao}</p>

          <div className="space-y-1.5">
            <Label className="text-xs">Valor Total</Label>
            <Input type="number" value={transaction.valor.toFixed(2)} disabled className="bg-muted" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Valor Recebido/Pago</Label>
            <Input type="number" min="0" step="0.01" value={valorRecebido} onChange={e => setValorRecebido(e.target.value)} />
          </div>

          {isParcial && (
            <div className="border border-warning/30 bg-warning/5 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">
                  Gerar novo lançamento com o restante de R$ {diferenca.toFixed(2)}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Qual a data para receber o restante?</Label>
                <Input type="date" value={dataRestante} onChange={e => setDataRestante(e.target.value)} />
              </div>
            </div>
          )}

          <Button onClick={handleConfirm} className="w-full">
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
