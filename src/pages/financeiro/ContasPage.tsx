import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Wallet, Edit, Trash2, Landmark } from 'lucide-react';
import { getAccounts, addAccount, updateAccount, deleteAccount } from '@/lib/storage';
import { Account, AccountType } from '@/lib/types';
import { toast } from 'sonner';

const TIPOS: AccountType[] = ['Conta Corrente', 'Poupança', 'Conta Digital', 'Caixa', 'Investimento'];

export default function FinanceiroContasPage() {
  const [key, setKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Account | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<AccountType>('Conta Corrente');
  const [saldo, setSaldo] = useState('');
  const [ativo, setAtivo] = useState(true);

  const accounts = useMemo(() => { void key; return getAccounts(); }, [key]);
  const refresh = () => setKey(k => k + 1);
  const total = accounts.filter(a => a.ativo).reduce((s, a) => s + a.saldo, 0);

  function openNew() {
    setEditItem(null);
    setNome('');
    setTipo('Conta Corrente');
    setSaldo('');
    setAtivo(true);
    setOpen(true);
  }

  function openEdit(a: Account) {
    setEditItem(a);
    setNome(a.nome);
    setTipo(a.tipo);
    setSaldo(String(a.saldo));
    setAtivo(a.ativo);
    setOpen(true);
  }

  function handleSave() {
    if (!nome.trim()) {
      toast.error('Dê um nome para a conta.');
      return;
    }
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight">Contas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Bancos, contas digitais e caixa — saldo mantido manualmente por você</p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5 font-bold rounded-lg">
          <Plus className="w-4 h-4" /> Nova Conta
        </Button>
      </div>

      <Card className="rounded-2xl border-primary/30 bg-primary/5">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10"><Wallet className="w-5 h-5 text-primary" /></div>
            <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Dinheiro disponível (contas ativas)</span>
          </div>
          <span className="text-2xl font-black tabular-nums text-primary">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </CardContent>
      </Card>

      {accounts.length === 0 ? (
        <Card className="border-border/40 shadow-none bg-muted/20">
          <CardContent className="p-10 text-center text-muted-foreground flex flex-col items-center">
            <div className="bg-primary/5 p-4 rounded-full mb-4"><Landmark className="w-10 h-10 text-primary/40" /></div>
            <p className="text-sm font-bold uppercase tracking-wide">Nenhuma conta cadastrada</p>
            <p className="text-xs mt-1.5 mb-5 opacity-80 max-w-xs leading-relaxed">Cadastre suas contas bancárias e caixa para ver quanto dinheiro sua empresa tem disponível de verdade.</p>
            <Button variant="outline" size="sm" onClick={openNew} className="rounded-full font-semibold text-primary border-primary/20 bg-primary/5">+ Cadastrar Primeira Conta</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map(a => (
            <Card key={a.id} className={`border-border/60 rounded-2xl ${!a.ativo ? 'opacity-50' : ''}`}>
              <CardContent className="p-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm truncate">{a.nome}</span>
                    {!a.ativo && <span className="text-[9px] font-black uppercase bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">Inativa</span>}
                  </div>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{a.tipo}</span>
                  <div className="text-xl font-black tabular-nums mt-1">R$ {a.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}><Edit className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(a)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Banco do Brasil" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Saldo atual</Label>
              <Input type="number" step="0.01" value={saldo} onChange={e => setSaldo(e.target.value)} placeholder="0,00" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Label htmlFor="ativo-switch" className="cursor-pointer">Conta ativa</Label>
              <Switch id="ativo-switch" checked={ativo} onCheckedChange={setAtivo} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editItem ? 'Salvar' : 'Criar Conta'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
