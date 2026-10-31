import { ContratoDoc } from '@/lib/comercial/contratoDoc';

/** Contrato no formato do modelo do profissional: título, abertura com as partes, cláusulas, assinaturas e rodapé
 *  (telefone/e-mail) repetido em cada página. */
export function DocumentoContrato({ dados }: { dados: ContratoDoc }) {
  return (
    <div className="documento-folha">
      <p className="documento-p" style={{ textAlign: 'center', fontSize: '15px', marginBottom: '1.25rem' }}>
        <strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS DE ENGENHARIA</strong>
      </p>

      <p className="documento-p">{dados.abertura}</p>

      {dados.clausulas.map(cl => (
        <div key={cl.titulo}>
          <p className="documento-p" style={{ marginTop: '0.9rem', marginBottom: '0.35rem', breakAfter: 'avoid' }}><strong>{cl.titulo}</strong></p>
          {cl.blocos.map((b, i) => (
            <p key={i} className="documento-p" style={b.recuo ? { marginLeft: '1.25rem', marginBottom: '0.3rem' } : undefined}>{b.texto}</p>
          ))}
        </div>
      ))}

      <div className="documento-assinaturas">
        <p className="documento-p" style={{ marginTop: '1.5rem', textAlign: 'right' }}>{dados.cidade}, {dados.data}</p>

        <div className="documento-sign-grid documento-sign-grid--compacto">
          <div>
            <div className="linha">{dados.contratado.nome}</div>
            <div className="papel">Profissional</div>
            <div className="papel">{dados.contratado.titulo}{dados.contratado.crea ? ` · ${dados.contratado.crea}` : ''}</div>
          </div>
          {dados.contratantes.map((c, i) => (
            <div key={i}>
              <div className="linha">{c.nome}</div>
              <div className="papel">{c.representado ? `Representante legal · CNPJ ${c.documento}` : `CPF ${c.documento}`}</div>
            </div>
          ))}
        </div>

        {dados.testemunhas && (
          <div className="documento-sign-grid documento-sign-grid--compacto" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '3.5rem' }}>
            {[1, 2].map(n => (
              <div key={n}>
                <div className="linha">Testemunha {n}</div>
                <div className="papel">Nome: ______________________________</div>
                <div className="papel" style={{ marginTop: '0.35rem' }}>CPF: ______________________________</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {dados.rodape && (
        <div className="documento-footer">
          <div>{dados.rodape}</div>
        </div>
      )}
    </div>
  );
}
