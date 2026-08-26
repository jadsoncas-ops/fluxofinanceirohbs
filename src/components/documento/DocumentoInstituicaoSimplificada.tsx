import { InstituicaoSimplificadaData } from '@/lib/producao/instituicaoSimplificada';
import { descricaoAreas, TEXTO_ATIPICIDADE_SIMPLIFICADA } from '@/lib/producao/documentoShared';
import { fmtProsa, formatarQuadroFracao } from '@/lib/producao/fracaoIdeal';
import { Process } from '@/lib/types';
import { AssinaturaTitular } from './AssinaturaTitular';
import { QuadroFracaoIdeal } from './QuadroFracaoIdeal';

export function DocumentoInstituicaoSimplificada({ dados, trabalho, onSaved }: { dados: InstituicaoSimplificadaData; trabalho?: Process; onSaved?: () => void }) {
  const medidasBruto = dados.medidas || '(medidas do lote a preencher)';
  const jaTemArea = /totalizando|área total/i.test(medidasBruto);
  const medidasTexto = medidasBruto.replace(/\.\s*$/, '');
  const overrides = trabalho?.tecnico?.quadroFracaoOverrides;
  const casasPorColuna = trabalho?.tecnico?.quadroFracaoCasas;
  const formatadoPorId = new Map(formatarQuadroFracao(dados.quadro, casasPorColuna, overrides).linhas.map((f, i) => [dados.quadro[i].unidade.id, f]));

  return (
    <div className="documento-folha">
      <div className="documento-header" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Especificação simplificada de condomínio</h1>
          <div className="sub">{dados.endereco}</div>
        </div>
      </div>

      <p className="documento-p" style={{ textAlign: 'center' }}>
        <strong>INSTRUMENTO PARTICULAR DE ESPECIFICAÇÃO SIMPLIFICADA DE CONDOMÍNIO EDILÍCIO &quot;{dados.nomeTrabalho.toUpperCase()}&quot;</strong>
      </p>

      <div className="documento-section-title"><div className="n">1</div><div className="t">Dos proprietários</div></div>
      {dados.qualificacoes.length === 0 && <p className="documento-p">(a preencher)</p>}
      {dados.qualificacoes.map((q, i) => <p key={i} className="documento-p">{q.texto}</p>)}

      <div className="documento-section-title"><div className="n">2</div><div className="t">Da origem registral</div></div>
      <p className="documento-p">As unidades descritas neste instrumento são oriundas da matrícula-mãe nº {dados.matriculaMae || '(a preencher)'}.</p>

      <div className="documento-section-title"><div className="n">3</div><div className="t">Da área total do terreno</div></div>
      <p className="documento-p">{medidasTexto}{jaTemArea ? '' : ` totalizando ${fmtProsa(dados.terreno)}m²`}, situado {dados.endereco}.</p>

      <div className="documento-section-title"><div className="n">4</div><div className="t">Da caracterização do prédio</div></div>
      <p className="documento-p">{TEXTO_ATIPICIDADE_SIMPLIFICADA}</p>
      <p className="documento-p">
        O empreendimento está situado {dados.endereco}, e possui {new Set(dados.paragrafos.map(p => p.pavimento)).size} pavimento(s) e {dados.paragrafos.length} unidade(s) autônoma(s), com as seguintes descrições:
      </p>

      {dados.paragrafos.map(p => (
        <p key={p.unidade.id} className="documento-p">
          <strong>{p.pavimento.toUpperCase()} ({p.unidade.nome}):</strong>{' '}
          {descricaoAreas(p, dados.semFracao, p.unidade.autonoma !== false, formatadoPorId.get(p.unidade.id))}, com as seguintes características: {p.unidade.comodos || '(cômodos a preencher)'}.{' '}
          {p.unidade.inscricao ? `Inscrição municipal: ${p.unidade.inscricao}.` : ''}
        </p>
      ))}

      {!dados.semFracao && dados.quadro.length > 0 && <QuadroFracaoIdeal linhas={dados.quadro} trabalho={trabalho} onSaved={onSaved} />}

      <div className="documento-section-title"><div className="n">5</div><div className="t">Do uso das unidades autônomas</div></div>
      <p className="documento-p">
        {dados.paragrafos.map(p => `A unidade ${p.pavimento.toLowerCase()} (${p.unidade.nome}) tem destinação ${p.unidade.tipo.toLowerCase()}`).join('; ')}.
      </p>

      <div className="documento-section-title"><div className="n">6</div><div className="t">Das áreas e coisas de uso comum</div></div>
      <p className="documento-p">
        {dados.areasComunsBoilerplate}{dados.areasComunsTexto ? ` Especialmente: ${dados.areasComunsTexto}.` : ''}
      </p>

      <div className="documento-section-title"><div className="n">7</div><div className="t">Do requerimento</div></div>
      <p className="documento-p">Requer(em) o registro da presente especificação simplificada de condomínio, para que produza seus efeitos jurídicos e legais.</p>

      <div className="documento-assinaturas">
        <p className="documento-p" style={{ marginTop: '2rem' }}>Itabuna/BA, {new Date().toLocaleDateString('pt-BR')}</p>
        <div className="documento-sign-grid">
          {dados.qualificacoes.length ? (
            dados.qualificacoes.map((q, i) => (
              <AssinaturaTitular key={i} nome={q.nome || '(a preencher)'} conjuge={q.conjuge} secundaria={<>{q.cpf ? `CPF: ${q.cpf}` : ''}{q.unidadesRef ? ` — ${q.unidadesRef}` : ''}</>} />
            ))
          ) : (
            <div><div className="linha">(a preencher)</div><div className="papel"></div></div>
          )}
        </div>
      </div>
    </div>
  );
}
