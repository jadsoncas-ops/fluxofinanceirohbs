import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Landmark, PiggyBank, ArrowDownUp, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getAccounts, addAccount, updateAccount, deleteAccount, registrarMovimentacaoConta, getCompanyConfig, saveCompanyConfig } from '@/lib/storage';
import { Account, AccountType, AccountMovimentacaoTipo } from '@/lib/types';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge } from '@/components/StatusBadge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TIPOS: AccountType[] = ['Conta Corrente', 'Poupança', 'Conta Digital', 'Caixa', 'Investimento'];

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Contas — saldo mantido manualmente pelo usuário, sem conciliação/vínculo automático com
 *  lançamentos (Account.saldo em lib/types.ts). Fase 4F: só apresentação — mesmos dados,
 *  mesmas ações (criar/editar/excluir/marcar reserva), agora com KpiCard/StatusBadge/AlertDialog
 *  do design system HBS 2.0 em vez de markup próprio. */
export default function FinanceiroContasPage() {
  const [key, setKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<AccountType>('Conta Corrente');
  const [saldo, setSaldo] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [movOpen, setMovOpen] = useState(false);
  const [movConta, setMovConta] = useState<Account | null>(null);
  const [movTipo, setMovTipo] = useState<AccountMovimentacaoTipo>('Aporte');
  const [movValor, setMovValor] = useState('');
  const [movData, setMovData] = useState(() => new Date().toISOString().slice(0, 10));
  const [movObservacao, setMovObservacao] = useState('');

  const { accounts, contaReservaId } = useMemo(() => { void key; return { accounts: getAccounts(), contaReservaId: getCompanyConfig().contaReservaId }; }, [key]);
  const refresh = () => setKey(k => k + 1);
  const total = accounts.filter(a => a.ativo).reduce((s, a) => s + a.saldo, 0);

  function alternarContaReserva(a: Account) {
    const config = getCompanyConfig();
    saveCompanyConfig({ ...config, contaReservaId: config.contaReservaId === a.id ? undefined : a.id });
    toast.success(config.contaReservaId === a.id ? 'Conta desmarcada como reserva.' : `"${a.nome}" agora é a conta reserva da empresa.`);
    refresh();
  }

  function openNew() {
    setEditItem(null);
    setNome(''); setTipo('Conta Corrente'); setSaldo(''); setAtivo(true);
    setOpen(true);
  }

  function openEdit(a: Account) {
    setEditItem(a);
    setNome(a.nome); setTipo(a.tipo); setSaldo(String(a.saldo)); setAtivo(a.ativo);
    setOpen(true);
  }

  function handleSave() {
    if (!nome.trim()) { toast.error('Dê um nome para a conta.'); return; }
    const valor = parseFloat(saldo.replace(',', '.')) || 0;
    if (editItem) {
      updateAccount({ ...editItem, nome: nome.trim(), tipo, saldo: valor, ativo });
      toast.success('Conta atualizada.');
    } else {
      addAccount({ id: crypto.randomUUID(), nome: nome.trim(), tipo, saldo: valor, ativo, createdAt: Date.now() });
      toast.success('Conta criada.');
    }
    setOpen(false);
    refresh();
  }

  function openMovimentar(a: Account) {
    setMovConta(a);
    setMovTipo('Aporte');
    setMovValor('');
    setMovData(new Date().toISOString().slice(0, 10));
    setMovObservacao('');
    setMovOpen(true);
  }

  function handleSalvarMovimentacao() {
    if (!movConta) return;
    const valor = parseFloat(movValor.replace(',', '.')) || 0;
    if (valor <= 0) { toast.error('Informe um valor.'); return; }
    if (!movData) { toast.error('Selecione a data.'); return; }
    registrarMovimentacaoConta(movConta.id, movTipo, valor, movData, movObservacao.trim() || undefined);
    toast.success(movTipo === 'Aporte' ? 'Aporte registrado.' : 'Retirada registrada.');
    setMovOpen(false);
    refresh();
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteAccount(deleteTarget.id);
    toast.success('Conta removida.');
    setDeleteTarget(null);
    refresh();
  }

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-semibold">Contas</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5 flex items-center gap-1">
            Bancos, contas digitais e caixa — saldo mantido manualmente por você
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-mute-3 cursor-help flex-none" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px] text-[11.5px]">Marcar uma conta como "reserva" não move dinheiro — é só um rótulo que diz "esse saldo é protegido". A partir daí, o Início mostra separadamente quanto está na reserva e quanto está disponível para retirada (saldo total menos a reserva).</TooltipContent>
            </Tooltip>
          </p>
        </div>
        <button onClick={openNew} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Nova conta
        </button>
      </div>

      <KpiCard label="Dinheiro disponível (contas ativas)" value={fmt(total)} size="hero" />

      {accounts.length === 0 ? (
        <div className="bg-card border border-dash border-2 rounded-xl py-16 text-center">
          <Landmark className="w-8 h-8 mx-auto text-mute-3 mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium">Nenhuma conta cadastrada.</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre suas contas bancárias e caixa para ver quanto dinheiro sua empresa tem disponível de verdade.</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {accounts.map(a => {
            const ehReserva = contaReservaId === a.id;
            return (
              <div key={a.id} className={cn('bg-card border rounded-xl p-[15px_18px]', ehReserva ? 'border-accent' : 'border-border', !a.ativo && 'opacity-50')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-medium truncate">{a.nome}</span>
                      {!a.ativo && <StatusBadge tone="neutral">Inativa</StatusBadge>}
                      {ehReserva && <StatusBadge tone="accent">Reserva</StatusBadge>}
                    </div>
                    <div className="text-[11px] text-mute-2 uppercase tracking-[.05em] mt-0.5">{a.tipo}</div>
                  </div>
                  <div className="flex gap-0.5 flex-none">
                    <button onClick={() => openMovimentar(a)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 transition-colors text-mute-2" title="Registrar aporte ou retirada"><ArrowDownUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => openEdit(a)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 transition-colors text-mute-2" title="Editar conta"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteTarget(a)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive-soft transition-colors text-destructive" title="Excluir conta"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="font-mono-hbs text-[19px] mt-2.5">{fmt(a.saldo)}</div>
                <button
                  onClick={() => alternarContaReserva(a)}
                  className={cn(
                    'flex items-center gap-1.5 text-[10.5px] font-medium mt-2.5 pt-2.5 border-t w-full',
                    ehReserva ? 'border-transparent text-accent' : 'border-border text-mute-2 hover:text-foreground transition-colors'
                  )}
                >
                  <PiggyBank className="w-3 h-3" /> {ehReserva ? 'Remover como conta reserva' : 'Marcar como conta reserva'}
                </button>
                {a.movimentacoes && a.movimentacoes.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-3">
                    <div className="text-[10px] uppercase tracking-[.06em] text-mute-2 mb-1.5">Últimas movimentações</div>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                      {[...a.movimentacoes]
                        .sort((x, y) => y.data.localeCompare(x.data) || y.createdAt - x.createdAt)
                        .map(m => (
                          <div key={m.id} className="flex items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <StatusBadge tone={m.tipo === 'Aporte' ? 'success' : 'warning'}>{m.tipo === 'Aporte' ? '+' : '−'}</StatusBadge>
                              <span className="text-mute-2 truncate">{m.observacao || m.tipo}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-none">
                              <span className="font-mono-hbs">{fmt(m.valor)}</span>
                              <span className="text-mute-3 font-mono-hbs">{new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editItem ? 'Editar conta' : 'Nova conta'}</DialogTitle></DialogHeader>
          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Banco do Brasil" /></div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Saldo atual</Label>
              <Input type="number" step="0.01" value={saldo} onChange={e => setSaldo(e.target.value)} placeholder="0,00" />
              <p className="text-[10.5px] text-mute-3">Corrige o número diretamente, sem data. Para aportes/retiradas do dia a dia, use "Movimentar".</p>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] cursor-pointer pt-1">
              <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="w-3.5 h-3.5 accent-primary" /> Conta ativa
            </label>
          </div>
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="h-9 px-3.5 border-2 rounded-lg text-[12.5px]">Cancelar</button>
            <button onClick={handleSave} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium">{editItem ? 'Salvar' : 'Criar conta'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Movimentar {movConta?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3.5 py-2">
            <div className="flex bg-surface-2 rounded-lg p-1 gap-1 w-fit">
              <button
                type="button"
                onClick={() => setMovTipo('Aporte')}
                className={cn('px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors', movTipo === 'Aporte' ? 'bg-success text-white' : 'text-muted-foreground')}
              >
                Aporte
              </button>
              <button
                type="button"
                onClick={() => setMovTipo('Retirada')}
                className={cn('px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors', movTipo === 'Retirada' ? 'bg-warning text-white' : 'text-muted-foreground')}
              >
                Retirada
              </button>
            </div>
            <div className="space-y-1.5"><Label>Valor</Label><Input type="number" step="0.01" value={movValor} onChange={e => setMovValor(e.target.value)} placeholder="0,00" autoFocus /></div>
            <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={movData} onChange={e => setMovData(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Observação (opcional)</Label><Input value={movObservacao} onChange={e => setMovObservacao(e.target.value)} placeholder="Ex: transferência da conta corrente" /></div>
          </div>
          <DialogFooter>
            <button onClick={() => setMovOpen(false)} className="h-9 px-3.5 border-2 rounded-lg text-[12.5px]">Cancelar</button>
            <button onClick={handleSalvarMovimentacao} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium">Registrar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conta</AlertDialogTitle>
            <AlertDialogDescription>Remover a conta "{deleteTarget?.nome}"? O histórico de lançamentos não é afetado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="w-4 h-4 mr-1.5" /> Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
