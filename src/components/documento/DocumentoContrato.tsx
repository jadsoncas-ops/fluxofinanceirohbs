import { ContratoDoc } from '@/lib/comercial/contratoDoc';

/** Item de lista dentro de uma cláusula ("a) ...", "b) ...") — vem recuado; o restante é parágrafo normal. */
const ehItemDeLista = (texto: string) => /^[a-z]\) /.test(texto);

export function DocumentoContrato({ dados }: { dados: ContratoDoc }) {
  const { plural } = dados;

  return (
    <div className="documento-folha">
      <div className="documento-header" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Contrato de Prestação de Serviços Técnicos de Engenharia</h1>
          <div className="sub">Contrato {dados.codigo}{dados.propostaCodigo ? ` · Proposta ${dados.propostaCodigo}` : ''}</div>
        </div>
      </div>

      <p className="documento-p"><strong>CONTRATADA:</strong> {dados.contratada.qualificacao}</p>

      {plural ? (
        <>
          <p className="documento-p" style={{ marginBottom: '0.4rem' }}><strong>CONTRATANTES:</strong></p>
          {dados.contratantes.map((c, i) => <p key={i} className="documento-p">{c.qualificacao}</p>)}
        </>
      ) : (
        <p className="documento-p"><strong>CONTRATANTE:</strong> {dados.contratantes[0].qualificacao}</p>
      )}

      <p className="documento-p">
        As partes acima qualificadas têm entre si justo e contratado o presente contrato de prestação de serviços técnicos de engenharia, que se rege pelas cláusulas e condições seguintes:
      </p>

      {dados.clausulas.map(cl => (
        <div key={cl.titulo}>
          <p className="documento-p" style={{ marginBottom: '0.4rem', marginTop: '0.4rem' }}><strong>{cl.titulo}</strong></p>
          {cl.paragrafos.map((p, i) => (
            <p key={i} className="documento-p" style={ehItemDeLista(p) ? { marginLeft: '1.25rem', marginBottom: '0.3rem' } : undefined}>{p}</p>
          ))}
        </div>
      ))}

      <p className="documento-p" style={{ marginTop: '1rem' }}>
        E, por estarem justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença de 2 (duas) testemunhas.
      </p>

      <div className="documento-assinaturas">
        <p className="documento-p" style={{ marginTop: '1.5rem' }}>{dados.cidade}, {dados.data}.</p>

        <div className="documento-sign-grid documento-sign-grid--compacto">
          <div>
            <div className="linha">{dados.contratada.nome}</div>
            <div className="papel">CONTRATADA — {dados.contratada.responsavel}{dados.contratada.crea ? ` · CREA nº ${dados.contratada.crea}` : ''}</div>
          </div>
          {dados.contratantes.map((c, i) => (
            <div key={i}>
              <div className="linha">{c.nome}</div>
              <div className="papel">{plural ? `CONTRATANTE ${i + 1}` : 'CONTRATANTE'} — {c.representado ? 'representante legal · CNPJ' : 'CPF'} {c.documento}</div>
            </div>
          ))}
        </div>

        <div className="documento-sign-grid documento-sign-grid--compacto" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '3.5rem' }}>
          {[1, 2].map(n => (
            <div key={n}>
              <div className="linha">Testemunha {n}</div>
              <div className="papel">Nome: ______________________________</div>
              <div className="papel" style={{ marginTop: '0.35rem' }}>CPF: ______________________________</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
