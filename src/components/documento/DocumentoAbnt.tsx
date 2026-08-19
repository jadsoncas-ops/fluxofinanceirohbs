import { useMemo, useState } from 'react';
import { Unidade, CompanyConfig } from '@/lib/types';
import { calcularQuadroAbnt, fmtMoeda } from '@/lib/producao/abnt';
import { fmt } from '@/lib/producao/fracaoIdeal';
import { ConjugeAssinatura } from '@/lib/producao/documentoShared';
import { AssinaturaTitular } from './AssinaturaTitular';
import logoJadsonCastro from '@/assets/logo-jadson-castro.png';

function Th({ principal, secundario }: { principal: string; secundario?: string }) {
  return (
    <th>
      <span className="th-principal">{principal}</span>
      {secundario && <span className="th-secundario">{secundario}</span>}
    </th>
  );
}

type TipoReferencia = 'cub' | 'adotado';

function justificativaCub(valorNum: number, referencia: string) {
  return `O presente cálculo foi elaborado com base no Custo Unitário Básico da Construção Civil (CUB/m²)${
    valorNum ? `, no valor de R$ ${fmtMoeda(valorNum)}/m²,` : ''
  } referente ao mês de ${
    referencia || '[mês/ano de referência]'
  }, divulgado pelo Sindicato da Indústria da Construção Civil do Estado da Bahia — SINDUSCON-BA, em conformidade com os critérios estabelecidos pela ABNT NBR 12721:2006. Os valores atribuídos às unidades autônomas no Quadro IV-A destinam-se exclusivamente à instrução do processo de instituição de condomínio edilício, não constituindo avaliação mercadológica do imóvel.`;
}

function justificativaEspecifico(valorNum: number, referencia: string) {
  const valorTexto = valorNum ? `R$ ${fmtMoeda(valorNum)}/m²` : '[valor]';
  const referenciaTexto = referencia || '[mês/ano de referência]';
  return `Para fins deste levantamento, foi adotado o valor unitário de referência de ${valorTexto}, com referência temporal em ${referenciaTexto}, considerando as características construtivas observadas, o padrão da edificação e o período de sua construção.\n\nO valor adotado constitui parâmetro técnico específico para a composição dos custos da edificação, não correspondendo a CUB oficial. Para a composição dos custos das unidades autônomas, foram aplicados os critérios de área equivalente e proporcionalidade previstos na ABNT NBR 12721:2006.\n\nO valor resultante destina-se exclusivamente à composição dos custos de construção para os fins deste documento, não constituindo avaliação de valor de mercado, valor venal ou preço de comercialização do imóvel.`;
}

export function DocumentoAbnt({
  nomeTrabalho,
  units,
  responsavel,
  art,
  proprietarios,
}: {
  nomeTrabalho: string;
  units: Unidade[];
  responsavel: CompanyConfig;
  art: string;
  proprietarios: { nome: string; cpf?: string; conjuge?: ConjugeAssinatura }[];
}) {
  const [tipoReferencia, setTipoReferencia] = useState<TipoReferencia>('cub');
  const [valor, setValor] = useState('');
  const [referencia, setReferencia] = useState('');
  const [justificativaComplemento, setJustificativaComplemento] = useState('');
  const valorNum = parseFloat(valor.replace(',', '.')) || 0;

  const { linhas, totais, somaTotal } = useMemo(() => calcularQuadroAbnt(units, valorNum), [units, valorNum]);

  const ehCub = tipoReferencia === 'cub';
  const rotuloValor = ehCub ? 'CUB (R$/m²)' : 'Valor unitário de referência (R$/m²)';
  const rotuloMesAno = ehCub ? 'Mês/ano de referência (SINDUSCON-BA)' : 'Mês/ano de referência';
  const justificativa = ehCub ? justificativaCub(valorNum, referencia) : justificativaEspecifico(valorNum, referencia);
  const justificativaCompleta = !ehCub && justificativaComplemento.trim() ? `${justificativa}\n\n${justificativaComplemento.trim()}` : justificativa;

  return (
    <div className="documento-folha">
      <div className="no-print" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--doc-line)', borderRadius: '10px', padding: '16px', background: '#fafafa' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--doc-muted)', fontFamily: 'system-ui, sans-serif' }}>Tipo de referência</label>
          <div style={{ display: 'inline-flex', width: 'fit-content', border: '1px solid var(--doc-line)', borderRadius: '8px', padding: '3px' }}>
            <button type="button" onClick={() => setTipoReferencia('cub')} className={tipoReferenciaBtnCls(ehCub)}>CUB</button>
            <button type="button" onClick={() => setTipoReferencia('adotado')} className={tipoReferenciaBtnCls(!ehCub)}>Valor unitário de referência específico</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--doc-muted)', fontFamily: 'system-ui, sans-serif' }}>{rotuloValor}</label>
            <input value={valor} onChange={e => setValor(e.target.value)} placeholder={ehCub ? 'Ex: 2150,00' : 'Ex: 860,00'} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--doc-muted)', fontFamily: 'system-ui, sans-serif' }}>{rotuloMesAno}</label>
            <input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder={ehCub ? 'Ex: agosto/2026' : 'Ex: agosto de 1988'} style={{ ...inputStyle, width: '210px' }} />
          </div>
        </div>

        {!ehCub && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--doc-muted)', fontFamily: 'system-ui, sans-serif' }}>Complemento à justificativa (some ao texto padrão abaixo, no documento)</label>
            <textarea value={justificativaComplemento} onChange={e => setJustificativaComplemento(e.target.value)} rows={4} placeholder="Ex: Edificação construída originalmente em 1988, apresentando padrão construtivo inferior às referências atuais..." style={{ ...inputStyle, width: '100%' }} />
          </div>
        )}

        <p style={{ fontSize: '11px', color: 'var(--doc-muted)', fontFamily: 'system-ui, sans-serif', margin: 0 }}>Preenche aqui antes de gerar — não fica salvo separadamente, é parte deste documento.</p>
      </div>

      <div className="documento-header">
        <img src={logoJadsonCastro} alt="Jadson Castro — Engenheiro Civil" className="documento-logo" />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="kicker">Conforme ABNT NBR 12721:2006</div>
          <h1>Quadros IV-A e IV-B</h1>
        </div>
        <div className="kicker">&nbsp;</div>
      </div>

      <div className="documento-idbox">
        <div className="row">
          <div className="lbl">Profissional</div>
          <div className="val">
            {responsavel.responsavelNome || '(configure em Configurações)'}
            {responsavel.responsavelCrea ? ` — ${responsavel.responsavelCrea}` : ''}
            {art ? ` — ART Nº ${art}` : ''}
          </div>
        </div>
        <div className="row">
          <div className="lbl">Tipo de referência</div>
          <div className="val">{ehCub ? 'CUB' : 'Valor unitário de referência específico'}</div>
        </div>
        {ehCub ? (
          <div className="row">
            <div className="lbl">CUB de referência</div>
            <div className="val">{valorNum ? `R$ ${fmtMoeda(valorNum)}/m²` : '(a preencher)'}{referencia ? ` — ${referencia}` : ''}</div>
          </div>
        ) : (
          <div className="row">
            <div className="lbl">Valor unitário de referência</div>
            <div className="val">{valorNum ? `R$ ${fmtMoeda(valorNum)}/m²` : '(a preencher)'}{referencia ? ` — referência temporal: ${referencia}` : ''}</div>
          </div>
        )}
      </div>

      <div className="documento-section-title"><div className="n">A</div><div className="t">Quadro IV-A — Custo de construção da unidade autônoma</div></div>
      <table className="documento-table">
        <colgroup>
          <col style={{ width: '12%' }} /><col style={{ width: '16%' }} /><col style={{ width: '12%' }} /><col style={{ width: '21%' }} /><col style={{ width: '15%' }} /><col style={{ width: '13%' }} /><col style={{ width: '11%' }} />
        </colgroup>
        <thead>
          <tr>
            <Th principal="Designação da unidade" />
            <Th principal="Área equivalente" secundario="em área de custo padrão das unidades" />
            <Th principal="Custo" />
            <Th principal="Coeficiente de proporcionalidade" secundario="(para rateio do custo de construção)" />
            <Th principal="Total" secundario="(total de unidades idênticas sub-rogadas ou não)" />
            <Th principal="Unidades sub-rogadas" />
            <Th principal="Diferença" secundario="(unidades que suportam o custo da edificação)" />
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.label}>
              <td>{l.label}</td>
              <td>{fmt(l.privativaTotal)}</td>
              <td style={{ whiteSpace: 'nowrap' }}>R$ {fmtMoeda(l.custo)}</td>
              <td>{fmt(l.coefCusto, 5)}</td>
              <td>1</td>
              <td>—</td>
              <td>1</td>
            </tr>
          ))}
          <tr className="verificacao">
            <td>TOTAIS</td>
            <td>{fmt(totais.privativaTotal)}</td>
            <td style={{ whiteSpace: 'nowrap' }}>R$ {fmtMoeda(totais.custo)}</td>
            <td>1,00000</td>
            <td>{linhas.length}</td>
            <td>—</td>
            <td>{linhas.length}</td>
          </tr>
        </tbody>
      </table>

      <div className="documento-nota">
        {justificativaCompleta.split('\n\n').map((paragrafo, i) => <p key={i}>{paragrafo}</p>)}
      </div>

      <div className="documento-section-title"><div className="n">B</div><div className="t">Quadro IV-B — Áreas reais</div></div>
      <table className="documento-table">
        <colgroup>
          <col style={{ width: '11%' }} /><col style={{ width: '9%' }} /><col style={{ width: '11%' }} /><col style={{ width: '9%' }} /><col style={{ width: '9%' }} /><col style={{ width: '9%' }} /><col style={{ width: '22%' }} /><col style={{ width: '20%' }} />
        </colgroup>
        <thead>
          <tr>
            <Th principal="Designação da unidade" />
            <Th principal="Área privativa" secundario="(principal)" />
            <Th principal="Outras áreas privativas" secundario="(acessórias)" />
            <Th principal="Área privativa total" />
            <Th principal="Área de uso comum" />
            <Th principal="Área real total" />
            <Th principal="Coeficiente de proporcionalidade" />
            <Th principal="Quantitativo" secundario="(número de unidades idênticas)" />
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.label}>
              <td>{l.label}</td>
              <td>{fmt(l.privativa)}</td>
              <td>{fmt(l.garagem)}</td>
              <td>{fmt(l.privativaTotal)}</td>
              <td>{fmt(l.comum)}</td>
              <td>{fmt(l.areaReal)}</td>
              <td>{fmt(l.coefArea, 5)}</td>
              <td>1</td>
            </tr>
          ))}
          <tr className="verificacao">
            <td>TOTAL</td>
            <td>{fmt(totais.privativa)}</td>
            <td>{fmt(totais.garagem)}</td>
            <td>{fmt(totais.privativaTotal)}</td>
            <td>{fmt(totais.comum)}</td>
            <td>{fmt(totais.areaReal)}</td>
            <td>{fmt(somaTotal ? totais.areaReal / somaTotal : 0, 5)}</td>
            <td>{linhas.length}</td>
          </tr>
        </tbody>
      </table>

      <div className="documento-assinaturas">
        <div className="documento-section-title"><div className="n">✓</div><div className="t">Responsáveis</div></div>
        <div className="documento-sign-grid" style={{ gap: '48px 24px', marginTop: '5.5rem' }}>
          <div>
            <div className="linha">{responsavel.responsavelNome || '(configure em Configurações)'}</div>
            <div className="papel">
              {responsavel.responsavelTitulo || ''}
              {responsavel.responsavelCrea ? ` — ${responsavel.responsavelCrea}` : ''}
              {art ? ` — ART Nº ${art}` : ''}
            </div>
          </div>
          {proprietarios.map((p, i) => (
            <AssinaturaTitular key={i} nome={p.nome || '(preencha o proprietário)'} conjuge={p.conjuge} secundaria={p.cpf ? `CPF/CNPJ: ${p.cpf}` : '(CPF/CNPJ não informado)'} />
          ))}
        </div>
      </div>

      <div className="documento-footer">
        <div>{responsavel.endereco || 'HBS Engenharia'}</div>
        <div>{[responsavel.telefone, responsavel.email].filter(Boolean).join(' | ')}</div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '190px',
  borderRadius: '8px',
  border: '1px solid var(--doc-line)',
  padding: '8px 10px',
  fontSize: '13px',
  fontFamily: 'system-ui, sans-serif',
  outline: 'none',
};

function tipoReferenciaBtnCls(active: boolean) {
  return active ? 'documento-abnt-tab documento-abnt-tab--active' : 'documento-abnt-tab';
}
