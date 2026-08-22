import { Client, ProcuracaoData, Process } from '@/lib/types';

const PLACEHOLDER = 'Informação necessária para geração.';

/** Outorgado fixo em toda Procuração emitida pela HBS — é sempre o próprio responsável técnico
 *  representando o cliente perante a Prefeitura, dado real e estável (não vem de cadastro). */
export const OUTORGADO_PROCURACAO = {
  nome: 'Jádson Castro Santana',
  qualificacao: 'engenheiro civil, inscrito no CREA sob nº 051598661-5, portador do CPF nº 009.912.635-45',
  endereco: 'Rua Francisco Benício, 140, Alto Maron, Itabuna-BA',
};

function enderecoClienteFmt(cliente: Client | undefined): string {
  if (!cliente?.endereco) return '';
  const { rua, numero, complemento, bairro, cidade, estado } = cliente.endereco;
  return [rua, numero, complemento, bairro, cidade, estado].filter(Boolean).join(', ');
}

/** Dados iniciais: usa o que já foi salvo neste Trabalho (edição), senão auto-preenche do Cliente/Trabalho. */
export function dadosIniciaisProcuracao(trabalho: Process, cliente: Client | undefined): ProcuracaoData {
  if (trabalho.procuracao) return trabalho.procuracao;

  const data: ProcuracaoData = {
    objetoProcesso: trabalho.endereco || trabalho.objeto || undefined,
    cidade: cliente?.endereco?.cidade || 'Itabuna',
    dataDocumento: new Date().toISOString().slice(0, 10),
  };

  if (cliente) {
    data.outorganteNome = cliente.nome || undefined;
    data.outorganteCpf = cliente.documento || undefined;
    data.outorganteNacionalidade = cliente.qualificacao?.nacionalidade;
    data.outorganteEstadoCivil = cliente.qualificacao?.estadoCivil;
    data.outorganteProfissao = cliente.qualificacao?.profissao;
    data.outorganteRg = cliente.qualificacao?.rg;
    const end = enderecoClienteFmt(cliente);
    if (end) data.outorganteEndereco = end;
  }

  return data;
}

function lowerFirst(v: string): string {
  return v.charAt(0).toLowerCase() + v.slice(1);
}

function qualificacaoOutorgante(data: ProcuracaoData): string {
  const nome = (data.outorganteNome || '').toUpperCase();
  if (!nome) return PLACEHOLDER;
  const partes = [nome];
  if (data.outorganteNacionalidade) partes.push(data.outorganteNacionalidade);
  if (data.outorganteEstadoCivil) partes.push(lowerFirst(data.outorganteEstadoCivil));
  if (data.outorganteProfissao) partes.push(data.outorganteProfissao);
  if (data.outorganteRg) partes.push(`portador(a) do RG nº ${data.outorganteRg}`);
  if (data.outorganteCpf) partes.push(`CPF nº ${data.outorganteCpf}`);
  if (data.outorganteEndereco) partes.push(`residente e domiciliado(a) à ${data.outorganteEndereco}`);
  return `${partes.join(', ')}.`;
}

export interface ProcuracaoDoc {
  outorganteQualificacao: string;
  outorgadoNome: string;
  outorgadoQualificacao: string;
  outorgadoEndereco: string;
  objeto: string;
  cidade: string;
  data: string;
}

export function montarProcuracao(data: ProcuracaoData): ProcuracaoDoc {
  return {
    outorganteQualificacao: qualificacaoOutorgante(data),
    outorgadoNome: OUTORGADO_PROCURACAO.nome,
    outorgadoQualificacao: OUTORGADO_PROCURACAO.qualificacao,
    outorgadoEndereco: OUTORGADO_PROCURACAO.endereco,
    objeto: data.objetoProcesso?.trim() || PLACEHOLDER,
    cidade: data.cidade?.trim() || 'Itabuna',
    data: data.dataDocumento ? new Date(data.dataDocumento + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
  };
}
