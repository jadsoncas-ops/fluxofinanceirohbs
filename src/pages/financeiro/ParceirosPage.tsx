import { useMemo, useState } from 'react';
import { Plus, Users, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { getPartners, addPartner, updatePartner, deletePartner, getClients, getProcesses } from '@/lib/storage';
import { Partner, Transaction } from '@/lib/types';
import { dataEfetiva } from '@/lib/financials';
import { useShell } from '@/hooks/use-shell';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge } from '@/components/StatusBadge';
import { DetalheLancamentoDialog } from '@/components/financeiro/DetalheLancamentoDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Parceiros — quem recebe repasse (isRepasse) vinculado a um Trabalho. Repassado/Previsto
 *  somados a partir de shell.monthTransactions (mesmo seletor de período do cabeçalho do
 *  Shell, já visível acima desta página — showMonthFilter em AppShell.tsx inclui
 *  /caixa/parceiros). Fase 4F: só apresentação — mesmos cálculos, mesmo drilldown por parceiro,
 *  agora com KpiCard/StatusBadge/AlertDialog do design system, e cada repasse do drilldown abre
 *  o DetalheLancamentoDialog já usado no resto do Financeiro em vez de ficar sem ação. */
export default function FinanceiroParceirosPage() {
  const shell = useShell();
  const [key, setKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Partner | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [contato, setContato] = useState('');
  const [observacao, setObservacao] = useState('');
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Transaction | null>(null);

  const clientes = useMemo(() => getClients(), []);
  const processos = useMemo(() => getProcesses(), []);

  const { partners, historicoPorParceiro, txsPorParceiro, totais } = useMemo(() => {
    void key;
    const partners = getPartners();
    const txs = shell.monthTransactions.filter(t => t.isRepasse && t.partnerId);
    const historicoPorParceiro = new Map<string, { pago: number; previsto: number; count: number }>();
    const txsPorParceiro = new Map<string, typeof txs>();
    txs.forEach(t => {
      const acc = historicoPorParceiro.get(t.partnerId!) || { pago: 0, previsto: 0, count: 0 };
      if (t.status === 'Concluído') acc.pago += t.valor; else acc.previsto += t.valor;
      acc.count += 1;
      historicoPorParceiro.set(t.partnerId!, acc);
      txsPorParceiro.set(t.partnerId!, [...(txsPorParceiro.get(t.partnerId!) || []), t]);
    });
    txsPorParceiro.forEach(lista => lista.sort((a, b) => dataEfetiva(b).localeCompare(dataEfetiva(a))));
    let pago = 0, previsto = 0;
    historicoPorParceiro.forEach(h => { pago += h.pago; previsto += h.previsto; });
    return { partners, historicoPorParceiro, txsPorParceiro, totais: { pago, previsto } };
  }, [key, shell.monthTransactions]);

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

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deletePartner(deleteTarget.id);
    toast.success('Parceiro removido.');
    setDeleteTarget(null);
    refresh();
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border border border-border rounded-xl overflow-hidden">
        <KpiCard label="Repassado no período" value={fmt(totais.pago)} size="hero" tone="success" />
        <KpiCard label="Previsto no período" value={fmt(totais.previsto)} size="hero" tone="warning" />
      </div>

      {partners.length === 0 ? (
        <div className="bg-card border border-dash border-2 rounded-xl py-16 text-center">
          <Users className="w-8 h-8 mx-auto text-mute-3 mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium">Nenhum parceiro cadastrado ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre para controlar repasses vinculados a um Trabalho.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="hidden sm:flex gap-3.5 px-[18px] py-[11px] border-b border-border bg-surface-2 text-[10.5px] tracking-[.07em] uppercase text-mute-2">
            <span className="flex-[2] min-w-0">Parceiro</span>
            <span className="flex-1 min-w-0">Contato</span>
            <span className="flex-1 min-w-0 text-right">Repassado / Previsto no período</span>
            <span className="w-[70px] flex-none"></span>
          </div>
          {partners.map(p => {
            const h = historicoPorParceiro.get(p.id);
            const expandido = expandidoId === p.id;
            const itens = txsPorParceiro.get(p.id) || [];
            return (
              <div key={p.id} className="border-t border-3">
                <div
                  onClick={() => h && setExpandidoId(expandido ? null : p.id)}
                  className={cn('flex flex-col sm:flex-row gap-1.5 sm:gap-3.5 sm:items-center px-[18px] py-[13px]', h && 'cursor-pointer hover:bg-surface-2 transition-colors', expandido && 'bg-surface-2')}
                >
                  <div className="flex-[2] min-w-0 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-start gap-1.5">
                      {h && <ChevronDown className={cn('w-3.5 h-3.5 mt-[3px] flex-none text-mute-3 transition-transform', expandido && 'rotate-180')} />}
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium sm:truncate">{p.nome}</div>
                        {p.documento && <div className="text-[11px] text-mute-2">{p.documento}</div>}
                      </div>
                    </div>
                    <div className="flex sm:hidden flex-none gap-1 -mt-1">
                      <button onClick={e => { e.stopPropagation(); openEdit(p); }} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 transition-colors text-mute-2"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={e => { e.stopPropagation(); setDeleteTarget(p); }} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive-soft transition-colors text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 text-[12px] text-muted-foreground sm:truncate">{p.contato || '—'}</div>
                  <div className="flex-1 min-w-0 sm:text-right font-mono-hbs text-[12px]">
                    {h ? (
                      <>
                        <span className="text-success">{fmt(h.pago)}</span>
                        {h.previsto > 0 && <span className="text-mute-3"> / {fmt(h.previsto)}</span>}
                      </>
                    ) : (
                      <span className="text-mute-3 font-sans">Sem repasses no período</span>
                    )}
                  </div>
                  <div className="hidden sm:flex w-[70px] flex-none justify-end gap-1">
                    <button onClick={e => { e.stopPropagation(); openEdit(p); }} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 transition-colors text-mute-2"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget(p); }} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive-soft transition-colors text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {expandido && (
                  <div className="bg-surface-2 border-t border-3">
                    {itens.map(t => {
                      const clienteNome = t.clienteId ? clientes.find(c => c.id === t.clienteId)?.nome : null;
                      const trabalho = t.processId ? processos.find(pr => pr.id === t.processId) : undefined;
                      return (
                        <button
                          key={t.id}
                          onClick={e => { e.stopPropagation(); setDetalhe(t); }}
                          className="flex items-center justify-between gap-3 px-[18px] py-[10px] border-t border-3 first:border-t-0 pl-[38px] w-full text-left hover:bg-surface-3/60 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-medium truncate">{t.descricao}</div>
                            <div className="text-[11px] text-mute-2 truncate">
                              {clienteNome || 'Sem cliente'}{trabalho && ` · ${trabalho.objeto}`} · {new Date(dataEfetiva(t) + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-none">
                            <span className="font-mono-hbs text-[12.5px]">{fmt(t.valor)}</span>
                            <StatusBadge tone={t.status === 'Concluído' ? 'success' : 'warning'}>{t.status}</StatusBadge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
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

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover parceiro</AlertDialogTitle>
            <AlertDialogDescription>Remover o parceiro "{deleteTarget?.nome}"? O histórico de repasses já feitos não é afetado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="w-4 h-4 mr-1.5" /> Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DetalheLancamentoDialog transaction={detalhe} onClose={() => setDetalhe(null)} />
    </div>
  );
}
