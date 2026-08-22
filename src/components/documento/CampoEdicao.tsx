import { ReactNode } from 'react';

/** Rótulo + campo, usado nos painéis "no-print" de edição inline acima dos documentos de Produção Técnica. */
export function CampoEdicao({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-mute-2">{label}</label>
      {children}
    </div>
  );
}

export const campoInputCls =
  'w-full h-9 rounded-lg border border-border px-2.5 text-[13px] outline-none focus:border-hover transition-colors bg-background';
