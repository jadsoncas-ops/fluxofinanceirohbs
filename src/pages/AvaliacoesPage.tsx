import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Plus, Trash2 } from 'lucide-react';
import { getAvaliacoes, addAvaliacao, deleteAvaliacao } from '@/lib/storage';
import { criarAvaliacaoPadrao } from '@/lib/avaliacao/defaults';
import { calcularResumoAvaliacao, fmtMoney } from '@/lib/avaliacao/homogeneizacao';
import { calcularRelatorio } from '@/lib/avaliacao/relatorio';
import { StatusBadge } from '@/components/StatusBadge';
import { KpiCard } from '@/components/KpiCard';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Aba = 'Lista' | 'Relatório';
const ABAS: Aba[] = ['Lista', 'Relatório'];

export default function AvaliacoesPage() {
  const navigate = useNavigate();
  const [key, setKey] = useState(0);
  const [aba, setAba] = useState<Aba>('Lista');
  const [avaliacaoParaExcluir, setAvaliacaoParaExcluir] = useState<{ id: string; endereco: string } | null>(null);

  const avaliacoes = useMemo(() => {
    void key;
    return [...getAvaliacoes()].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [key]);

  const relatorio = useMemo(() => calcularRelatorio(avaliacoes), [avaliacoes]);

  function novaAvaliacao() {
    const av = criarAvaliacaoPadrao();
    addAvaliacao(av);
    navigate(`/avaliacoes/${av.id}`);
  }

  function remover(e: React.MouseEvent, id: string, endereco: string) {
    e.stopPropagation();
    setAvaliacaoParaExcluir({ id, endereco });
  }

  function confirmarExclusaoAvaliacao() {
    if (!avaliacaoParaExcluir) return;
    deleteAvaliacao(avaliacaoParaExcluir.id);
    toast.success('Avaliação removida.');
    setAvaliacaoParaExcluir(null);
    setKey(k => k + 1);
  }

  return (
    <div className="space-y-[22px] pb-10 animate-hbs-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold -tracking-[.02em]">Avaliações de aluguel</h1>
          <p className="text-[13px] text-muted-foreground mt-1 max-w-[560px]">
            Laudos técnicos de avaliação de aluguel de imóvel urbano — trabalho independente como avaliador da CIUB junto à Prefeitura de Itabuna, fora dos trabalhos/clientes da HBS.
          </p>
        </div>
        <button onClick={novaAvaliacao} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5 flex-none">
          <Plus className="w-3.5 h-3.5" /> Nova avaliação
        </button>
      </div>

      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="flex gap-1 bg-surface-2 p-1 rounded-xl border border-3 w-fit">
            {ABAS.map(ab => (
              <button
                key={ab}
                onClick={() => setAba(ab)}
                className={cn(
                  'px-3 py-[6px] rounded-lg text-[12px] font-medium transition-colors',
                  aba === ab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {ab}
              </button>
            ))}
          </div>
        </div>

        {aba === 'Lista' && (
          avaliacoes.length === 0 ? (
            <div className="py-14 text-center">
              <Scale className="w-8 h-8 mx-auto text-mute-3 mb-3" strokeWidth={1.5} />
              <p className="text-sm font-medium">Nenhuma avaliação ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">Crie a primeira avaliação de aluguel para começar.</p>
            </div>
          ) : (
            avaliacoes.map(a => {
              const resumo = calcularResumoAvaliacao(a);
              return (
                <div
                  key={a.id}
                  onClick={() => navigate(`/avaliacoes/${a.id}`)}
                  className="group flex items-center gap-3 px-[18px] py-3 border-t border-3 hover:bg-surface-3 transition-colors cursor-pointer first:border-t-0"
                >
                  <span className="w-[31px] h-[31px] flex-none rounded-[7px] bg-neutral-soft grid place-items-center text-mute-2">
                    <Scale className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium truncate">{a.enderecoImovel || 'Endereço não informado'}</div>
                    <div className="text-[11px] text-mute-2 truncate">{a.secretariaSolicitante || a.entidadeSolicitante || 'Sem secretaria informada'}</div>
                  </div>
                  <span className="text-[11px] font-mono-hbs text-mute-2 flex-none">{resumo.valorMedio ? fmtMoney(resumo.valorMedio) : '—'}</span>
                  <span className="text-[11px] font-mono-hbs text-mute-2 flex-none">{new Date(a.updatedAt).toLocaleDateString('pt-BR')}</span>
                  <StatusBadge tone={a.status === 'Concluído' ? 'success' : 'neutral'} className="flex-none">{a.status}</StatusBadge>
                  <button onClick={e => remover(e, a.id, a.enderecoImovel || '')} className="opacity-0 group-hover:opacity-100 transition-opacity text-mute-3 hover:text-destructive flex-none">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )
        )}

        {aba === 'Relatório' && (
          avaliacoes.length === 0 ? (
            <div className="py-14 text-center">
              <Scale className="w-8 h-8 mx-auto text-mute-3 mb-3" strokeWidth={1.5} />
              <p className="text-sm font-medium">Nada pra mostrar ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">O relatório aparece assim que houver avaliações cadastradas.</p>
            </div>
          ) : (
            <div className="p-[18px] space-y-5">
              <div className="grid gap-px bg-border border border-border rounded-xl overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                <KpiCard label="Total de avaliações" value={String(relatorio.total)} />
                <KpiCard label="Concluídas" value={String(relatorio.concluidas)} />
                <KpiCard label="Rascunhos" value={String(relatorio.rascunhos)} />
                <KpiCard label="R$/m² médio geral" value={relatorio.rsM2MedioGeral != null ? `${fmtMoney(relatorio.rsM2MedioGeral)}/m²` : '—'} />
                <KpiCard label="Valor médio geral" value={fmtMoney(relatorio.valorMedioGeral)} />
              </div>

              <div>
                <div className="text-[12.5px] font-semibold mb-2">Por secretaria solicitante</div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="grid text-[10.5px] uppercase tracking-[.04em] text-mute-2 px-3 py-2 bg-surface-3" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                    <div>Secretaria</div>
                    <div>Avaliações</div>
                    <div>Valor médio</div>
                  </div>
                  {relatorio.porSecretaria.map(l => (
                    <div key={l.nome} className="grid px-3 py-2 border-t border-3 text-[12.5px]" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                      <div className="truncate">{l.nome}</div>
                      <div className="font-mono-hbs">{l.quantidade}</div>
                      <div className="font-mono-hbs">{fmtMoney(l.valorMedio)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </section>

      <AlertDialog open={!!avaliacaoParaExcluir} onOpenChange={v => !v && setAvaliacaoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover avaliação</AlertDialogTitle>
            <AlertDialogDescription>
              Remover a avaliação{avaliacaoParaExcluir?.endereco ? ` de "${avaliacaoParaExcluir.endereco}"` : ''}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusaoAvaliacao} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
