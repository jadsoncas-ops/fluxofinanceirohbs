import { useState } from 'react';
import { Process, Client, CompanyConfig } from '@/lib/types';
import { montarLaudo } from '@/lib/producao/laudo';
import logoJadsonCastro from '@/assets/logo-jadson-castro.png';

export function DocumentoLaudo({ trabalho, cliente, config }: { trabalho: Process; cliente: Client | undefined; config: CompanyConfig }) {
  const [inadequacoes, setInadequacoes] = useState('');
  const [construidoAntes2015, setConstruidoAntes2015] = useState(false);
  const [omitirDescricaoUnidades, setOmitirDescricaoUnidades] = useState(false);
  const dados = montarLaudo(trabalho, cliente, config, inadequacoes, construidoAntes2015, omitirDescricaoUnidades);
  const hoje = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="documento-folha">
      <div className="no-print" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--doc-line)', borderRadius: '10px', padding: '16px', background: '#fafafa' }}>
        <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--doc-muted)', fontFamily: 'system-ui, sans-serif' }}>
          Inadequações constatadas na vistoria (deixe em branco se não houver)
        </label>
        <textarea
          value={inadequacoes}
          onChange={e => setInadequacoes(e.target.value)}
          placeholder="Ex: iluminação natural insuficiente no dormitório 2, ausência de ventilação cruzada na cozinha"
          rows={2}
          style={{ borderRadius: '8px', border: '1px solid var(--doc-line)', padding: '8px 10px', fontSize: '13px', fontFamily: 'system-ui, sans-serif', outline: 'none' }}
        />
        <p style={{ fontSize: '11px', color: 'var(--doc-muted)', fontFamily: 'system-ui, sans-serif', margin: 0 }}>Preenche aqui antes de imprimir — não fica salvo separadamente.</p>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontFamily: 'system-ui, sans-serif', color: 'var(--doc-ink)', marginTop: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={construidoAntes2015} onChange={e => setConstruidoAntes2015(e.target.checked)} />
          Construção executada antes de 2015 (anterior ao atual Código de Obras)
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontFamily: 'system-ui, sans-serif', color: 'var(--doc-ink)', marginTop: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={omitirDescricaoUnidades} onChange={e => setOmitirDescricaoUnidades(e.target.checked)} />
          Não descrever os ambientes das unidades no texto
        </label>
      </div>

      <div className="documento-header">
        <img src={logoJadsonCastro} alt="Jadson Castro — Engenheiro Civil" className="documento-logo" />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h1>Relatório de vistoria e laudo de habitabilidade</h1>
          <div className="sub">Conforme vistoria técnica realizada no imóvel</div>
        </div>
        <div className="kicker">{hoje}</div>
      </div>

      <div className="documento-idbox">
        <div className="row">
          <div className="lbl">Profissional</div>
          <div className="val">
            {dados.responsavel.responsavelNome || '(configure em Configurações)'}
            {dados.responsavel.responsavelCrea ? ` — ${dados.responsavel.responsavelCrea}` : ''}
            {dados.art ? ` — ART Nº ${dados.art}` : ''}
          </div>
        </div>
        <div className="row"><div className="lbl">Proprietário</div><div className="val">{dados.nomesProprietarios}</div></div>
        <div className="row"><div className="lbl">Endereço</div><div className="val">{dados.endereco || '(a preencher)'}</div></div>
      </div>

      <p className="documento-p">Em atendimento à solicitação, apresento laudo técnico do imóvel em questão, com intuito de verificação de seu estado atual de habitabilidade.</p>

      <div className="documento-section-title"><div className="n">1</div><div className="t">Procedimentos adotados</div></div>
      <p className="documento-p">A inspeção foi conduzida através da verificação da conformidade do imóvel em relação aos requisitos exigidos e das recomendações da legislação vigente: Código de Obras e Plano Diretor Municipal.</p>
      <p className="documento-p">Trata-se de imóvel residencial{dados.descricaoAmbientes ? ` com ${dados.descricaoAmbientes}` : ''}. {dados.fraseInadequacoes}{dados.fraseEpocaConstrucao ? ` ${dados.fraseEpocaConstrucao}` : ''}</p>

      <div className="documento-section-title"><div className="n">2</div><div className="t">Declaração de conformidade</div></div>
      <p className="documento-p">Declaro, portanto, que o imóvel descrito está em conformidade com o relatório acima, atende as condições abaixo:</p>
      <ol style={{ margin: '0 0 0.85rem 1.2rem', padding: 0, fontSize: '13.5px', lineHeight: 1.7 }}>
        <li>Não está localizado em área de risco, em Áreas de Proteção Ambiental, várzeas ou áreas de preservação permanente (APP);</li>
        <li>Está localizado em loteamento regular e liberado para construção;</li>
        <li>A atividade desenvolvida no local está de acordo com a lei de uso e ocupação do solo;</li>
        <li>Não se trata de ÁREA PÚBLICA;</li>
        <li>Apresenta condições de segurança, habitabilidade e higiene, ou seja, está em condições para expedição do habite-se de que trata a Lei em vigor.</li>
      </ol>

      <div className="documento-assinaturas">
        <p className="documento-p" style={{ marginTop: '2rem' }}>Itabuna, {hoje}</p>
        <div className="documento-sign-grid">
          <div>
            <div className="linha">{dados.responsavel.responsavelNome || '(configure em Configurações)'}</div>
            <div className="papel">
              {dados.responsavel.responsavelTitulo || ''}
              {dados.responsavel.responsavelCrea ? ` — ${dados.responsavel.responsavelCrea}` : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="documento-footer">
        <div>{dados.responsavel.endereco || 'HBS Engenharia'}</div>
        <div>{[dados.responsavel.telefone, dados.responsavel.email].filter(Boolean).join(' | ')}</div>
      </div>
    </div>
  );
}
