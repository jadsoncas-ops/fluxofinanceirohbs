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
  /** Parceiro que recebe este repasse — presente quando o repasse tem um parceiro cadastrado vinculado. */
  partnerId?: string | null;
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

/** Etapa do Kanban de Trabalhos — independente do ProcessStatus (que descreve a fase perante o órgão).
 *  Ordem reflete o fluxo real de regularização: aguarda o cliente, levanta o imóvel/documentação,
 *  tramita no órgão (prefeitura/cartório), pode voltar em devolutiva (exigência) até concluir. */
export type TrabalhoEtapa = 'Aguardando cliente' | 'Levantamento' | 'Tramitando' | 'Devolutiva' | 'Concluído';

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
  /** Ajustes manuais dos valores exibidos no Quadro de Fração Ideal, por unidade — usado quando o
   *  arredondamento automático precisa de correção pontual para bater com uma exigência específica do
   *  cartório. Chave: `Unidade.id`. Persiste até nova edição. */
  quadroFracaoOverrides?: Record<string, Partial<Record<'areaPrivativa' | 'areaGaragem' | 'areaComum' | 'soma' | 'fracaoM2' | 'fracaoPct', number>>>;
  /** Quantas casas decimais mostrar em cada coluna do Quadro de Fração Ideal — cada coluna tem sua
   *  própria precisão natural. Sem valor definido, usa o perfil padrão (ver `CASAS_PADRAO`). */
  quadroFracaoCasas?: Partial<Record<'areaPrivativa' | 'areaGaragem' | 'areaComum' | 'soma' | 'fracaoM2' | 'fracaoPct', number>>;
}

export interface Process {
  id: string;
  clienteId: string;
  objeto: string;
  status: ProcessStatus;
  /** Etapa no Kanban de Trabalhos. Novos trabalhos entram em 'Levantamento'. */
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
  /** Presente apenas quando este trabalho gera um Requerimento de Averbação (Produção Técnica). */
  averbacao?: AverbacaoData;
  /** Presente apenas quando este trabalho gera uma Procuração (Produção Técnica). */
  procuracao?: ProcuracaoData;
  /** Presente apenas quando este trabalho gera uma Carta de Reforma Simples (Produção Técnica). */
  cartaReforma?: CartaReformaData;
  /** Presente apenas quando este trabalho gera uma Declaração de Anuência (Produção Técnica). */
  anuencia?: AnuenciaData;
  /** Presente apenas quando este trabalho gera uma Declaração de Descarte de Entulhos (Produção Técnica). */
  descarteEntulhos?: DescarteEntulhosData;
  createdAt: number;
  updatedAt: number;
}

/** Parceiro que recebe repasses da HBS (comissionado, indicador, prestador terceirizado). */
export interface Partner {
  id: string;
  nome: string;
  documento?: string | null;
  contato?: string | null;
  observacao?: string | null;
  createdAt: number;
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

/** Os tipos de documento técnico que a Produção Técnica sabe gerar (motor portado do cota_saas + geradores nativos da HBS). */
export type TipoDocumentoTecnico =
  | 'memorial'
  | 'abnt'
  | 'instituicao'
  | 'convencao'
  | 'instituicao_simplificada'
  | 'laudo'
  | 'requerimento'
  | 'requerimento_averbacao'
  | 'procuracao'
  | 'carta_reforma'
  | 'declaracao_anuencia'
  | 'descarte_entulhos';

export type TipoAtoAverbacao = 'averbacao_construcao' | 'averbacao_ampliacao' | 'averbacao_reforma' | 'regularizacao_existente';

/** Dados do Requerimento de Averbação — usado quando o Trabalho NÃO envolve instituição de condomínio
 *  (averbação de construção/ampliação/reforma ou regularização de construção existente perante o RI).
 *  Persistido no Trabalho para permitir reabrir, editar e regenerar sem perder o preenchimento. */
export interface AverbacaoData {
  requerenteNome?: string;
  requerenteDocumento?: string;
  requerenteEstadoCivil?: EstadoCivil;
  requerenteProfissao?: string;
  requerenteConjugeNome?: string;
  requerenteEndereco?: string;
  /** Preenchidos apenas quando o requerente é pessoa jurídica. */
  representanteNome?: string;
  representanteCpf?: string;
  representanteQualificacao?: string;

  matricula?: string;
  cartorio?: string;
  imovelEndereco?: string;
  imovelNumero?: string;
  imovelComplemento?: string;
  imovelBairro?: string;
  imovelCidade?: string;
  imovelEstado?: string;
  inscricaoMunicipal?: string;

  tipoAto?: TipoAtoAverbacao;
  areaConstruida?: number;
  pavimentos?: number;
  finalidade?: string;
  anoConstrucao?: string;
  /** Valor atribuído à construção/obra para fins registrais — NÃO é valor de terreno nem valor de mercado do imóvel. */
  valorConstrucao?: number;

  temAlvara?: boolean;
  temHabiteSe?: boolean;
  temArt?: boolean;
  temRrt?: boolean;
  temTrt?: boolean;
  temCertidao?: boolean;
  temPlantasAprovadas?: boolean;
  outrosDocumentos?: string;

  dataDocumento?: string; // YYYY-MM-DD
}

/** Procuração do proprietário para a HBS representá-lo junto à Prefeitura. Persistida no Trabalho. */
export interface ProcuracaoData {
  outorganteNome?: string;
  outorganteNacionalidade?: string;
  outorganteEstadoCivil?: EstadoCivil;
  outorganteProfissao?: string;
  outorganteRg?: string;
  outorganteCpf?: string;
  outorganteEndereco?: string;
  /** Descrição do processo/imóvel objeto da procuração (endereço ou inscrição imobiliária). */
  objetoProcesso?: string;
  cidade?: string;
  dataDocumento?: string; // YYYY-MM-DD
}

/** Carta de solicitação de licença para reforma simples, com lista de serviços editável. */
export interface CartaReformaData {
  servicos?: string[];
  observacoes?: string;
  cidade?: string;
  dataDocumento?: string; // YYYY-MM-DD
}

/** Declaração de anuência do confrontante à demarcação de área do imóvel do cliente. */
export interface AnuenciaData {
  declaranteNome?: string;
  declaranteCpf?: string;
  proprietarioNome?: string;
  imovelEndereco?: string;
  matricula?: string;
  cartorio?: string;
  comarca?: string;
  cidade?: string;
  dataDocumento?: string; // YYYY-MM-DD
}

/** Declaração de destinação de resíduos, usada em processos de demolição. */
export interface DescarteEntulhosData {
  cidade?: string;
  dataDocumento?: string; // YYYY-MM-DD
}

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

/** Uma condição de pagamento da proposta (ex.: "Entrada", "No protocolo") — soma deve fechar com resultado.precoVenda. */
export interface PropostaParcela {
  descricao: string;
  valor: number;
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
  /** @deprecated substituído por parcelasPagamento — mantido só para propostas antigas já salvas. */
  formaPagamento?: string;
  parcelasPagamento?: PropostaParcela[];
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

/** Reunião/visita agendada com horário — diferente de Task (que é "o que precisa ser feito", sem hora). */
export interface Compromisso {
  id: string;
  titulo: string;
  data: string; // YYYY-MM-DD
  horaInicio?: string; // HH:MM
  horaFim?: string; // HH:MM
  comQuem?: string;
  clienteId?: string | null;
  processId?: string | null;
  cor: string; // uma das chaves de CORES_COMPROMISSO
  createdAt: number;
  updatedAt: number;
}

export const CORES_COMPROMISSO: Record<string, string> = {
  roxo: '262 60% 56%',
  verde: '152 45% 40%',
  azul: '213 70% 52%',
  laranja: '25 85% 55%',
  rosa: '330 65% 58%',
  ambar: '38 80% 50%',
};
