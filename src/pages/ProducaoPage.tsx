import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FileStack, Trash2 } from 'lucide-react';
import { getDocuments, getClients, getProcesses, deleteDocument } from '@/lib/storage';
import { DocumentRecord, DocumentSituacao, TipoDocumentoTecnico } from '@/lib/types';
import { DOCUMENT_REGISTRY } from '@/lib/producao/registry';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Aba = 'Em produção' | 'Recentes' | 'Concluídos' | 'Modelos';
const ABAS: Aba[] = ['Em produção', 'Recentes', 'Concluídos', 'Modelos'];

const badgeStyle: Record<DocumentSituacao, string> = {
  Vigente: 'bg-success-soft text-success',
  Pendente: 'bg-warning-soft text-warning',
  Entregue: 'bg-accent-soft text-accent',
  Modelo: 'bg-neutral-soft text-mute-2',
  'Em produção': 'bg-warning-soft text-warning',
  'Em revisão': 'bg-warning-soft text-warning',
  Rascunho: 'bg-neutral-soft text-mute-2',
  Desatualizado: 'bg-destructive-soft text-destructive',
  Concluído: 'bg-success-soft text-success',
};

function extOf(nome: string) {
  const m = nome.match(/\.([a-zA-Z0-9]{2,4})$/);
  return (m ? m[1] : 'DOC').toUpperCase();
}

export default function ProducaoPage() {
  const [aba, setAba] = useState<Aba>('Em produção');
  const [escolhendoTipo, setEscolhendoTipo] = useState<TipoDocumentoTecnico | null>(null);
  const [buscaTrabalho, setBuscaTrabalho] = useState('');
  const [key, setKey] = useState(0);
  const navigate = useNavigate();

  const { documentos, clients, processes } = useMemo(() => {
    void key;
    return { documentos: getDocuments(), clients: getClients(), processes: getProcesses().filter(p => !p.isArchived) };
  }, [key]);

  function removerDocumento(e: React.MouseEvent, id: string, nome: string) {
    e.stopPropagation();
    if (confirm(`Remover "${nome}"?`)) {
      deleteDocument(id);
      toast.success('Documento removido.');
      setKey(k => k + 1);
    }
  }

  const vinculoNome = (d: DocumentRecord) => {
    const clienteId = d.clienteId || processes.find(p => p.id === d.processId)?.clienteId;
    if (clienteId) return clients.find(c => c.id === clienteId)?.nome || 'Cliente';
    if (d.processId) {
      const p = processes.find(p => p.id === d.processId);
      if (p) return p.objeto || 'Trabalho';
    }
    return 'Modelos';
  };

  const filtrados = documentos.filter(d => {
    if (aba === 'Modelos') return d.situacao === 'Modelo';
    if (aba === 'Concluídos') return d.situacao === 'Concluído' || d.situacao === 'Entregue' || d.situacao === 'Vigente';
    if (aba === 'Recentes') return true;
    return d.situacao === 'Em produção' || d.situacao === 'Em revisão' || d.situacao === 'Pendente' || d.situacao === 'Rascunho';
  });

  const contagem = (a: Aba) => documentos.filter(d => {
    if (a === 'Modelos') return d.situacao === 'Modelo';
    if (a === 'Concluídos') return d.situacao === 'Concluído' || d.situacao === 'Entregue' || d.situacao === 'Vigente';
    if (a === 'Recentes') return true;
    return d.situacao === 'Em produção' || d.situacao === 'Em revisão' || d.situacao === 'Pendente' || d.situacao === 'Rascunho';
  }).length;

  function clienteNome(id: string) {
    return clients.find(c => c.id === id)?.nome || 'Cliente';
  }

  const processosFiltrados = processes.filter(p => {
    if (!buscaTrabalho.trim()) return true;
    const q = buscaTrabalho.toLowerCase();
    return (p.objeto || '').toLowerCase().includes(q) || clienteNome(p.clienteId).toLowerCase().includes(q);
  });

  return (
    <div className="space-y-[22px] pb-10 animate-hbs-in">
      <div>
        <h1 className="text-2xl font-semibold -tracking-[.02em]">Central de produção</h1>
        <p className="text-[13px] text-muted-foreground mt-1 max-w-[640px]">Toda a documentação técnica da HBS é produzida aqui. Escolha uma ferramenta, selecione o trabalho e o documento sai pronto para revisão.</p>
      </div>

      <section>
        <div className="text-[16px] font-semibold mb-3">O que você quer produzir?</div>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(268px, 1fr))' }}>
          {DOCUMENT_REGISTRY.map(f => (
            <div key={f.slug} className={cn('bg-card border border-border rounded-[10px] p-4 flex flex-col', !f.disponivel && 'opacity-60')}>
              <span className="text-[10px] uppercase tracking-[.07em] text-mute-2">{f.grupo}</span>
              <div className="text-[14px] font-semibold mt-1.5">{f.icon} {f.label}</div>
              <p className="text-[12px] text-muted-foreground mt-1.5 leading-[1.5] flex-1">{f.descricao}</p>
              <div className="flex items-center justify-between mt-3.5">
                <span className="text-[11px] font-mono-hbs text-mute-2">{f.disponivel ? 'Disponível' : 'Em desenvolvimento'}</span>
                <button
                  onClick={() => f.disponivel && setEscolhendoTipo(f.slug)}
                  disabled={!f.disponivel}
                  className="h-[31px] px-3 rounded-lg border-2 text-[12px] font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  Criar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex gap-1 px-3 pt-3 border-b border-border">
          {ABAS.map(a => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={cn(
                'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                aba === a ? 'text-foreground border-foreground' : 'text-muted-foreground border-transparent hover:text-foreground'
              )}
            >
              {a} <span className="font-mono-hbs text-[11px] text-mute-3">({contagem(a)})</span>
            </button>
          ))}
        </div>

        {filtrados.length === 0 ? (
          <div className="py-14 text-center">
            <FileStack className="w-8 h-8 mx-auto text-mute-3 mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium">{aba === 'Concluídos' ? 'Nenhum documento concluído ainda.' : 'Nada por aqui ainda.'}</p>
            <p className="text-xs text-muted-foreground mt-1">{aba === 'Concluídos' ? 'Quando você finalizar uma revisão, o documento aparece aqui com data e versão.' : 'Escolha uma ferramenta acima para começar.'}</p>
          </div>
        ) : (
          filtrados.map(d => (
            <div
              key={d.id}
              onClick={() => d.tipoTecnico && d.processId && navigate(`/producao/${d.processId}/${d.tipoTecnico}`)}
              className={cn('group flex items-center gap-3 px-[18px] py-3 border-t border-3 hover:bg-surface-3 transition-colors', d.tipoTecnico && d.processId && 'cursor-pointer')}
            >
              <span className="w-[31px] h-[31px] flex-none rounded-[7px] bg-neutral-soft grid place-items-center text-[9.5px] font-mono-hbs text-mute-2">{extOf(d.nome)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium truncate">{d.nome}</div>
                <div className="text-[11px] text-mute-2">{vinculoNome(d)}</div>
              </div>
              <span className="text-[11px] font-mono-hbs text-mute-2 flex-none">{new Date(d.updatedAt).toLocaleDateString('pt-BR')}</span>
              <span className={cn('flex-none text-[11px] px-2 py-[3px] rounded-[5px] font-medium', badgeStyle[d.situacao])}>{d.situacao}</span>
              <button onClick={e => removerDocumento(e, d.id, d.nome)} className="opacity-0 group-hover:opacity-100 transition-opacity text-mute-3 hover:text-destructive flex-none">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </section>

      <Dialog open={!!escolhendoTipo} onOpenChange={v => { if (!v) { setEscolhendoTipo(null); setBuscaTrabalho(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Para qual trabalho?</DialogTitle>
          </DialogHeader>
          {processes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum trabalho cadastrado ainda. Crie um trabalho primeiro em Trabalhos.</p>
          ) : (
            <>
              <Input value={buscaTrabalho} onChange={e => setBuscaTrabalho(e.target.value)} placeholder="Buscar por trabalho ou cliente" className="h-9 text-[13px]" autoFocus />
              <div className="max-h-[360px] overflow-y-auto -mx-1 px-1 space-y-1.5">
                {processosFiltrados.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">Nenhum trabalho encontrado.</p>
                ) : (
                  processosFiltrados.map(p => (
                    <button
                      key={p.id}
                      onClick={() => escolhendoTipo && navigate(`/producao/${p.id}/${escolhendoTipo}`)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 hover:border-hover hover:bg-surface-3 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-mute-2 flex-none" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-medium truncate">{p.objeto}</div>
                        <div className="text-[11px] text-mute-2">{clienteNome(p.clienteId)}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
