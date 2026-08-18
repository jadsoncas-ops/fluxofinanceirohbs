import { ConvencaoData } from '@/lib/producao/convencao';
import { descricaoAreas } from '@/lib/producao/documentoShared';
import { fmtProsa } from '@/lib/producao/fracaoIdeal';
import { AssinaturaTitular } from './AssinaturaTitular';

export function DocumentoConvencao({ dados }: { dados: ConvencaoData }) {
  return (
    <div className="documento-folha">
      <div className="documento-header" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Convenção de condomínio</h1>
          <div className="sub">{dados.endereco}</div>
        </div>
      </div>

      <p className="documento-p">
        Convenção de Condomínio que entre si fazem os Condôminos do Edifício &quot;{dados.nomeTrabalho.toUpperCase()}&quot;, sito à {dados.endereco || '(endereço a preencher)'}, cadastro municipal: {dados.inscricoes || '(a preencher)'}.
      </p>

      <div className="documento-section-title"><div className="n">1</div><div className="t">Qualificação dos condôminos</div></div>
      {dados.qualificacoes.length === 0 && <p className="documento-p">(a preencher)</p>}
      {dados.qualificacoes.map((q, i) => <p key={i} className="documento-p">{q}</p>)}

      <div className="documento-section-title"><div className="n">2</div><div className="t">Do objeto e destinação</div></div>
      <p className="documento-p">
        O Edifício &quot;{dados.nomeTrabalho.toUpperCase()}&quot; compõe-se de unidades de uso {dados.semFracao ? 'exclusivo' : 'autônomo'}, com área total de {fmtProsa(dados.somaTotal)}m², assim caracterizadas:
      </p>

      {dados.paragrafos.map(p => (
        <p key={p.unidade.id} className="documento-p">
          <strong>{p.pavimento.toUpperCase()} ({p.unidade.nome}):</strong>{' '}
          {descricaoAreas(p, dados.semFracao, p.unidade.autonoma !== false)}, é constituído por {p.unidade.comodos || '(cômodos a preencher)'}.
        </p>
      ))}

      {dados.artigos.map((paragrafo, i) => {
        const ehTitulo = /^CAP[IÍ]TULO/i.test(paragrafo);
        if (ehTitulo) {
          return <div className="documento-section-title" key={i}><div className="n">§</div><div className="t">{paragrafo}</div></div>;
        }
        return <p key={i} className="documento-p">{paragrafo}</p>;
      })}

      <div className="documento-assinaturas">
        <p className="documento-p" style={{ marginTop: '2rem' }}>Itabuna/BA, {new Date().toLocaleDateString('pt-BR')}</p>
        <div className="documento-sign-grid">
          {dados.proprietarios.map((p, i) => (
            <AssinaturaTitular key={i} nome={p.nome || '(a preencher)'} conjuge={p.conjuge} secundaria={<>{p.cpf ? `CPF: ${p.cpf}` : ''}{p.unidades ? ` — ${p.unidades}` : ''}</>} />
          ))}
        </div>
      </div>
    </div>
  );
}
