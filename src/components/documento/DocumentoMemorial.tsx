import { MemorialData } from '@/lib/producao/memorial';
import { descricaoAreas } from '@/lib/producao/documentoShared';
import { fmtProsa, formatarQuadroFracao } from '@/lib/producao/fracaoIdeal';
import { Process } from '@/lib/types';
import { AssinaturaTitular } from './AssinaturaTitular';
import { QuadroFracaoIdeal } from './QuadroFracaoIdeal';
import logoJadsonCastro from '@/assets/logo-jadson-castro.png';

export function DocumentoMemorial({ dados, trabalho, onSaved }: { dados: MemorialData; trabalho?: Process; onSaved?: () => void }) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  // Mesmos valores (mesma precisão por coluna, mesmos ajustes manuais) do Quadro de Fração Ideal, pra prosa e tabela nunca divergirem na mesma unidade.
  const overrides = trabalho?.tecnico?.quadroFracaoOverrides;
  const casasPorColuna = trabalho?.tecnico?.quadroFracaoCasas;
  const formatadoPorId = new Map(formatarQuadroFracao(dados.quadro, casasPorColuna, overrides).linhas.map((f, i) => [dados.quadro[i].unidade.id, f]));

  return (
    <div className="documento-folha">
      <div className="documento-header">
        <img src={logoJadsonCastro} alt="Jadson Castro — Engenheiro Civil" className="documento-logo" />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h1>Memorial descritivo · fração ideal</h1>
          <div className="sub">Conforme levantamento cadastral e projeto arquitetônico apresentados à prefeitura municipal</div>
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
        <div className="row">
          <div className="lbl">Proprietário(s)</div>
          <div className="val">
            {dados.proprietarios.length
              ? dados.proprietarios.map(p => (p.conjuge ? `${p.conjuge.nome} e cônjuge ${p.nome}` : p.nome)).join(', ')
              : '(a preencher)'}
          </div>
        </div>
        <div className="row">
          <div className="lbl">Endereço do imóvel</div>
          <div className="val">{dados.endereco || '(a preencher)'}</div>
        </div>
        <div className="row">
          <div className="lbl">Área do terreno</div>
          <div className="val">{fmtProsa(dados.terreno)} m²</div>
        </div>
        <div className="row">
          <div className="lbl">Medidas do lote</div>
          <div className="val">{dados.medidas || '(a preencher)'}</div>
        </div>
      </div>

      <div className="documento-section-title">
        <div className="n">1</div>
        <div className="t">Descrição dos pavimentos</div>
      </div>

      {dados.paragrafos.length === 0 && (
        <p className="documento-p">(nenhuma unidade cadastrada ainda — adicione unidades para compor esta seção)</p>
      )}

      {dados.paragrafos.map(p =>
        p.unidade.autonoma === false ? (
          <p key={p.unidade.id} className="documento-p">
            <strong>{p.pavimento.toUpperCase()} ({p.unidade.nome}):</strong>{' '}
            Área de uso comum a todas as unidades, constituída por {p.unidade.comodos || '(descreva o que compõe esta área comum ao editar a unidade)'}.
          </p>
        ) : (
          <p key={p.unidade.id} className="documento-p">
            <strong>{p.pavimento.toUpperCase()} ({p.unidade.nome}):</strong>{' '}
            {descricaoAreas(p, dados.semFracao, true, formatadoPorId.get(p.unidade.id))}. É constituído por {p.unidade.comodos || '(descreva os cômodos ao editar a unidade)'}.
          </p>
        )
      )}

      {!dados.semFracao && dados.quadro.length > 0 && (
        <>
          <div className="documento-section-title">
            <div className="n">2</div>
            <div className="t">Quadro de fração ideal</div>
          </div>
          <QuadroFracaoIdeal linhas={dados.quadro} trabalho={trabalho} onSaved={onSaved} />
        </>
      )}

      {dados.temAreaComum && (
        <>
          <div className="documento-section-title">
            <div className="n">3</div>
            <div className="t">Áreas comuns</div>
          </div>
          <p className="documento-p">
            As áreas comuns descritas na tabela referem-se aos espaços de uso coletivo dos condôminos, que garantem a funcionalidade, segurança e conforto do edifício.
            Elas são compostas pelos seguintes elementos: <strong>{dados.areasComunsTexto || '(descreva os elementos que compõem a área comum)'}</strong>.
            Esses espaços são indispensáveis para o pleno funcionamento do condomínio e são proporcionalmente compartilhados entre todos os proprietários, conforme a fração
            ideal de cada unidade. São de propriedade comum, indivisíveis e inalienáveis.
          </p>
        </>
      )}

      <div className="documento-assinaturas">
        <div className="documento-section-title">
          <div className="n">4</div>
          <div className="t">Responsáveis</div>
        </div>
        <div className="documento-sign-grid">
          <div>
            <div className="linha">{dados.responsavel.responsavelNome || '(configure em Configurações)'}</div>
            <div className="papel">
              {dados.responsavel.responsavelTitulo || ''}
              {dados.responsavel.responsavelCrea ? ` — ${dados.responsavel.responsavelCrea}` : ''}
              {dados.art ? ` — ART Nº ${dados.art}` : ''}
            </div>
          </div>
        </div>
        <div className="documento-sign-grid">
          {dados.proprietarios.length ? (
            dados.proprietarios.map((p, i) => (
              <AssinaturaTitular key={i} nome={p.nome || '(preencha o proprietário)'} conjuge={p.conjuge} secundaria={<>{p.cpf ? `CPF/CNPJ: ${p.cpf}` : '(CPF/CNPJ não informado)'}{p.unidadesRef ? ` — ${p.unidadesRef}` : ''}</>} />
            ))
          ) : (
            <div>
              <div className="linha">(preencha o proprietário)</div>
              <div className="papel">(CPF/CNPJ não informado)</div>
            </div>
          )}
        </div>
      </div>

      <div className="documento-footer">
        <div>{dados.responsavel.endereco || 'HBS Engenharia'}</div>
        <div>{[dados.responsavel.telefone, dados.responsavel.email].filter(Boolean).join(' | ')}</div>
      </div>
    </div>
  );
}
