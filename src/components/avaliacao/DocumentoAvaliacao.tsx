import { AvaliacaoAluguel } from '@/lib/types';
import { calcularResumoAvaliacao, fmtMoney, valorPorExtenso } from '@/lib/avaliacao/homogeneizacao';

function fmtDataHora(iso: string | undefined): string {
  if (!iso) return '(data não informada)';
  const d = new Date(iso);
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
}

function fmtDataCurta(iso: string | undefined): string {
  if (!iso) return '(data)';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

export function DocumentoAvaliacao({ avaliacao }: { avaliacao: AvaliacaoAluguel }) {
  const resumo = calcularResumoAvaliacao(avaliacao);
  const a = avaliacao;

  return (
    <div className="documento-folha">
      <div className="documento-header">
        <div style={{ width: 40, height: 40, flexShrink: 0, border: '1px dashed var(--doc-line)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: 'var(--doc-muted)', textAlign: 'center', lineHeight: 1.1 }}>
          logo Prefeitura
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="kicker" style={{ marginBottom: 4 }}>{a.entidadeSolicitante} · {a.secretariaDestinataria}</div>
          <h1>{a.tipoLaudo}</h1>
        </div>
        <div style={{ width: 40, flexShrink: 0 }} />
      </div>

      <div className="documento-idbox">
        <div className="row"><div className="lbl">Entidade solicitante</div><div className="val">{a.entidadeSolicitante || '(a preencher)'}</div></div>
        <div className="row"><div className="lbl">Secretaria solicitante</div><div className="val">{a.secretariaSolicitante || '(a preencher)'}</div></div>
        <div className="row"><div className="lbl">Secretaria destinatária</div><div className="val">{a.secretariaDestinataria || '(a preencher)'}</div></div>
        <div className="row"><div className="lbl">Finalidade</div><div className="val">{a.finalidade}</div></div>
        <div className="row"><div className="lbl">Endereço do imóvel</div><div className="val">{a.enderecoImovel || '(a preencher)'}</div></div>
        <div className="row"><div className="lbl">Município/UF</div><div className="val">{a.municipioUf}</div></div>
        <div className="row"><div className="lbl">Grau de fundamentação</div><div className="val">{a.grauFundamentacao}</div></div>
        <div className="row"><div className="lbl">Proprietário(a)</div><div className="val">{a.proprietario || '(a preencher)'}</div></div>
        <div className="row"><div className="lbl">Tipo de imóvel</div><div className="val">{a.tipoImovel || '(a preencher)'}</div></div>
        <div className="row"><div className="lbl">Área construída aproximada</div><div className="val">{a.areaConstruida ? `Aprox. ${a.areaConstruida.toLocaleString('pt-BR')}m²` : '(a preencher)'}</div></div>
        <div className="row"><div className="lbl">Metodologia aplicada</div><div className="val">{a.metodologiaAplicada}</div></div>
        <div className="row"><div className="lbl">Data e hora de referência</div><div className="val">{fmtDataHora(a.dataReferencia)}</div></div>
      </div>

      <div className="documento-section-title"><div className="n">1</div><div className="t">Objetivo da avaliação</div></div>
      <p className="documento-p">
        O presente Laudo Técnico tem como objetivo determinar o valor de aluguel de mercado do imóvel urbano identificado
        neste documento, para subsidiar processos administrativos internos entre Secretarias Municipais, visando instrução
        de contratação, renovação ou revisão de locação de imóvel pela Administração Pública.
      </p>

      <div className="documento-section-title"><div className="n">2</div><div className="t">Identificação e caracterização do imóvel</div></div>
      <p className="documento-p">
        O imóvel objeto desta avaliação localiza-se à {a.enderecoImovel || '(endereço a preencher)'}, {a.municipioUf}, inserido em
        zona urbana consolidada, dotada de infraestrutura básica, acessibilidade e serviços públicos essenciais.
        {a.destinacaoUso ? ` A unidade será destinada ao ${a.destinacaoUso}.` : ''}
      </p>
      <p className="documento-p" style={{ fontWeight: 700, marginBottom: '0.3rem' }}>2.1 Características gerais</p>
      <ul style={{ margin: '0 0 0.85rem 1.2rem', padding: 0, fontSize: '13.5px', lineHeight: 1.7 }}>
        <li>Uso predominante: {a.usoPredominante || '(a preencher)'}</li>
        <li>Tipologia: {a.tipologia || '(a preencher)'}</li>
        <li>Área construída aproximada: {a.areaConstruida ? `${a.areaConstruida.toLocaleString('pt-BR')} m²` : '(a preencher)'}</li>
        <li>Número de pavimentos: {a.numeroPavimentos ?? '(a preencher)'}</li>
        <li>Padrão construtivo: {a.padraoConstrutivo || '(a preencher)'}</li>
      </ul>
      {a.observacoesAdicionais && <p className="documento-p">{a.observacoesAdicionais}</p>}

      <div className="documento-section-title"><div className="n">3</div><div className="t">Estado de conservação</div></div>
      <p className="documento-p">{a.estadoConservacao}</p>

      <div className="documento-section-title"><div className="n">4</div><div className="t">Fundamentação normativa</div></div>
      <p className="documento-p">Este Laudo fundamenta-se no que estabelecem as normas técnicas da ABNT – Associação Brasileira de Normas Técnicas, em especial:</p>
      <ul style={{ margin: '0 0 0.85rem 1.2rem', padding: 0, fontSize: '13.5px', lineHeight: 1.7 }}>
        <li>NBR 14653-1:2019 – Avaliação de Bens – Parte 1: Procedimentos Gerais;</li>
        <li>NBR 14653-2:2011 – Avaliação de Bens – Parte 2: Imóveis Urbanos.</li>
      </ul>
      <p className="documento-p">A avaliação baseia-se na documentação fornecida referente ao imóvel, bem como em dados de mercado obtidos por meio de pesquisa específica.</p>

      <div className="documento-section-title"><div className="n">5</div><div className="t">Metodologia de avaliação</div></div>
      <p className="documento-p">
        Para a determinação do valor locatício foi utilizado o {a.metodologiaAplicada}, conforme preconiza a NBR 14653,
        mediante análise de imóveis similares, considerando:
      </p>
      <ul style={{ margin: '0 0 0.85rem 1.2rem', padding: 0, fontSize: '13.5px', lineHeight: 1.7 }}>
        <li>Localização;</li>
        <li>Área construída;</li>
        <li>Padrão construtivo;</li>
        <li>Estado de conservação;</li>
        <li>Oferta e demanda do mercado local;</li>
        <li>Uso permitido.</li>
      </ul>

      <div className="documento-section-title"><div className="n">6</div><div className="t">Pesquisa de mercado</div></div>
      <p className="documento-p">
        Foram consideradas amostras de imóveis disponíveis para locação em {a.municipioUf}, com características técnicas
        comparáveis em termos de área, tipologia, padrão construtivo e localização próxima, conforme tabela do Anexo III. Os
        valores extraídos refletem a realidade do mercado imobiliário na data de referência.
      </p>

      <div className="documento-section-title"><div className="n">7</div><div className="t">Determinação do valor de aluguel</div></div>
      <p className="documento-p">Com base nos dados analisados e na metodologia aplicada, o valor de aluguel do imóvel avaliado situa-se no seguinte intervalo:</p>
      <ul style={{ margin: '0 0 0.85rem 1.2rem', padding: 0, fontSize: '13.5px', lineHeight: 1.7 }}>
        <li>Valor mínimo estimado: {fmtMoney(resumo.valorMinimo)}{resumo.valorMinimo != null && ` (${valorPorExtenso(resumo.valorMinimo)})`}</li>
        <li>Valor médio estimado: {fmtMoney(resumo.valorMedio)}{resumo.valorMedio != null && ` (${valorPorExtenso(resumo.valorMedio)})`}</li>
        <li>Valor máximo estimado: {fmtMoney(resumo.valorMaximo)}{resumo.valorMaximo != null && ` (${valorPorExtenso(resumo.valorMaximo)})`}</li>
      </ul>
      <p className="documento-p">Os valores apresentados refletem as condições de mercado vigentes à data de referência desta avaliação.</p>

      <div className="documento-section-title"><div className="n">8</div><div className="t">Pressupostos, ressalvas e limitações</div></div>
      <ul style={{ margin: '0 0 0.85rem 1.2rem', padding: 0, fontSize: '13.5px', lineHeight: 1.7 }}>
        <li>O presente Laudo destina-se exclusivamente ao uso interno da Prefeitura Municipal, entre suas Secretarias e setores administrativos;</li>
        <li>Não se destina a fins judiciais, financeiros externos ou garantia real;</li>
        <li>Foi elaborado com base nas informações e documentos fornecidos pela Secretaria solicitante;</li>
        <li>Não foram realizadas análises jurídicas, ambientais ou estruturais aprofundadas;</li>
        <li>Alterações nas condições de mercado poderão impactar os valores apresentados.</li>
      </ul>

      <div className="documento-section-title"><div className="n">9</div><div className="t">Responsabilidade técnica</div></div>
      <p className="documento-p">
        A vistoria técnica do imóvel, o levantamento de dados, a pesquisa de mercado e a elaboração da avaliação técnica
        foram realizados por {a.responsavelNome}, {a.responsavelRegistro}
        {a.colaboradorNome ? ` e ${a.colaboradorNome}, ${a.colaboradorRegistro || ''}, no exercício de atividades técnicas de apoio` : ''}.
      </p>
      <p className="documento-p">
        Ressalta-se que o presente Laudo tem caráter técnico subsidiário, sendo encaminhado à Comissão de Avaliação e
        Aluguel, cabendo ao avaliador designado integrante da referida Comissão a análise administrativa, validação e
        assinatura final do processo, conforme as normativas internas do órgão solicitante.
      </p>

      <div className="documento-section-title"><div className="n">10</div><div className="t">Conclusão</div></div>
      <p className="documento-p">
        Diante dos elementos analisados, conclui-se que o valor locatício determinado representa, de forma técnica e
        fundamentada, o justo valor de mercado do imóvel avaliado, atendendo às normas vigentes e à finalidade proposta.
      </p>

      <div className="documento-assinaturas">
        <p className="documento-p" style={{ marginTop: '2rem' }}>Local e data: {a.cidadeAssinatura} {fmtDataCurta(a.dataAssinatura)}.</p>
        <div className="documento-sign-grid">
          <div>
            <div className="linha">{a.avaliadorNome || '(preencha o avaliador da Comissão)'}</div>
            <div className="papel">{a.avaliadorRegistro || ''}</div>
          </div>
        </div>
      </div>

      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} />
      <div className="documento-section-title" style={{ marginTop: 0 }}><div className="n">I</div><div className="t">Anexo I — Tabela de grau de fundamentação</div></div>
      <p className="documento-p" style={{ fontSize: '12px', color: 'var(--doc-muted)' }}>Conforme ABNT NBR 14653-2 — quadro de referência no caso de utilização do tratamento por fatores.</p>
      <table className="documento-table">
        <thead>
          <tr>
            <th rowSpan={2} style={{ verticalAlign: 'middle' }}>Item</th>
            <th rowSpan={2} style={{ verticalAlign: 'middle' }}>Descrição</th>
            <th colSpan={3} style={{ textAlign: 'center' }}>Grau</th>
          </tr>
          <tr>
            <th style={{ textAlign: 'center' }}>III</th>
            <th style={{ textAlign: 'center' }}>II</th>
            <th style={{ textAlign: 'center' }}>I</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Caracterização do imóvel avaliando</td>
            <td>Completa quanto a todos os fatores analisados</td>
            <td>Completa quanto aos fatores utilizados no tratamento</td>
            <td>Adoção de situação paradigma</td>
          </tr>
          <tr>
            <td>2</td>
            <td>Quantidade mínima de dados de mercado, efetivamente utilizados</td>
            <td style={{ textAlign: 'center' }}>12</td>
            <td style={{ textAlign: 'center' }}>5</td>
            <td style={{ textAlign: 'center' }}>3</td>
          </tr>
          <tr>
            <td>3</td>
            <td>Identificação dos dados de mercado</td>
            <td>Apresentação de informações relativas a todas as características dos dados analisados, com foto e características observadas pelo autor do laudo</td>
            <td>Apresentação de informações relativas a todas as características dos dados analisados</td>
            <td>Apresentação de informações relativas a todas as características dos dados correspondentes aos fatores utilizados</td>
          </tr>
          <tr>
            <td>4</td>
            <td>Intervalo admissível de ajuste para o conjunto de fatores</td>
            <td style={{ textAlign: 'center' }}>0,80 a 1,25</td>
            <td style={{ textAlign: 'center' }}>0,50 a 2,00</td>
            <td style={{ textAlign: 'center' }}>0,40 a 2,50 (a)</td>
          </tr>
        </tbody>
      </table>
      <p className="documento-p" style={{ fontSize: '10.5px', color: 'var(--doc-muted)' }}>
        (a) No caso de utilização de menos de cinco dados de mercado, o intervalo admissível de ajuste é de 0,80 a 1,25,
        pois é desejável que, com um número menor de dados de mercado, a amostra seja menos heterogênea.
      </p>

      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} />
      <div className="documento-section-title" style={{ marginTop: 0 }}><div className="n">II</div><div className="t">Anexo II — Tabela de enquadramento do laudo</div></div>
      <p className="documento-p" style={{ fontSize: '12px', color: 'var(--doc-muted)' }}>Conforme ABNT NBR 14653-2 — enquadramento do laudo segundo seu grau de fundamentação, no caso de utilização de tratamento por fatores.</p>
      <table className="documento-table">
        <thead>
          <tr>
            <th>Graus</th>
            <th style={{ textAlign: 'center' }}>III</th>
            <th style={{ textAlign: 'center' }}>II</th>
            <th style={{ textAlign: 'center' }}>I</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Pontos mínimos</td>
            <td style={{ textAlign: 'center' }}>10</td>
            <td style={{ textAlign: 'center' }}>6</td>
            <td style={{ textAlign: 'center' }}>4</td>
          </tr>
          <tr>
            <td>Itens obrigatórios</td>
            <td>Itens 2 e 4 no grau III, com os demais no mínimo no grau II</td>
            <td>Itens 2 e 4 no mínimo no grau II e os demais no mínimo no grau I</td>
            <td>Todos, no mínimo no grau I</td>
          </tr>
        </tbody>
      </table>

      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} />
      <div className="documento-section-title" style={{ marginTop: 0 }}><div className="n">III</div><div className="t">Anexo III — Tabela de homogeneização de valores de imóveis</div></div>
      <p className="documento-p" style={{ fontSize: '12px', color: 'var(--doc-muted)' }}>Imóveis de referência</p>
      <table className="documento-table">
        <thead>
          <tr>
            <th>Nº</th>
            <th>Endereço</th>
            <th>Estado de conservação</th>
            <th>Área (m²)</th>
            <th>Anunciante</th>
            <th>Valor do aluguel</th>
            <th>Fator redutor ({a.fatorRedutorPercent}%)</th>
            <th>Valor aplicado</th>
            <th>Valor de mercado do m²</th>
          </tr>
        </thead>
        <tbody>
          {resumo.comparaveis.length === 0 ? (
            <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--doc-muted)' }}>Nenhum comparável cadastrado</td></tr>
          ) : (
            resumo.comparaveis.map((c, i) => (
              <tr key={c.id}>
                <td>{String(i + 1).padStart(2, '0')}</td>
                <td>{c.endereco || '—'}</td>
                <td>{c.estadoConservacao || '—'}</td>
                <td>{c.areaConstruida ?? '—'}</td>
                <td>{c.anunciante || '—'}</td>
                <td>{fmtMoney(c.valorAluguel)}</td>
                <td>{fmtMoney(c.valorFatorReducao)}</td>
                <td>{fmtMoney(c.valorAplicado)}</td>
                <td>{c.valorM2 != null ? fmtMoney(c.valorM2) : '—'}</td>
              </tr>
            ))
          )}
          <tr className="verificacao">
            <td colSpan={8}>TOTAL</td>
            <td>{fmtMoney(resumo.totalM2)}</td>
          </tr>
          <tr className="verificacao">
            <td colSpan={8}>MÉDIA DO M²</td>
            <td>{resumo.mediaM2 != null ? `${fmtMoney(resumo.mediaM2)}/m²` : '—'}</td>
          </tr>
        </tbody>
      </table>
      <p className="documento-p" style={{ fontSize: '11px', color: 'var(--doc-muted)' }}>Fonte: anúncios online de imobiliárias e corretores, pesquisa de mercado na data de referência.</p>
    </div>
  );
}
