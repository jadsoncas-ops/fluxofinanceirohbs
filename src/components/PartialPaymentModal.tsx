import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Transaction } from '@/lib/types';
import { updateTransaction, addTransaction, getTransactions, getProcesses, updateProcess } from '@/lib/storage';
import { toast } from 'sonner';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function getNext3MonthsOptions(originalDateStr: string) {
  const [, , dStr] = originalDateStr.split('-');
  const origDay = parseInt(dStr, 10);
  
  const options = [];
  const baseDate = new Date();
  const txDate = new Date(originalDateStr + 'T12:00:00');
  const startRef = txDate > baseDate ? txDate : baseDate;
  
  let currentMonth = startRef.getMonth();
  let currentYear = startRef.getFullYear();

  for (let i = 1; i <= 3; i++) {
    const targetMonth = (currentMonth + i) % 12;
    const targetYear = currentYear + Math.floor((currentMonth + i) / 12);
    
    // Calcula ultimo dia valido
    const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const finalDay = Math.min(origDay, lastDayOfMonth);
    
    const mFmt = String(targetMonth + 1).padStart(2, '0');
    const dFmt = String(finalDay).padStart(2, '0');
    const newDateStr = `${targetYear}-${mFmt}-${dFmt}`;
    
    options.push({
      label: `${MONTHS[targetMonth]} ${targetYear}`,
      newDate: newDateStr,
      displayDate: `${dFmt}/${mFmt}/${targetYear}`,
    });
  }
  return options;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  transaction: Transaction | null;
}

export function PartialPaymentModal({ open, onClose, onSave, transaction }: Props) {
  const [valorRecebido, setValorRecebido] = useState('');
  const [restanteDecision, setRestanteDecision] = useState<'manter' | 'adiar'>('manter');
  const [dataRestante, setDataRestante] = useState('');
  
  // Repasses pendentes
  const [pendingRepasses, setPendingRepasses] = useState<Transaction[]>([]);
  const [repasseInputs, setRepasseInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (transaction) {
      setValorRecebido(String(transaction.valor));
      setRestanteDecision('manter');
      setDataRestante(transaction.data);
      
      const reps = getTransactions().filter(t => t.parentId === transaction.id && t.isRepasse && t.status === 'Pendente');
      setPendingRepasses(reps);
      
      const initInputs: Record<string, string> = {};
      reps.forEach(r => initInputs[r.id] = String(r.valor));
      setRepasseInputs(initInputs);
    }
  }, [transaction, open]);

  const recebido = transaction ? (parseFloat(valorRecebido) || 0) : 0;
  const diferenca = transaction ? parseFloat((transaction.valor - recebido).toFixed(2)) : 0;
  const isParcial = transaction ? (recebido >= 0 && recebido < transaction.valor) : false;

  const sumRepasses = pendingRepasses.reduce((acc, rep) => {
     return acc + (parseFloat(repasseInputs[rep.id]) || 0);
  }, 0);

  const monthOptions = transaction ? getNext3MonthsOptions(transaction.data) : [];

  useEffect(() => {
     if (!transaction) return;
     if (restanteDecision === 'adiar' && monthOptions.length > 0) {
        if (!monthOptions.find(o => o.newDate === dataRestante)) {
           setDataRestante(monthOptions[0].newDate);
        }
     } else if (restanteDecision === 'manter' && transaction) {
        setDataRestante(transaction.data);
     }
  }, [restanteDecision, isParcial, transaction]);

  if (!transaction) return null;

  function handleRepasseChange(id: string, val: string) {
     setRepasseInputs(prev => ({ ...prev, [id]: val }));
  }

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
      toast.error('Verifique a data para o restante.');
      return;
    }
    if (sumRepasses > recebido) {
      toast.error('O montante de repasses listados superou seu total recebido em tela.');
      return;
    }
    for (const r of pendingRepasses) {
       const v = parseFloat(repasseInputs[r.id]) || 0;
       if (v > r.valor || v < 0) {
          toast.error(`Valor inválido (maior que o maximo) no repasse de: ${r.descricao}`);
          return;
       }
    }

    const tipoConcluido = transaction!.tipo === 'A Receber' ? 'Entrada' : transaction!.tipo === 'A Pagar' ? 'Saída' : transaction!.tipo;
    const tipoRestante = transaction!.tipo === 'A Receber' ? 'A Receber' : transaction!.tipo === 'A Pagar' ? 'A Pagar' : transaction!.tipo;

    let targetPendingId = transaction!.id;

    if (recebido > 0) {
      // 1. Atualizar Pai
      updateTransaction({
        ...transaction!,
        valor: recebido,
        status: 'Concluído',
        tipo: tipoConcluido,
        updatedAt: Date.now(),
      });
      
      if (diferenca > 0) {
        targetPendingId = crypto.randomUUID();
        addTransaction({
          id: targetPendingId,
          data: dataRestante,
          tipo: tipoRestante,
          categoria: transaction!.categoria,
          descricao: transaction!.descricao.includes('(Restante') 
              ? transaction!.descricao 
              : `${transaction!.descricao} (Restante)`,
          valor: diferenca,
          status: 'Parcial',
          isRepasse: transaction!.isRepasse,
          parentId: transaction!.parentId,
          processId: transaction!.processId,
          originalTotal: transaction!.originalTotal || transaction!.valor,
        });
      }
    } else {
      // Recebido 0 puro adiamento global
      updateTransaction({
        ...transaction!,
        data: dataRestante,
        updatedAt: Date.now(),
      });
    }

    // 2. Processar os Repasses
    for (const r of pendingRepasses) {
        const rpPaid = parseFloat(repasseInputs[r.id]) || 0;
        const rpDiff = parseFloat((r.valor - rpPaid).toFixed(2));
        
        if (rpPaid > 0) {
            updateTransaction({
               ...r,
               valor: rpPaid,
               status: 'Concluído',
               tipo: r.tipo === 'A Pagar' ? 'Saída' : r.tipo,
               data: transaction!.data, 
               parentId: transaction!.id,
               updatedAt: Date.now(),
            });
            
            if (rpDiff > 0) {
               addTransaction({
                 id: crypto.randomUUID(),
                 data: dataRestante,
                 tipo: r.tipo,
                 categoria: r.categoria,
                 descricao: r.descricao.includes('(Restante') ? r.descricao : `${r.descricao} (Restante)`,
                 valor: rpDiff,
                 status: 'Parcial',
                 isRepasse: true,
                 parentId: targetPendingId,
                 originalTotal: r.originalTotal || r.valor,
               });
            }
        } else {
            updateTransaction({
               ...r,
               data: dataRestante,
               parentId: targetPendingId,
               updatedAt: Date.now(),
            });
        }
    }
    
    // 3. Adicionar nota automática no histórico do Processo (se existir)
    if (transaction?.processId) {
      const allP = getProcesses();
      const proc = allP.find(p => p.id === transaction.processId);
      if (proc) {
        const noteText = isParcial 
          ? `💰 Pagamento parcial de R$ ${recebido.toLocaleString('pt-BR')} efetuado em "${transaction.descricao}". Restante de R$ ${diferenca.toLocaleString('pt-BR')}.¹` 
          : `✅ Pagamento integral de R$ ${recebido.toLocaleString('pt-BR')} efetuado em "${transaction.descricao}".¹`;
        const actionNote = { id: crypto.randomUUID(), data: Date.now(), texto: noteText };
        updateProcess({ ...proc, notas: [actionNote, ...(proc.notas || [])], updatedAt: Date.now() });
      }
    }

    if (isParcial) {
      toast.success(`Baixa registrada. Restante (R$ ${diferenca.toFixed(2)}) listado.`);
    } else {
      toast.success('Lançamento concluído com sucesso.');
    }

    onSave();
    onClose();
  }

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-[1.25rem] p-5">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-lg font-bold">Confirmar Valor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
            <p className="text-xs font-semibold text-primary mb-1">Total Previsto</p>
            <p className="text-sm font-black tabular-nums tracking-tight">R$ {transaction.valor.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest truncate">{transaction.descricao}</p>
          </div>

          <div className="space-y-1.5 pt-1">
             <Label className="text-xs uppercase tracking-wide font-bold ml-1 text-foreground/80">Quanto Entrou de Fato?</Label>
             <Input 
               type="number" 
               min="0" 
               step="0.01" 
               className="h-12 text-lg font-bold px-4" 
               value={valorRecebido} 
               onChange={e => setValorRecebido(e.target.value)} 
               placeholder="0,00"
             />
          </div>

          {isParcial && (
             <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
               <div className="flex justify-between items-center bg-muted/40 p-3 rounded-xl border border-border/60">
                 <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Valor Restante:</span>
                 <span className="text-base font-black tabular-nums text-foreground/80">R$ {diferenca.toFixed(2)}</span>
               </div>
               
               <div className="p-1 space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">O Restante Será Pago Em:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      type="button" 
                      variant={restanteDecision === 'manter' ? 'default' : 'outline'} 
                      size="sm" 
                      className={`h-9 text-xs font-semibold tracking-wide ${restanteDecision === 'manter' ? 'shadow-sm text-foreground bg-primary/10 hover:bg-primary/20 hover:text-foreground text-primary' : 'text-muted-foreground'}`} 
                      onClick={() => setRestanteDecision('manter')}
                    >
                      Neste Mês
                    </Button>
                    <Button 
                      type="button" 
                      variant={restanteDecision === 'adiar' ? 'secondary' : 'outline'} 
                      size="sm" 
                      className={`h-9 text-xs font-semibold tracking-wide ${restanteDecision === 'adiar' ? 'shadow-sm text-warning/90 bg-warning/20 hover:bg-warning/30 hover:text-warning' : 'text-muted-foreground'}`} 
                      onClick={() => setRestanteDecision('adiar')}
                    >
                      Mês que Vem
                    </Button>
                  </div>

                  {restanteDecision === 'adiar' && (
                    <div className="space-y-1.5 pt-2 animate-in slide-in-from-top-1 duration-200">
                      <Select value={dataRestante} onValueChange={setDataRestante}>
                        <SelectTrigger className="h-10 text-xs font-bold bg-muted/20">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {monthOptions.map(opt => (
                             <SelectItem key={opt.newDate} value={opt.newDate} className="py-2.5">
                               {opt.label} <span className="opacity-60 font-medium ml-1.5 tabular-nums">({opt.displayDate})</span>
                             </SelectItem>
                           ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
               </div>
             </div>
          )}

          {pendingRepasses.length > 0 && (
            <div className="border border-border/80 rounded-xl p-3.5 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] bg-background">
               <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Repasses Vinculados</Label>
               </div>
               
               <div className="space-y-3">
                  {pendingRepasses.map(rep => (
                    <div key={rep.id} className="flex flex-col gap-2">
                       <div className="flex justify-between items-center text-xs">
                         <span className="font-semibold text-foreground/80 truncate w-[65%]">{rep.descricao}</span>
                         <span className="font-bold tabular-nums text-muted-foreground">Max: R$ {rep.valor.toFixed(2)}</span>
                       </div>
                       <div className="flex items-center gap-3">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Pagar:</span>
                          <Input 
                            type="number" 
                            min="0" 
                            max={rep.valor}
                            step="0.01" 
                            className="h-8 text-xs font-bold tabular-nums bg-accent/20" 
                            value={repasseInputs[rep.id] ?? ''} 
                            onChange={e => handleRepasseChange(rep.id, e.target.value)} 
                          />
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          <Button onClick={handleConfirm} size="lg" className="w-full mt-2 font-bold tracking-wide shadow-md">
            Confirmar Recebimento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
