import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Printer, Save, AlertTriangle, Pencil } from 'lucide-react';
import { AverbacaoData, Client, DocumentRecord, EstadoCivil, Process } from '@/lib/types';
import { addDocument, getDocuments, registrarEvento, updateDocument, updateProcess } from '@/lib/storage';
import {
  CampoFaltante,
  TIPOS_ATO,
  dadosIniciaisAverbacao,
  montarRequerimentoAverbacao,
  trabalhoPareceCondominio,
  validarAverbacao,
} from '@/lib/producao/requerimentoAverbacao';
import { DocumentoRequerimentoAverbacao } from '@/components/documento/DocumentoRequerimentoAverbacao';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ESTADOS_CIVIS: EstadoCivil[] = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];
const STEPS = ['Requerente', 'Imóvel', 'Construção', 'Documentação', 'Conferência'];

interface Props {
  trabalho: Process;
  cliente: Client | undefined;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-[.07em] text-mute-2">{label}</div>
      {children}
      {error && <div className="text-[11px] text-destructive">{error}</div>}
    </div>
  );
}

export function RequerimentoAverbacaoWizard({ trabalho, cliente }: Props) {
  const navigate = useNavigate();
  const existenteInicial = useMemo(
    () => getDocuments().find(d => d.processId === trabalho.id && d.tipoTecnico === 'requerimento_averbacao'),
    [trabalho.id]
  );
  const [step, setStep] = useState(existenteInicial ? STEPS.length - 1 : 0);
  const [data, setData] = useState<AverbacaoData>(() => dadosIniciaisAverbacao(trabalho, cliente));
  const [erros, setErros] = useState<CampoFaltante[]>([]);
  const [versaoSalva, setVersaoSalva] = useState<string | null>(existenteInicial?.versao || null);

  const isPJ = cliente?.tipo === 'Pessoa jurídica';
  const avisoCondominio = trabalhoPareceCondominio(trabalho, cliente);
  const documentoPreview = useMemo(() => montarRequerimentoAverbacao(data, cliente), [data, cliente]);

  function set<K extends keyof AverbacaoData>(key: K, value: AverbacaoData[K]) {
    setData(d => ({ ...d, [key]: value }));
    setErros(e => e.filter(er => er.campo !== key));
  }

  function erroDe(campo: string) {
    return erros.find(e => e.campo === campo)?.mensagem;
  }

  function gerarDocumento() {
    const validacao = validarAverbacao(data);
    if (validacao.length > 0) {
      setErros(validacao);
      toast.error(validacao[0].mensagem);
      return;
    }
    setErros([]);
    updateProcess({ ...trabalho, averbacao: data });

    const existente = getDocuments().find(d => d.processId === trabalho.id && d.tipoTecnico === 'requerimento_averbacao');
    if (existente) {
      const proximaVersao = String((parseInt(existente.versao || '1', 10) || 1) + 1);
      updateDocument({ ...existente, versao: proximaVersao, situacao: 'Concluído', updatedAt: Date.now() });
      registrarEvento({ modulo: 'Produção Técnica', texto: `Requerimento de Averbação atualizado (v${proximaVersao})`, clienteId: trabalho.clienteId, trabalhoId: trabalho.id });
      setVersaoSalva(proximaVersao);
      toast.success(`Requerimento atualizado para a versão ${proximaVersao}.`);
    } else {
      const doc: DocumentRecord = {
        id: crypto.randomUUID(),
        nome: `Requerimento de Averbação — ${trabalho.objeto}`,
        clienteId: trabalho.clienteId,
        processId: trabalho.id,
        tipoTecnico: 'requerimento_averbacao',
        versao: '1',
        situacao: 'Concluído',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addDocument(doc);
      registrarEvento({ modulo: 'Produção Técnica', texto: 'Requerimento de Averbação gerado', clienteId: trabalho.clienteId, trabalhoId: trabalho.id });
      setVersaoSalva('1');
      toast.success('Requerimento gerado e salvo no trabalho.');
    }
  }

  const inputCls = 'h-9 text-[13px]';

  return (
    <div className="flex flex-col gap-[18px] pb-10 animate-hbs-in">
      <div className="no-print flex flex-col gap-[18px]">
        <button onClick={() => navigate(`/trabalhos/${trabalho.id}`)} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 w-fit">
          <ArrowLeft className="w-3 h-3" /> {trabalho.objeto}
        </button>

        <div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-[20px] font-semibold -tracking-[.02em]">Requerimento de Averbação</h1>
              <p className="text-[12.5px] text-muted-foreground mt-1 max-w-[560px]">Requerimento para averbação de construção, ampliação ou regularização da edificação.</p>
            </div>
            {versaoSalva && <span className="text-[11.5px] text-success font-medium flex-none">✓ Salvo no trabalho · v{versaoSalva}</span>}
          </div>

          {avisoCondominio && (
            <div className="flex items-start gap-2.5 bg-warning-soft text-warning rounded-lg px-3 py-2.5 mt-3.5 text-[12px]">
              <AlertTriangle className="w-3.5 h-3.5 flex-none mt-[1px]" />
              <span>Este trabalho está configurado como condomínio. Verifique se o Requerimento de Averbação é o documento adequado ou utilize os documentos de Instituição de Condomínio.</span>
            </div>
          )}

          <div className="flex items-center gap-2.5 mt-4">
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => setStep(i)} className="flex items-center gap-2.5 group">
                <span className={cn('w-2 h-2 rounded-full transition-colors', i === step ? 'bg-primary' : i < step ? 'bg-accent' : 'bg-border group-hover:bg-mute-3')} />
                {i < STEPS.length - 1 && <span className={cn('w-6 h-px', i < step ? 'bg-accent' : 'bg-border')} />}
              </button>
            ))}
            <span className="text-[11px] font-mono-hbs text-mute-2 ml-1.5">{step + 1} de {STEPS.length} · {STEPS[step]}</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-[18px]">
          {step === 0 && (
            <div className="space-y-4">
              <div className="text-[13.5px] font-semibold">Requerente</div>
              <Field label="Nome completo / razão social" error={erroDe('requerenteNome')}>
                <Input value={data.requerenteNome || ''} onChange={e => set('requerenteNome', e.target.value)} className={inputCls} placeholder="Nome do requerente" />
              </Field>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <Field label={isPJ ? 'CNPJ' : 'CPF'} error={erroDe('requerenteDocumento')}>
                  <Input value={data.requerenteDocumento || ''} onChange={e => set('requerenteDocumento', e.target.value)} className={inputCls} placeholder={isPJ ? '00.000.000/0001-00' : '000.000.000-00'} />
                </Field>
                {!isPJ && (
                  <Field label="Estado civil">
                    <Select value={data.requerenteEstadoCivil || ''} onValueChange={v => set('requerenteEstadoCivil', v as EstadoCivil)}>
                      <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{ESTADOS_CIVIS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                )}
              </div>

              {!isPJ ? (
                <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <Field label="Profissão">
                    <Input value={data.requerenteProfissao || ''} onChange={e => set('requerenteProfissao', e.target.value)} className={inputCls} placeholder="Ex: Engenheiro civil" />
                  </Field>
                  <Field label="Cônjuge (quando aplicável)">
                    <Input value={data.requerenteConjugeNome || ''} onChange={e => set('requerenteConjugeNome', e.target.value)} className={inputCls} placeholder="Nome do cônjuge" />
                  </Field>
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <Field label="Representante legal">
                    <Input value={data.representanteNome || ''} onChange={e => set('representanteNome', e.target.value)} className={inputCls} placeholder="Nome do representante" />
                  </Field>
                  <Field label="CPF do representante">
                    <Input value={data.representanteCpf || ''} onChange={e => set('representanteCpf', e.target.value)} className={inputCls} placeholder="000.000.000-00" />
                  </Field>
                  <Field label="Qualificação do representante">
                    <Input value={data.representanteQualificacao || ''} onChange={e => set('representanteQualificacao', e.target.value)} className={inputCls} placeholder="Ex: sócio-administrador" />
                  </Field>
                </div>
              )}

              <Field label="Endereço">
                <Input value={data.requerenteEndereco || ''} onChange={e => set('requerenteEndereco', e.target.value)} className={inputCls} placeholder="Endereço completo do requerente" />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="text-[13.5px] font-semibold">Imóvel</div>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <Field label="Matrícula" error={erroDe('matricula')}>
                  <Input value={data.matricula || ''} onChange={e => set('matricula', e.target.value)} className={inputCls} placeholder="Nº da matrícula" />
                </Field>
                <Field label="Cartório de Registro de Imóveis">
                  <Input value={data.cartorio || ''} onChange={e => set('cartorio', e.target.value)} className={inputCls} placeholder="Ex: 1º Ofício de Registro de Imóveis" />
                </Field>
              </div>
              <Field label="Endereço do imóvel" error={erroDe('imovelEndereco')}>
                <Input value={data.imovelEndereco || ''} onChange={e => set('imovelEndereco', e.target.value)} className={inputCls} placeholder="Rua/Avenida" />
              </Field>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 2fr' }}>
                <Field label="Número">
                  <Input value={data.imovelNumero || ''} onChange={e => set('imovelNumero', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Complemento">
                  <Input value={data.imovelComplemento || ''} onChange={e => set('imovelComplemento', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: '2fr 2fr 1fr' }}>
                <Field label="Bairro">
                  <Input value={data.imovelBairro || ''} onChange={e => set('imovelBairro', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Cidade">
                  <Input value={data.imovelCidade || ''} onChange={e => set('imovelCidade', e.target.value)} className={inputCls} />
                </Field>
                <Field label="UF">
                  <Input value={data.imovelEstado || ''} onChange={e => set('imovelEstado', e.target.value.toUpperCase())} maxLength={2} className={cn(inputCls, 'uppercase')} />
                </Field>
              </div>
              <Field label="Inscrição municipal">
                <Input value={data.inscricaoMunicipal || ''} onChange={e => set('inscricaoMunicipal', e.target.value)} className={inputCls} placeholder="Se disponível" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="text-[13.5px] font-semibold">Construção</div>
              <Field label="Tipo de ato" error={erroDe('tipoAto')}>
                <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  {TIPOS_ATO.map(t => (
                    <button
                      key={t.key}
                      onClick={() => set('tipoAto', t.key)}
                      className={cn(
                        'text-left px-3 py-2.5 rounded-lg border-2 text-[12.5px] font-medium transition-colors',
                        data.tipoAto === t.key ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:border-hover'
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <Field label="Área construída (m²)" error={erroDe('areaConstruida')}>
                  <Input type="number" value={data.areaConstruida ?? ''} onChange={e => set('areaConstruida', e.target.value ? parseFloat(e.target.value) : undefined)} className={inputCls} placeholder="0,00" />
                </Field>
                <Field label="Número de pavimentos">
                  <Input type="number" value={data.pavimentos ?? ''} onChange={e => set('pavimentos', e.target.value ? parseInt(e.target.value, 10) : undefined)} className={inputCls} placeholder="1" />
                </Field>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <Field label="Finalidade">
                  <Input value={data.finalidade || ''} onChange={e => set('finalidade', e.target.value)} className={inputCls} placeholder="Ex: residencial unifamiliar" />
                </Field>
                <Field label="Data/ano da construção">
                  <Input value={data.anoConstrucao || ''} onChange={e => set('anoConstrucao', e.target.value)} className={inputCls} placeholder="Se conhecida" />
                </Field>
              </div>
              <Field label="Valor atribuído à construção" error={erroDe('valorConstrucao')}>
                <Input type="number" value={data.valorConstrucao ?? ''} onChange={e => set('valorConstrucao', e.target.value ? parseFloat(e.target.value) : undefined)} className={inputCls} placeholder="R$ 0,00" />
                <div className="text-[11px] text-mute-2 mt-1">Valor atribuído à construção/obra para fins registrais — não é o valor do terreno nem o valor de mercado do imóvel. Edição manual; sem cálculo automático.</div>
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-[13.5px] font-semibold">Documentação</div>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {([
                  ['temAlvara', 'Alvará'],
                  ['temHabiteSe', 'Habite-se / documento municipal equivalente'],
                  ['temArt', 'ART'],
                  ['temRrt', 'RRT'],
                  ['temTrt', 'TRT'],
                  ['temCertidao', 'Certidão'],
                  ['temPlantasAprovadas', 'Plantas Aprovadas pela Prefeitura'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-[12.5px] cursor-pointer">
                    <input type="checkbox" checked={!!data[key]} onChange={e => set(key, e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
                    {label}
                  </label>
                ))}
              </div>
              <Field label="Outros documentos">
                <Textarea value={data.outrosDocumentos || ''} onChange={e => set('outrosDocumentos', e.target.value)} placeholder="Descreva outros documentos apresentados" className="text-[13px] min-h-[70px]" />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="text-[13.5px] font-semibold">Conferência</div>
              {erros.length > 0 && (
                <div className="bg-destructive-soft text-destructive rounded-lg px-3 py-2.5 text-[12px] space-y-1">
                  {erros.map(e => <div key={e.campo}>{e.mensagem}</div>)}
                </div>
              )}
              <div className="grid gap-x-6 gap-y-2.5 text-[12.5px]" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div><span className="text-mute-2">Requerente:</span> {data.requerenteNome || '—'}</div>
                <div><span className="text-mute-2">CPF/CNPJ:</span> {data.requerenteDocumento || '—'}</div>
                <div><span className="text-mute-2">Matrícula:</span> {data.matricula || '—'}</div>
                <div><span className="text-mute-2">Cartório:</span> {data.cartorio || '—'}</div>
                <div className="col-span-2"><span className="text-mute-2">Endereço do imóvel:</span> {[data.imovelEndereco, data.imovelNumero, data.imovelBairro, data.imovelCidade, data.imovelEstado].filter(Boolean).join(', ') || '—'}</div>
                <div><span className="text-mute-2">Tipo de ato:</span> {TIPOS_ATO.find(t => t.key === data.tipoAto)?.label || '—'}</div>
                <div><span className="text-mute-2">Área construída:</span> {data.areaConstruida ? `${data.areaConstruida} m²` : '—'}</div>
                <div><span className="text-mute-2">Valor da construção:</span> {data.valorConstrucao ? `R$ ${data.valorConstrucao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                <button onClick={gerarDocumento} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {versaoSalva ? 'Salvar alterações / regenerar' : 'Gerar documento'}
                </button>
                {versaoSalva && (
                  <button onClick={() => window.print()} className="h-9 px-3.5 border-2 rounded-lg text-[12.5px] font-medium hover:border-hover transition-colors flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5" /> Imprimir / Baixar PDF
                  </button>
                )}
                <button onClick={() => setStep(0)} className="h-9 px-3.5 rounded-lg text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Editar do início
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-3">
            <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="h-9 px-3.5 rounded-lg text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-0 flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </button>
            {step < STEPS.length - 1 && (
              <button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
                Avançar <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {step === 4 && <DocumentoRequerimentoAverbacao dados={documentoPreview} />}
    </div>
  );
}
