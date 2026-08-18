import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Send, ArrowRight, Printer, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Proposta, PropostaStatus, Contrato } from '@/lib/types';
import { getClients, getContratos, getPropostas, updateProposta, deleteProposta, deleteContrato, registrarEvento } from '@/lib/storage';
import { aprovarPropostaEGerarContrato } from '@/lib/comercial/fluxo';
import { formatBRL } from '@/lib/comercial/precificacao';
import { NovoTrabalhoDialog } from './NovoTrabalhoDialog';
import { NovaPropostaDialog } from './NovaPropostaDialog';
import { cn } from '@/lib/utils';

interface Props {
  propostaId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

const statusBadge: Record<PropostaStatus, string> = {
  Rascunho: 'bg-neutral-soft text-mute-2',
  Enviada: 'bg-accent-soft text-accent',
  'Em aprovação': 'bg-warning-soft text-warning',
  Aprovada: 'bg-success-soft text-success',
  Perdida: 'bg-destructive-soft text-destructive',
};

export function PropostaDetailDialog({ propostaId, onClose, onChanged }: Props) {
  const navigate = useNavigate();
  const [key, setKey] = useState(0);
  const [novoTrabalhoOpen, setNovoTrabalhoOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<'proposta' | 'contrato' | null>(null);

  const { proposta, cliente, contrato } = useMemo(() => {
    void key;
    if (!propostaId) return { proposta: null, cliente: null, contrato: null };
    const p: Proposta | undefined = getPropostas().find((x: Proposta) => x.id === propostaId);
    if (!p) return { proposta: null, cliente: null, contrato: null };
    const cliente = getClients().find(c => c.id === p.clienteId) || null;
    const contrato = getContratos().find(c => c.propostaId === p.id) || null;
    return { proposta: p, cliente, contrato };
  }, [propostaId, key]);

  if (!proposta) return null;

  function setStatus(status: PropostaStatus) {
    updateProposta({ ...proposta!, status, enviadaEm: status === 'Enviada' ? Date.now() : proposta!.enviadaEm, updatedAt: Date.now() });
    registrarEvento({ modulo: 'Comercial', texto: `Proposta ${proposta!.codigo} marcada como ${status.toLowerCase()}`, clienteId: proposta!.clienteId, propostaId: proposta!.id });
    setKey(k => k + 1);
    onChanged();
  }

  function handleAprovar() {
    aprovarPropostaEGerarContrato(proposta!);
    toast.success('Proposta aprovada e contrato gerado.');
    setKey(k => k + 1);
    onChanged();
  }

  function handleDeleteProposta() {
    registrarEvento({ modulo: 'Comercial', texto: `Proposta ${proposta!.codigo} excluída`, clienteId: proposta!.clienteId });
    deleteProposta(proposta!.id);
    toast.success('Proposta excluída.');
    setDeleteConfirm(null);
    onChanged();
    onClose();
  }

  function handleDeleteContrato() {
    if (!contrato) return;
    registrarEvento({ modulo: 'Comercial', texto: `Contrato ${contrato.codigo} excluído`, clienteId: proposta!.clienteId, propostaId: proposta!.id });
    deleteContrato(contrato.id);
    toast.success('Contrato excluído.');
    setDeleteConfirm(null);
    setKey(k => k + 1);
    onChanged();
  }

  return (
    <>
      <Dialog open={!!propostaId && !editOpen} onOpenChange={v => !v && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <DialogTitle>{proposta.codigo} · {proposta.titulo}</DialogTitle>
              <span className={cn('text-[11px] px-2 py-[3px] rounded-[5px] font-medium', statusBadge[proposta.status])}>{proposta.status}</span>
            </div>
          </DialogHeader>

          <div className="flex gap-2">
            <button
              onClick={() => { onClose(); navigate(`/comercial/propostas/${proposta.id}/imprimir`); }}
              className="flex-1 h-9 rounded-lg border-2 text-[12.5px] font-medium hover:border-hover transition-colors flex items-center justify-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
            </button>
            {!contrato && (
              <>
                <button onClick={() => setEditOpen(true)} className="h-9 px-3 rounded-lg border-2 text-[12.5px] font-medium hover:border-hover transition-colors flex items-center justify-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => setDeleteConfirm('proposta')} className="h-9 px-3 rounded-lg border-2 text-[12.5px] font-medium text-destructive hover:border-destructive transition-colors flex items-center justify-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="text-[13px] text-muted-foreground">
              Cliente: <button onClick={() => { onClose(); navigate(`/clientes/${proposta.clienteId}`); }} className="text-accent font-medium hover:underline">{cliente?.nome || 'Cliente'}</button>
            </div>

            <div className="space-y-1.5">
              {proposta.itens.map(item => (
                <div key={item.etapaId} className="flex justify-between text-[12.5px]">
                  <span>{item.nome}</span>
                  <span className="text-mute-2 font-mono-hbs">{item.visitas}v + {item.horas}h</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border p-4 bg-surface-2 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Custo total</span><span className="font-mono-hbs">{formatBRL(proposta.resultado.custoTotal)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Margem ({proposta.lucroPercent}%)</span><span className="font-mono-hbs">{formatBRL(proposta.resultado.lucro)}</span></div>
              <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-3"><span>Valor da proposta</span><span className="font-mono-hbs text-success">{formatBRL(proposta.resultado.precoVenda)}</span></div>
            </div>

            {proposta.parcelasPagamento && proposta.parcelasPagamento.length > 0 && (
              <div className="rounded-xl border border-border p-4 space-y-1.5">
                <div className="text-[11px] uppercase tracking-[.07em] text-mute-2 mb-1">Condições de pagamento</div>
                {proposta.parcelasPagamento.map((p, i) => (
                  <div key={i} className="flex justify-between text-[12.5px]">
                    <span>{p.descricao}</span>
                    <span className="font-mono-hbs">{formatBRL(p.valor)}</span>
                  </div>
                ))}
              </div>
            )}

            {contrato ? (
              <div className="rounded-xl border border-border p-4 space-y-2.5">
                <div className="text-[13px] font-semibold flex items-center gap-2">Contrato {contrato.codigo} <span className="text-[11px] px-2 py-[2px] rounded-[5px] bg-success-soft text-success font-medium">{contrato.status}</span></div>
                <div className="text-[12px] text-muted-foreground">Valor: <span className="font-mono-hbs text-foreground">{formatBRL(contrato.valor)}</span></div>
                {contrato.trabalhoId ? (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => { onClose(); navigate(`/trabalhos/${contrato.trabalhoId}`); }}>Ver trabalho <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Button>
                ) : (
                  <>
                    <Button size="sm" className="w-full" onClick={() => setNovoTrabalhoOpen(true)}>Criar Trabalho</Button>
                    <Button size="sm" variant="ghost" className="w-full gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm('contrato')}><Trash2 className="w-3.5 h-3.5" /> Excluir contrato</Button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {proposta.status === 'Rascunho' && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setStatus('Enviada')}><Send className="w-3.5 h-3.5" /> Marcar como enviada</Button>
                )}
                {(proposta.status === 'Rascunho' || proposta.status === 'Enviada' || proposta.status === 'Em aprovação') && (
                  <>
                    <Button size="sm" className="gap-1.5" onClick={handleAprovar}><CheckCircle2 className="w-3.5 h-3.5" /> Aprovar e gerar contrato</Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setStatus('Perdida')}><XCircle className="w-3.5 h-3.5" /> Marcar como perdida</Button>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <NovaPropostaDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setKey(k => k + 1); onChanged(); }}
        editItem={proposta}
      />

      <NovoTrabalhoDialog
        open={novoTrabalhoOpen}
        onClose={() => setNovoTrabalhoOpen(false)}
        onCreated={(trabalhoId) => { setKey(k => k + 1); onChanged(); onClose(); navigate(`/trabalhos/${trabalhoId}`); }}
        contrato={contrato}
        proposta={proposta}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteConfirm === 'contrato' ? 'Excluir contrato' : 'Excluir proposta'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm === 'contrato'
                ? `Tem certeza que deseja excluir o contrato ${contrato?.codigo}? A proposta continua existindo, mas volta a ficar sem contrato.`
                : `Tem certeza que deseja excluir a proposta ${proposta.codigo}? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteConfirm === 'contrato' ? handleDeleteContrato : handleDeleteProposta} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
