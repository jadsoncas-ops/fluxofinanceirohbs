import { Client, CompanyConfig, Contrato, Proposta, RequerenteAdicional } from '@/lib/types';
import { qualificacaoInlineTexto, ProprietarioRef } from '@/lib/producao/documentoShared';
import { reaisPorExtenso } from '@/lib/extenso';
import { ETAPAS_PADRAO, formatBRL } from './precificacao';
import { Clausula, montarClausulas, ParcelaContrato } from './contratoClausulas';

const PLACEHOLDER = '(a preencher)';
/** Cidade-sede e foro — a HBS atua em Itabuna/BA (mesmo padrão dos demais documentos). */
const CIDADE = 'Itabuna/BA';

export interface ContratanteDoc {
  /** Frase de qualificação completa, pronta para o texto. */
  qualificacao: string;
  nome: string;
  documento: string;
  /** Pessoa jurídica/condomínio: a assinatura é do representante legal. */
  representado: boolean;
}

export interface ContratoDoc {
  codigo: string;
  propostaCodigo: string;
  titulo: string;
  contratada: { qualificacao: string; nome: string; responsavel: string; crea: string };
  contratantes: ContratanteDoc[];
  plural: boolean;
  clausulas: Clausula[];
  cidade: string;
  data: string;
}

/** "CREA-BA 051598661-5" já vem com o prefixo no cadastro; "0512345678-BA" não — só acrescenta "CREA nº" quando falta. */
export function creaTexto(crea: string | undefined): string {
  const c = (crea || '').trim();
  if (!c) return '';
  return /^crea/i.test(c) ? c : `CREA nº ${c}`;
}

function enderecoCliente(cliente: Client): string | undefined {
  const e = cliente.endereco;
  // O formulário de cliente já nasce com UF "BA": sem rua não há endereço de verdade — evita "residente em BA".
  if (!e || !(e.rua || '').trim()) return undefined;
  // O cadastro às vezes guarda espaço sobrando no fim ("Santo Antonio ") — limpa pra não sair "Antonio , Itabuna".
  const texto = [e.rua, e.numero, e.complemento, e.bairro, e.cidade, e.estado].map(x => (x || '').trim()).filter(Boolean).join(', ');
  return texto || undefined;
}

function contratantePrincipal(cliente: Client): ContratanteDoc {
  const nome = cliente.nome.trim();
  const documento = cliente.documento?.trim() || PLACEHOLDER;
  const endereco = enderecoCliente(cliente);

  if (cliente.tipo === 'Pessoa jurídica' || cliente.tipo === 'Condomínio') {
    const rep = cliente.tipo === 'Condomínio' ? 'neste ato representado por seu síndico' : 'neste ato representada por seu representante legal';
    const partes = [
      nome.toUpperCase(),
      cliente.tipo === 'Condomínio' ? 'condomínio edilício' : 'pessoa jurídica de direito privado',
      `inscrito(a) no CNPJ nº ${documento}`,
      ...(endereco ? [`com sede em ${endereco}`] : []),
      rep,
    ];
    return { qualificacao: `${partes.join(', ')}.`, nome, documento, representado: true };
  }

  const q = cliente.qualificacao;
  const ref: ProprietarioRef = {
    nome, cpf: cliente.documento || undefined,
    nacionalidade: q?.nacionalidade, estadoCivil: q?.estadoCivil, conjugeNome: q?.conjuge?.nome,
    profissao: q?.profissao, rg: q?.rg, endereco,
  };
  return { qualificacao: qualificacaoInlineTexto(ref), nome, documento, representado: false };
}

function contratanteAdicional(r: RequerenteAdicional): ContratanteDoc {
  const ref: ProprietarioRef = { nome: r.nome, cpf: r.documento, estadoCivil: r.estadoCivil, profissao: r.profissao, conjugeNome: r.conjugeNome, endereco: r.endereco };
  return { qualificacao: qualificacaoInlineTexto(ref), nome: r.nome.trim(), documento: r.documento?.trim() || PLACEHOLDER, representado: false };
}

function contratadaDoc(config: CompanyConfig): ContratoDoc['contratada'] {
  const nome = config.razaoSocial?.trim() || '(razão social — configure em Configurações)';
  const responsavel = config.responsavelNome?.trim() || '(responsável — configure em Configurações)';
  const crea = creaTexto(config.responsavelCrea);
  const partes = [
    nome.toUpperCase(),
    'pessoa jurídica de direito privado',
    `inscrita no CNPJ nº ${config.cnpj?.trim() || PLACEHOLDER}`,
    ...(config.endereco?.trim() ? [`com sede em ${config.endereco.trim()}`] : []),
    `neste ato representada por ${responsavel}${crea ? `, ${crea}` : ''}`,
  ];
  return { qualificacao: `${partes.join(', ')}.`, nome, responsavel, crea };
}

/** Parcelas do contrato: as do próprio contrato (com vencimento, quando o trabalho já foi criado); senão as
 *  condições da proposta, desde que somem o valor do contrato. Nunca inventa parcela. */
function parcelasDoContrato(contrato: Contrato, proposta: Proposta | undefined): ParcelaContrato[] {
  const dataBR = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : undefined);
  if (contrato.parcelas.length > 0) {
    return contrato.parcelas.map(p => ({ descricao: p.descricao, valor: formatBRL(p.valor), vencimento: dataBR(p.vencimento) }));
  }
  const daProposta = proposta?.parcelasPagamento || [];
  const soma = daProposta.reduce((s, p) => s + p.valor, 0);
  if (daProposta.length > 0 && Math.abs(soma - contrato.valor) < 0.01) {
    return daProposta.map(p => ({ descricao: p.descricao, valor: formatBRL(p.valor) }));
  }
  return [];
}

/** Monta o contrato a partir do contrato aprovado + proposta + cadastro do cliente principal. Nunca inventa dado:
 *  o que falta aparece como "(a preencher)". `hoje` é injetável para teste. */
export function montarContrato(contrato: Contrato, proposta: Proposta | undefined, cliente: Client, config: CompanyConfig, hoje = new Date()): ContratoDoc {
  const adicionais = (contrato.contratantesAdicionais || []).filter(r => r.nome?.trim());
  const contratantes = [contratantePrincipal(cliente), ...adicionais.map(contratanteAdicional)];
  const plural = contratantes.length > 1;
  const contratada = contratadaDoc(config);

  const itens = (proposta?.itens || []).map(i => ({
    nome: i.nome,
    descricao: ETAPAS_PADRAO.find(e => e.id === i.etapaId)?.descricao,
  }));

  const clausulas = montarClausulas({
    titulo: proposta?.titulo || '(objeto a preencher)',
    propostaCodigo: proposta?.codigo || PLACEHOLDER,
    plural,
    itens,
    artIncluida: !!proposta?.custosProtocolo?.art,
    prazoDias: proposta?.prazoDias,
    valor: formatBRL(contrato.valor),
    valorExtenso: reaisPorExtenso(contrato.valor),
    parcelas: parcelasDoContrato(contrato, proposta),
    notaParceiro: proposta?.observacaoParceiro?.trim() || undefined,
    responsavelNome: contratada.responsavel,
    responsavelCrea: contratada.crea || undefined,
    foro: CIDADE,
  });

  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return {
    codigo: contrato.codigo,
    propostaCodigo: proposta?.codigo || '',
    titulo: proposta?.titulo || '',
    contratada,
    contratantes,
    plural,
    clausulas,
    cidade: CIDADE,
    data: `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`,
  };
}

/** O que ainda falta preencher para o contrato sair completo — mostrado antes de imprimir (não bloqueia). */
export function pendenciasDoContrato(contrato: Contrato, cliente: Client, config: CompanyConfig): string[] {
  const p: string[] = [];
  if (!config.razaoSocial?.trim()) p.push('Razão social da HBS (Configurações)');
  if (!config.cnpj?.trim()) p.push('CNPJ da HBS (Configurações)');
  if (!config.endereco?.trim()) p.push('Endereço da HBS (Configurações)');
  if (!config.responsavelNome?.trim()) p.push('Responsável técnico da HBS (Configurações)');
  if (!cliente.documento?.trim()) p.push(`CPF/CNPJ de ${cliente.nome} (cadastro do cliente)`);
  if (!enderecoCliente(cliente)) p.push(`Endereço de ${cliente.nome} (cadastro do cliente)`);
  if (cliente.tipo === 'Pessoa física' && !cliente.qualificacao?.estadoCivil) p.push(`Estado civil e profissão de ${cliente.nome} (cadastro do cliente)`);
  for (const r of contrato.contratantesAdicionais || []) {
    if (r.nome?.trim() && !r.documento?.trim()) p.push(`CPF de ${r.nome.trim()}`);
  }
  return p;
}
