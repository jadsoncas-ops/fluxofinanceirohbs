import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { getPropostas, getClients, getCompanyConfig } from '@/lib/storage';
import { ETAPAS_PADRAO, GRUPOS, formatBRL } from '@/lib/comercial/precificacao';

function addDias(base: number, dias: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('pt-BR');
}

export default function PropostaImpressaoPage() {
  const { propostaId } = useParams<{ propostaId: string }>();
  const navigate = useNavigate();

  const { proposta, cliente, config } = useMemo(() => {
    const proposta = getPropostas().find(p => p.id === propostaId) || null;
    const cliente = proposta ? getClients().find(c => c.id === proposta.clienteId) : undefined;
    const config = getCompanyConfig();
    return { proposta, cliente, config };
  }, [propostaId]);

  if (!proposta) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="text-sm font-semibold">Proposta não encontrada</p>
        <button onClick={() => navigate('/comercial')} className="mt-4 h-9 px-3.5 border-2 rounded-lg text-xs">Voltar para Comercial</button>
      </div>
    );
  }

  const grupos = GRUPOS.map(g => ({
    nome: g,
    itens: proposta.itens.filter(i => i.grupo === g).map(i => ({
      ...i,
      descricao: ETAPAS_PADRAO.find(e => e.id === i.etapaId)?.descricao,
    })),
  })).filter(g => g.itens.length > 0);

  const validade = proposta.enviadaEm
    ? addDias(proposta.enviadaEm, config.validadePropostaDias || 15)
    : addDias(proposta.createdAt, config.validadePropostaDias || 15);

  return (
    <div className="flex flex-col gap-[18px] pb-10 animate-hbs-in">
      <div className="no-print flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => navigate('/comercial')} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Comercial
        </button>
        <button onClick={() => window.print()} className="h-9 px-3.5 bg-primary text-primary-foreground rounded-lg text-[12.5px] font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
          <Printer className="w-3.5 h-3.5" /> Imprimir / Baixar PDF
        </button>
      </div>

      <div className="documento-folha">
        <div className="documento-header">
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1>Proposta comercial</h1>
            <div className="sub">{config.razaoSocial || 'HBS Engenharia'}</div>
          </div>
          <div className="kicker">{proposta.codigo}</div>
        </div>

        <div className="documento-idbox">
          <div className="row"><div className="lbl">Cliente</div><div className="val">{cliente?.nome || '(a preencher)'}</div></div>
          <div className="row"><div className="lbl">Objeto</div><div className="val">{proposta.titulo}</div></div>
          <div className="row"><div className="lbl">Data</div><div className="val">{new Date(proposta.createdAt).toLocaleDateString('pt-BR')}</div></div>
          <div className="row"><div className="lbl">Validade da proposta</div><div className="val">{validade}</div></div>
          {proposta.prazoDias && <div className="row"><div className="lbl">Prazo de execução</div><div className="val">{proposta.prazoDias} dias, a contar da assinatura</div></div>}
          {proposta.formaPagamento && <div className="row"><div className="lbl">Condições de pagamento</div><div className="val">{proposta.formaPagamento}</div></div>}
        </div>

        <div className="documento-section-title"><div className="n">1</div><div className="t">Escopo dos serviços</div></div>
        {grupos.map(g => (
          <div key={g.nome} style={{ marginBottom: '1.1rem' }}>
            <p className="documento-p" style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{g.nome}</p>
            {g.itens.map(i => (
              <p key={i.etapaId} className="documento-p" style={{ marginLeft: '1rem' }}>
                <strong>{i.nome}.</strong>{i.descricao ? ` ${i.descricao}` : ''}
              </p>
            ))}
          </div>
        ))}

        <div className="documento-section-title"><div className="n">2</div><div className="t">Investimento</div></div>
        <table className="documento-table">
          <tbody>
            <tr>
              <td style={{ fontWeight: 700 }}>Valor total dos serviços</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{formatBRL(proposta.resultado.precoVenda)}</td>
            </tr>
          </tbody>
        </table>

        <div className="documento-nota">
          <p>Proposta válida até {validade}. Valores sujeitos a alteração após esse prazo. O início dos trabalhos fica condicionado à formalização do contrato e às condições de pagamento acordadas.</p>
        </div>

        <div className="documento-assinaturas">
          <div className="documento-section-title"><div className="n">✓</div><div className="t">Aceite</div></div>
          <div className="documento-sign-grid" style={{ gap: '48px 24px', marginTop: '4rem' }}>
            <div>
              <div className="linha">{config.responsavelNome || '(configure em Configurações)'}</div>
              <div className="papel">{config.responsavelTitulo || ''}{config.responsavelCrea ? ` — ${config.responsavelCrea}` : ''}</div>
            </div>
            <div>
              <div className="linha">{cliente?.nome || '(a preencher)'}</div>
              <div className="papel">{cliente?.documento ? `CPF/CNPJ: ${cliente.documento}` : 'Cliente'}</div>
            </div>
          </div>
        </div>

        <div className="documento-footer">
          <div>{config.endereco || 'HBS Engenharia'}</div>
          <div>{[config.telefone, config.email].filter(Boolean).join(' | ')}</div>
        </div>
      </div>
    </div>
  );
}
