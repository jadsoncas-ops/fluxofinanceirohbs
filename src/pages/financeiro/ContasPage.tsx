import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Wallet, Pencil, Trash2, Landmark, PiggyBank } from 'lucide-react';
import { getAccounts, addAccount, updateAccount, deleteAccount, getCompanyConfig, saveCompanyConfig } from '@/lib/storage';
import { Account, AccountType } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TIPOS: AccountType[] = ['Conta Corrente', 'Poupança', 'Conta Digital', 'Caixa', 'Investimento'];

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FinanceiroContasPage() {
  const [key, setKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Account | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<AccountType>('Conta Corrente');
  const [saldo, setSaldo] = useState('');
  const [ativo, setAtivo] = useState(true);

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

  function handleDelete(a: Account) {
    if (confirm(`Remover a conta "${a.nome}"? O histórico de lançamentos não é afetado.`)) {
      deleteAccount(a.id);
      toast.success('Conta removida.');
      refresh();
    }
  }

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-semibold">Contas</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">Bancos, contas digitais e caixa — saldo mantido manualmente por você</p>
        </div>
        <button onClick={openNew} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Nova conta
        </button>
      </div>

      <div className="bg-primary text-primary-foreground rounded-xl p-[18px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 grid place-items-center"><Wallet className="w-4.5 h-4.5" /></div>
          <span className="text-[12.5px] font-medium uppercase tracking-[.05em] text-white/70">Dinheiro disponível (contas ativas)</span>
        </div>
        <span className="font-mono-hbs text-[22px]">{fmt(total)}</span>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium truncate">{a.nome}</span>
                      {!a.ativo && <span className="text-[9.5px] uppercase font-medium bg-neutral-soft text-mute-2 px-1.5 py-[1px] rounded-[4px]">Inativa</span>}
                    </div>
                    <div className="text-[11px] text-mute-2 uppercase tracking-[.05em] mt-0.5">{a.tipo}</div>
                  </div>
                  <div className="flex gap-0.5 flex-none">
                    <button onClick={() => openEdit(a)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 transition-colors text-mute-2"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(a)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive-soft transition-colors text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
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
                  <PiggyBank className="w-3 h-3" /> {ehReserva ? 'Conta reserva da empresa' : 'Marcar como conta reserva'}
                </button>
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
            <div className="space-y-1.5"><Label>Saldo atual</Label><Input type="number" step="0.01" value={saldo} onChange={e => setSaldo(e.target.value)} placeholder="0,00" /></div>
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
    </div>
  );
}
