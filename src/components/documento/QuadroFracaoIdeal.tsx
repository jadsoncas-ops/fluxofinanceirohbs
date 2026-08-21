import { useState } from 'react';
import { Pencil, Check, X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { LinhaFracao, ColunaFracaoIdeal, ColunaCasas, QuadroFracaoOverrides, VERIFICACAO_KEY, CASAS_PADRAO, formatarQuadroFracao } from '@/lib/producao/fracaoIdeal';
import { Process } from '@/lib/types';
import { updateProcess } from '@/lib/storage';
import { Input } from '@/components/ui/input';

const CABECALHO = ['Pavimento', 'Unid.', 'Banh.', 'Garagem', 'Privat.', 'Comum', 'Σ', 'Fração m²', 'Fração %'];
const CAMPOS_EDITAVEIS: ColunaFracaoIdeal[] = ['areaGaragem', 'areaPrivativa', 'areaComum', 'soma', 'fracaoM2', 'fracaoPct'];

interface Props {
  linhas: LinhaFracao[];
  /** Presente quando a tabela deve permitir edição (casas decimais da Verificação, ajuste manual de
   *  célula e da própria Verificação), persistida em `trabalho.tecnico`. Sem isso, a tabela é só leitura. */
  trabalho?: Process;
  onSaved?: () => void;
}

/** Tabela do Quadro de Fração Ideal, compartilhada entre Memorial e Instituição Simplificada. As LINHAS
 *  sempre usam a precisão padrão de cada coluna (estável, não editável). Só a VERIFICAÇÃO tem casas
 *  decimais ajustáveis, célula a célula, com setinhas ‹ › (igual ao botão de aumentar/diminuir casas
 *  decimais de uma planilha) — ela soma os valores reais das linhas e aproxima pro tamanho escolhido,
 *  sem forçar a soma visual das linhas a bater ao centavo. Quando `trabalho` é passado, também permite
 *  editar manualmente qualquer célula (linhas ou a própria Verificação) para os casos em que o cartório
 *  exige um valor específico — o ajuste fica salvo no trabalho até ser editado de novo ou restaurado ao
 *  automático. */
export function QuadroFracaoIdeal({ linhas, trabalho, onSaved }: Props) {
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState<Record<string, Partial<Record<ColunaFracaoIdeal, string>>>>({});

  if (linhas.length === 0) return null;

  const overridesAtuais: QuadroFracaoOverrides = trabalho?.tecnico?.quadroFracaoOverrides || {};
  const casasAtuais: ColunaCasas = trabalho?.tecnico?.quadroFracaoCasas || {};
  const temOverride = Object.values(overridesAtuais).some(o => o && Object.keys(o).length > 0);
  const { linhas: fmt, verificacao } = formatarQuadroFracao(linhas, casasAtuais, overridesAtuais);
  const totalBanheiros = linhas.reduce((s, l) => s + (l.unidade.banheiros || 0), 0);

  function ajustarCasas(campo: ColunaFracaoIdeal, delta: number) {
    if (!trabalho) return;
    const atual = casasAtuais[campo] ?? CASAS_PADRAO[campo];
    const nova = Math.max(0, Math.min(6, atual + delta));
    updateProcess({ ...trabalho, tecnico: { ...trabalho.tecnico!, quadroFracaoCasas: { ...casasAtuais, [campo]: nova } } });
    onSaved?.();
  }

  function iniciarEdicao() {
    const inicial: Record<string, Partial<Record<ColunaFracaoIdeal, string>>> = { [VERIFICACAO_KEY]: {} };
    linhas.forEach((l, i) => {
      inicial[l.unidade.id] = {};
      CAMPOS_EDITAVEIS.forEach(campo => {
        inicial[l.unidade.id][campo] = fmt[i][campo];
      });
    });
    CAMPOS_EDITAVEIS.forEach(campo => {
      inicial[VERIFICACAO_KEY][campo] = verificacao[campo];
    });
    setValores(inicial);
    setEditando(true);
  }

  function salvar() {
    if (!trabalho) return;
    const automatico = formatarQuadroFracao(linhas, casasAtuais); // sem overrides, pra comparar o que realmente mudou
    const novosOverrides: QuadroFracaoOverrides = {};

    linhas.forEach((l, i) => {
      CAMPOS_EDITAVEIS.forEach(campo => {
        const digitado = parseFloat((valores[l.unidade.id]?.[campo] || '').replace(',', '.'));
        const auto = parseFloat(automatico.linhas[i][campo].replace(',', '.'));
        if (!isNaN(digitado) && Math.abs(digitado - auto) > 1e-9) {
          novosOverrides[l.unidade.id] = { ...novosOverrides[l.unidade.id], [campo]: digitado };
        }
      });
    });

    CAMPOS_EDITAVEIS.forEach(campo => {
      const digitado = parseFloat((valores[VERIFICACAO_KEY]?.[campo] || '').replace(',', '.'));
      const auto = parseFloat(automatico.verificacao[campo].replace(',', '.'));
      if (!isNaN(digitado) && Math.abs(digitado - auto) > 1e-9) {
        novosOverrides[VERIFICACAO_KEY] = { ...novosOverrides[VERIFICACAO_KEY], [campo]: digitado };
      }
    });

    updateProcess({ ...trabalho, tecnico: { ...trabalho.tecnico!, quadroFracaoOverrides: novosOverrides } });
    setEditando(false);
    onSaved?.();
  }

  function restaurarAutomatico() {
    if (!trabalho) return;
    updateProcess({ ...trabalho, tecnico: { ...trabalho.tecnico!, quadroFracaoOverrides: {} } });
    setEditando(false);
    onSaved?.();
  }

  return (
    <div>
      {trabalho && (
        <div className="no-print flex flex-wrap items-center gap-2 mb-2">
          {!editando ? (
            <>
              <button onClick={iniciarEdicao} className="h-7 px-2.5 rounded-lg border-2 text-[11px] font-medium hover:border-hover transition-colors flex items-center gap-1.5">
                <Pencil className="w-3 h-3" /> Editar valores
              </button>
              {temOverride && (
                <button onClick={restaurarAutomatico} className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-mute-2 hover:text-foreground transition-colors flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Restaurar automático
                </button>
              )}
              {temOverride && <span className="text-[10.5px] text-warning">valores ajustados manualmente</span>}
            </>
          ) : (
            <>
              <button onClick={salvar} className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium flex items-center gap-1.5">
                <Check className="w-3 h-3" /> Salvar
              </button>
              <button onClick={() => setEditando(false)} className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-mute-2 hover:text-foreground transition-colors flex items-center gap-1.5">
                <X className="w-3 h-3" /> Cancelar
              </button>
            </>
          )}
        </div>
      )}

      <table className="documento-table">
        <thead>
          <tr>{CABECALHO.map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={l.unidade.id}>
              <td>{l.unidade.pavimento}</td>
              <td>{l.unidade.nome}</td>
              <td>{l.unidade.banheiros}</td>
              {CAMPOS_EDITAVEIS.map(campo => (
                <td key={campo}>
                  {editando ? (
                    <Input
                      value={valores[l.unidade.id]?.[campo] ?? ''}
                      onChange={e => setValores(v => ({ ...v, [l.unidade.id]: { ...v[l.unidade.id], [campo]: e.target.value } }))}
                      className="h-7 text-[11px] w-[76px] px-1.5 no-print"
                    />
                  ) : (
                    <>
                      {fmt[i][campo]}
                      {campo === 'fracaoPct' && '%'}
                      {overridesAtuais[l.unidade.id]?.[campo] !== undefined && <span title="Ajustado manualmente" style={{ color: 'var(--doc-accent)' }}> *</span>}
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
          <tr className="verificacao">
            <td>Verificação</td>
            <td></td>
            <td>{totalBanheiros}</td>
            {CAMPOS_EDITAVEIS.map(campo => (
              <td key={campo}>
                {editando ? (
                  <Input
                    value={valores[VERIFICACAO_KEY]?.[campo] ?? ''}
                    onChange={e => setValores(v => ({ ...v, [VERIFICACAO_KEY]: { ...v[VERIFICACAO_KEY], [campo]: e.target.value } }))}
                    className="h-7 text-[11px] w-[76px] px-1.5 no-print"
                  />
                ) : (
                  <span className="inline-flex items-center gap-[3px]">
                    {trabalho && (
                      <button onClick={() => ajustarCasas(campo, -1)} title="Menos casas decimais" className="no-print w-[13px] h-[13px] grid place-items-center rounded-sm hover:bg-surface-3 text-mute-3 hover:text-foreground flex-none">
                        <ChevronLeft className="w-2.5 h-2.5" />
                      </button>
                    )}
                    <span>
                      {verificacao[campo]}
                      {campo === 'fracaoPct' && '%'}
                      {overridesAtuais[VERIFICACAO_KEY]?.[campo] !== undefined && <span title="Ajustado manualmente" style={{ color: 'var(--doc-accent)' }}> *</span>}
                    </span>
                    {trabalho && (
                      <button onClick={() => ajustarCasas(campo, 1)} title="Mais casas decimais" className="no-print w-[13px] h-[13px] grid place-items-center rounded-sm hover:bg-surface-3 text-mute-3 hover:text-foreground flex-none">
                        <ChevronRight className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {!editando && (
        <div className="documento-nota">
          <p>
            Nota técnica: os valores deste quadro foram arredondados conforme a precisão decimal configurada para cada coluna. Pequenas variações entre
            a soma das linhas e a Verificação podem ocorrer nas colunas de menor precisão (ex.: percentuais), sendo tecnicamente normais e sem alteração
            da área real da unidade ou do empreendimento.{temOverride && <> Valores assinalados com <strong>*</strong> foram ajustados manualmente.</>}
          </p>
        </div>
      )}
    </div>
  );
}
