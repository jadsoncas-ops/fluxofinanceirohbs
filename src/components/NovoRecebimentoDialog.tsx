import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIAS_ENTRADA, Process } from '@/lib/types';
import { getClients, getProcesses, addTransaction, registrarEvento } from '@/lib/storage';

interface ParcelaInput {
  descricao: string;
  valor: number;
  data: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Quando informado, trava cliente e trabalho neste Trabalho — usado ao abrir a partir da ficha do Trabalho. */
  trabalhoFixo?: Process;
  /** Quando informado (sem trabalhoFixo), pré-seleciona o cliente mas deixa o trabalho livre — usado ao abrir a partir da ficha do Cliente. */
  clienteIdInicial?: string;
}

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Novo recebimento — único ou parcelado em N vezes, cada parcela com data própria. Cada parcela vira um Transaction 'A Receber' independente, e aparece em Próximos compromissos assim que estiver dentro de 15 dias. */
export function NovoRecebimentoDialog({ open, onClose, onCreated, trabalhoFixo, clienteIdInicial }: Props) {
  const clients = useMemo(() => getClients(), [open]);
  const [clienteId, setClienteId] = useState(trabalhoFixo?.clienteId || clienteIdInicial || '');
  const trabalhosDoCliente = useMemo(() => getProcesses().filter(p => !p.isArchived && p.clienteId === clienteId), [clienteId]);
  const [trabalhoId, setTrabalhoId] = useState(trabalhoFixo?.id || '');
  const [descricaoBase, setDescricaoBase] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS_ENTRADA[0]);
  const [modo, setModo] = useState<'unico' | 'parcelado'>('unico');
  const [valorTotal, setValorTotal] = useState('');
  const [parcelas, setParcelas] = useState<ParcelaInput[]>([{ descricao: '', valor: 0, data: todayPlus(0) }]);

  useEffect(() => {
    if (!open) return;
    setClienteId(trabalhoFixo?.clienteId || clienteIdInicial || '');
    setTrabalhoId(trabalhoFixo?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trabalhoFixo?.id, clienteIdInicial]);

  const totalParcelas = parcelas.reduce((s, p) => s + p.valor, 0);

  function resetParaModo(novoModo: 'unico' | 'parcelado') {
    setModo(novoModo);
    if (novoModo === 'unico') {
      setParcelas([{ descricao: '', valor: parseFloat(valorTotal.replace(',', '.')) || 0, data: todayPlus(0) }]);
    }
  }

  function definirQuantidade(qtd: number) {
    const total = parseFloat(valorTotal.replace(',', '.')) || 0;
    const cada = qtd > 0 ? Math.round((total / qtd) * 100) / 100 : 0;
    const novas: ParcelaInput[] = Array.from({ length: qtd }, (_, i) => ({
      descricao: i === 0 ? 'Entrada' : `Parcela ${i + 1}`,
      valor: i === qtd - 1 ? Math.round((total - cada * (qtd - 1)) * 100) / 100 : cada,
      data: todayPlus(30 * i),
    }));
    setParcelas(novas);
  }

  function updateParcela(i: number, patch: Partial<ParcelaInput>) {
    setParcelas(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function addParcela() {
    const n = parcelas.length + 1;
    setParcelas(prev => [...prev, { descricao: `Parcela ${n}`, valor: 0, data: todayPlus(30 * (n - 1)) }]);
  }

  function removeParcela(i: number) {
    setParcelas(prev => prev.filter((_, idx) => idx !== i));
  }

  function dividirIgualmente() {
    const total = parseFloat(valorTotal.replace(',', '.')) || totalParcelas;
    if (!total || parcelas.length === 0) return;
    const cada = Math.round((total / parcelas.length) * 100) / 100;
    setParcelas(prev => prev.map((p, i) => ({ ...p, valor: i === prev.length - 1 ? Math.round((total - cada * (prev.length - 1)) * 100) / 100 : cada })));
  }

  function reset() {
    setClienteId(trabalhoFixo?.clienteId || clienteIdInicial || ''); setTrabalhoId(trabalhoFixo?.id || ''); setDescricaoBase(''); setCategoria(CATEGORIAS_ENTRADA[0]);
    setModo('unico'); setValorTotal(''); setParcelas([{ descricao: '', valor: 0, data: todayPlus(0) }]);
  }

  function handleCreate() {
    if (!clienteId) { toast.error('Selecione o cliente.'); return; }
    if (!descricaoBase.trim()) { toast.error('Descreva o recebimento.'); return; }
    const parcelasValidas = parcelas.filter(p => p.valor > 0);
    if (parcelasValidas.length === 0) { toast.error('Defina ao menos uma parcela com valor.'); return; }

    const cliente = clients.find(c => c.id === clienteId)!;
    const isParcelado = modo === 'parcelado' && parcelasValidas.length > 1;

    parcelasValidas.forEach((p, i) => {
      addTransaction({
        id: crypto.randomUUID(),
        data: p.data,
        tipo: 'A Receber',
        categoria,
        descricao: isParcelado ? `${descricaoBase} — ${p.descricao || `Parcela ${i + 1}`}` : descricaoBase,
        valor: p.valor,
        status: 'Pendente',
        isRepasse: false,
        clienteId,
        processId: trabalhoId || undefined,
      });
    });

    registrarEvento({
      modulo: 'Financeiro',
      texto: isParcelado
        ? `${parcelasValidas.length} parcelas previstas para ${cliente.nome} — total de ${fmt(totalParcelas)}`
        : `Recebimento previsto para ${cliente.nome} — ${fmt(parcelasValidas[0].valor)}`,
      clienteId,
      trabalhoId: trabalhoId || undefined,
    });

    toast.success(isParcelado ? 'Recebimento parcelado registrado.' : 'Recebimento registrado.');
    onCreated();
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && (reset(), onClose())}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{trabalhoFixo ? `Novo recebimento — ${trabalhoFixo.objeto}` : 'Novo recebimento'}</DialogTitle></DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              {trabalhoFixo ? (
                <div className="h-10 px-3 rounded-lg border-2 bg-surface-2 text-[13px] flex items-center text-muted-foreground">{clients.find(c => c.id === clienteId)?.nome || '—'}</div>
              ) : (
                <Select value={clienteId} onValueChange={v => { setClienteId(v); setTrabalhoId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Trabalho</Label>
              {trabalhoFixo ? (
                <div className="h-10 px-3 rounded-lg border-2 bg-surface-2 text-[13px] flex items-center text-muted-foreground truncate">{trabalhoFixo.objeto}</div>
              ) : (
                <Select value={trabalhoId} onValueChange={setTrabalhoId} disabled={!clienteId || trabalhosDoCliente.length === 0}>
                  <SelectTrigger><SelectValue placeholder={trabalhosDoCliente.length === 0 ? 'Nenhum trabalho' : 'Selecione (opcional)'} /></SelectTrigger>
                  <SelectContent>{trabalhosDoCliente.map(p => <SelectItem key={p.id} value={p.id}>{p.objeto}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={descricaoBase} onChange={e => setDescricaoBase(e.target.value)} placeholder="Ex: Projeto Residencial Duplex — Regularização" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS_ENTRADA.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor total (R$)</Label>
              <Input type="number" value={valorTotal} onChange={e => { setValorTotal(e.target.value); if (modo === 'unico') updateParcela(0, { valor: parseFloat(e.target.value.replace(',', '.')) || 0 }); }} placeholder="0,00" />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Pagamento</Label>
            <div className="flex bg-surface-2 p-1 rounded-xl border border-3 w-fit">
              <button onClick={() => resetParaModo('unico')} className={`px-3.5 py-[7px] rounded-lg text-[12.5px] font-medium transition-colors ${modo === 'unico' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Único</button>
              <button onClick={() => resetParaModo('parcelado')} className={`px-3.5 py-[7px] rounded-lg text-[12.5px] font-medium transition-colors ${modo === 'parcelado' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Parcelado</button>
            </div>
          </div>

          {modo === 'parcelado' && (
            <div className="space-y-1.5">
              <Label>Quantidade de parcelas</Label>
              <div className="flex gap-2">
                {[2, 3, 4, 6, 12].map(n => (
                  <button key={n} onClick={() => definirQuantidade(n)} className="h-8 px-3 rounded-lg border-2 text-[12px] font-medium hover:border-hover transition-colors">{n}x</button>
                ))}
                <Input type="number" min={2} placeholder="outro" className="h-8 w-20 text-xs" onChange={e => { const n = parseInt(e.target.value); if (n > 1) definirQuantidade(n); }} />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Parcelas</Label>
              {modo === 'parcelado' && (
                <div className="flex gap-2">
                  {parcelas.length > 1 && <button onClick={dividirIgualmente} className="text-[11px] text-accent font-medium">Dividir igualmente</button>}
                  <button onClick={addParcela} className="text-[11px] text-accent font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Parcela</button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {parcelas.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  {modo === 'parcelado' && <Input value={p.descricao} onChange={e => updateParcela(i, { descricao: e.target.value })} placeholder="Descrição" className="flex-1 h-8 text-xs" />}
                  <Input type="number" value={p.valor || ''} onChange={e => updateParcela(i, { valor: Number(e.target.value) || 0 })} placeholder="Valor" className={`h-8 text-xs ${modo === 'parcelado' ? 'w-24' : 'flex-1'}`} />
                  <Input type="date" value={p.data} onChange={e => updateParcela(i, { data: e.target.value })} className="w-36 h-8 text-xs" />
                  {modo === 'parcelado' && parcelas.length > 1 && <button onClick={() => removeParcela(i)} className="text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
            </div>
            {modo === 'parcelado' && <div className="text-xs mt-2 font-mono-hbs text-muted-foreground">Total das parcelas: {fmt(totalParcelas)}</div>}
          </div>

          <p className="text-[11px] text-mute-2">Cada parcela vira um lançamento próprio e aparece em "Próximos compromissos" no Início a partir de 15 dias antes do vencimento.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleCreate}>Registrar recebimento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
