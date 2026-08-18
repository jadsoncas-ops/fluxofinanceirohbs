import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { getPropostas, getClients, getCompanyConfig } from '@/lib/storage';
import { ETAPAS_PADRAO, GRUPOS, CUSTOS_PROTOCOLO_PADRAO, formatBRL } from '@/lib/comercial/precificacao';
import hbsLogo from '@/assets/hbs-logo.png';

function addDias(base: number, dias: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('pt-BR');
}

const CRONOGRAMA = [
  { titulo: 'Contratação', desc: 'Assinatura do contrato e início dos trabalhos.' },
  { titulo: 'Levantamento e Projetos', desc: 'Visita técnica e elaboração das peças gráficas.' },
  { titulo: 'Documentação', desc: 'Memorial descritivo e peças complementares.' },
  { titulo: 'Protocolo e Acompanhamento', desc: 'Submissão e acompanhamento junto aos órgãos competentes.' },
  { titulo: 'Entrega', desc: 'Conclusão e entrega da documentação ao cliente.' },
];

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

  const validadeDias = config.validadePropostaDias || 15;
  const validadeData = proposta.enviadaEm ? addDias(proposta.enviadaEm, validadeDias) : addDias(proposta.createdAt, validadeDias);
  const nomeEmpresa = config.razaoSocial || 'HBS Engenharia';

  const grupos = GRUPOS.map(g => ({
    nome: g,
    itens: proposta.itens.filter(i => i.grupo === g).map(i => ({
      ...i,
      descricao: ETAPAS_PADRAO.find(e => e.id === i.etapaId)?.descricao,
    })),
  })).filter(g => g.itens.length > 0);

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

      {/* Capa */}
      <div className="proposta-capa">
        <div className="logo-circle"><img src={hbsLogo} alt={nomeEmpresa} /></div>
        <div className="regra" />
        <h1>PROPOSTA COMERCIAL</h1>
        <div className="subtitulo">Serviços Técnicos de Engenharia</div>

        <div className="capa-info">
          <div className="lbl">Cliente</div>
          <div className="val">{cliente?.nome || 'A definir'}</div>
          <div className="lbl">Emitida em</div>
          <div className="val">{new Date(proposta.createdAt).toLocaleDateString('pt-BR')}</div>
        </div>
        <div className="capa-numero">Proposta nº {proposta.codigo}</div>

        <div className="capa-rodape">{nomeEmpresa.toUpperCase()}</div>
      </div>

      {/* Conteúdo */}
      <div className="proposta-folha">
        <div className="proposta-topo">
          <div className="linha"><span className="lbl">Cliente</span><span className="val">{cliente?.nome || 'A definir'}</span></div>
          <div className="linha"><span className="lbl">Prazo estimado</span><span className="val">{proposta.prazoDias ? `${proposta.prazoDias} dias` : 'A definir'}</span></div>
          <div className="linha"><span className="lbl">Validade da proposta</span><span className="val">{validadeDias} dias</span></div>
        </div>

        <div className="proposta-secao">
          <div className="titulo"><span className="num">01</span><span>Objeto da contratação</span></div>
        </div>
        <p style={{ fontSize: '13px', lineHeight: 1.6 }}>
          A presente proposta tem por objeto a prestação de serviços técnicos de engenharia para {proposta.titulo.toLowerCase()}.
        </p>

        <div className="proposta-secao">
          <div className="titulo"><span className="num">02</span><span>Escopo dos serviços</span></div>
        </div>
        {grupos.map(g => (
          <div key={g.nome}>
            <div className="proposta-modulo">{g.nome.toUpperCase()}</div>
            {g.itens.map(i => (
              <div key={i.etapaId} className="proposta-item">
                <strong>{i.nome}</strong>
                {i.descricao && <span className="desc">{i.descricao}</span>}
              </div>
            ))}
          </div>
        ))}

        <div className="proposta-nao-incluso">
          <div className="titulo-mini">NÃO INCLUSO</div>
          <ul>
            <li>Taxas de prefeitura (emolumentos do município)</li>
            {proposta.custosProtocolo.art && <li>Taxa de emissão de ART/RRT ({formatBRL(CUSTOS_PROTOCOLO_PADRAO.art)})</li>}
            <li>Emolumentos de cartório e impostos incidentes sobre o imóvel</li>
          </ul>
        </div>

        <div className="proposta-secao">
          <div className="titulo"><span className="num">03</span><span>Cronograma / Trâmite</span></div>
        </div>
        <div className="proposta-timeline">
          {CRONOGRAMA.map((passo, i) => (
            <div key={passo.titulo} className="passo">
              <div className="bolha">{String(i + 1).padStart(2, '0')}</div>
              <div className="titulo-passo">{passo.titulo}</div>
              <div className="desc-passo">{passo.desc}</div>
            </div>
          ))}
        </div>

        <div className="proposta-secao">
          <div className="titulo"><span className="num">04</span><span>Investimento</span></div>
        </div>
        <div className="proposta-investimento">
          <span className="lbl">Valor total do investimento</span>
          <span className="val">{formatBRL(proposta.resultado.precoVenda)}</span>
        </div>

        <div className="proposta-secao">
          <div className="titulo"><span className="num">05</span><span>Condições de pagamento</span></div>
        </div>
        <div className="proposta-pagamento-item">
          <span>{proposta.formaPagamento || 'A definir'}</span>
          <span className="val">{formatBRL(proposta.resultado.precoVenda)}</span>
        </div>

        <div className="proposta-secao">
          <div className="titulo"><span className="num">06</span><span>Validade e observações</span></div>
        </div>
        <div className="proposta-observacoes">
          <p>Esta proposta possui validade de {validadeDias} dias a partir da data de emissão.</p>
          <ul>
            <li>O prazo estimado refere-se à execução das peças técnicas sob responsabilidade da {nomeEmpresa}. O tempo de tramitação e aprovação junto aos órgãos públicos pode variar e não está sob o controle da contratada.</li>
            <li>Documentos do imóvel e do contratante devem ser fornecidos no início dos trabalhos.</li>
            <li>Alterações de escopo solicitadas após a aprovação são tratadas em aditivo específico.</li>
            <li>Taxas de prefeitura são de responsabilidade do contratante.</li>
            <li>Emolumentos de cartório e impostos incidentes sobre o imóvel são de responsabilidade do contratante.</li>
          </ul>
        </div>

        <div className="proposta-secao">
          <div className="titulo"><span className="num">07</span><span>Aceite da proposta</span></div>
        </div>
        <div className="proposta-aceite">
          <div className="campo">Contratante:<span className="linha-preenchimento" /></div>
          <div className="campo">Data: {new Date(proposta.createdAt).toLocaleDateString('pt-BR')}</div>
          <div className="assinaturas">
            <div className="linha">Assinatura do Contratante</div>
            <div className="linha">
              <span className="nome">{config.responsavelNome || '(configure em Configurações)'}</span>
              {config.responsavelCrea ? `CREA: ${config.responsavelCrea}` : ''}
            </div>
          </div>
        </div>

        <div className="proposta-rodape">
          <span>{nomeEmpresa}</span>
          <span>Proposta {proposta.codigo}</span>
        </div>
      </div>
    </div>
  );
}
