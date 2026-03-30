export type TransactionType = 'Entrada' | 'Saída' | 'A Receber' | 'A Pagar';
export type TransactionStatus = 'Pendente' | 'Concluído' | 'Parcial';

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
  clienteId?: string | null; // Vinculo com o cliente
  processId?: string; // Vinculo com o processo específico (Suporte a múltiplos processos p/ mesmo cliente)
  updatedAt?: number; // Flag visual de edição
  originalTotal?: number; // Memória do valor total do repasse original
}

export const CATEGORIAS_ENTRADA = [
  '📐 Elaboração de Projeto',
  '📋 Vistoria',
  '🏠 Regularização Parcial',
  '🏢 Regularização Total',
  '👷 Administração de Obra',
];

export const CATEGORIAS_SAIDA = [
  '🖨️ Impressão de projetos',
  '📄 Pagamento de ART',
  '🏃 Despachante',
  '🤝 Comissão',
  '⚙️ Custos operacionais',
  '⛽ Deslocamento/Combustível',
  '🔄 Outros',
];

export const CATEGORIAS_REPASSE = ['🖨️ Impressão de projetos', '📄 Pagamento de ART', '🏃 Despachante', '🤝 Comissão', '⚙️ Custos operacionais'];

export function getCategorias(tipo: TransactionType): string[] {
  if (tipo === 'Entrada' || tipo === 'A Receber') return CATEGORIAS_ENTRADA;
  return CATEGORIAS_SAIDA;
}

export interface Client {
  id: string;
  nome: string;
  telefone?: {
    ddd: string | null;
    numero: string | null;
  } | null;
  endereco?: {
    rua: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
  } | null;
  descricao?: string | null;
  createdAt?: number;
}

export type ProcessStatus = 'Levantamento' | 'Protocolo' | 'Exigência' | 'Finalizado';

export interface ProcessNote {
  id: string;
  data: number;
  texto: string;
}

export interface Process {
  id: string;
  clienteId: string;
  objeto: string;
  status: ProcessStatus;
  protocolo?: string;
  dataProtocolo?: string;
  valorContrato?: number;
  driveLink?: string;
  isArchived?: boolean;
  notas: ProcessNote[];
  createdAt: number;
  updatedAt: number;
}
