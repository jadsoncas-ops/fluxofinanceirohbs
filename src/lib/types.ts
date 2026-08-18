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
  previsaoData?: string; // Data esperada p/ o evento (YYYY-MM-DD)
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

export type ClientTipo = 'Pessoa física' | 'Pessoa jurídica' | 'Condomínio';
export type EstadoCivil = 'Solteiro(a)' | 'Casado(a)' | 'Divorciado(a)' | 'Viúvo(a)' | 'União Estável';
export type RegimeBens = 'Comunhão Parcial de Bens' | 'Comunhão Universal de Bens' | 'Separação Total de Bens' | 'Participação Final nos Aquestos';

/** Qualificação jurídica completa — usada na geração de documentos técnicos (Produção Técnica). Opcional: só é preciso preencher quando o cliente vai assinar um documento gerado. */
export interface QualificacaoJuridica {
  nacionalidade?: string;
  estadoCivil?: EstadoCivil;
  regimeBens?: RegimeBens;
  profissao?: string;
  rg?: string;
  filiacao?: string;
  conjuge?: {
    nome?: string;
    cpf?: string;
    nacionalidade?: string;
    profissao?: string;
    rg?: string;
    /** Se o cônjuge também assina os documentos gerados para este cliente. */
    assina?: boolean;
  } | null;
}

export interface Client {
  id: string;
  nome: string;
  tipo?: ClientTipo;
  /** CPF ou CNPJ, como o usuário digitou — sem máscara/validação nesta fase. */
  documento?: string | null;
  telefone?: {
    ddd: string | null;
    numero: string | null;
  } | null;
  endereco?: {
    rua: string | null;
    numero: string | null;
    complemento?: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
  } | null;
  descricao?: string | null;
  qualificacao?: QualificacaoJuridica;
  createdAt?: number;
}

export type ProcessStatus = 'Levantamento' | 'Protocolo' | 'Exigência' | 'Finalizado';

/** Etapa do Kanban de Trabalhos — independente do ProcessStatus (que descreve a fase perante o órgão). */
export type TrabalhoEtapa = 'Planejamento' | 'Em andamento' | 'Aguardando cliente' | 'Revisão' | 'Concluído';

export interface ProcessNote {
  id: string;
  data: number;
  texto: string;
}

/** Uma unidade autônoma dentro de um empreendimento (apartamento, sala, etc.) — mesma estrutura do cota_saas. */
export interface Unidade {
  id: string;
  pavimento: string;
  nome: string;
  tipo: string;
  banheiros: number;
  areaPrivativa: number;
  areaGaragem: number;
  areaComum: number;
  comodos?: string;
  /** false = não entra no quadro de fração ideal (ex.: guarita, área institucional). Default true. */
  autonoma?: boolean;
  /** false = a vaga de garagem desta unidade fica em outro pavimento — não citar na prosa deste. Default true. */
  garagemNoPavimento?: boolean;
  inscricao?: string;
  /** Usado só na Instituição Simplificada. */
  matriculaIndividual?: string;
  origemAquisicao?: string;
  /** CPF (normalizado) do proprietário desta unidade, para ligar a um item de proprietariosGerais. */
  proprietarioCpf?: string;
}

export interface ProprietarioGeral {
  nome: string;
  cpf: string;
}

/** Dados técnicos do empreendimento — só preenchidos quando o Trabalho vai gerar documentação técnica (Produção Técnica). */
export interface DadosTecnicosTrabalho {
  matricula?: string;
  /** Nº da ART/RRT do responsável técnico para este trabalho. */
  art?: string;
  /** Área do terreno, em m². */
  terreno?: number;
  formatoTerreno?: 'regular' | 'irregular';
  frente?: number;
  fundo?: number;
  lateralDireita?: number;
  lateralEsquerda?: number;
  /** Texto livre "medindo X de frente..." usado nos documentos quando o terreno é irregular. */
  medidas?: string;
  areasComuns?: string;
  /** Override do texto padrão de áreas comuns, quando o empreendimento tem particularidades. */
  areasComunsDescricao?: string;
  /** true = documento não usa % de fração, só "área total" (empreendimentos sem condomínio). */
  semFracao?: boolean;
  /** Ativa o Capítulo IX da Convenção (regras específicas p/ condomínios de 2 unidades). */
  condominioDuasUnidades?: boolean;
  atosRegistraisRequerimento?: ('especificacao' | 'instituicao' | 'convencao' | 'inventario' | 'partilha' | 'transmissao' | 'doacao' | 'outros')[];
  proprietariosGerais?: ProprietarioGeral[];
  units: Unidade[];
}

export interface Process {
  id: string;
  clienteId: string;
  objeto: string;
  status: ProcessStatus;
  /** Etapa no Kanban de Trabalhos. Novos trabalhos entram em 'Planejamento'. */
  etapa?: TrabalhoEtapa;
  /** Tipo do trabalho — usado como rótulo no Kanban (ex.: "Regularização de imóvel", "Projeto arquitetônico"). */
  tipoTrabalho?: string;
  endereco?: string;
  prazo?: string; // YYYY-MM-DD
  protocolo?: string;
  dataProtocolo?: string;
  valorContrato?: number;
  driveLink?: string;
  isArchived?: boolean;
  notas: ProcessNote[];
  /** Presente apenas quando este trabalho envolve geração de documentação técnica (Produção Técnica). */
  tecnico?: DadosTecnicosTrabalho;
  /** Preenchido quando o trabalho nasceu de um contrato aprovado no módulo Comercial. */
  contratoId?: string;
  createdAt: number;
  updatedAt: number;
}

export type AccountType = 'Conta Corrente' | 'Poupança' | 'Conta Digital' | 'Caixa' | 'Investimento';

export interface Account {
  id: string;
  nome: string;
  tipo: AccountType;
  /** Saldo atual da conta — mantido manualmente pelo usuário (sem reconciliação automática com lançamentos nesta fase). */
  saldo: number;
  ativo: boolean;
  createdAt: number;
}

export type DocumentSituacao = 'Vigente' | 'Pendente' | 'Entregue' | 'Modelo' | 'Em produção' | 'Em revisão' | 'Rascunho' | 'Desatualizado' | 'Concluído';

/** Os 7 tipos de documento técnico que a Produção Técnica sabe gerar (motor portado do cota_saas). */
export type TipoDocumentoTecnico =
  | 'memorial'
  | 'abnt'
  | 'instituicao'
  | 'convencao'
  | 'instituicao_simplificada'
  | 'laudo'
  | 'requerimento';

export interface DocumentRecord {
  id: string;
  /** Nome do arquivo, com extensão (ex.: "Contrato de prestação de serviços.pdf"). */
  nome: string;
  clienteId?: string | null;
  processId?: string | null;
  /** Presente quando este documento é gerado pela Produção Técnica (não um upload avulso). */
  tipoTecnico?: TipoDocumentoTecnico;
  versao?: string;
  situacao: DocumentSituacao;
  /** Link externo (Drive, etc.) — sem upload de arquivo real nesta fase. */
  link?: string;
  createdAt: number;
  updatedAt: number;
}

/** Dados da empresa e do responsável técnico — usados como cabeçalho/rodapé em todo documento gerado. */
export interface CompanyConfig {
  razaoSocial?: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  logoUrl?: string;
  responsavelNome?: string;
  responsavelCrea?: string;
  responsavelTitulo?: string;
  /** Validade padrão de uma proposta comercial, em dias. */
  validadePropostaDias?: number;
}

/** Configuração da precificação — custos operacionais, horas produtivas e taxas de protocolo usadas no cálculo de toda proposta. */
export interface PrecificacaoConfig {
  custosDiretos: { id: string; descricao: string; valor: number; tipo: 'fixo' | 'variavel' }[];
  custosIndiretos: { id: string; descricao: string; valor: number; tipo: 'fixo' | 'variavel' }[];
  horasDisponiveis: number;
  horasNaoFaturaveis: number;
  custosProtocolo: { art: number; assinatura: number };
  lucroPercentPadrao: number;
  impostosPercentPadrao: number;
  comissaoPercentPadrao: number;
}

export type PropostaStatus = 'Rascunho' | 'Enviada' | 'Em aprovação' | 'Aprovada' | 'Perdida';

export interface PropostaItem {
  etapaId: string;
  nome: string;
  grupo: string;
  visitas: number;
  horas: number;
}

export interface PropostaResultado {
  custoTecnico: number;
  custoProtocolos: number;
  custoTotal: number;
  lucro: number;
  imposto: number;
  comissao: number;
  precoVenda: number;
  margem: number;
}

/** Uma proposta comercial — nasce de um cliente existente, pode terminar em Contrato. */
export interface Proposta {
  id: string;
  codigo: string; // PRP-0001
  clienteId: string;
  /** Preenchido se a proposta parte de (ou gera) um trabalho específico. */
  trabalhoId?: string | null;
  titulo: string;
  itens: PropostaItem[];
  custoHoraBase: number;
  lucroPercent: number;
  impostosPercent: number;
  comissaoPercent: number;
  custosProtocolo: { art: boolean; assinatura: boolean };
  resultado: PropostaResultado;
  prazoDias?: number;
  formaPagamento?: string;
  status: PropostaStatus;
  enviadaEm?: number;
  createdAt: number;
  updatedAt: number;
}

export type ContratoStatus = 'Ativo' | 'Concluído' | 'Cancelado';

export interface ContratoParcela {
  id: string;
  descricao: string;
  valor: number;
  vencimento?: string; // YYYY-MM-DD
  /** Vínculo com o lançamento financeiro (Transaction) gerado a partir desta parcela. */
  transactionId?: string;
}

/** Um contrato — nasce sempre de uma Proposta aprovada. */
export interface Contrato {
  id: string;
  codigo: string; // CTR-0001
  propostaId: string;
  clienteId: string;
  trabalhoId?: string | null;
  valor: number;
  parcelas: ContratoParcela[];
  status: ContratoStatus;
  assinadoEm?: number;
  createdAt: number;
  updatedAt: number;
}

export type HistoricoModulo = 'Comercial' | 'Financeiro' | 'Trabalhos' | 'Produção Técnica' | 'Clientes';

export interface HistoricoEvent {
  id: string;
  modulo: HistoricoModulo;
  texto: string;
  clienteId?: string | null;
  trabalhoId?: string | null;
  propostaId?: string | null;
  contratoId?: string | null;
  createdAt: number;
}

export type TaskStatus = 'Pendente' | 'Em Andamento' | 'Concluída';
export type TaskPriority = 'Baixa' | 'Média' | 'Alta';

export interface Task {
  id: string;
  titulo: string;
  descricao?: string;
  status: TaskStatus;
  prioridade: TaskPriority;
  prazo?: string; // YYYY-MM-DD
  processId?: string | null;
  clienteId?: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
