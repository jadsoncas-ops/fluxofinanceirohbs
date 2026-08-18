/** Motor de precificação — portado verbatim do hbs-orcamento-inteligente (src/lib/orcamento.ts). Funções puras, testadas. */

export interface EtapaServico {
  id: string;
  nome: string;
  grupo: string;
  /** Descrição do escopo — visível para o cliente (aparece também na proposta em PDF). */
  descricao?: string;
  /** Aviso só para quem monta a proposta (ex.: risco de cobrança duplicada) — nunca aparece no PDF. */
  notaInterna?: string;
  ativa: boolean;
  visitas: number;
  horas: number;
}

export const GRUPOS = ['Módulo Projeto', 'Módulo Documental', 'Módulo Jurídico', 'Módulo Trâmite'];

// Cada serviço tem escopo mutuamente exclusivo dos demais do mesmo módulo —
// a descrição existe justamente para deixar essa fronteira explícita e evitar
// que o mesmo entregável seja cobrado em duas linhas diferentes.
export const ETAPAS_PADRAO: Omit<EtapaServico, 'ativa' | 'visitas' | 'horas'>[] = [
  // Módulo Projeto
  {
    id: 'levantamento', nome: 'Levantamento Cadastral', grupo: GRUPOS[0],
    descricao: 'Visita técnica e medição in loco do imóvel existente — insumo para todo o projeto.',
  },
  {
    id: 'arq', nome: 'Elaboração de Projeto Legal (Plantas, Cortes e Fachadas)', grupo: GRUPOS[0],
    descricao: 'Projeto arquitetônico completo do as-built: plantas, cortes e fachadas, já no padrão exigido para aprovação.',
    notaInterna: 'Cobre sozinho todo o desenho — não lance cortes/fachadas em outro item.',
  },
  {
    id: 'situacao', nome: 'Planta de Situação', grupo: GRUPOS[0],
    descricao: 'Implantação do imóvel no lote/quadra — peça exigida à parte do projeto arquitetônico.',
  },
  {
    id: 'calculos', nome: 'Cálculo para Aprovação', grupo: GRUPOS[0],
    descricao: 'Quadro de áreas e índices urbanísticos (taxa de ocupação, coeficiente etc.) exigidos pelo órgão aprovador.',
  },
  {
    id: 'pranchas', nome: 'Pranchas para Impressão', grupo: GRUPOS[0],
    descricao: 'Diagramação final das pranchas já aprovadas, no formato de plotagem para protocolo.',
  },

  // Módulo Documental
  {
    id: 'fracao-ideal', nome: 'Memorial Descritivo + Fração Ideal', grupo: GRUPOS[1],
    descricao: 'Texto descritivo do imóvel e cálculo da fração ideal, para averbação ou condomínio.',
  },

  // Módulo Jurídico
  {
    id: 'inst-convencao', nome: 'Instituição e Convenção de Condomínio', grupo: GRUPOS[2],
    descricao: 'Minuta jurídica de instituição e convenção — só se aplica quando o imóvel será desmembrado em unidades autônomas.',
  },
  {
    id: 'nbr12721', nome: 'Quadro de Áreas NBR 12721', grupo: GRUPOS[2],
    descricao: 'Discriminação de áreas conforme NBR 12721, exigida para incorporação ou financiamento.',
  },

  // Módulo Trâmite
  {
    id: 'certidao-tributos', nome: 'Certidão de Área Construída (Tributos)', grupo: GRUPOS[3],
    descricao: 'Emissão de certidão junto ao setor de tributos/IPTU para comprovar a área construída.',
  },
  {
    id: 'protocolos', nome: 'Protocolos em Órgãos', grupo: GRUPOS[3],
    descricao: 'Deslocamento e protocolo físico do processo nos órgãos competentes (prefeitura, cartório etc.).',
  },
  {
    id: 'acompanhamento', nome: 'Acompanhamento do Processo', grupo: GRUPOS[3],
    descricao: 'Acompanhamento periódico da tramitação até a conclusão/aprovação do processo.',
  },
];

export interface TemposPadrao {
  [id: string]: { v: number; h: number };
}

export const TEMPOS_PADRAO_INICIAIS: TemposPadrao = {
  'levantamento': { v: 1, h: 0 },
  'arq': { v: 0, h: 24 },
  'situacao': { v: 0, h: 4 },
  'calculos': { v: 0, h: 4 },
  'pranchas': { v: 0, h: 2 },
  'fracao-ideal': { v: 0, h: 6 },
  'inst-convencao': { v: 0, h: 12 },
  'nbr12721': { v: 0, h: 4 },
  'certidao-tributos': { v: 0, h: 4 },
  'protocolos': { v: 1, h: 0 },
  'acompanhamento': { v: 1, h: 0 },
};

export interface CustosProtocolo {
  art: number;
  assinatura: number;
}

export const CUSTOS_PROTOCOLO_PADRAO: CustosProtocolo = { art: 115, assinatura: 80 };

export interface ProtocolosSelecionados {
  art: boolean;
  assinatura: boolean;
}

export const CUSTOS_FIXOS_PADRAO = 775.0;
export const CUSTOS_VARIAVEIS_PADRAO = 1170.0;
export const INVESTIMENTOS_PADRAO = 700.0;
export const HORAS_PRODUTIVAS_PADRAO = 74;

// Motor de custo itemizado: Custos Diretos (ligados à execução de um serviço
// específico) e Custos Indiretos (estrutura profissional, não vinculados a um
// único serviço). calcularCustoOperacionalTotal é a ÚNICA função que deve
// combinar os dois grupos — usar sempre ela, nunca somar os itens à parte.
export interface CustoItem {
  id: string;
  descricao: string;
  valor: number;
  observacao?: string;
  tipo: 'fixo' | 'variavel';
}

export function somarCustos(items: CustoItem[]): number {
  return items.reduce((acc, item) => acc + item.valor, 0);
}

export function calcularCustoOperacionalTotal(diretos: CustoItem[], indiretos: CustoItem[]): number {
  return somarCustos(diretos) + somarCustos(indiretos);
}

// Nem toda hora disponível é faturável (administrativo, propostas, reuniões,
// prospecção etc. também consomem tempo). Horas produtivas = o que resta
// depois de descontar isso — é o divisor real usado para achar o custo/hora.
export function calcularHorasProdutivas(disponiveis: number, naoFaturaveis: number): number {
  return Math.max(0, disponiveis - naoFaturaveis);
}

export function calcularCustoHora(custoOperacional: number, horasProdutivas: number): number {
  if (horasProdutivas <= 0) return 0;
  return custoOperacional / horasProdutivas;
}

export function calcularCustoEtapa(etapa: EtapaServico, custoHora: number): number {
  if (!etapa.ativa) return 0;
  // Cada visita representa 8 horas de dedicação técnica (1 dia de trabalho)
  const totalHoras = etapa.visitas * 8 + etapa.horas;
  return totalHoras * custoHora;
}

export function calcularTotalHoras(etapas: EtapaServico[]): number {
  return etapas.filter(e => e.ativa).reduce((acc, e) => acc + e.visitas * 8 + e.horas, 0);
}

export function calcularTotalProtocolos(protocolos: ProtocolosSelecionados, custosProtocolo: CustosProtocolo): number {
  let total = 0;
  if (protocolos.art) total += custosProtocolo.art;
  if (protocolos.assinatura) total += custosProtocolo.assinatura;
  return total;
}

/**
 * lucro e imposto incidem sobre custoTotal (custo técnico + protocolos), de forma
 * independente e aditiva. comissao incide sobre o subtotal (custo + lucro + imposto) —
 * ou seja, ela compõe sobre a margem e o imposto, não sobre o custo bruto. O lucro
 * real da empresa é `lucro` sozinho, nunca `precoVenda - comissao - imposto`.
 */
export function calcularPrecoFinal(
  custoTecnico: number,
  custoProtocolos: number,
  lucroPercent: number,
  impostosPercent: number,
  comissaoPercent: number
) {
  const custoTotal = custoTecnico + custoProtocolos;
  const lucro = custoTotal * (lucroPercent / 100);
  const imposto = custoTotal * (impostosPercent / 100);
  const subtotal = custoTotal + lucro + imposto;
  const comissao = subtotal * (comissaoPercent / 100);
  const precoVenda = subtotal + comissao;
  const valorLiquido = subtotal;
  const margem = precoVenda > 0 ? ((precoVenda - custoTotal) / precoVenda) * 100 : 0;
  return { precoVenda, custoTotal, lucro, imposto, comissao, valorLiquido, margem };
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
