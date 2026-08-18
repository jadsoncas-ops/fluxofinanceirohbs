import { useMemo, useState } from 'react';
import { Plus, Users, Pencil, Trash2 } from 'lucide-react';
import { getPartners, addPartner, updatePartner, deletePartner, getTransactions } from '@/lib/storage';
import { Partner } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FinanceiroParceirosPage() {
  const [key, setKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Partner | null>(null);
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [contato, setContato] = useState('');
  const [observacao, setObservacao] = useState('');

  const { partners, historicoPorParceiro } = useMemo(() => {
    void key;
    const partners = getPartners();
    const txs = getTransactions().filter(t => t.isRepasse && t.partnerId);
    const historicoPorParceiro = new Map<string, { pago: number; previsto: number; count: number }>();
    txs.forEach(t => {
      const acc = historicoPorParceiro.get(t.partnerId!) || { pago: 0, previsto: 0, count: 0 };
      if (t.status === 'Concluído') acc.pago += t.valor; else acc.previsto += t.valor;
      acc.count += 1;
      historicoPorParceiro.set(t.partnerId!, acc);
    });
    return { partners, historicoPorParceiro };
  }, [key]);

  const refresh = () => setKey(k => k + 1);

  function openNew() {
    setEditItem(null);
    setNome(''); setDocumento(''); setContato(''); setObservacao('');
    setOpen(true);
  }

  function openEdit(p: Partner) {
    setEditItem(p);
    setNome(p.nome); setDocumento(p.documento || ''); setContato(p.contato || ''); setObservacao(p.observacao || '');
    setOpen(true);
  }

  function handleSave() {
    if (!nome.trim()) { toast.error('Dê um nome para o parceiro.'); return; }
    if (editItem) {
      updatePartner({ ...editItem, nome: nome.trim(), documento: documento.trim() || null, contato: contato.trim() || null, observacao: observacao.trim() || null });
      toast.success('Parceiro atualizado.');
    } else {
      addPartner({ id: crypto.randomUUID(), nome: nome.trim(), documento: documento.trim() || null, contato: contato.trim() || null, observacao: observacao.trim() || null, createdAt: Date.now() });
      toast.success('Parceiro cadastrado.');
    }
    setOpen(false);
    refresh();
  }

  function handleDelete(p: Partner) {
    if (confirm(`Remover o parceiro "${p.nome}"? O histórico de repasses já feitos não é afetado.`)) {
      deletePartner(p.id);
      toast.success('Parceiro removido.');
      refresh();
    }
  }

  return (
    <div className="space-y-[18px] pb-10 animate-hbs-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-semibold">Parceiros</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">Quem recebe repasses da HBS — comissionados, indicadores, prestadores terceirizados</p>
        </div>
        <button onClick={openNew} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Novo parceiro
        </button>
      </div>

      {partners.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <Users className="w-8 h-8 mx-auto text-mute-3 mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium">Nenhum parceiro cadastrado ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre para controlar repasses vinculados a um Trabalho.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex gap-3.5 px-[18px] py-[11px] border-b border-border bg-surface-2 text-[10.5px] tracking-[.07em] uppercase text-mute-2">
            <span className="flex-[2] min-w-0">Parceiro</span>
            <span className="flex-1 min-w-0">Contato</span>
            <span className="flex-1 min-w-0 text-right">Repassado / Previsto</span>
            <span className="w-[70px] flex-none"></span>
          </div>
          {partners.map(p => {
            const h = historicoPorParceiro.get(p.id);
            return (
              <div key={p.id} className="flex gap-3.5 items-center px-[18px] py-[13px] border-t border-3">
                <div className="flex-[2] min-w-0">
                  <div className="text-[13px] font-medium truncate">{p.nome}</div>
                  {p.documento && <div className="text-[11px] text-mute-2">{p.documento}</div>}
                </div>
                <div className="flex-1 min-w-0 text-[12px] text-muted-foreground truncate">{p.contato || '—'}</div>
                <div className="flex-1 min-w-0 text-right font-mono-hbs text-[12px]">
                  <span className="text-success">{fmt(h?.pago || 0)}</span>
                  {h && h.previsto > 0 && <span className="text-mute-3"> / {fmt(h.previsto)}</span>}
                  {!h && <span className="text-mute-3">Sem repasses ainda</span>}
                </div>
                <div className="w-[70px] flex-none flex justify-end gap-1">
                  <button onClick={() => openEdit(p)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 transition-colors text-mute-2"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(p)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive-soft transition-colors text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editItem ? 'Editar parceiro' : 'Novo parceiro'}</DialogTitle></DialogHeader>
          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo ou razão social" /></div>
            <div className="space-y-1.5"><Label>CPF/CNPJ</Label><Input value={documento} onChange={e => setDocumento(e.target.value)} placeholder="Opcional" /></div>
            <div className="space-y-1.5"><Label>Contato</Label><Input value={contato} onChange={e => setContato(e.target.value)} placeholder="Telefone ou e-mail" /></div>
            <div className="space-y-1.5"><Label>Observação</Label><Input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Opcional" /></div>
          </div>
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="h-9 px-3.5 border-2 rounded-lg text-[12.5px]">Cancelar</button>
            <button onClick={handleSave} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium">{editItem ? 'Salvar' : 'Cadastrar'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
