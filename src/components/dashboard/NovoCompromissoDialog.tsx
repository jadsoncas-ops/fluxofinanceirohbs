import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getClients, addCompromisso, updateCompromisso, deleteCompromisso } from '@/lib/storage';
import { Compromisso, CORES_COMPROMISSO } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Quando informado, o diálogo edita esse compromisso em vez de criar um novo. */
  compromisso?: Compromisso;
  /** Data pré-selecionada ao criar (ex.: dia clicado no widget da semana). */
  dataInicial?: string;
}

export function NovoCompromissoDialog({ open, onClose, compromisso, dataInicial }: Props) {
  const clients = getClients();
  const editando = !!compromisso;
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [comQuem, setComQuem] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [cor, setCor] = useState('roxo');

  useEffect(() => {
    if (!open) return;
    if (compromisso) {
      setTitulo(compromisso.titulo);
      setData(compromisso.data);
      setHoraInicio(compromisso.horaInicio || '');
      setHoraFim(compromisso.horaFim || '');
      setComQuem(compromisso.comQuem || '');
      setClienteId(compromisso.clienteId || '');
      setCor(compromisso.cor);
    } else {
      setTitulo(''); setData(dataInicial || new Date().toISOString().slice(0, 10));
      setHoraInicio(''); setHoraFim(''); setComQuem(''); setClienteId(''); setCor('roxo');
    }
  }, [open, compromisso, dataInicial]);

  function handleSave() {
    if (!titulo.trim()) { toast.error('Descreva o compromisso.'); return; }
    if (!data) { toast.error('Selecione a data.'); return; }
    const now = Date.now();
    const salvo: Compromisso = {
      ...(compromisso ?? { id: crypto.randomUUID(), createdAt: now }),
      titulo: titulo.trim(),
      data,
      horaInicio: horaInicio || undefined,
      horaFim: horaFim || undefined,
      comQuem: comQuem.trim() || undefined,
      clienteId: clienteId || null,
      cor,
      updatedAt: now,
    };
    if (editando) updateCompromisso(salvo);
    else addCompromisso(salvo);
    toast.success(editando ? 'Compromisso atualizado.' : 'Compromisso criado.');
    onClose();
  }

  function handleDelete() {
    if (!compromisso) return;
    if (!confirm('Excluir este compromisso?')) return;
    deleteCompromisso(compromisso.id);
    toast.success('Compromisso excluído.');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{editando ? 'Editar compromisso' : 'Novo compromisso'}</DialogTitle></DialogHeader>
        <div className="space-y-3.5 py-1">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Reunião de alinhamento" autoFocus />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Com quem (opcional)</Label>
            <Input value={comQuem} onChange={e => setComQuem(e.target.value)} placeholder="Nome de quem participa" />
          </div>
          <div className="space-y-1.5">
            <Label>Cliente vinculado (opcional)</Label>
            <Select value={clienteId || '__none'} onValueChange={v => setClienteId(v === '__none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhum</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex items-center gap-2">
              {Object.entries(CORES_COMPROMISSO).map(([nome, hsl]) => (
                <button
                  key={nome}
                  type="button"
                  onClick={() => setCor(nome)}
                  title={nome}
                  className={cn('w-6 h-6 rounded-full flex-none transition-all', cor === nome && 'ring-2 ring-offset-2 ring-foreground')}
                  style={{ backgroundColor: `hsl(${hsl})` }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex items-center sm:justify-between">
          {editando ? (
            <button onClick={handleDelete} className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave}>{editando ? 'Salvar' : 'Criar compromisso'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
