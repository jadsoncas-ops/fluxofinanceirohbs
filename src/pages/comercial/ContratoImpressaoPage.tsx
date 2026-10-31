import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, AlertTriangle, ChevronDown, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getContratos, getPropostas, getClients, getCompanyConfig, getProcesses, updateContrato } from '@/lib/storage';
import { montarContrato, pendenciasDoContrato } from '@/lib/comercial/contratoDoc';
import { modeloInstituicaoCondominio } from '@/lib/comercial/contratoClausulas';
import { DocumentoContrato } from '@/components/documento/DocumentoContrato';
import { Textarea } from '@/components/ui/textarea';
import { usePrintTitle } from '@/hooks/use-print-title';
import { TextoContrato } from '@/lib/types';
import { cn } from '@/lib/utils';

const rotulo = 'text-[11px] text-mute-2 uppercase tracking-[.06em]';

export default function ContratoImpressaoPage() {
  const { contratoId } = useParams<{ contratoId: string }>();
  const navigate = useNavigate();

  const { contrato, proposta, cliente, config, trabalho } = useMemo(() => {
    const contrato = getContratos().find(c => c.id === contratoId) || null;
    const cliente = contrato ? getClients().find(c => c.id === contrato.clienteId) : undefined;
    const proposta = contrato ? getPropostas().find(p => p.id === contrato.propostaId) : undefined;
    const trabalho = contrato?.trabalhoId ? getProcesses().find(p => p.id === contrato.trabalhoId) : undefined;
    return { contrato, proposta, cliente, config: getCompanyConfig(), trabalho };
  }, [contratoId]);

  // O que está na tela (e na prévia) é o rascunho; "Salvar texto" grava no contrato.
  const [texto, setTexto] = useState<TextoContrato>(() => getContratos().find(c => c.id === contratoId)?.textoPersonalizado || {});
  const [painelAberto, setPainelAberto] = useState(true);
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(getContratos().find(c => c.id === contratoId)?.textoPersonalizado || {}));

  const dados = useMemo(
    () => (contrato && cliente ? montarContrato(contrato, proposta, cliente, config, { trabalho, texto }) : null),
    [contrato, proposta, cliente, config, trabalho, texto]
  );
  const pendencias = useMemo(() => (contrato && cliente ? pendenciasDoContrato(contrato, cliente, config, proposta) : []), [contrato, cliente, config, proposta]);

  usePrintTitle(contrato && dados ? `Contrato ${contrato.codigo} - ${dados.contratantes.map(c => c.nome).join(' e ')}` : undefined);

  if (!contrato || !cliente || !dados) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="text-sm font-semibold">Contrato não encontrado</p>
        <button onClick={() => navigate('/comercial')} className="mt-4 h-9 px-3.5 border-2 rounded-lg text-xs">Voltar para Comercial</button>
      </div>
    );
  }

  const alterado = JSON.stringify(texto) !== salvoJson;

  function salvarTexto() {
    updateContrato({ ...contrato!, textoPersonalizado: texto, updatedAt: Date.now() });
    setSalvoJson(JSON.stringify(texto));
    toast.success('Texto do contrato salvo.');
  }

  function usarModeloCondominio() {
    setTexto(t => ({
      ...modeloInstituicaoCondominio({ plural: dados!.plural, prazoDias: proposta?.prazoDias || 15, endereco: trabalho?.endereco, matricula: trabalho?.tecnico?.matricula }),
      testemunhas: t.testemunhas,
    }));
  }

  return (
    <div className="flex flex-col gap-[18px] pb-10 animate-hbs-in">
      <div className="no-print flex flex-col gap-3.5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => navigate('/comercial')} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Comercial
          </button>
          <button onClick={() => window.print()} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Imprimir / Baixar PDF
          </button>
        </div>

        {pendencias.length > 0 && (
          <div className="flex items-start gap-2.5 bg-warning-soft text-warning rounded-lg px-3 py-2.5 text-[12px]">
            <AlertTriangle className="w-3.5 h-3.5 flex-none mt-[1px]" />
            <span>Antes de imprimir, falta preencher: {pendencias.join('; ')}. O que faltar sai como "(a preencher)" no contrato.</span>
          </div>
        )}

        <section className="bg-card border border-border rounded-xl">
          <button onClick={() => setPainelAberto(a => !a)} className="w-full flex items-center justify-between gap-3 px-[18px] py-3.5 text-left">
            <div>
              <div className="text-[13.5px] font-semibold">Ajustar texto do contrato</div>
              <div className="text-[11.5px] text-mute-2 mt-0.5">Serviço (objeto, fases e prazo). Contratantes e valor vêm do contrato: use "Editar" no card do contrato para mudá-los.</div>
            </div>
            <ChevronDown className={cn('w-4 h-4 text-mute-2 flex-none transition-transform', painelAberto && 'rotate-180')} />
          </button>

          {painelAberto && (
            <div className="px-[18px] pb-[18px] space-y-3 border-t border-3 pt-3.5">
              <div>
                <label className={rotulo}>Objeto (cláusula I)</label>
                <Textarea value={texto.objeto ?? dados.padroes.objeto} onChange={e => setTexto(t => ({ ...t, objeto: e.target.value }))} className="mt-1 min-h-[80px] text-[12.5px]" />
              </div>
              <div>
                <label className={rotulo}>Fases (cláusula II) — uma por linha</label>
                <Textarea value={(texto.fases ?? dados.padroes.fases).join('\n')} onChange={e => setTexto(t => ({ ...t, fases: e.target.value.split('\n') }))} className="mt-1 min-h-[110px] text-[12.5px]" />
              </div>
              <div>
                <label className={rotulo}>Prazo de entrega (cláusula III, alínea c)</label>
                <Textarea value={texto.prazoEntrega ?? dados.padroes.prazoEntrega} onChange={e => setTexto(t => ({ ...t, prazoEntrega: e.target.value }))} className="mt-1 min-h-[80px] text-[12.5px]" />
              </div>
              <div>
                <label className={rotulo}>Parágrafo único da cláusula III — limite de responsabilidade (opcional)</label>
                <Textarea value={texto.paragrafoUnico ?? dados.padroes.paragrafoUnico} onChange={e => setTexto(t => ({ ...t, paragrafoUnico: e.target.value }))} placeholder="Deixe vazio para não incluir. Ex.: quando o protocolo no cartório fica com outro profissional." className="mt-1 min-h-[80px] text-[12.5px]" />
              </div>
              <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
                <input type="checkbox" checked={!!texto.testemunhas} onChange={e => setTexto(t => ({ ...t, testemunhas: e.target.checked }))} className="w-3.5 h-3.5 accent-primary" />
                Incluir duas linhas de testemunhas (com elas o contrato vale como título executivo)
              </label>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button onClick={salvarTexto} disabled={!alterado} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5 disabled:opacity-40">
                  <Save className="w-3.5 h-3.5" /> Salvar texto
                </button>
                <button onClick={usarModeloCondominio} className="h-9 px-3.5 border-2 rounded-lg text-[12.5px] font-medium hover:border-hover transition-colors">Usar modelo de Instituição de Condomínio</button>
                <button onClick={() => setTexto({})} className="h-9 px-3 rounded-lg text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors">Voltar ao padrão</button>
                {alterado && <span className="text-[11.5px] text-warning">alterações não salvas</span>}
              </div>
            </div>
          )}
        </section>
      </div>

      <DocumentoContrato dados={dados} />
    </div>
  );
}
