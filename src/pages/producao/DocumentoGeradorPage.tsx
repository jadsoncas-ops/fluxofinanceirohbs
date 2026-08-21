import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Save } from 'lucide-react';
import { getProcesses, getClients, getCompanyConfig, getDocuments, addDocument, updateDocument, registrarEvento } from '@/lib/storage';
import { TipoDocumentoTecnico } from '@/lib/types';
import { buscarTemplate } from '@/lib/producao/registry';
import { montarMemorial } from '@/lib/producao/memorial';
import { montarInstituicao } from '@/lib/producao/instituicao';
import { montarConvencao } from '@/lib/producao/convencao';
import { montarInstituicaoSimplificada } from '@/lib/producao/instituicaoSimplificada';
import { montarRequerimento } from '@/lib/producao/requerimento';
import { proprietariosDoTrabalho, conjugeParaAssinatura } from '@/lib/producao/documentoShared';
import { DadosTecnicosForm } from '@/components/producao/DadosTecnicosForm';
import { DocumentoMemorial } from '@/components/documento/DocumentoMemorial';
import { DocumentoAbnt } from '@/components/documento/DocumentoAbnt';
import { DocumentoInstituicao } from '@/components/documento/DocumentoInstituicao';
import { DocumentoConvencao } from '@/components/documento/DocumentoConvencao';
import { DocumentoInstituicaoSimplificada } from '@/components/documento/DocumentoInstituicaoSimplificada';
import { DocumentoLaudo } from '@/components/documento/DocumentoLaudo';
import { DocumentoRequerimento } from '@/components/documento/DocumentoRequerimento';
import { RequerimentoAverbacaoWizard } from './RequerimentoAverbacaoWizard';
import { toast } from 'sonner';

export default function DocumentoGeradorPage() {
  const { trabalhoId, tipo } = useParams<{ trabalhoId: string; tipo: TipoDocumentoTecnico }>();
  const navigate = useNavigate();
  const [key, setKey] = useState(0);
  const [gerado, setGerado] = useState<string | null>(null);

  const { trabalho, cliente, clientes, config, template } = useMemo(() => {
    void key;
    const trabalho = getProcesses().find(p => p.id === trabalhoId) || null;
    const clientes = getClients();
    const cliente = trabalho ? clientes.find(c => c.id === trabalho.clienteId) : undefined;
    const config = getCompanyConfig();
    const template = tipo ? buscarTemplate(tipo) : null;
    return { trabalho, cliente, clientes, config, template };
  }, [trabalhoId, tipo, key]);

  if (!trabalho || !template) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="text-sm font-semibold">Trabalho ou documento não encontrado</p>
        <button onClick={() => navigate('/producao')} className="mt-4 h-9 px-3.5 border-2 rounded-lg text-xs">Voltar para Produção Técnica</button>
      </div>
    );
  }

  if (tipo === 'requerimento_averbacao') {
    return <RequerimentoAverbacaoWizard trabalho={trabalho} cliente={cliente} />;
  }

  function salvarDocumento() {
    const existente = getDocuments().find(d => d.processId === trabalho!.id && d.tipoTecnico === tipo);

    if (existente) {
      const proximaVersao = (parseInt(existente.versao || '1', 10) || 1) + 1;
      updateDocument({ ...existente, versao: String(proximaVersao), situacao: 'Concluído', updatedAt: Date.now() });
      registrarEvento({ modulo: 'Produção Técnica', texto: `Documento atualizado (v${proximaVersao}) — ${template!.label}`, clienteId: trabalho!.clienteId, trabalhoId: trabalho!.id });
      setGerado(existente.id);
      toast.success(`Documento atualizado para a versão ${proximaVersao}.`);
    } else {
      const doc = {
        id: crypto.randomUUID(),
        nome: `${template!.label} — ${trabalho!.objeto}`,
        clienteId: trabalho!.clienteId,
        processId: trabalho!.id,
        tipoTecnico: tipo,
        versao: '1',
        situacao: 'Concluído' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addDocument(doc);
      registrarEvento({ modulo: 'Produção Técnica', texto: `Documento gerado — ${template!.label}`, clienteId: trabalho!.clienteId, trabalhoId: trabalho!.id });
      setGerado(doc.id);
      toast.success('Documento gerado e salvo no trabalho.');
    }
  }

  const jaExiste = getDocuments().some(d => d.processId === trabalho.id && d.tipoTecnico === tipo);

  return (
    <div className="flex flex-col gap-[18px] pb-10 animate-hbs-in">
      <div className="no-print flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => navigate(`/trabalhos/${trabalho.id}`)} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> {trabalho.objeto}
        </button>
        {template.disponivel && (
          <div className="flex items-center gap-2">
            {(gerado || jaExiste) && <span className="text-[11.5px] text-success font-medium">✓ Salvo no trabalho</span>}
            <button onClick={salvarDocumento} className="h-9 px-3.5 rounded-lg border-2 text-[12.5px] font-medium hover:border-hover transition-colors flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Gerar e salvar
            </button>
            <button onClick={() => window.print()} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Imprimir / Baixar PDF
            </button>
          </div>
        )}
      </div>

      {!template.disponivel ? (
        <div className="no-print bg-card border border-border rounded-xl py-16 text-center">
          <div className="text-3xl mb-3">{template.icon}</div>
          <p className="text-sm font-semibold">{template.label} — em desenvolvimento</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-[420px] mx-auto">Este gerador ainda não foi portado para a HBS Engineering. Memorial Descritivo e Quadro NBR 12721 já estão disponíveis.</p>
        </div>
      ) : (
        <>
          <div className="no-print">
            <DadosTecnicosForm trabalho={trabalho} onChange={() => setKey(k => k + 1)} />
          </div>

          {tipo === 'memorial' && (
            <DocumentoMemorial dados={montarMemorial(trabalho, cliente, config, clientes)} trabalho={trabalho} onSaved={() => setKey(k => k + 1)} />
          )}
          {tipo === 'abnt' && (
            <DocumentoAbnt
              nomeTrabalho={trabalho.objeto}
              units={trabalho.tecnico?.units || []}
              responsavel={config}
              art={trabalho.tecnico?.art || ''}
              proprietarios={proprietariosDoTrabalho(trabalho, cliente).map(p => ({ ...p, conjuge: conjugeParaAssinatura(p.cpf, clientes) }))}
            />
          )}
          {tipo === 'instituicao' && (
            <DocumentoInstituicao dados={montarInstituicao(trabalho, cliente, clientes)} />
          )}
          {tipo === 'convencao' && (
            <DocumentoConvencao dados={montarConvencao(trabalho, cliente, clientes)} />
          )}
          {tipo === 'instituicao_simplificada' && (
            <DocumentoInstituicaoSimplificada dados={montarInstituicaoSimplificada(trabalho, cliente, clientes)} trabalho={trabalho} onSaved={() => setKey(k => k + 1)} />
          )}
          {tipo === 'laudo' && (
            <DocumentoLaudo trabalho={trabalho} cliente={cliente} config={config} />
          )}
          {tipo === 'requerimento' && (
            <DocumentoRequerimento dados={montarRequerimento(trabalho, cliente, clientes)} />
          )}
        </>
      )}
    </div>
  );
}
