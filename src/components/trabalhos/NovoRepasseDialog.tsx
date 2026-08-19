import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Process } from '@/lib/types';
import { getPartners, addTransaction, registrarEvento } from '@/lib/storage';
import { Link } from 'react-router-dom';

interface ParcelaRepasse {
  descricao: string;
  valor: number;
  data: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  trabalho: Process;
  onCreated: () => void;
}

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Registra um repasse (parcelado ou único) a um Parceiro, vinculado a este Trabalho. Reaproveita o modelo de Transaction existente (isRepasse) — apenas com partnerId. */
export function NovoRepasseDialog({ open, onClose, trabalho, onCreated }: Props) {
  const partners = useMemo(() => getPartners(), [open]);
  const [partnerId, setPartnerId] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [parcelas, setParcelas] = useState<ParcelaRepasse[]>([{ descricao: 'Repasse único', valor: 0, data: todayPlus(0) }]);

  const totalParcelas = parcelas.reduce((s, p) => s + p.valor, 0);

  function addParcela() {
    const n = parcelas.length + 1;
    setParcelas(prev => [...prev, { descricao: `Parcela ${n}`, valor: 0, data: todayPlus(30 * n) }]);
  }

  function updateParcela(i: number, patch: Partial<ParcelaRepasse>) {
    setParcelas(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function removeParcela(i: number) {
    setParcelas(prev => prev.filter((_, idx) => idx !== i));
  }

  function dividirIgualmente() {
    const total = parseFloat(valorTotal.replace(',', '.')) || 0;
    if (!total || parcelas.length === 0) return;
    const cada = Math.round((total / parcelas.length) * 100) / 100;
    setParcelas(prev => prev.map((p, i) => ({ ...p, valor: i === prev.length - 1 ? Math.round((total - cada * (prev.length - 1)) * 100) / 100 : cada })));
  }

  function handleCreate() {
    if (!partnerId) { toast.error('Selecione o parceiro.'); return; }
    if (parcelas.length === 0 || totalParcelas <= 0) { toast.error('Defina ao menos uma parcela com valor.'); return; }
    const partner = partners.find(p => p.id === partnerId)!;

    parcelas.forEach(p => {
      addTransaction({
        id: crypto.randomUUID(),
        data: p.data,
        tipo: 'A Pagar',
        categoria: '🤝 Comissão',
        descricao: `Repasse — ${partner.nome} — ${p.descricao}`,
        valor: p.valor,
        status: 'Pendente',
        isRepasse: true,
        partnerId: partner.id,
        clienteId: trabalho.clienteId,
        processId: trabalho.id,
      });
    });

    registrarEvento({ modulo: 'Financeiro', texto: `${parcelas.length} repasse${parcelas.length > 1 ? 's' : ''} previsto${parcelas.length > 1 ? 's' : ''} para ${partner.nome} — total de ${fmt(totalParcelas)}`, clienteId: trabalho.clienteId, trabalhoId: trabalho.id });
    toast.success('Repasse registrado.');
    onCreated();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo repasse a parceiro</DialogTitle></DialogHeader>

        <div className="space-y-4 py-1">
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum parceiro cadastrado ainda. <Link to="/caixa/parceiros" className="text-accent underline">Cadastre um parceiro</Link> antes de registrar um repasse.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label>Parceiro</Label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger><SelectValue placeholder="Selecione o parceiro" /></SelectTrigger>
                <SelectContent>{partners.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Valor total do repasse (ajuda a dividir igualmente)</Label>
            <Input type="number" value={valorTotal} onChange={e => setValorTotal(e.target.value)} placeholder="0,00" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Parcelas</Label>
              <div className="flex gap-2">
                {parcelas.length > 1 && <button onClick={dividirIgualmente} className="text-[11px] text-accent font-medium">Dividir igualmente</button>}
                <button onClick={addParcela} className="text-[11px] text-accent font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Parcela</button>
              </div>
            </div>
            <div className="space-y-2">
              {parcelas.map((p, i) => {
                const totalRef = parseFloat(valorTotal.replace(',', '.')) || 0;
                return (
                  <div key={i} className="flex gap-2 items-center">
                    <Input value={p.descricao} onChange={e => updateParcela(i, { descricao: e.target.value })} placeholder="Descrição" className="flex-1 h-8 text-xs" />
                    <div className="relative w-16">
                      <Input
                        type="number"
                        value={totalRef > 0 ? Math.round((p.valor / totalRef) * 1000) / 10 || '' : ''}
                        onChange={e => { const pct = Number(e.target.value) || 0; updateParcela(i, { valor: Math.round(totalRef * (pct / 100) * 100) / 100 }); }}
                        placeholder="%"
                        className="h-8 text-xs pr-4"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-mute-3 pointer-events-none">%</span>
                    </div>
                    <Input type="number" value={p.valor || ''} onChange={e => updateParcela(i, { valor: Number(e.target.value) || 0 })} placeholder="Valor" className="w-24 h-8 text-xs" />
                    <Input type="date" value={p.data} onChange={e => updateParcela(i, { data: e.target.value })} className="w-36 h-8 text-xs" />
                    {parcelas.length > 1 && <button onClick={() => removeParcela(i)} className="text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                );
              })}
            </div>
            <div className="text-xs mt-2 font-mono-hbs text-muted-foreground">Total das parcelas: {fmt(totalParcelas)}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={partners.length === 0}>Registrar repasse</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
