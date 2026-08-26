import { InstituicaoData } from '@/lib/producao/instituicao';
import { descricaoAreas } from '@/lib/producao/documentoShared';
import { fmtProsa } from '@/lib/producao/fracaoIdeal';
import { AssinaturaTitular } from './AssinaturaTitular';

export function DocumentoInstituicao({ dados }: { dados: InstituicaoData }) {
  const medidasBruto = dados.medidas || '(medidas do lote a preencher)';
  const jaTemArea = /totalizando|área total/i.test(medidasBruto);
  const medidasTexto = medidasBruto.replace(/\.\s*$/, '');

  return (
    <div className="documento-folha">
      <div className="documento-header" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Instituição de condomínio · finalidade residencial</h1>
          <div className="sub">{dados.endereco}</div>
        </div>
      </div>

      <div className="documento-section-title"><div className="n">1</div><div className="t">Proprietário(s)</div></div>
      {dados.qualificacoes.length === 0 && <p className="documento-p">(a preencher)</p>}
      {dados.qualificacoes.map((q, i) => <p key={i} className="documento-p">{q}</p>)}

      <p className="documento-p">
        <strong>TERRENO:</strong> {medidasTexto}{jaTemArea ? '' : ` totalizando ${fmtProsa(dados.terreno)}m²`}, situado {dados.endereco}, cadastrado na Prefeitura Municipal sob nº {dados.inscricoes || '(inscrições a preencher por unidade)'}.
      </p>
      <p className="documento-p">
        <strong>ORIGEM E DISPONIBILIDADE:</strong> Adquirido pelo(s) proprietário(s) acima, nos termos da transcrição do registro na matrícula {dados.matricula || '(a preencher)'}, estando livre de ônus reais, fiscais, judiciais e extrajudiciais, sendo declarado por todos na forma da lei.
      </p>

      <div className="documento-section-title"><div className="n">2</div><div className="t">Instituição de condomínio</div></div>
      <p className="documento-p">
        O(s) proprietário(s) acima nomeado(s) e qualificado(s), tendo edificado sobre o terreno em tela o empreendimento abaixo caracterizado, submete(m) ao regime do Condomínio Edilício nos termos dos arts. 1.331 e seguintes do Código Civil e da Lei nº 4.591/1964, instituindo em condomínio especial e individualizando as unidades autônomas, tudo como segue, conforme projeto aprovado pela Prefeitura Municipal.
      </p>

      {dados.paragrafos.map(p => (
        <p key={p.unidade.id} className="documento-p">
          <strong>{p.pavimento.toUpperCase()} ({p.unidade.nome}):</strong>{' '}
          {descricaoAreas(p, dados.semFracao, p.unidade.autonoma !== false)}, é constituído por {p.unidade.comodos || '(cômodos a preencher)'}.
        </p>
      ))}

      <p className="documento-p">
        EDIFÍCIO &quot;{dados.nomeTrabalho.toUpperCase()}&quot; é constituído das unidades autônomas acima descritas, totalizando área edificada de {fmtProsa(dados.somaTotal)}m².
      </p>

      <div className="documento-section-title"><div className="n">3</div><div className="t">Documentação exigida por lei</div></div>
      <p className="documento-p">Integram o presente memorial os documentos exigidos em lei.</p>

      {dados.areasComunsTexto && (
        <>
          <div className="documento-section-title"><div className="n">4</div><div className="t">Das áreas comuns</div></div>
          <p className="documento-p">
            São áreas e partes comuns do edifício, indivisíveis e inalienáveis: o terreno sobre o qual foram edificadas as unidades autônomas, bem como as fundações, colunas e vigas de sustentação, paredes externas e, enfim, tudo o mais que se destine a servir indistintamente todas as unidades, especialmente: <strong>{dados.areasComunsTexto}</strong>.
          </p>
        </>
      )}

      <div className="documento-section-title"><div className="n">5</div><div className="t">Requerimento</div></div>
      <p className="documento-p">Conforme exposto, o(s) requerente(s) solicita(m) o registro da presente Instituição de Condomínio, para que produza seus jurídicos e legais efeitos.</p>

      <div className="documento-assinaturas">
        <p className="documento-p" style={{ marginTop: '2rem' }}>Itabuna, Bahia, {new Date().toLocaleDateString('pt-BR')}</p>
        <div className="documento-section-title"><div className="n">✓</div><div className="t">Assinaturas</div></div>
        <div className="documento-sign-grid">
          {dados.proprietariosAssinatura.map((p, i) => (
            <AssinaturaTitular key={i} nome={p.nome || '(a preencher)'} conjuge={p.conjuge} secundaria={<>{p.cpf ? `CPF: ${p.cpf}` : ''}{p.unidadesRef ? ` — ${p.unidadesRef}` : ''}</>} />
          ))}
        </div>
      </div>
    </div>
  );
}
