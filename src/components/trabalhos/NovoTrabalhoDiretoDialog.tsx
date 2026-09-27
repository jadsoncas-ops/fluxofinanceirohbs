import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getClients, getPartners, updateProcess, registrarEvento, addTransactions } from '@/lib/storage';
import { Client, Process, Transaction, CATEGORIAS_ENTRADA } from '@/lib/types';
import { cn } from '@/lib/utils';

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface RepasseInput {
  partnerId: string;
  valor: string;
}

const TIPOS_TRABALHO = [
  'Regularização de imóvel', 'Instituição de condomínio', 'Convenção de condomínio',
  'Projeto arquitetônico', 'As Built', 'Vistoria', 'Consultoria', 'Serviço técnico',
];

function enderecoDoCliente(cliente: Client | undefined): string {
  if (!cliente?.endereco) return '';
  return [cliente.endereco.rua, cliente.endereco.numero, cliente.endereco.bairro, cliente.endereco.cidade, cliente.endereco.estado]
    .filter(Boolean).join(', ');
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  /** Quando informado, o diálogo edita esse trabalho em vez de criar um novo. */
  trabalho?: Process;
  /** Pré-seleciona o cliente ao criar (ex.: logo após cadastrar um cliente novo). Ignorado ao editar. */
  clienteIdInicial?: string;
}

export function NovoTrabalhoDiretoDialog({ open, onClose, onCreated, trabalho, clienteIdInicial }: Props) {
  const clients = getClients();
  const partners = getPartners();
  const editando = !!trabalho;
  const [clienteId, setClienteId] = useState('');
  const [objeto, setObjeto] = useState('');
  const [tipoTrabalho, setTipoTrabalho] = useState(TIPOS_TRABALHO[0]);
  const [endereco, setEndereco] = useState('');
  const [valorContrato, setValorContrato] = useState('');
  const [prazo, setPrazo] = useState('');
  const [usarEnderecoCliente, setUsarEnderecoCliente] = useState(false);
  const [repasses, setRepasses] = useState<RepasseInput[]>([]);

  useEffect(() => {
    if (!open) return;
    if (trabalho) {
      setClienteId(trabalho.clienteId);
      setObjeto(trabalho.objeto);
      setTipoTrabalho(trabalho.tipoTrabalho || TIPOS_TRABALHO[0]);
      setEndereco(trabalho.endereco || '');
      setValorContrato(trabalho.valorContrato != null ? String(trabalho.valorContrato) : '');
      setPrazo(trabalho.prazo || '');
    } else {
      setClienteId(clienteIdInicial || ''); setObjeto(''); setTipoTrabalho(TIPOS_TRABALHO[0]); setEndereco(''); setValorContrato(''); setPrazo('');
    }
    setUsarEnderecoCliente(false);
    setRepasses([]);
  }, [open, trabalho, clienteIdInicial]);

  const clienteSelecionado = clients.find(c => c.id === clienteId);
  const enderecoCliente = enderecoDoCliente(clienteSelecionado);

  useEffect(() => {
    if (usarEnderecoCliente && enderecoCliente) setEndereco(enderecoCliente);
  }, [usarEnderecoCliente, enderecoCliente]);

  function addRepasseRow() {
    setRepasses(prev => [...prev, { partnerId: '', valor: '' }]);
  }
  function updateRepasseRow(i: number, patch: Partial<RepasseInput>) {
    setRepasses(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRepasseRow(i: number) {
    setRepasses(prev => prev.filter((_, idx) => idx !== i));
  }

  const valorContratoNum = Number(valorContrato) || 0;
  const totalRepasses = repasses.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const lucroPrevisto = valorContratoNum - totalRepasses;

  function handleSave() {
    if (!clienteId) { toast.error('Selecione o cliente.'); return; }
    if (!objeto.trim()) { toast.error('Descreva o trabalho.'); return; }
    const now = Date.now();
    const salvo: Process = {
      ...(trabalho ?? { id: crypto.randomUUID(), status: 'Levantamento', etapa: 'Elaboração', notas: [], createdAt: now }),
      clienteId,
      objeto: objeto.trim(),
      tipoTrabalho,
      endereco: endereco.trim() || undefined,
      valorContrato: valorContrato ? Number(valorContrato) : undefined,
      prazo: prazo || undefined,
      updatedAt: now,
    };
    updateProcess(salvo);
    registrarEvento({
      modulo: 'Trabalhos',
      texto: editando ? `Trabalho "${salvo.objeto}" editado` : `Trabalho "${salvo.objeto}" criado`,
      clienteId, trabalhoId: salvo.id,
    });

    const avisos: string[] = [];

    // Só na criação: o valor do contrato e os repasses viram lançamentos reais na hora, em vez
    // de precisar de uma segunda visita ao Trabalho pra "Registrar como a receber"/"Novo repasse".
    // a Vista, com vencimento no prazo informado (ou hoje, se não tiver prazo) — quem precisar de
    // parcelamento de verdade ainda usa "Registrar recebimento" depois, isso aqui só cobre o caso
    // simples (a maioria).
    if (!editando) {
      const dataLancamento = prazo || new Date().toISOString().slice(0, 10);
      const novasTransacoes: Transaction[] = [];

      if (valorContratoNum > 0) {
        novasTransacoes.push({
          id: crypto.randomUUID(),
          data: dataLancamento,
          tipo: 'A Receber',
          categoria: CATEGORIAS_ENTRADA[0],
          descricao: salvo.objeto,
          valor: valorContratoNum,
          status: 'Pendente',
          isRepasse: false,
          clienteId,
          processId: salvo.id,
        });
        registrarEvento({
          modulo: 'Financeiro',
          texto: `Recebimento previsto para ${clienteSelecionado?.nome || 'cliente'} — ${fmt(valorContratoNum)}`,
          clienteId, trabalhoId: salvo.id,
        });
        avisos.push(`${fmt(valorContratoNum)} a receber`);
      }

      const repassesValidos = repasses.filter(r => r.partnerId && Number(r.valor) > 0);
      repassesValidos.forEach(r => {
        const valorRepasse = Number(r.valor);
        const partner = partners.find(p => p.id === r.partnerId);
        novasTransacoes.push({
          id: crypto.randomUUID(),
          data: dataLancamento,
          tipo: 'A Pagar',
          categoria: '🤝 Comissão',
          descricao: `Repasse — ${partner?.nome || 'Parceiro'} — ${salvo.objeto}`,
          valor: valorRepasse,
          status: 'Pendente',
          isRepasse: true,
          partnerId: r.partnerId,
          clienteId,
          processId: salvo.id,
        });
        registrarEvento({
          modulo: 'Financeiro',
          texto: `Repasse previsto para ${partner?.nome || 'parceiro'} — ${fmt(valorRepasse)}`,
          clienteId, trabalhoId: salvo.id,
        });
      });
      if (repassesValidos.length > 0) avisos.push(`${fmt(totalRepasses)} repassado${repassesValidos.length > 1 ? 's' : ''}`);

      if (novasTransacoes.length > 0) addTransactions(novasTransacoes);
    }

    toast.success(editando ? 'Trabalho atualizado.' : 'Trabalho criado.', editando ? undefined : {
      description: avisos.length > 0
        ? `Já registrado: ${avisos.join(' · ')}.`
        : 'Agora você pode acompanhar a execução, gerar documentos técnicos e organizar o financeiro dele.',
    });
    onCreated(salvo.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{editando ? 'Editar trabalho' : 'Novo trabalho'}</DialogTitle></DialogHeader>
        {!editando && (
          <p className="text-[11.5px] text-mute-2 -mt-2">
            {clienteIdInicial
              ? 'Cliente cadastrado. Continue criando o primeiro Trabalho dele agora, ou cancele para pular esta etapa.'
              : 'Trabalho é o serviço técnico que a HBS presta para este cliente — a partir dele você organiza etapa, produção técnica e financeiro.'}
          </p>
        )}
        <div className="space-y-3.5 py-1">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            {editando ? (
              <div className="h-9 px-3 flex items-center rounded-lg border-2 text-[13px] text-muted-foreground bg-surface-2">
                {clients.find(c => c.id === clienteId)?.nome || '—'}
              </div>
            ) : (
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipoTrabalho} onValueChange={setTipoTrabalho}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS_TRABALHO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição do trabalho</Label>
            <Input value={objeto} onChange={e => setObjeto(e.target.value)} placeholder="Ex: Regularização — Rua Ipê 320" />
          </div>
          <div className="space-y-1.5">
            <Label>Endereço do imóvel (opcional)</Label>
            <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade - UF" />
            {enderecoCliente && (
              <label className="flex items-center gap-2 text-[11.5px] text-muted-foreground bg-surface-2 border border-3 rounded-lg px-2.5 py-2 cursor-pointer">
                <input type="checkbox" checked={usarEnderecoCliente} onChange={e => setUsarEnderecoCliente(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
                Usar o endereço já cadastrado do cliente ({enderecoCliente})
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (opcional)</Label>
              <Input type="number" value={valorContrato} onChange={e => setValorContrato(e.target.value)} placeholder="0,00" />
              {!editando && valorContratoNum > 0 && (
                <p className="text-[10.5px] text-mute-2">Já registra como a receber, vencimento {prazo ? new Date(prazo + 'T12:00:00').toLocaleDateString('pt-BR') : 'hoje'}.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Prazo (opcional)</Label>
              <Input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
            </div>
          </div>

          {!editando && partners.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-3">
              <div className="flex items-center justify-between">
                <Label>Repasse a parceiro (opcional)</Label>
                <button type="button" onClick={addRepasseRow} className="text-[11px] text-accent font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Repasse</button>
              </div>
              {repasses.map((r, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={r.partnerId} onValueChange={v => updateRepasseRow(i, { partnerId: v })}>
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Parceiro" /></SelectTrigger>
                    <SelectContent>{partners.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" value={r.valor} onChange={e => updateRepasseRow(i, { valor: e.target.value })} placeholder="Valor" className="w-24 h-8 text-xs" />
                  <button type="button" onClick={() => removeRepasseRow(i)} className="text-destructive p-1 flex-none"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {(valorContratoNum > 0 || totalRepasses > 0) && (
                <div className="flex items-center justify-between text-[11.5px] pt-1">
                  <span className="text-muted-foreground">Lucro líquido previsto</span>
                  <span className={cn('font-mono-hbs font-medium', lucroPrevisto < 0 ? 'text-destructive' : 'text-success')}>{fmt(lucroPrevisto)}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>{editando ? 'Salvar' : 'Criar trabalho'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
