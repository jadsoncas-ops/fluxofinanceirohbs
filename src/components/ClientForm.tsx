import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Client } from '@/lib/types';
import { addClient, updateClient } from '@/lib/storage';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (client?: Client) => void;
  editItem?: Client | null;
}

export function ClientForm({ open, onClose, onSave, editItem }: Props) {
  const [nome, setNome] = useState('');
  const [ddd, setDdd] = useState('');
  const [numero, setNumero] = useState('');
  const [rua, setRua] = useState('');
  const [numEnd, setNumEnd] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [descricao, setDescricao] = useState('');

  useEffect(() => {
    if (editItem) {
      setNome(editItem.nome);
      setDdd(editItem.telefone?.ddd || '');
      setNumero(editItem.telefone?.numero || '');
      setRua(editItem.endereco?.rua || '');
      setNumEnd(editItem.endereco?.numero || '');
      setBairro(editItem.endereco?.bairro || '');
      setCidade(editItem.endereco?.cidade || '');
      setEstado(editItem.endereco?.estado || '');
      setDescricao(editItem.descricao || '');
    } else {
      setNome(''); setDdd(''); setNumero(''); setRua(''); setNumEnd(''); setBairro(''); setCidade(''); setEstado(''); setDescricao('');
    }
  }, [editItem, open]);

  function handleSave() {
    if (!nome) {
      toast.error('Preencha pelo menos o nome do cliente.');
      return;
    }

    const clearNumber = (str: string) => str.replace(/\D/g, '');

    const clientData: Client = {
      id: editItem ? editItem.id : crypto.randomUUID(),
      nome,
      telefone: (ddd || numero) ? { ddd: clearNumber(ddd), numero: clearNumber(numero) } : null,
      endereco: (rua || numEnd || bairro || cidade || estado) ? { rua, numero: numEnd, bairro, cidade, estado } : null,
      descricao: descricao || null,
      createdAt: editItem ? editItem.createdAt : Date.now()
    };

    if (editItem) {
      updateClient(clientData);
      toast.success('Cliente atualizado com sucesso.');
    } else {
      addClient(clientData);
      toast.success('Cliente cadastrado com sucesso.');
    }
    onSave(clientData);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
           <div className="space-y-1.5">
             <Label className="text-xs">Nome / Empresa *</Label>
             <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João Silva ou Construtora B" />
           </div>
           
           <div className="grid grid-cols-4 gap-3">
             <div className="col-span-1 space-y-1.5">
               <Label className="text-xs">DDD</Label>
               <Input value={ddd} onChange={e => setDdd(e.target.value)} placeholder="73" maxLength={2} />
             </div>
             <div className="col-span-3 space-y-1.5">
               <Label className="text-xs">Celular / WhatsApp</Label>
               <Input value={numero} onChange={e => setNumero(e.target.value)} placeholder="999999999" maxLength={10} />
             </div>
           </div>

           <div className="space-y-2 border border-border/50 p-3 rounded-lg bg-muted/20">
             <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Endereço (Opcional)</Label>
             <div className="grid grid-cols-4 gap-2">
                <div className="col-span-3">
                   <Input value={rua} onChange={e => setRua(e.target.value)} placeholder="Rua / Avenida" className="text-xs h-8" />
                </div>
                <div className="col-span-1">
                   <Input value={numEnd} onChange={e => setNumEnd(e.target.value)} placeholder="Nº" className="text-xs h-8" />
                </div>
             </div>
             <div className="grid grid-cols-3 gap-2">
                <Input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro" className="text-xs h-8" />
                <Input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade" className="text-xs h-8" />
                <Input value={estado} onChange={e => setEstado(e.target.value)} placeholder="UF" maxLength={2} className="text-xs h-8 uppercase" />
             </div>
           </div>

           <div className="space-y-1.5">
             <Label className="text-xs">Observações / Descrição</Label>
             <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Obra no Bairro Y, Contrato Z" />
           </div>

           <Button onClick={handleSave} className="w-full">
              {editItem ? 'Guardar Alterações' : 'Cadastrar Cliente'}
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
