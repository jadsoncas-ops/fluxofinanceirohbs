import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Contrato } from '@/lib/types';
import { getProcesses, getPropostas } from '@/lib/storage';
import { excluirContrato } from '@/lib/comercial/fluxo';

interface Props {
  contrato: Contrato | null;
  onClose: () => void;
  onDeleted: () => void;
}

/** Confirma e exclui um contrato — com ou sem trabalho criado. Diz com todas as letras o que é apagado e o que continua. */
export function ExcluirContratoDialog({ contrato, onClose, onDeleted }: Props) {
  const trabalho = contrato?.trabalhoId ? getProcesses().find(p => p.id === contrato.trabalhoId) : undefined;
  const proposta = contrato ? getPropostas().find(p => p.id === contrato.propostaId) : undefined;
  const lancamentos = contrato ? contrato.parcelas.filter(p => p.transactionId).length : 0;

  function confirmar() {
    if (!contrato) return;
    excluirContrato(contrato, proposta);
    toast.success(`Contrato ${contrato.codigo} excluído.`, proposta ? { description: `A proposta ${proposta.codigo} voltou para "Em aprovação" — dá para gerar o contrato de novo.` } : undefined);
    onDeleted();
    onClose();
  }

  return (
    <AlertDialog open={!!contrato} onOpenChange={v => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir contrato {contrato?.codigo}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>O contrato (valor, parcelas e contratantes adicionais) será excluído.</p>
              {trabalho && (
                <p>
                  O trabalho <strong className="text-foreground font-medium">"{trabalho.objeto}"</strong>
                  {lancamentos === 1 ? ' e o lançamento financeiro já criado' : lancamentos > 1 ? ` e os ${lancamentos} lançamentos financeiros já criados` : ''}{' '}
                  <strong className="text-foreground font-medium">{lancamentos > 0 ? 'continuam' : 'continua'}</strong> — só {lancamentos > 0 ? 'deixam' : 'deixa'} de estar ligado{lancamentos > 0 ? 's' : ''} a este contrato.
                </p>
              )}
              {proposta && <p>A proposta {proposta.codigo} volta para "Em aprovação", e você poderá gerar o contrato de novo.{trabalho ? ' Um contrato novo não se liga sozinho a este trabalho: "Criar trabalho" criaria outro.' : ''}</p>}
              <p>Esta ação não pode ser desfeita.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir contrato</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
