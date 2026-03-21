import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Transaction, TransactionType, getCategorias, CATEGORIAS_REPASSE } from '@/lib/types';
import { addTransactions, updateTransaction } from '@/lib/storage';
import { toast } from 'sonner';

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
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<'Pendente' | 'Concluído'>('Pendente');

  const [hasRepasse, setHasRepasse] = useState(false);
  const [repasseValor, setRepasseValor] = useState('');
  const [repasseCategoria, setRepasseCategoria] = useState('Projetista');
  const [repasseDescricao, setRepasseDescricao] = useState('');

  useEffect(() => {
    if (editItem) {
      setTipo(editItem.tipo);
      setCategoria(editItem.categoria);
      setDescricao(editItem.descricao);
      setValor(String(editItem.valor));
      setData(editItem.data);
      setStatus(editItem.status);
      setHasRepasse(false);
    } else {
      setTipo('Entrada');
      setCategoria('');
      setDescricao('');
      setValor('');
      setData(new Date().toISOString().slice(0, 10));
      setStatus('Pendente');
      setHasRepasse(false);
      setRepasseValor('');
      setRepasseDescricao('');
    }
  }, [editItem, open]);

  const showRepasse = !editItem && (tipo === 'Entrada' || tipo === 'A Receber');
  const categorias = getCategorias(tipo);

  function handleSave() {
    if (!categoria || !descricao || !valor || !data) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    const numValor = parseFloat(valor);
    if (isNaN(numValor) || numValor <= 0) {
      toast.error('Valor inválido.');
      return;
    }

    if (editItem) {
      updateTransaction({ ...editItem, tipo, categoria, descricao, valor: numValor, data, status });
      toast.success('Lançamento atualizado com sucesso.');
    } else {
      const mainTx: Transaction = {
        id: crypto.randomUUID(),
        data,
        tipo,
        categoria,
        descricao,
        valor: numValor,
        status,
        isRepasse: false,
      };

      const txs: Transaction[] = [mainTx];

      if (hasRepasse && repasseValor) {
        const rv = parseFloat(repasseValor);
        if (!isNaN(rv) && rv > 0) {
          txs.push({
            id: crypto.randomUUID(),
            data,
            tipo: tipo === 'Entrada' ? 'Saída' : 'A Pagar',
            categoria: repasseCategoria,
            descricao: repasseDescricao || `Repasse - ${descricao}`,
            valor: rv,
            status: tipo === 'Entrada' ? 'Concluído' : 'Pendente',
            isRepasse: true,
          });
        }
      }

      addTransactions(txs);
      toast.success(txs.length > 1 ? 'Lançamento e repasse registados.' : 'Lançamento registado.');
    }

    onSave();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {editItem ? 'Editar Lançamento' : 'Novo Lançamento'}
          </DialogTitle>
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
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as 'Pendente' | 'Concluído')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showRepasse && (
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
  );
}
