import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Save, Plus, Trash2, ClipboardPaste } from 'lucide-react';
import { toast } from 'sonner';
import { getAvaliacoes, updateAvaliacao } from '@/lib/storage';
import { AvaliacaoAluguel, ComparavelAvaliacao } from '@/lib/types';
import { calcularResumoAvaliacao, fmtMoney } from '@/lib/avaliacao/homogeneizacao';
import { novoComparavel } from '@/lib/avaliacao/defaults';
import { extrairDadosAnuncio } from '@/lib/avaliacao/parseAnuncio';
import { DocumentoAvaliacao } from '@/components/avaliacao/DocumentoAvaliacao';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="text-[11px] uppercase tracking-[.07em] text-mute-2">{label}</div>
      {children}
    </div>
  );
}

function isoToDatetimeLocal(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputCls = 'h-9 text-[13px]';

export default function AvaliacaoDetailPage() {
  const { avaliacaoId } = useParams<{ avaliacaoId: string }>();
  const navigate = useNavigate();
  const [key, setKey] = useState(0);

  const avaliacaoSalva = useMemo(() => {
    void key;
    return getAvaliacoes().find(a => a.id === avaliacaoId) || null;
  }, [avaliacaoId, key]);

  const [rascunho, setRascunho] = useState<AvaliacaoAluguel | null>(avaliacaoSalva);
  const [colagem, setColagem] = useState('');
  const data = rascunho || avaliacaoSalva;

  if (!data) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="text-sm font-semibold">Avaliação não encontrada</p>
        <button onClick={() => navigate('/avaliacoes')} className="mt-4 h-9 px-3.5 border-2 rounded-lg text-xs">Voltar para Avaliações</button>
      </div>
    );
  }

  const resumo = calcularResumoAvaliacao(data);

  function set<K extends keyof AvaliacaoAluguel>(key: K, value: AvaliacaoAluguel[K]) {
    setRascunho(d => ({ ...(d || avaliacaoSalva!), [key]: value }));
  }

  function setComparavel(id: string, patch: Partial<ComparavelAvaliacao>) {
    setRascunho(d => {
      const base = d || avaliacaoSalva!;
      return { ...base, comparaveis: base.comparaveis.map(c => c.id === id ? { ...c, ...patch } : c) };
    });
  }

  function addComparavel() {
    setRascunho(d => {
      const base = d || avaliacaoSalva!;
      return { ...base, comparaveis: [...base.comparaveis, novoComparavel()] };
    });
  }

  function adicionarDeColagem() {
    const texto = colagem.trim();
    if (!texto) return;
    const extraido = extrairDadosAnuncio(texto);
    if (!extraido.valorAluguel && !extraido.areaConstruida && !extraido.fonte) {
      toast.error('Não encontrei valor, área ou link nesse texto. Confira se copiou o anúncio inteiro.');
      return;
    }
    setRascunho(d => {
      const base = d || avaliacaoSalva!;
      return { ...base, comparaveis: [...base.comparaveis, { ...novoComparavel(), ...extraido }] };
    });
    setColagem('');
    const partes: string[] = [];
    if (extraido.valorAluguel) partes.push(`valor R$ ${extraido.valorAluguel.toLocaleString('pt-BR')}`);
    if (extraido.areaConstruida) partes.push(`área ${extraido.areaConstruida}m²`);
    if (extraido.fonte) partes.push('link');
    toast.success(`Linha adicionada (${partes.join(', ')}). Confira endereço e anunciante.`);
  }

  function removerComparavel(id: string) {
    setRascunho(d => {
      const base = d || avaliacaoSalva!;
      return { ...base, comparaveis: base.comparaveis.filter(c => c.id !== id) };
    });
  }

  function salvar() {
    updateAvaliacao(data);
    setRascunho(null);
    setKey(k => k + 1);
    toast.success('Avaliação salva.');
  }

  const sujo = rascunho !== null;

  return (
    <div className="flex flex-col gap-[18px] pb-10 animate-hbs-in">
      <div className="no-print flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => navigate('/avaliacoes')} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Avaliações
        </button>
        <div className="flex items-center gap-2">
          {sujo && <span className="text-[11.5px] text-warning font-medium">Alterações não salvas</span>}
          <button onClick={salvar} className="h-9 px-3.5 rounded-lg border-2 text-[12.5px] font-medium hover:border-hover transition-colors flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> Salvar
          </button>
          <button onClick={() => window.print()} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Imprimir / Baixar PDF
          </button>
        </div>
      </div>

      <div className="no-print flex flex-col gap-4">
        <div className="bg-card border border-border rounded-xl p-[18px] space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[13.5px] font-semibold">Identificação</div>
            <Select value={data.status} onValueChange={v => set('status', v as AvaliacaoAluguel['status'])}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Rascunho">Rascunho</SelectItem>
                <SelectItem value="Concluído">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Entidade solicitante"><Input value={data.entidadeSolicitante || ''} onChange={e => set('entidadeSolicitante', e.target.value)} className={inputCls} /></Field>
            <Field label="Secretaria destinatária"><Input value={data.secretariaDestinataria || ''} onChange={e => set('secretariaDestinataria', e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Secretaria solicitante"><Input value={data.secretariaSolicitante || ''} onChange={e => set('secretariaSolicitante', e.target.value)} className={inputCls} placeholder="Ex: Secretaria de Promoção Social e Combate à Pobreza" /></Field>
          <Field label="Finalidade"><Textarea value={data.finalidade || ''} onChange={e => set('finalidade', e.target.value)} className="text-[13px] min-h-[60px]" /></Field>
          <div className="grid gap-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <Field label="Endereço do imóvel"><Input value={data.enderecoImovel || ''} onChange={e => set('enderecoImovel', e.target.value)} className={inputCls} /></Field>
            <Field label="Município/UF"><Input value={data.municipioUf || ''} onChange={e => set('municipioUf', e.target.value)} className={inputCls} /></Field>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <Field label="Proprietário(a)"><Input value={data.proprietario || ''} onChange={e => set('proprietario', e.target.value)} className={inputCls} /></Field>
            <Field label="Grau de fundamentação">
              <Select value={data.grauFundamentacao || ''} onValueChange={v => set('grauFundamentacao', v)}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Grau I">Grau I</SelectItem>
                  <SelectItem value="Grau II">Grau II</SelectItem>
                  <SelectItem value="Grau III">Grau III</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Tipo de imóvel">
              <Select value={data.tipoImovel || ''} onValueChange={v => set('tipoImovel', v)}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Residencial">Residencial</SelectItem>
                  <SelectItem value="Comercial">Comercial</SelectItem>
                  <SelectItem value="Residencial / Comercial">Residencial / Comercial</SelectItem>
                  <SelectItem value="Institucional">Institucional</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Área construída aproximada (m²)">
              <Input type="number" value={data.areaConstruida ?? ''} onChange={e => set('areaConstruida', e.target.value ? parseFloat(e.target.value) : undefined)} className={inputCls} />
            </Field>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <Field label="Destinação de uso (ex: funcionamento do CREAS)">
              <Input value={data.destinacaoUso || ''} onChange={e => set('destinacaoUso', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Data e hora de referência">
              <Input type="datetime-local" value={isoToDatetimeLocal(data.dataReferencia)} onChange={e => set('dataReferencia', e.target.value ? new Date(e.target.value).toISOString() : undefined)} className={inputCls} />
            </Field>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-[18px] space-y-4">
          <div className="text-[13.5px] font-semibold">Características do imóvel</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <Field label="Uso predominante"><Input value={data.usoPredominante || ''} onChange={e => set('usoPredominante', e.target.value)} className={inputCls} /></Field>
            <Field label="Tipologia"><Input value={data.tipologia || ''} onChange={e => set('tipologia', e.target.value)} className={inputCls} placeholder="Casa, prédio, galpão…" /></Field>
            <Field label="Padrão construtivo">
              <Select value={data.padraoConstrutivo || ''} onValueChange={v => set('padraoConstrutivo', v)}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixo">Baixo</SelectItem>
                  <SelectItem value="Médio">Médio</SelectItem>
                  <SelectItem value="Alto">Alto</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Número de pavimentos" className="w-40">
            <Input type="number" value={data.numeroPavimentos ?? ''} onChange={e => set('numeroPavimentos', e.target.value ? parseInt(e.target.value, 10) : undefined)} className={inputCls} />
          </Field>
          <Field label="Estado de conservação (texto da seção 3)">
            <Textarea value={data.estadoConservacao || ''} onChange={e => set('estadoConservacao', e.target.value)} className="text-[13px] min-h-[70px]" />
          </Field>
          <Field label="Observações adicionais (opcional — ex: itens excluídos da locação)">
            <Textarea value={data.observacoesAdicionais || ''} onChange={e => set('observacoesAdicionais', e.target.value)} className="text-[13px] min-h-[60px]" />
          </Field>
        </div>

        <div className="bg-card border border-border rounded-xl p-[18px] space-y-4">
          <div className="text-[13.5px] font-semibold">Responsáveis</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Responsável técnico"><Input value={data.responsavelNome || ''} onChange={e => set('responsavelNome', e.target.value)} className={inputCls} /></Field>
            <Field label="Registro"><Input value={data.responsavelRegistro || ''} onChange={e => set('responsavelRegistro', e.target.value)} className={inputCls} /></Field>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Colaborador(a) técnico (opcional)"><Input value={data.colaboradorNome || ''} onChange={e => set('colaboradorNome', e.target.value)} className={inputCls} /></Field>
            <Field label="Registro do colaborador"><Input value={data.colaboradorRegistro || ''} onChange={e => set('colaboradorRegistro', e.target.value)} className={inputCls} /></Field>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Avaliador da Comissão (assinatura final)"><Input value={data.avaliadorNome || ''} onChange={e => set('avaliadorNome', e.target.value)} className={inputCls} /></Field>
            <Field label="Registro do avaliador"><Input value={data.avaliadorRegistro || ''} onChange={e => set('avaliadorRegistro', e.target.value)} className={inputCls} /></Field>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <Field label="Cidade da assinatura"><Input value={data.cidadeAssinatura || ''} onChange={e => set('cidadeAssinatura', e.target.value)} className={inputCls} /></Field>
            <Field label="Data da assinatura"><Input type="date" value={data.dataAssinatura || ''} onChange={e => set('dataAssinatura', e.target.value)} className={inputCls} /></Field>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-[18px] space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-[13.5px] font-semibold">Anexo III — Tabela de homogeneização</div>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">Cada linha é um imóvel de referência. Valor aplicado e R$/m² são calculados automaticamente.</p>
            </div>
            <Field label="Fator redutor de negociação (%)" className="w-32">
              <Input type="number" value={data.fatorRedutorPercent} onChange={e => set('fatorRedutorPercent', parseFloat(e.target.value) || 0)} className={inputCls} />
            </Field>
          </div>

          <div className="bg-surface-3 rounded-lg p-3 space-y-2">
            <div className="text-[11.5px] font-medium flex items-center gap-1.5"><ClipboardPaste className="w-3.5 h-3.5" /> Colar anúncio (solução momentânea, sem IA)</div>
            <p className="text-[11px] text-muted-foreground">Copie o texto do anúncio (OLX, Zap, Wimóveis…) e cole aqui — o sistema tenta achar valor, área e link sozinho; endereço e anunciante você confere na linha criada.</p>
            <div className="flex gap-2">
              <Textarea value={colagem} onChange={e => setColagem(e.target.value)} placeholder="Cole aqui o texto copiado do anúncio…" className="text-[12.5px] min-h-[60px] flex-1" />
              <button onClick={adicionarDeColagem} className="h-9 px-3 rounded-lg border-2 text-[12px] font-medium hover:border-hover transition-colors flex-none self-start">
                Extrair e adicionar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto -mx-[18px] px-[18px]">
            <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[.04em] text-mute-2">
                  <th className="pb-2 pr-2">Endereço</th>
                  <th className="pb-2 pr-2">Est. conservação</th>
                  <th className="pb-2 pr-2 w-24">Área (m²)</th>
                  <th className="pb-2 pr-2">Anunciante</th>
                  <th className="pb-2 pr-2 w-32">Valor aluguel</th>
                  <th className="pb-2 pr-2">Fonte/link</th>
                  <th className="pb-2 pr-2 w-24">R$/m²</th>
                  <th className="pb-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {resumo.comparaveis.map(c => (
                  <tr key={c.id} className="border-t border-3">
                    <td className="py-1.5 pr-2"><input value={c.endereco || ''} onChange={e => setComparavel(c.id, { endereco: e.target.value })} className="w-full h-8 rounded-md border border-border px-2 text-[12px] bg-background" /></td>
                    <td className="py-1.5 pr-2"><input value={c.estadoConservacao || ''} onChange={e => setComparavel(c.id, { estadoConservacao: e.target.value })} className="w-full h-8 rounded-md border border-border px-2 text-[12px] bg-background" placeholder="Regular" /></td>
                    <td className="py-1.5 pr-2"><input type="number" value={c.areaConstruida ?? ''} onChange={e => setComparavel(c.id, { areaConstruida: e.target.value ? parseFloat(e.target.value) : undefined })} className="w-full h-8 rounded-md border border-border px-2 text-[12px] bg-background" /></td>
                    <td className="py-1.5 pr-2"><input value={c.anunciante || ''} onChange={e => setComparavel(c.id, { anunciante: e.target.value })} className="w-full h-8 rounded-md border border-border px-2 text-[12px] bg-background" /></td>
                    <td className="py-1.5 pr-2"><input type="number" value={c.valorAluguel ?? ''} onChange={e => setComparavel(c.id, { valorAluguel: e.target.value ? parseFloat(e.target.value) : undefined })} className="w-full h-8 rounded-md border border-border px-2 text-[12px] bg-background" /></td>
                    <td className="py-1.5 pr-2"><input value={c.fonte || ''} onChange={e => setComparavel(c.id, { fonte: e.target.value })} className="w-full h-8 rounded-md border border-border px-2 text-[12px] bg-background" placeholder="link do anúncio" /></td>
                    <td className="py-1.5 pr-2 text-mute-2 font-mono-hbs whitespace-nowrap">{c.valorM2 != null ? fmtMoney(c.valorM2) : '—'}</td>
                    <td className="py-1.5">
                      <button onClick={() => removerComparavel(c.id)} className="h-8 w-8 grid place-items-center rounded-md text-mute-3 hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addComparavel} className="h-8 px-3 rounded-lg border-2 text-[12px] font-medium hover:border-hover transition-colors flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Adicionar comparável
          </button>

          <div className="flex items-center gap-5 pt-2 border-t border-3 text-[12.5px]">
            <div><span className="text-mute-2">Média do m²:</span> <strong className="font-mono-hbs">{resumo.mediaM2 != null ? `${fmtMoney(resumo.mediaM2)}/m²` : '—'}</strong></div>
            <div><span className="text-mute-2">Valor médio estimado:</span> <strong className="font-mono-hbs">{fmtMoney(resumo.valorMedio)}</strong></div>
            <div><span className="text-mute-2">Faixa:</span> <strong className="font-mono-hbs">{fmtMoney(resumo.valorMinimo)} – {fmtMoney(resumo.valorMaximo)}</strong></div>
          </div>
        </div>
      </div>

      <DocumentoAvaliacao avaliacao={data} />
    </div>
  );
}
