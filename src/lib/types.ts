export type TransactionType = 'Entrada' | 'Saída' | 'A Receber' | 'A Pagar';
export type TransactionStatus = 'Pendente' | 'Concluído';

export interface Transaction {
  id: string;
  data: string; // YYYY-MM-DD
  tipo: TransactionType;
  categoria: string;
  descricao: string;
  valor: number;
  status: TransactionStatus;
  isRepasse: boolean;
  parentId?: string; // Links repasse to parent transaction
}

export const CATEGORIAS_ENTRADA = [
  '📐 Elaboração de Projeto',
  '📋 Vistoria',
  '🏠 Regularização Parcial',
  '🏢 Regularização Total',
  '👷 Administração de Obra',
];

export const CATEGORIAS_SAIDA = [
  '💻 Projetista',
  '🏃 Despachante',
  '🤝 Comissão',
  '🏛️ Taxas e Emolumentos',
  '⛽ Deslocamento/Combustível',
  '🔄 Outros',
];

export const CATEGORIAS_REPASSE = ['💻 Projetista', '🏃 Despachante', '🤝 Comissão'];

export function getCategorias(tipo: TransactionType): string[] {
  if (tipo === 'Entrada' || tipo === 'A Receber') return CATEGORIAS_ENTRADA;
  return CATEGORIAS_SAIDA;
}
