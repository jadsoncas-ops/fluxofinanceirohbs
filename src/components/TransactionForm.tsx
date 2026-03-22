import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Transaction, TransactionType, getCategorias, CATEGORIAS_REPASSE } from '@/lib/types';
import { addTransactions, updateTransaction, addTransaction, deleteTransaction } from '@/lib/storage';
import { toast } from 'sonner';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editItem?: Transaction | null;
}

export function TransactionForm({ open, onClose, onSave, editItem }: Props) {
  const [tipo, setTipo] = useState<TransactionType>('Entrada');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [valorRecebido, setValorRecebido] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [dataRestante, setDataRestante] = useState('');

  const [hasRepasse, setHasRepasse] = useState(false);
  const [repasseValor, setRepasseValor] = useState('');
  const [repasseCategoria, setRepasseCategoria] = useState('Projetista');
  const [repasseDescricao, setRepasseDescricao] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (editItem) {
      setTipo(editItem.tipo);
      setCategoria(editItem.categoria);
      setDescricao(editItem.descricao);
      setValorTotal(String(editItem.valor));
      setValorRecebido(String(editItem.valor));
      setData(editItem.data);
      setDataRestante('');
      setHasRepasse(false);
    } else {
      setTipo('Entrada');
      setCategoria('');
      setDescricao('');
      setValorTotal('');
      setValorRecebido('');
      setData(new Date().toISOString().slice(0, 10));
      setDataRestante('');
      setHasRepasse(false);
      setRepasseValor('');
      setRepasseDescricao('');
    }
  }, [editItem, open]);

  function handleValorTotalChange(val: string) {
    const wasSync = valorTotal === valorRecebido || valorRecebido === '';
    setValorTotal(val);
    if (wasSync) setValorRecebido(val);
  }

  const numTotal = parseFloat(valorTotal) || 0;
  const numRecebido = parseFloat(valorRecebido) || 0;
  const hasSplit = numRecebido >= 0 && numRecebido < numTotal;
  const diferenca = numTotal - numRecebido;

  const showRepasse = tipo === 'Entrada' || tipo === 'A Receber';
  const categorias = getCategorias(tipo);

  function getCompletedType(t: TransactionType): TransactionType {
    if (t === 'A Receber') return 'Entrada';
    if (t === 'A Pagar') return 'Saída';
    return t;
  }
  function getPendingType(t: TransactionType): TransactionType {
    if (t === 'Entrada') return 'A Receber';
    if (t === 'Saída') return 'A Pagar';
    return t;
  }

  function handleSave() {
    if (!categoria || !descricao || !valorTotal || !data) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    if (numTotal <= 0) {
      toast.error('Valor total inválido.');
      return;
    }
    if (numRecebido < 0 || numRecebido > numTotal) {
      toast.error('Valor recebido/pago inválido.');
      return;
    }
    if (hasSplit && !dataRestante) {
      toast.error('Selecione a data de vencimento do restante.');
      return;
    }

    if (editItem) {
      if (hasSplit) {
        updateTransaction({
          ...editItem,
          tipo: getCompletedType(editItem.tipo),
          categoria,
          descricao,
          valor: numRecebido,
          data,
          status: 'Concluído',
        });
        addTransaction({
          id: crypto.randomUUID(),
          data: dataRestante,
          tipo: getPendingType(editItem.tipo),
          categoria,
          descricao: `${descricao.replace(/ \(Restante\)$/, '')} (Restante)`,
          valor: diferenca,
          status: 'Pendente',
          isRepasse: editItem.isRepasse,
        });
        toast.success(`Atualizado. Restante de R$ ${diferenca.toFixed(2)} gerado como pendente.`);
      } else {
        updateTransaction({
          ...editItem,
          tipo: numRecebido === numTotal ? getCompletedType(editItem.tipo) : editItem.tipo,
          categoria,
          descricao,
          valor: numRecebido,
          data,
          status: numRecebido === numTotal ? 'Concluído' : editItem.status,
        });
        toast.success('Lançamento atualizado com sucesso.');
      }
    } else {
      const txs: Transaction[] = [];

      if (hasSplit) {
        txs.push({
          id: crypto.randomUUID(),
          data,
          tipo: getCompletedType(tipo),
          categoria,
          descricao,
          valor: numRecebido,
          status: 'Concluído',
          isRepasse: false,
        });
        txs.push({
          id: crypto.randomUUID(),
          data: dataRestante,
          tipo: getPendingType(tipo),
          categoria,
          descricao: `${descricao} (Restante)`,
          valor: diferenca,
          status: 'Pendente',
          isRepasse: false,
        });
      } else {
        const isConcluido = tipo === 'Entrada' || tipo === 'Saída';
        txs.push({
          id: crypto.randomUUID(),
          data,
          tipo,
          categoria,
          descricao,
          valor: numTotal,
          status: isConcluido ? 'Concluído' : 'Pendente',
          isRepasse: false,
        });
      }

      if (hasRepasse && repasseValor) {
        const rv = parseFloat(repasseValor);
        if (!isNaN(rv) && rv > 0) {
          const mainTipo = hasSplit ? getCompletedType(tipo) : tipo;
          txs.push({
            id: crypto.randomUUID(),
            data,
            tipo: mainTipo === 'Entrada' ? 'Saída' : 'A Pagar',
            categoria: repasseCategoria,
            descricao: repasseDescricao || `Repasse - ${descricao}`,
            valor: rv,
            status: mainTipo === 'Entrada' ? 'Concluído' : 'Pendente',
            isRepasse: true,
          });
        }
      }

      addTransactions(txs);
      toast.success(txs.length > 1 ? 'Lançamentos registados com sucesso.' : 'Lançamento registado.');
    }

    onSave();
    onClose();
  }

  function handleDelete() {
    if (!editItem) return;
    deleteTransaction(editItem.id);
    toast.success('Lançamento excluído com sucesso.');
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
              <DialogTitle className="text-base font-semibold">
                {editItem ? 'Editar Lançamento' : 'Novo Lançamento'}
              </DialogTitle>
              {editItem && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo} onValueChange={v => { setTipo(v as TransactionType); setCategoria(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['Entrada', 'Saída', 'A Receber', 'A Pagar'] as TransactionType[]).map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={data} onChange={e => setData(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Projeto residencial Lote 14" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor Total (R$)</Label>
                <Input type="number" min="0" step="0.01" value={valorTotal} onChange={e => handleValorTotalChange(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor Recebido/Pago (R$)</Label>
                <Input type="number" min="0" step="0.01" value={valorRecebido} onChange={e => setValorRecebido(e.target.value)} placeholder="0,00" />
              </div>
            </div>

            {hasSplit && (
              <div className="border border-warning/30 bg-warning/5 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-medium">
                    Gerar novo lançamento com o restante de R$ {diferenca.toFixed(2)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data para receber/pagar o restante</Label>
                  <Input type="date" value={dataRestante} onChange={e => setDataRestante(e.target.value)} />
                </div>
              </div>
            )}

            {showRepasse && !editItem && (
              <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox checked={hasRepasse} onCheckedChange={v => setHasRepasse(!!v)} id="repasse" />
                  <Label htmlFor="repasse" className="text-xs font-medium cursor-pointer">Adicionar repasse a parceiro</Label>
                </div>
                {hasRepasse && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Valor Repasse</Label>
                        <Input type="number" min="0" step="0.01" value={repasseValor} onChange={e => setRepasseValor(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Categoria</Label>
                        <Select value={repasseCategoria} onValueChange={setRepasseCategoria}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS_REPASSE.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Descrição do Repasse</Label>
                      <Input value={repasseDescricao} onChange={e => setRepasseDescricao(e.target.value)} placeholder="Opcional" />
                    </div>
                  </>
                )}
              </div>
            )}

            <Button onClick={handleSave} className="w-full">
              {editItem ? 'Guardar Alterações' : 'Registar Lançamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
