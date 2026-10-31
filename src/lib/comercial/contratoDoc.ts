import { Client, CompanyConfig, Contrato, Process, Proposta, RequerenteAdicional, TextoContrato } from '@/lib/types';
import { estadoCivilProsa } from '@/lib/producao/documentoShared';
import { reaisPorExtenso } from '@/lib/extenso';
import { formatBRL } from './precificacao';
import { Clausula, ParcelaContrato, montarClausulas, objetoPadrao, prazoEntregaPadrao } from './contratoClausulas';

const PLACEHOLDER = '(a preencher)';
/** Cidade onde o contrato é assinado — a HBS atua em Itabuna/BA (mesmo padrão dos demais documentos). */
const CIDADE = 'Itabuna/BA';
/** Prazo de entrega usado quando a proposta não informa um. */
const PRAZO_ENTREGA_PADRAO_DIAS = 15;

export interface ContratanteDoc {
  /** Qualificação como aparece na abertura do contrato. */
  qualificacao: string;
  nome: string;
  documento: string;
  /** Pessoa jurídica/condomínio: a assinatura é do representante legal. */
  representado: boolean;
}

export interface ContratoDoc {
  codigo: string;
  propostaCodigo: string;
  /** Parágrafo de abertura, com as partes qualificadas. */
  abertura: string;
  contratado: { nome: string; titulo: string; crea: string };
  contratantes: ContratanteDoc[];
  plural: boolean;
  clausulas: Clausula[];
  cidade: string;
  data: string;
  testemunhas: boolean;
  /** Linhas do rodapé de cada página (telefone/e-mail). */
  rodape: string;
  /** O texto que valeria sem personalização — o painel "Ajustar texto" mostra isto quando o campo está sem ajuste. */
  padroes: { objeto: string; fases: string[]; prazoEntrega: string; paragrafoUnico: string };
}

/** "CREA-BA 051598661-5" já vem com o prefixo no cadastro; "0512345678-BA" não — só acrescenta "CREA nº" quando falta. */
export function creaTexto(crea: string | undefined): string {
  const c = (crea || '').trim();
  if (!c) return '';
  return /^crea/i.test(c) ? c : `CREA nº ${c}`;
}

function enderecoCliente(cliente: Client): string | undefined {
  const e = cliente.endereco;
  // O formulário de cliente já nasce com UF "BA": sem rua não há endereço de verdade.
  if (!e || !(e.rua || '').trim()) return undefined;
  // O cadastro às vezes guarda espaço sobrando no fim ("Santo Antonio ") — limpa pra não sair "Antonio , Itabuna".
  const texto = [e.rua, e.numero, e.complemento, e.bairro, e.cidade, e.estado].map(x => (x || '').trim()).filter(Boolean).join(', ');
  return texto || undefined;
}

interface DadosPessoa {
  nome: string;
  nacionalidade?: string;
  estadoCivil?: string;
  profissao?: string;
  rg?: string;
  documento?: string;
}

/** Qualificação no formato do contrato do profissional: "NOME, brasileiro, casado, autônomo, portador do RG nº X e CPF nº Y". */
function qualificacaoPessoaFisica(p: DadosPessoa): string {
  const partes = [p.nome.trim().toUpperCase()];
  if (p.nacionalidade?.trim()) partes.push(p.nacionalidade.trim());
  if (p.estadoCivil) partes.push(estadoCivilProsa(p.estadoCivil));
  if (p.profissao?.trim()) partes.push(p.profissao.trim());
  const rg = p.rg?.trim();
  const cpf = p.documento?.trim() || PLACEHOLDER;
  partes.push(rg ? `portador(a) do RG nº ${rg} e CPF nº ${cpf}` : `inscrito(a) no CPF sob nº ${cpf}`);
  return partes.join(', ');
}

function contratantePrincipal(cliente: Client): ContratanteDoc {
  const nome = cliente.nome.trim();
  const documento = cliente.documento?.trim() || PLACEHOLDER;

  if (cliente.tipo === 'Pessoa jurídica' || cliente.tipo === 'Condomínio') {
    const endereco = enderecoCliente(cliente);
    const condominio = cliente.tipo === 'Condomínio';
    const partes = [
      nome.toUpperCase(),
      condominio ? 'condomínio edilício' : 'pessoa jurídica de direito privado',
      `inscrito(a) no CNPJ sob nº ${documento}`,
      ...(endereco ? [`com sede em ${endereco}`] : []),
      condominio ? 'neste ato representado por seu síndico' : 'neste ato representada por seu representante legal',
    ];
    return { qualificacao: partes.join(', '), nome, documento, representado: true };
  }

  const q = cliente.qualificacao;
  return {
    qualificacao: qualificacaoPessoaFisica({ nome, nacionalidade: q?.nacionalidade, estadoCivil: q?.estadoCivil, profissao: q?.profissao, rg: q?.rg, documento: cliente.documento || undefined }),
    nome, documento, representado: false,
  };
}

function contratanteAdicional(r: RequerenteAdicional): ContratanteDoc {
  return {
    qualificacao: qualificacaoPessoaFisica({ nome: r.nome, nacionalidade: r.nacionalidade, estadoCivil: r.estadoCivil, profissao: r.profissao, rg: r.rg, documento: r.documento }),
    nome: r.nome.trim(),
    documento: r.documento?.trim() || PLACEHOLDER,
    representado: false,
  };
}

/** "A e B" para dois; "A; B e C" para três ou mais (as qualificações já têm vírgulas). */
function listaQualificacoes(qs: string[]): string {
  if (qs.length <= 1) return qs[0] || PLACEHOLDER;
  if (qs.length === 2) return `${qs[0]} e ${qs[1]}`;
  return `${qs.slice(0, -1).join('; ')} e ${qs[qs.length - 1]}`;
}

/** Qualificação do contratado (o profissional): vem inteira das Configurações; sem ela, monta o mínimo com o que há. */
function qualificacaoContratado(config: CompanyConfig): string {
  const colada = config.contratadoQualificacao?.trim().replace(/[\s,.;]+$/, '');
  if (colada) return colada;
  const nome = config.responsavelNome?.trim();
  if (!nome) return '(qualificação do contratado — preencha em Configurações)';
  const crea = creaTexto(config.responsavelCrea);
  return [nome, (config.responsavelTitulo || 'engenheiro civil').toLowerCase(), crea ? `com registro no ${crea}` : ''].filter(Boolean).join(', ');
}

function percentual(valor: number, total: number): string | undefined {
  if (!(total > 0)) return undefined;
  return String(Math.round((valor / total) * 1000) / 10).replace('.', ',');
}

/** Parcelas do contrato: as do próprio contrato (com vencimento, quando o trabalho já foi criado); senão as
 *  condições da proposta, desde que somem o valor do contrato. Nunca inventa parcela. */
export function parcelasDoContrato(contrato: Contrato, proposta: Proposta | undefined): ParcelaContrato[] {
  const dataBR = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : undefined);
  if (contrato.parcelas.length > 0) {
    return contrato.parcelas.map(p => ({ descricao: p.descricao, valor: formatBRL(p.valor), percentual: percentual(p.valor, contrato.valor), vencimento: dataBR(p.vencimento) }));
  }
  const daProposta = proposta?.parcelasPagamento || [];
  const soma = daProposta.reduce((s, p) => s + p.valor, 0);
  if (daProposta.length > 0 && Math.abs(soma - contrato.valor) < 0.01) {
    return daProposta.map(p => ({ descricao: p.descricao, valor: formatBRL(p.valor), percentual: percentual(p.valor, contrato.valor) }));
  }
  return [];
}

interface OpcoesContrato {
  /** Trabalho do contrato, quando já existe — fornece endereço e matrícula do imóvel para o objeto. */
  trabalho?: Process;
  /** Texto em edição (painel "Ajustar texto"); sem isso usa o que está salvo no contrato. */
  texto?: TextoContrato;
  hoje?: Date;
}

/** Monta o contrato a partir do contrato aprovado + proposta + cadastro do cliente principal. Nunca inventa dado:
 *  o que falta aparece como "(a preencher)". */
export function montarContrato(contrato: Contrato, proposta: Proposta | undefined, cliente: Client, config: CompanyConfig, opcoes: OpcoesContrato = {}): ContratoDoc {
  const hoje = opcoes.hoje ?? new Date();
  const texto = opcoes.texto ?? contrato.textoPersonalizado ?? {};

  const adicionais = (contrato.contratantesAdicionais || []).filter(r => r.nome?.trim());
  const contratantes = [contratantePrincipal(cliente), ...adicionais.map(contratanteAdicional)];
  const plural = contratantes.length > 1;

  const padroes = {
    objeto: objetoPadrao(proposta?.titulo || '', { endereco: opcoes.trabalho?.endereco, matricula: opcoes.trabalho?.tecnico?.matricula }),
    fases: (proposta?.itens || []).map(i => i.nome),
    prazoEntrega: prazoEntregaPadrao(proposta?.prazoDias || PRAZO_ENTREGA_PADRAO_DIAS),
    paragrafoUnico: '',
  };

  const clausulas = montarClausulas({
    plural,
    objeto: texto.objeto?.trim() || padroes.objeto,
    fases: texto.fases?.some(f => f.trim()) ? texto.fases : padroes.fases,
    prazoEntrega: texto.prazoEntrega?.trim() || padroes.prazoEntrega,
    paragrafoUnico: texto.paragrafoUnico?.trim() || undefined,
    valor: formatBRL(contrato.valor),
    valorExtenso: reaisPorExtenso(contrato.valor),
    parcelas: parcelasDoContrato(contrato, proposta),
  });

  const qualContratado = qualificacaoContratado(config);
  const abertura = `Através do presente instrumento particular de contrato, de um lado, ${listaQualificacoes(contratantes.map(c => c.qualificacao))}, doravante denominad${plural ? 'os CONTRATANTES' : 'o CONTRATANTE'}, e do outro lado ${qualContratado}, doravante denominado CONTRATADO, têm justo e contratado entre si o que segue:`;

  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const rodape = [config.telefone?.trim() ? `Tel. ${config.telefone.trim()}` : '', config.email?.trim().toUpperCase() || ''].filter(Boolean).join(' / ');

  return {
    codigo: contrato.codigo,
    propostaCodigo: proposta?.codigo || '',
    abertura,
    contratado: {
      nome: config.responsavelNome?.trim() || qualContratado.split(',')[0],
      titulo: config.responsavelTitulo?.trim() || 'Engenheiro Civil',
      crea: creaTexto(config.responsavelCrea),
    },
    contratantes,
    plural,
    clausulas,
    cidade: CIDADE,
    data: `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`,
    testemunhas: !!texto.testemunhas,
    rodape,
    padroes,
  };
}

/** O que ainda falta preencher para o contrato sair completo — mostrado antes de imprimir (não bloqueia). */
export function pendenciasDoContrato(contrato: Contrato, cliente: Client, config: CompanyConfig, proposta?: Proposta): string[] {
  const p: string[] = [];
  if (!config.contratadoQualificacao?.trim()) p.push('Qualificação do contratado — nome, CPF, RG, endereço… (Configurações → dados da empresa)');
  if (!cliente.documento?.trim()) p.push(`CPF/CNPJ de ${cliente.nome.trim()} (cadastro do cliente)`);
  if (cliente.tipo === 'Pessoa física') {
    const q = cliente.qualificacao;
    const faltam = [!q?.nacionalidade?.trim() && 'nacionalidade', !q?.estadoCivil && 'estado civil', !q?.profissao?.trim() && 'profissão'].filter(Boolean);
    if (faltam.length) p.push(`${faltam.join(', ').replace(/, ([^,]*)$/, ' e $1')} de ${cliente.nome.trim()} (cadastro do cliente)`);
  }
  for (const r of contrato.contratantesAdicionais || []) {
    if (r.nome?.trim() && !r.documento?.trim()) p.push(`CPF de ${r.nome.trim()}`);
  }
  if (parcelasDoContrato(contrato, proposta).length === 0) p.push('Parcelas de pagamento (Editar contrato)');
  return p;
}
