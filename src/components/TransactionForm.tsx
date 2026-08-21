import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Transaction, TransactionType, TransactionStatus, getCategorias } from '@/lib/types';
import { updateTransaction, addTransaction, deleteTransaction, getClients } from '@/lib/storage';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editItem?: Transaction | null;
}

/** Lançamento avulso — sem cliente, sem trabalho, sem parcelamento e sem repasse: é só pra despesas gerais
 *  do escritório (aluguel, internet, etc). Qualquer coisa ligada a um cliente ou trabalho nasce lá, não aqui. */
export function TransactionForm({ open, onClose, onSave, editItem }: Props) {
  const [tipo, setTipo] = useState<TransactionType>('Saída');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<TransactionStatus>('Concluído');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editItem?.id) {
      setTipo(editItem.tipo);
      setCategoria(editItem.categoria);
      setDescricao(editItem.descricao);
      setValor(String(editItem.valor));
      setData(editItem.data);
      setStatus(editItem.status);
    } else {
      setTipo(editItem?.tipo || 'Saída');
      setCategoria('');
      setDescricao('');
      setValor('');
      setData(new Date().toISOString().slice(0, 10));
      setStatus('Concluído');
    }
  }, [editItem, open]);

  const categorias = getCategorias(tipo);
  const numValor = parseFloat(valor) || 0;
  const clienteVinculado = editItem?.clienteId ? getClients().find(c => c.id === editItem.clienteId) : null;

  function statusParaTipo(t: TransactionType, s: TransactionStatus): TransactionType {
    const isPago = s === 'Concluído';
    if (t === 'Entrada' || t === 'A Receber') return isPago ? 'Entrada' : 'A Receber';
    return isPago ? 'Saída' : 'A Pagar';
  }

  function handleSave() {
    if (!categoria || !descricao || !valor || !data) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    if (numValor <= 0) {
      toast.error('Valor inválido.');
      return;
    }

    const tipoFinal = statusParaTipo(tipo, status);

    if (editItem?.id) {
      updateTransaction({ ...editItem, tipo: tipoFinal, categoria, descricao, valor: numValor, data, status, updatedAt: Date.now() });
      toast.success('Lançamento atualizado.');
    } else {
      addTransaction({
        id: crypto.randomUUID(),
        data,
        tipo: tipoFinal,
        categoria,
        descricao,
        valor: numValor,
        status,
        isRepasse: false,
      });
      toast.success('Lançamento registrado.');
    }

    onSave();
    onClose();
  }

  function handleDelete() {
    if (!editItem?.id) return;
    deleteTransaction(editItem.id);
    toast.success('Lançamento excluído.');
    setShowDeleteConfirm(false);
    onSave();
    onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold">{editItem?.id ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle>
              {editItem?.id && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground -mt-2">
              {clienteVinculado
                ? `Lançamento avulso de ${clienteVinculado.nome}, sem trabalho vinculado.`
                : 'Despesa geral do escritório — sem cliente nem trabalho. Receita de cliente ou repasse a parceiro são lançados no Trabalho.'}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo === 'A Receber' ? 'Entrada' : tipo === 'A Pagar' ? 'Saída' : tipo} onValueChange={v => { setTipo(v as TransactionType); setCategoria(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Entrada">Receita</SelectItem>
                    <SelectItem value="Saída">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={v => setStatus(v as TransactionStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Concluído">{tipo === 'Entrada' || tipo === 'A Receber' ? 'Já recebi' : 'Já paguei'}</SelectItem>
                    <SelectItem value="Pendente">{tipo === 'Entrada' || tipo === 'A Receber' ? 'A receber' : 'A pagar'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={data} onChange={e => setData(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Internet do escritório" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
            </div>

            <Button onClick={handleSave} className="w-full">{editItem?.id ? 'Salvar alterações' : 'Registrar lançamento'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
