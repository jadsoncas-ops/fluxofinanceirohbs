import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Contrato, ContratoParcela } from '@/lib/types';
import { getProcesses, getTransactions, updateContrato, updateProcess, updateTransaction, registrarEvento } from '@/lib/storage';
import { formatBRL } from '@/lib/comercial/precificacao';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  contrato: Contrato | null;
}

/** Edita o valor/parcelas de um contrato já gerado. Diferente da Proposta (que só tem preço
 *  sugerido antes de aprovar), o Contrato é o número "oficial" — se tem parcelas com lançamento
 *  já criado (contrato.parcelas[].transactionId), edita o lançamento junto, senão o Fluxo de Caixa
 *  ficaria mostrando um valor diferente do contrato. Se o trabalho já nasceu daqui, atualiza
 *  também o valorContrato do Trabalho, que é o número usado nos cálculos de lucro. */
export function EditarContratoDialog({ open, onClose, onSaved, contrato }: Props) {
  const [valorSemParcelas, setValorSemParcelas] = useState(0);
  const [parcelas, setParcelas] = useState<ContratoParcela[]>([]);

  useEffect(() => {
    if (!open || !contrato) return;
    setValorSemParcelas(contrato.valor);
    setParcelas(contrato.parcelas.map(p => ({ ...p })));
  }, [open, contrato]);

  if (!contrato) return null;

  const temParcelas = contrato.parcelas.length > 0;
  const totalParcelas = parcelas.reduce((s, p) => s + p.valor, 0);

  function updateParcela(i: number, patch: Partial<ContratoParcela>) {
    setParcelas(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function handleSave() {
    const novoValor = temParcelas ? totalParcelas : valorSemParcelas;
    if (novoValor <= 0) { toast.error('O valor do contrato precisa ser maior que zero.'); return; }

    if (temParcelas) {
      const transacoes = getTransactions();
      parcelas.forEach(p => {
        if (!p.transactionId) return;
        const tx = transacoes.find(t => t.id === p.transactionId);
        if (!tx) return;
        updateTransaction({ ...tx, valor: p.valor, data: p.vencimento || tx.data, descricao: p.descricao, updatedAt: Date.now() });
      });
    }

    updateContrato({ ...contrato, valor: novoValor, parcelas, updatedAt: Date.now() });

    if (contrato.trabalhoId) {
      const trabalho = getProcesses().find(p => p.id === contrato.trabalhoId);
      if (trabalho) updateProcess({ ...trabalho, valorContrato: novoValor, updatedAt: Date.now() });
    }

    registrarEvento({
      modulo: 'Comercial',
      texto: `Contrato ${contrato.codigo} editado — novo valor ${formatBRL(novoValor)}`,
      clienteId: contrato.clienteId,
      contratoId: contrato.id,
      trabalhoId: contrato.trabalhoId || undefined,
    });

    toast.success('Contrato atualizado.');
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar contrato {contrato.codigo}</DialogTitle></DialogHeader>

        {!temParcelas ? (
          <div className="space-y-1.5">
            <Label>Valor do contrato</Label>
            <Input type="number" value={valorSemParcelas || ''} onChange={e => setValorSemParcelas(Number(e.target.value) || 0)} />
            <p className="text-[11px] text-muted-foreground">Este contrato ainda não tem trabalho/parcelas — é só esse número que muda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] text-muted-foreground -mt-1">
              Cada parcela já tem um lançamento no Fluxo de Caixa — editar aqui atualiza o lançamento junto, pra não ficar número diferente entre as telas.
            </div>
            {parcelas.map((p, i) => (
              <div key={p.id} className="flex gap-2 items-center">
                <Input value={p.descricao} onChange={e => updateParcela(i, { descricao: e.target.value })} placeholder="Descrição" className="flex-1 h-8 text-xs" />
                <Input type="number" value={p.valor || ''} onChange={e => updateParcela(i, { valor: Number(e.target.value) || 0 })} placeholder="Valor" className="w-24 h-8 text-xs" />
                <Input type="date" value={p.vencimento || ''} onChange={e => updateParcela(i, { vencimento: e.target.value })} className="w-36 h-8 text-xs" />
              </div>
            ))}
            <div className="text-xs font-mono-hbs text-muted-foreground pt-1">Total: {formatBRL(totalParcelas)}</div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
