import { useMemo, useState } from 'react';
import { Search, FileText, Plus, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDocuments, addDocument, getClients, getProcesses } from '@/lib/storage';
import { DocumentRecord, DocumentSituacao } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TAGS = ['Todos', 'Vigente', 'Pendente', 'Entregue', 'Modelo'] as const;
const SITUACOES: DocumentSituacao[] = ['Vigente', 'Pendente', 'Entregue', 'Modelo'];

const badgeStyle: Record<DocumentSituacao, string> = {
  Vigente: 'bg-success-soft text-success',
  Pendente: 'bg-warning-soft text-warning',
  Entregue: 'bg-accent-soft text-accent',
  Modelo: 'bg-neutral-soft text-mute-2',
};

function extOf(nome: string) {
  const m = nome.match(/\.([a-zA-Z0-9]{2,4})$/);
  return (m ? m[1] : '—').toUpperCase();
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR');
}

export default function DocumentosPage() {
  const [key, setKey] = useState(0);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<(typeof TAGS)[number]>('Todos');
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [clienteId, setClienteId] = useState<string>('');
  const [processId, setProcessId] = useState<string>('');
  const [versao, setVersao] = useState('');
  const [situacao, setSituacao] = useState<DocumentSituacao>('Vigente');
  const [link, setLink] = useState('');

  const clients = useMemo(() => getClients(), [key]);
  const processes = useMemo(() => getProcesses(), [key]);

  const documents = useMemo(() => {
    void key;
    return getDocuments();
  }, [key]);

  const vinculoNome = (d: DocumentRecord) => {
    if (d.processId) {
      const p = processes.find(p => p.id === d.processId);
      if (p) return p.objeto || 'Projeto';
    }
    if (d.clienteId) {
      const c = clients.find(c => c.id === d.clienteId);
      if (c) return c.nome;
    }
    return 'Modelos';
  };

  const filtered = documents.filter(d => {
    if (tag !== 'Todos' && d.situacao !== tag) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!d.nome.toLowerCase().includes(q) && !vinculoNome(d).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function handleSave() {
    if (!nome.trim()) {
      toast.error('Dê um nome ao documento.');
      return;
    }
    addDocument({
      id: crypto.randomUUID(),
      nome: nome.trim(),
      clienteId: clienteId || null,
      processId: processId || null,
      versao: versao.trim() || undefined,
      situacao,
      link: link.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    toast.success('Documento adicionado.');
    setOpen(false);
    setNome(''); setClienteId(''); setProcessId(''); setVersao(''); setSituacao('Vigente'); setLink('');
    setKey(k => k + 1);
  }

  const pendentes = documents.filter(d => d.situacao === 'Pendente').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Documentos</h1>
          <p className="text-[11.5px] text-mute-2 font-mono-hbs mt-0.5">{documents.length} arquivos · {pendentes} pendentes</p>
        </div>
        <Button size="sm" className="gap-1.5 h-9" onClick={() => setOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Enviar documento
        </Button>
      </div>

      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-mute-3" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar documento, cliente ou tag" className="h-9 pl-9 text-[13px] border-2" />
        </div>
        {TAGS.map(t => (
          <button
            key={t}
            onClick={() => setTag(t)}
            className={cn(
              'h-9 px-3 rounded-lg text-[12.5px] border transition-colors',
              tag === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-2 hover:border-hover'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex gap-3.5 px-[18px] py-[11px] border-b border-border bg-surface-2 text-[10.5px] tracking-[.07em] uppercase text-mute-2">
          <span className="flex-[2.2] min-w-0">Documento</span>
          <span className="flex-[1.4] min-w-0">Vínculo</span>
          <span className="w-[90px] flex-none">Versão</span>
          <span className="w-[96px] flex-none">Atualizado</span>
          <span className="w-[86px] flex-none text-right">Situação</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <FileText className="w-8 h-8 mx-auto text-mute-3 mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium">Nenhum documento encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">Envie o primeiro documento vinculado a um cliente ou projeto.</p>
          </div>
        ) : (
          filtered.map(d => (
            <div key={d.id} className="flex gap-3.5 items-center px-[18px] py-3 border-b border-3 last:border-b-0 hover:bg-surface-3 transition-colors">
              <div className="flex-[2.2] min-w-0 flex items-center gap-[11px]">
                <span className="w-[30px] h-[30px] flex-none rounded-md bg-neutral-soft grid place-items-center text-[9.5px] font-mono-hbs text-mute-2">{extOf(d.nome)}</span>
                <span className="text-[12.5px] font-medium truncate">{d.nome}</span>
              </div>
              <span className="flex-[1.4] min-w-0 text-[11.5px] text-mute-2 truncate flex items-center gap-1">
                {vinculoNome(d)}
                {d.link && <a href={d.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}><ExternalLink className="w-3 h-3 text-accent" /></a>}
              </span>
              <span className="w-[90px] flex-none text-[11.5px] font-mono-hbs text-mute-2">{d.versao || '—'}</span>
              <span className="w-[96px] flex-none text-[11.5px] font-mono-hbs text-mute-2">{fmtDate(d.updatedAt)}</span>
              <span className="w-[86px] flex-none text-right">
                <span className={cn('text-[11px] px-[7px] py-[2px] rounded-[5px] font-medium', badgeStyle[d.situacao])}>{d.situacao}</span>
              </span>
            </div>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Enviar documento</DialogTitle></DialogHeader>
          <div className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label>Nome do arquivo</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Contrato de prestação de serviços.pdf" />
            </div>
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Projeto (opcional)</Label>
              <Select value={processId} onValueChange={setProcessId}>
                <SelectTrigger><SelectValue placeholder="Sem projeto" /></SelectTrigger>
                <SelectContent>
                  {processes.filter(p => !clienteId || p.clienteId === clienteId).map(p => <SelectItem key={p.id} value={p.id}>{p.objeto || 'Projeto'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Versão</Label>
                <Input value={versao} onChange={e => setVersao(e.target.value)} placeholder="v1" />
              </div>
              <div className="space-y-1.5">
                <Label>Situação</Label>
                <Select value={situacao} onValueChange={v => setSituacao(v as DocumentSituacao)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SITUACOES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Link (Drive, etc.) — opcional</Label>
              <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
