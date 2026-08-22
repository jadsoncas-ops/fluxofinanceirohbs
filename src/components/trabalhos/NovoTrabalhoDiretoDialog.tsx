import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getClients, updateProcess, registrarEvento } from '@/lib/storage';
import { Process } from '@/lib/types';

const TIPOS_TRABALHO = [
  'Regularização de imóvel', 'Instituição de condomínio', 'Convenção de condomínio',
  'Projeto arquitetônico', 'As Built', 'Vistoria', 'Consultoria', 'Serviço técnico',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  /** Quando informado, o diálogo edita esse trabalho em vez de criar um novo. */
  trabalho?: Process;
}

export function NovoTrabalhoDiretoDialog({ open, onClose, onCreated, trabalho }: Props) {
  const clients = getClients();
  const editando = !!trabalho;
  const [clienteId, setClienteId] = useState('');
  const [objeto, setObjeto] = useState('');
  const [tipoTrabalho, setTipoTrabalho] = useState(TIPOS_TRABALHO[0]);
  const [endereco, setEndereco] = useState('');
  const [valorContrato, setValorContrato] = useState('');
  const [prazo, setPrazo] = useState('');

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
      setClienteId(''); setObjeto(''); setTipoTrabalho(TIPOS_TRABALHO[0]); setEndereco(''); setValorContrato(''); setPrazo('');
    }
  }, [open, trabalho]);

  function handleSave() {
    if (!clienteId) { toast.error('Selecione o cliente.'); return; }
    if (!objeto.trim()) { toast.error('Descreva o trabalho.'); return; }
    const now = Date.now();
    const salvo: Process = {
      ...(trabalho ?? { id: crypto.randomUUID(), status: 'Levantamento', etapa: 'Levantamento', notas: [], createdAt: now }),
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
    toast.success(editando ? 'Trabalho atualizado.' : 'Trabalho criado.');
    onCreated(salvo.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{editando ? 'Editar trabalho' : 'Novo trabalho'}</DialogTitle></DialogHeader>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (opcional)</Label>
              <Input type="number" value={valorContrato} onChange={e => setValorContrato(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo (opcional)</Label>
              <Input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>{editando ? 'Salvar' : 'Criar trabalho'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
