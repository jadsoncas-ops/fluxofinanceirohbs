import { RequerimentoAverbacaoDoc } from '@/lib/producao/requerimentoAverbacao';

export function DocumentoRequerimentoAverbacao({ dados }: { dados: RequerimentoAverbacaoDoc }) {
  const plural = dados.qualificacoes.length > 1;

  return (
    <div className="documento-folha">
      <div className="documento-header" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Requerimento de Averbação</h1>
          <div className="sub">{dados.tituloAto}</div>
        </div>
      </div>

      <p className="documento-p">
        Ao(À) Oficial(a) do<br />{dados.cartorio}
      </p>

      <p className="documento-p" style={{ textAlign: 'center' }}>
        <strong>REQUERIMENTO DE AVERBAÇÃO</strong>
      </p>

      {plural ? (
        <>
          <p className="documento-p" style={{ marginBottom: '0.4rem' }}><strong>QUALIFICAÇÃO DOS REQUERENTES:</strong></p>
          {dados.qualificacoes.map((q, i) => <p key={i} className="documento-p">{q}.</p>)}
          <p className="documento-p">
            Os requerentes acima qualificados, na qualidade de proprietários/interessados do imóvel objeto da matrícula nº {dados.matricula}, vêm respeitosamente requerer a V.Sa. a AVERBAÇÃO da {dados.tipoAtoTexto}, existente no imóvel situado à {dados.enderecoImovel}, conforme documentação emitida pelo órgão competente.
          </p>
        </>
      ) : (
        <p className="documento-p">
          {dados.qualificacoes[0]}, na qualidade de proprietário/interessado do imóvel objeto da matrícula nº {dados.matricula}, vem respeitosamente requerer a V.Sa. a AVERBAÇÃO da {dados.tipoAtoTexto}, existente no imóvel situado à {dados.enderecoImovel}, conforme documentação emitida pelo órgão competente.
        </p>
      )}

      <p className="documento-p">
        A edificação possui área construída de {dados.area}, destinada a {dados.finalidade}, com {dados.pavimentos} pavimento(s), conforme documentação técnica e municipal apresentada.
      </p>

      <p className="documento-p">
        Para fins registrais, atribui-se à construção/obra o valor de {dados.valor}.
      </p>

      <p className="documento-p">
        {plural ? 'Os requerentes apresentam' : 'O requerente apresenta'}, para instrução do presente pedido, a documentação pertinente, incluindo {dados.documentos}.
      </p>

      <p className="documento-p">
        Diante do exposto, {plural ? 'requerem' : 'requer'} a V.Sa. que seja procedida a competente averbação na matrícula do imóvel.
      </p>

      <div className="documento-assinaturas">
        <p className="documento-p" style={{ marginTop: '1.5rem' }}>{dados.municipio}, {dados.data}.</p>
        <div className="documento-sign-grid documento-sign-grid--compacto">
          {dados.assinaturas.map((a, i) => (
            <div key={i}>
              <div className="linha">{a.nome}</div>
              <div className="papel">CPF/CNPJ: {a.documento}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="documento-nota">
        <p>Este é um modelo técnico-administrativo parametrizado, sujeito às exigências específicas do Cartório de Registro de Imóveis competente. Revise e adapte os campos conforme a documentação e as normas locais antes de protocolar.</p>
      </div>
    </div>
  );
}
