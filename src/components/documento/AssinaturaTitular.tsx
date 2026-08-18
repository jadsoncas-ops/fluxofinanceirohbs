import { Fragment, ReactNode } from 'react';
import { ConjugeAssinatura } from '@/lib/producao/documentoShared';

/** Bloco de assinatura de um proprietário (+ cônjuge, quando aplicável) — reaproveitado por todos os documentos. */
export function AssinaturaTitular({ nome, conjuge, secundaria }: { nome: string; conjuge?: ConjugeAssinatura; secundaria: ReactNode }) {
  return (
    <Fragment>
      {conjuge && (
        <div>
          <div className="linha">{conjuge.nome}</div>
          <div className="papel">{conjuge.cpf ? `CPF: ${conjuge.cpf}` : '(CPF não informado)'}</div>
          <div className="papel">cônjuge de {nome}</div>
        </div>
      )}
      <div>
        <div className="linha">{nome}</div>
        <div className="papel">{secundaria}</div>
      </div>
    </Fragment>
  );
}
