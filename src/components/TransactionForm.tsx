import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Transaction, TransactionType, TransactionStatus, getCategorias, CATEGORIAS_REPASSE } from '@/lib/types';
import { getTransactions, addTransactions, updateTransaction, addTransaction, deleteTransaction } from '@/lib/storage';
import { toast } from 'sonner';
import { AlertTriangle, Trash2, Plus, X, Wallet } from 'lucide-react';

interface RepasseItem {
  id?: string;
  valor: string;
  categoria: string;
  descricao: string;
  status?: TransactionStatus;
}

const emptyRepasse = (): RepasseItem => ({ valor: '', categoria: '🖨️ Impressão de projetos', descricao: '', status: 'Pendente' });

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editItem?: Transaction | null;
  parentItem?: Transaction | null;
}

export function TransactionForm({ open, onClose, onSave, editItem, parentItem }: Props) {
  const [tipo, setTipo] = useState<TransactionType>('Entrada');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [valorRecebido, setValorRecebido] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [dataRestante, setDataRestante] = useState('');

  const [hasRepasse, setHasRepasse] = useState(false);
  const [repasses, setRepasses] = useState<RepasseItem[]>([emptyRepasse()]);

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

      const existingRepasses = getTransactions().filter(t => t.parentId === editItem.id && t.isRepasse);
      if (existingRepasses.length > 0) {
        setHasRepasse(true);
        setRepasses(existingRepasses.map(r => ({
          id: r.id,
          valor: String(r.valor),
          categoria: r.categoria,
          descricao: r.descricao,
          status: r.status
        })));
      } else {
        setHasRepasse(false);
        setRepasses([emptyRepasse()]);
      }
    } else if (parentItem) {
      setTipo(parentItem.status === 'Concluído' ? 'Saída' : 'A Pagar');
      setCategoria('🤝 Comissão');
      setDescricao(`Repasse - ${parentItem.descricao}`);
      setValorTotal('');
      setValorRecebido('');
      setData(new Date().toISOString().slice(0, 10));
      setDataRestante('');
      setHasRepasse(false);
      setRepasses([emptyRepasse()]);
    } else {
      setTipo('Entrada');
      setCategoria('');
      setDescricao('');
      setValorTotal('');
      setValorRecebido('');
      setData(new Date().toISOString().slice(0, 10));
      setDataRestante('');
      setHasRepasse(false);
      setRepasses([emptyRepasse()]);
    }
  }, [editItem, parentItem, open]);

  function handleValorTotalChange(val: string) {
    const wasSync = valorTotal === valorRecebido || valorRecebido === '';
    setValorTotal(val);
    if (wasSync) setValorRecebido(val);
  }

  const numTotal = parseFloat(valorTotal) || 0;
  const numRecebido = parseFloat(valorRecebido) || 0;
  const hasSplit = numRecebido > 0 && numRecebido < numTotal;
  const diferenca = numTotal - numRecebido;

  const showRepasse = (tipo === 'Entrada' || tipo === 'A Receber') && !parentItem;
  const categorias = getCategorias(tipo);

  function updateRepasse(index: number, field: keyof RepasseItem, value: string) {
    setRepasses(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  function addRepasse() {
    setRepasses(prev => [...prev, emptyRepasse()]);
  }

  function removeRepasse(index: number) {
    setRepasses(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index));
  }

  const totalRepasses = repasses.reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);

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
      const isFullyPaid = numRecebido > 0 && numRecebido === numTotal;

      if (hasSplit) {
        updateTransaction({
          ...editItem,
          tipo: numRecebido > 0 ? getCompletedType(editItem.tipo) : getPendingType(editItem.tipo),
          categoria,
          descricao,
          valor: numRecebido > 0 ? numRecebido : numTotal,
          data,
          status: numRecebido > 0 ? 'Concluído' : 'Pendente',
          updatedAt: Date.now(),
        });

        if (numRecebido > 0) {
          addTransaction({
            id: crypto.randomUUID(),
            data: dataRestante,
            tipo: getPendingType(editItem.tipo),
            categoria,
            descricao: `${descricao.replace(/ \(Restante\)$/, '')} (Restante)`,
            valor: diferenca,
            status: 'Parcial',
            isRepasse: editItem.isRepasse,
            parentId: editItem.parentId,
            originalTotal: editItem.originalTotal || numTotal,
          });
          toast.success(`Atualizado. Restante de R$ ${diferenca.toFixed(2)} gerado como pendente.`);
        } else {
          toast.success('Lançamento atualizado como pendente.');
        }
      } else {
        updateTransaction({
          ...editItem,
          tipo: isFullyPaid ? getCompletedType(editItem.tipo) : getPendingType(editItem.tipo),
          categoria,
          descricao,
          valor: numRecebido > 0 ? numRecebido : numTotal,
          data,
          status: isFullyPaid ? 'Concluído' : 'Pendente',
          updatedAt: Date.now(),
        });
        toast.success('Lançamento atualizado com sucesso.');
      }

      if (showRepasse) {
        const existingRepasses = getTransactions().filter(t => t.parentId === editItem.id && t.isRepasse);
        
        if (hasRepasse) {
          repasses.forEach(rep => {
             const rv = parseFloat(rep.valor);
             if (!isNaN(rv) && rv > 0) {
               const repStatus = rep.status || 'Pendente';
               const repTipo = repStatus === 'Concluído' ? 'Saída' : 'A Pagar';
               
               if (rep.id) {
                 const ex = existingRepasses.find(e => e.id === rep.id);
                 if (ex) {
                   updateTransaction({
                     ...ex,
                     valor: rv,
                     categoria: rep.categoria,
                     descricao: rep.descricao || `Repasse - ${descricao}`,
                     status: repStatus,
                     tipo: repTipo,
                     updatedAt: Date.now(),
                   });
                 }
               } else {
                 addTransaction({
                   id: crypto.randomUUID(),
                   data,
                   tipo: repTipo,
                   categoria: rep.categoria,
                   descricao: rep.descricao || `Repasse - ${descricao}`,
                   valor: rv,
                   status: repStatus,
                   isRepasse: true,
                   parentId: editItem.id,
                 });
               }
             }
          });
          
          const newRepasseIds = repasses.map(r => r.id).filter(Boolean);
          existingRepasses.forEach(er => {
            if (!newRepasseIds.includes(er.id)) {
              deleteTransaction(er.id);
            }
          });
        } else {
          existingRepasses.forEach(er => deleteTransaction(er.id));
        }
      }

    } else {
      const txs: Transaction[] = [];
      const rootId = crypto.randomUUID();
      const linkId = parentItem ? parentItem.id : rootId;
      const isAutoRepasse = !!parentItem;

      if (hasSplit) {
        const paidNow = numRecebido > 0;
        txs.push({
          id: isAutoRepasse ? crypto.randomUUID() : linkId,
          data,
          tipo: paidNow ? getCompletedType(tipo) : getPendingType(tipo),
          categoria,
          descricao,
          valor: paidNow ? numRecebido : numTotal,
          status: paidNow ? 'Concluído' : 'Pendente',
          isRepasse: isAutoRepasse,
          parentId: isAutoRepasse ? linkId : undefined,
        });
        txs.push({
          id: crypto.randomUUID(),
          data: dataRestante,
          tipo: getPendingType(tipo),
          categoria,
          descricao: `${descricao} (Restante)`,
          valor: diferenca,
          status: 'Parcial',
          isRepasse: isAutoRepasse,
          parentId: linkId,
          originalTotal: numTotal,
        });
      } else {
        const isConcluido = tipo === 'Entrada' || tipo === 'Saída';
        txs.push({
          id: isAutoRepasse ? crypto.randomUUID() : linkId,
          data,
          tipo,
          categoria,
          descricao,
          valor: numTotal,
          status: isConcluido ? 'Concluído' : 'Pendente',
          isRepasse: isAutoRepasse,
          parentId: isAutoRepasse ? linkId : undefined,
        });
      }

      if (hasRepasse && !isAutoRepasse) {
        const mainTipo = hasSplit ? getCompletedType(tipo) : tipo;
        repasses.forEach(rep => {
          const rv = parseFloat(rep.valor);
          if (!isNaN(rv) && rv > 0) {
            txs.push({
              id: crypto.randomUUID(),
              data,
              tipo: mainTipo === 'Entrada' ? 'Saída' : 'A Pagar',
              categoria: rep.categoria,
              descricao: rep.descricao || `Repasse - ${descricao}`,
              valor: rv,
              status: mainTipo === 'Entrada' ? 'Concluído' : 'Pendente',
              isRepasse: true,
              parentId: linkId,
            });
          }
        });
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
                {editItem ? 'Editar Lançamento' : (parentItem ? 'Lançar Repasse' : 'Novo Lançamento')}
              </DialogTitle>
              {editItem && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {editItem && editItem.status === 'Concluído' && (
              <div className="border border-warning/40 bg-warning/10 rounded-xl p-3.5 flex gap-3 items-start mt-0 mb-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-warning uppercase tracking-wide">Registro Já Consolidado</p>
                  <p className="text-warning/90 font-medium leading-relaxed">
                    Atenção! Você está ajustando um lançamento marcado como Concluído. Ao alterar este valor ou data, as movimentações financeiras no seu histórico serão diretamente recálculadas.
                  </p>
                </div>
              </div>
            )}
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

            {showRepasse && (
              <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox checked={hasRepasse} onCheckedChange={v => setHasRepasse(!!v)} id="repasse" />
                  <Label htmlFor="repasse" className="text-xs font-medium cursor-pointer">Adicionar repasse a parceiro(s)</Label>
                </div>
                {hasRepasse && (
                  <div className="space-y-3">
                    {repasses.map((rep, idx) => (
                      <div key={idx} className="space-y-2 border border-border/50 rounded-md p-2.5 bg-background/50 relative">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-muted-foreground">Parceiro {idx + 1}</span>
                          {repasses.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive" onClick={() => removeRepasse(idx)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Valor (R$)</Label>
                            <Input type="number" min="0" step="0.01" value={rep.valor} onChange={e => updateRepasse(idx, 'valor', e.target.value)} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Categoria</Label>
                            <Select value={rep.categoria} onValueChange={v => updateRepasse(idx, 'categoria', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {CATEGORIAS_REPASSE.map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Descrição do Repasse</Label>
                            <Input value={rep.descricao} onChange={e => updateRepasse(idx, 'descricao', e.target.value)} placeholder="Ex: Pagamento ao projetista" className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Status</Label>
                            <Select value={rep.status || 'Pendente'} onValueChange={v => updateRepasse(idx, 'status', v as TransactionStatus)}>
                              <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Pendente">Pendente</SelectItem>
                                <SelectItem value="Concluído">Concluído</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button type="button" variant="outline" size="sm" className="w-full text-xs gap-1.5" onClick={addRepasse}>
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar outro parceiro
                    </Button>

                    {totalRepasses > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground px-1">
                        <span>Total repasses:</span>
                        <span className="font-medium tabular-nums">R$ {totalRepasses.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {showRepasse && hasRepasse && repasses.length > 0 && (
              <div className="border border-success/30 bg-success/5 rounded-lg p-3 space-y-2 mt-2">
                <h4 className="text-xs font-bold text-success uppercase tracking-wider flex items-center pr-2">
                  <Wallet className="w-3.5 h-3.5 mr-1" /> Simulador: Lucro Líquido
                </h4>
                <div className="flex justify-between text-xs items-center text-muted-foreground pt-1.5 border-t border-success/10">
                  <span>Sobra Atual (Recebido - Repasses Pagos):</span>
                  <span className={`font-semibold tabular-nums px-1.5 py-0.5 rounded leading-none flex items-center ${(numRecebido - repasses.filter(r => r.status === 'Concluído').reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0)) >= 0 ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                    R$ {(numRecebido - repasses.filter(r => r.status === 'Concluído').reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0)).toFixed(2)}
                  </span>
                </div>
                {hasSplit && (
                  <div className="flex justify-between text-xs items-center text-muted-foreground pt-1.5 border-t border-success/10">
                     <span>Lucro Faltante (Restante - Rep. Pendentes):</span>
                     <span className={`font-semibold tabular-nums px-1.5 py-0.5 rounded leading-none flex items-center ${(diferenca - repasses.filter(r => r.status === 'Pendente').reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0)) >= 0 ? 'bg-primary/20 text-primary' : 'bg-warning/20 text-warning'}`}>
                       R$ {(diferenca - repasses.filter(r => r.status === 'Pendente').reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0)).toFixed(2)}
                     </span>
                  </div>
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
