import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Pencil, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Transaction } from '@/lib/types';
import { getClients, getProcesses, getPartners, deleteTransaction } from '@/lib/storage';
import { dataEfetiva } from '@/lib/financials';
import { isIncome, statusLabel, irmaosDoGrupo } from '@/lib/lancamentos';
import { useShell } from '@/hooks/use-shell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ValorMonetario } from '@/components/ValorMonetario';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtData(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

const STATUS_TONE: Record<string, BadgeTone> = {
  Recebido: 'success',
  Pago: 'success',
  'A receber': 'warning',
  'A pagar': 'warning',
};

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
}

/** Painel de detalhe de um lançamento — reutilizado por Movimentações (e, nas próximas fases,
 *  por A Receber/A Pagar). Só leitura + atalhos pras ações que já existiam espalhadas pela
 *  lista (editar/excluir/registrar recebimento/ver trabalho); nenhuma regra financeira nova. */
export function DetalheLancamentoDialog({ transaction, onClose }: Props) {
  const shell = useShell();
  const navigate = useNavigate();
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const clientes = useMemo(() => getClients(), []);
  const processos = useMemo(() => getProcesses(), []);
  const partners = useMemo(() => getPartners(), []);

  const irmaos = useMemo(() => (transaction ? irmaosDoGrupo(transaction, shell.allTransactions) : []), [transaction, shell.allTransactions]);
  const grupoCompleto = useMemo(() => (transaction ? [...irmaos, transaction].sort((a, b) => dataEfetiva(a).localeCompare(dataEfetiva(b))) : []), [transaction, irmaos]);
  const isParcelado = irmaos.length > 0;

  if (!transaction) return null;

  const income = isIncome(transaction);
  const cliente = transaction.clienteId ? clientes.find(c => c.id === transaction.clienteId) : undefined;
  const trabalho = transaction.processId ? processos.find(p => p.id === transaction.processId) : undefined;
  const parceiro = transaction.partnerId ? partners.find(p => p.id === transaction.partnerId) : undefined;
  const pendente = transaction.status !== 'Concluído';
  const vinculado = !!transaction.processId;

  const valorOriginal = grupoCompleto.reduce((max, t) => Math.max(max, t.originalTotal || 0), 0) || grupoCompleto.reduce((s, t) => s + t.valor, 0);
  const recebidoGrupo = grupoCompleto.filter(t => t.status === 'Concluído').reduce((s, t) => s + t.valor, 0);
  const restanteGrupo = grupoCompleto.filter(t => t.status !== 'Concluído').reduce((s, t) => s + t.valor, 0);

  function handleExcluir() {
    if (!transaction) return;
    deleteTransaction(transaction.id);
    toast.success('Lançamento excluído.');
    setConfirmarExclusao(false);
    shell.refresh();
    onClose();
  }

  return (
    <>
      <Dialog open={!!transaction} onOpenChange={v => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Detalhe do lançamento</DialogTitle>
          </DialogHeader>

          <div className={cn('font-mono-hbs text-[26px] font-semibold', income ? 'text-success' : 'text-destructive')}>
            {income ? '+ ' : '− '}<ValorMonetario value={fmt(transaction.valor)} />
          </div>
          <div className="text-[14px] font-medium -mt-2">{transaction.descricao}</div>

          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge tone={STATUS_TONE[statusLabel(transaction)] || 'neutral'} size="md">{statusLabel(transaction)}</StatusBadge>
            {transaction.isRepasse && <StatusBadge tone="accent" size="md">🤝 Repasse</StatusBadge>}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px] pt-1 border-t border-3">
            <div>
              <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2">Vencimento</div>
              <div className="mt-0.5">{fmtData(transaction.data)}</div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2">Data efetiva</div>
              <div className="mt-0.5">{transaction.dataConclusao ? fmtData(dataEfetiva(transaction)) : '—'}</div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2">Categoria</div>
              <div className="mt-0.5 truncate">{transaction.categoria}</div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2">Cliente</div>
              <div className="mt-0.5 truncate">{cliente?.nome || 'Sem cliente'}</div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2">Trabalho</div>
              <div className="mt-0.5 truncate">{trabalho?.objeto || '—'}</div>
            </div>
            {parceiro && (
              <div>
                <div className="text-[10.5px] uppercase tracking-[.06em] text-mute-2">Parceiro</div>
                <div className="mt-0.5 truncate">{parceiro.nome}</div>
              </div>
            )}
          </div>

          {isParcelado && (
            <div className="border-t border-3 pt-3">
              <div className="text-[11.5px] font-semibold mb-2">Histórico financeiro</div>
              <div className="bg-surface-2 rounded-lg p-3 space-y-1.5 text-[12px]">
                <div className="flex items-center justify-between"><span className="text-mute-2">Valor original</span><span className="font-mono-hbs">{fmt(valorOriginal)}</span></div>
                <div className="flex items-center justify-between"><span className="text-mute-2">Recebido</span><span className="font-mono-hbs text-success">{fmt(recebidoGrupo)}</span></div>
                {restanteGrupo > 0 && <div className="flex items-center justify-between"><span className="text-mute-2">Restante</span><span className="font-mono-hbs text-warning">{fmt(restanteGrupo)}</span></div>}
              </div>
              <div className="mt-2 space-y-1">
                {grupoCompleto.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-[11.5px] px-1">
                    <span className="text-mute-2">{t.status === 'Concluído' ? 'Recebido' : 'Vencimento'} · {fmtData(dataEfetiva(t))}</span>
                    <span className="font-mono-hbs">{fmt(t.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-3 flex-wrap">
            {vinculado && (
              <button onClick={() => { navigate(`/trabalhos/${transaction.processId}`); onClose(); }} className="h-8 px-3 rounded-lg border-2 text-[12px] font-medium hover:border-hover transition-colors flex items-center gap-1.5">
                Ver trabalho <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {pendente && (
              <button onClick={() => { shell.openCompleteTransaction(transaction); onClose(); }} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> {income ? 'Registrar recebimento' : 'Registrar pagamento'}
              </button>
            )}
            {!vinculado && (
              <>
                <button onClick={() => { shell.openEditTransaction(transaction); onClose(); }} className="h-8 px-3 rounded-lg border-2 text-[12px] font-medium hover:border-hover transition-colors flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => setConfirmarExclusao(true)} className="h-8 px-3 rounded-lg border-2 text-[12px] font-medium text-destructive hover:bg-destructive-soft transition-colors flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </button>
              </>
            )}
            <div className="flex-1" />
            <button onClick={onClose} className="h-8 px-3 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors">Fechar</button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
