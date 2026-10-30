import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, AlertTriangle } from 'lucide-react';
import { getContratos, getPropostas, getClients, getCompanyConfig } from '@/lib/storage';
import { montarContrato, pendenciasDoContrato } from '@/lib/comercial/contratoDoc';
import { DocumentoContrato } from '@/components/documento/DocumentoContrato';
import { usePrintTitle } from '@/hooks/use-print-title';

export default function ContratoImpressaoPage() {
  const { contratoId } = useParams<{ contratoId: string }>();
  const navigate = useNavigate();

  const { contrato, dados, pendencias } = useMemo(() => {
    const contrato = getContratos().find(c => c.id === contratoId) || null;
    const cliente = contrato ? getClients().find(c => c.id === contrato.clienteId) : undefined;
    if (!contrato || !cliente) return { contrato, dados: null, pendencias: [] as string[] };
    const proposta = getPropostas().find(p => p.id === contrato.propostaId);
    const config = getCompanyConfig();
    return { contrato, dados: montarContrato(contrato, proposta, cliente, config), pendencias: pendenciasDoContrato(contrato, cliente, config) };
  }, [contratoId]);

  usePrintTitle(contrato && dados ? `Contrato ${contrato.codigo} - ${dados.contratantes.map(c => c.nome).join(' e ')}` : undefined);

  if (!contrato || !dados) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="text-sm font-semibold">Contrato não encontrado</p>
        <button onClick={() => navigate('/comercial')} className="mt-4 h-9 px-3.5 border-2 rounded-lg text-xs">Voltar para Comercial</button>
      </div>
    );
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
      </div>

      <DocumentoContrato dados={dados} />
    </div>
  );
}
