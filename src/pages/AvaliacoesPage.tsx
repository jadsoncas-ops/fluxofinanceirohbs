import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Plus, Trash2 } from 'lucide-react';
import { getAvaliacoes, addAvaliacao, deleteAvaliacao } from '@/lib/storage';
import { criarAvaliacaoPadrao } from '@/lib/avaliacao/defaults';
import { calcularResumoAvaliacao, fmtMoney } from '@/lib/avaliacao/homogeneizacao';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function AvaliacoesPage() {
  const navigate = useNavigate();
  const [key, setKey] = useState(0);

  const avaliacoes = useMemo(() => {
    void key;
    return [...getAvaliacoes()].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [key]);

  function novaAvaliacao() {
    const av = criarAvaliacaoPadrao();
    addAvaliacao(av);
    navigate(`/avaliacoes/${av.id}`);
  }

  function remover(e: React.MouseEvent, id: string, endereco: string) {
    e.stopPropagation();
    if (confirm(`Remover a avaliação${endereco ? ` de "${endereco}"` : ''}?`)) {
      deleteAvaliacao(id);
      toast.success('Avaliação removida.');
      setKey(k => k + 1);
    }
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
        {avaliacoes.length === 0 ? (
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
                <span className={cn('flex-none text-[11px] px-2 py-[3px] rounded-[5px] font-medium', a.status === 'Concluído' ? 'bg-success-soft text-success' : 'bg-neutral-soft text-mute-2')}>{a.status}</span>
                <button onClick={e => remover(e, a.id, a.enderecoImovel || '')} className="opacity-0 group-hover:opacity-100 transition-opacity text-mute-3 hover:text-destructive flex-none">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
