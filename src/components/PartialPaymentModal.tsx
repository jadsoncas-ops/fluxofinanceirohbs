import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Transaction } from '@/lib/types';
import { updateTransaction, addTransaction } from '@/lib/storage';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  transaction: Transaction | null;
}

export function PartialPaymentModal({ open, onClose, onSave, transaction }: Props) {
  const [valorPago, setValorPago] = useState('');
  const [gerarRestante, setGerarRestante] = useState(false);
  const [dataRestante, setDataRestante] = useState('');

  useEffect(() => {
    if (transaction) {
      setValorPago(String(transaction.valor));
      setGerarRestante(false);
      setDataRestante('');
    }
  }, [transaction]);

  if (!transaction) return null;

  const pago = parseFloat(valorPago) || 0;
  const diferenca = transaction.valor - pago;
  const isParcial = pago > 0 && pago < transaction.valor;

  function handleConfirm() {
    if (pago <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    if (isParcial && gerarRestante && !dataRestante) {
      toast.error('Selecione a data de vencimento do restante.');
      return;
    }

    updateTransaction({ ...transaction!, valor: pago, status: 'Concluído' });

    if (isParcial && gerarRestante) {
      addTransaction({
        id: crypto.randomUUID(),
        data: dataRestante,
        tipo: transaction!.tipo,
        categoria: transaction!.categoria,
        descricao: `${transaction!.descricao} - Restante`,
        valor: diferenca,
        status: 'Pendente',
        isRepasse: transaction!.isRepasse,
      });
      toast.success(`Baixa parcial registada. Saldo restante de R$ ${diferenca.toFixed(2)} gerado.`);
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
          <p className="text-sm font-medium">Valor original: R$ {transaction.valor.toFixed(2)}</p>

          <div className="space-y-1.5">
            <Label className="text-xs">Valor Recebido/Pago</Label>
            <Input type="number" min="0" step="0.01" value={valorPago} onChange={e => setValorPago(e.target.value)} />
          </div>

          {isParcial && (
            <div className="border border-warning/30 bg-warning/5 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox checked={gerarRestante} onCheckedChange={v => setGerarRestante(!!v)} id="restante" />
                <Label htmlFor="restante" className="text-xs cursor-pointer">
                  Gerar saldo remanescente (R$ {diferenca.toFixed(2)})?
                </Label>
              </div>
              {gerarRestante && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Data de vencimento do restante</Label>
                  <Input type="date" value={dataRestante} onChange={e => setDataRestante(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <Button onClick={handleConfirm} className="w-full">Confirmar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
