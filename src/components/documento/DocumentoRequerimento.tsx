import { RequerimentoData } from '@/lib/producao/requerimento';
import { AssinaturaTitular } from './AssinaturaTitular';

export function DocumentoRequerimento({ dados }: { dados: RequerimentoData }) {
  return (
    <div className="documento-folha">
      <div className="documento-header" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Requerimento de especificação simplificada</h1>
          <div className="sub">{dados.endereco}</div>
        </div>
      </div>

      <p className="documento-p">
        Ao<br />1º Ofício de Registro de Imóveis<br />Av. Ilhéus, 345-B - Centro, Itabuna – BA
      </p>

      <p className="documento-p" style={{ textAlign: 'center' }}>
        <strong>REQUERIMENTO DE ESPECIFICAÇÃO SIMPLIFICADA DE CONDOMÍNIO</strong>
      </p>

      <p className="documento-p">
        Os proprietários das unidades autônomas descritas abaixo, por este instrumento particular, manifestam sua anuência e concordância à especificação do condomínio simplificado do Edifício &quot;{dados.nomeTrabalho.toUpperCase()}&quot; sito à {dados.endereco || '(endereço a preencher)'}, cadastro municipal: {dados.inscricoes || '(a preencher)'}.
      </p>

      {dados.qualificacoes.length > 0 && (
        <>
          <p className="documento-p" style={{ marginBottom: '0.4rem' }}><strong>QUALIFICAÇÃO DOS REQUERENTES:</strong></p>
          {dados.qualificacoes.map((q, i) => <p key={i} className="documento-p">{q}</p>)}
        </>
      )}

      <p className="documento-p">
        Declaramos, para os devidos fins, estarmos cientes de que o empreendimento se encontra em situação atípica perante o município, não possuindo &quot;habite-se&quot; (certificado de conclusão de obra), tampouco certidão de área construída emitida pela Prefeitura, impossibilitando, por ora, a averbação convencional da edificação.
      </p>
      <p className="documento-p">
        Por esta razão, requer-se que o procedimento de especificação se dê de forma simplificada, nos termos da legislação vigente, com o compromisso de atender aos requisitos documentais que forem solicitados por esse respeitável Cartório.
      </p>

      <p className="documento-p" style={{ marginBottom: '0.4rem' }}><strong>DOS REQUERIMENTOS</strong></p>
      <p className="documento-p">Diante do exposto, requerem:</p>

      {dados.pedidos.length === 0 ? (
        <p className="documento-p" style={{ marginLeft: '1.25rem', color: 'var(--doc-muted)' }}>(nenhum ato registral selecionado ainda — marque em Dados técnicos)</p>
      ) : (
        dados.pedidos.map((pedido, i) => (
          <p key={i} className="documento-p" style={{ marginLeft: '1.25rem' }}>{String.fromCharCode(97 + i)}) {pedido}</p>
        ))
      )}

      <p className="documento-p">Nestes termos,<br />Pedimos deferimento.</p>

      <div className="documento-assinaturas">
        <p className="documento-p" style={{ marginTop: '1.5rem' }}>Itabuna/BA, {new Date().toLocaleDateString('pt-BR')}</p>
        <div className="documento-sign-grid documento-sign-grid--compacto">
          {dados.proprietarios.length ? (
            dados.proprietarios.map((p, i) => (
              <AssinaturaTitular key={i} nome={p.nome || '(a preencher)'} conjuge={p.conjuge} secundaria={<>{p.cpf ? `CPF: ${p.cpf}` : ''}{p.unidade ? ` — ${p.unidade}` : ''}</>} />
            ))
          ) : (
            <div><div className="linha">(a preencher)</div><div className="papel"></div></div>
          )}
        </div>
      </div>
    </div>
  );
}
