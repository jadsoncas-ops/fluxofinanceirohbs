import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Contrato, Proposta } from '@/lib/types';
import { criarTrabalhoDoContrato, ParcelaInput } from '@/lib/comercial/fluxo';

const TIPOS_TRABALHO = [
  'Regularização de imóvel', 'Instituição de condomínio', 'Convenção de condomínio',
  'Projeto arquitetônico', 'As Built', 'Vistoria', 'Consultoria', 'Serviço técnico',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (trabalhoId: string) => void;
  contrato: Contrato | null;
  proposta: Proposta | null;
}

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function NovoTrabalhoDialog({ open, onClose, onCreated, contrato, proposta }: Props) {
  const [tipoTrabalho, setTipoTrabalho] = useState(TIPOS_TRABALHO[0]);
  const [endereco, setEndereco] = useState('');
  const [prazo, setPrazo] = useState(todayPlus(30));
  const [parcelas, setParcelas] = useState<ParcelaInput[]>([]);

  // A proposta já vem com as parcelas que o cliente negociou (descrição + valor,
  // sem data — isso só se define na hora de virar trabalho). Antes o usuário tinha
  // que redigitar tudo aqui do zero; agora só ajusta as datas se precisar.
  useEffect(() => {
    if (!open) return;
    if (proposta?.parcelasPagamento && proposta.parcelasPagamento.length > 0) {
      setParcelas(proposta.parcelasPagamento.map((p, i) => ({ descricao: p.descricao, valor: p.valor, vencimento: todayPlus(30 * (i + 1)) })));
    } else {
      setParcelas([]);
    }
  }, [open, proposta]);

  if (!contrato || !proposta) return null;

  const totalParcelas = parcelas.reduce((s, p) => s + p.valor, 0);
  const diferenca = Math.round((contrato.valor - totalParcelas) * 100) / 100;

  function addParcela() {
    const n = parcelas.length + 1;
    setParcelas(prev => [...prev, { descricao: n === 1 ? 'Entrada' : `Parcela ${n}`, valor: 0, vencimento: todayPlus(30 * n) }]);
  }

  function updateParcela(i: number, patch: Partial<ParcelaInput>) {
    setParcelas(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function removeParcela(i: number) {
    setParcelas(prev => prev.filter((_, idx) => idx !== i));
  }

  function preencherIgualmente() {
    if (parcelas.length === 0) return;
    const cada = Math.round((contrato.valor / parcelas.length) * 100) / 100;
    setParcelas(prev => prev.map((p, i) => ({ ...p, valor: i === prev.length - 1 ? Math.round((contrato.valor - cada * (prev.length - 1)) * 100) / 100 : cada })));
  }

  function handleCreate() {
    if (parcelas.length === 0) {
      toast.error('Defina ao menos uma parcela (pode ser o valor cheio à vista).');
      return;
    }
    if (Math.abs(diferenca) > 0.01) {
      toast.error(`As parcelas somam R$ ${totalParcelas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, mas o contrato é de R$ ${contrato.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
      return;
    }
    const trabalho = criarTrabalhoDoContrato(contrato.id, proposta, { tipoTrabalho, endereco: endereco || undefined, prazo, parcelas });
    toast.success(`Trabalho "${trabalho.objeto}" criado.`);
    onCreated(trabalho.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Criar trabalho a partir do contrato {contrato.codigo}</DialogTitle></DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg bg-surface-2 border border-3 p-3 text-[12.5px]">
            <div className="font-medium">{proposta.titulo}</div>
            <div className="text-mute-2 mt-0.5">Valor do contrato: <span className="font-mono-hbs">R$ {contrato.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo do trabalho</Label>
              <Select value={tipoTrabalho} onValueChange={setTipoTrabalho}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_TRABALHO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prazo de entrega</Label>
              <Input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Endereço (opcional)</Label>
            <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Condições de pagamento</Label>
              <div className="flex gap-2">
                {parcelas.length > 1 && <button onClick={preencherIgualmente} className="text-[11px] text-accent font-medium">Dividir igualmente</button>}
                <button onClick={addParcela} className="text-[11px] text-accent font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Parcela</button>
              </div>
            </div>
            <div className="space-y-2">
              {parcelas.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={p.descricao} onChange={e => updateParcela(i, { descricao: e.target.value })} placeholder="Descrição" className="flex-1 h-8 text-xs" />
                  <Input type="number" value={p.valor || ''} onChange={e => updateParcela(i, { valor: Number(e.target.value) || 0 })} placeholder="Valor" className="w-24 h-8 text-xs" />
                  <Input type="date" value={p.vencimento} onChange={e => updateParcela(i, { vencimento: e.target.value })} className="w-36 h-8 text-xs" />
                  <button onClick={() => removeParcela(i)} className="text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {parcelas.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma parcela definida ainda.</p>}
            </div>
            <div className={`text-xs mt-2 font-mono-hbs ${Math.abs(diferenca) > 0.01 ? 'text-destructive' : 'text-success'}`}>
              Total: R$ {totalParcelas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {Math.abs(diferenca) > 0.01 && `(faltam R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleCreate}>Criar trabalho</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
