import { AverbacaoData, Client, Process, TipoAtoAverbacao } from '@/lib/types';

export const TIPOS_ATO: { key: TipoAtoAverbacao; label: string; textoDocumento: string }[] = [
  { key: 'averbacao_construcao', label: 'Averbação de construção', textoDocumento: 'construção' },
  { key: 'averbacao_ampliacao', label: 'Averbação de ampliação', textoDocumento: 'ampliação' },
  { key: 'averbacao_reforma', label: 'Averbação de reforma', textoDocumento: 'reforma' },
  { key: 'regularizacao_existente', label: 'Regularização de construção existente', textoDocumento: 'regularização da construção existente' },
];

const PLACEHOLDER = 'Informação necessária para geração.';

function enderecoClienteFmt(cliente: Client | undefined): string {
  if (!cliente?.endereco) return '';
  const { rua, numero, complemento, bairro, cidade, estado } = cliente.endereco;
  return [rua, numero, complemento, bairro, cidade, estado].filter(Boolean).join(', ');
}

/** Dados iniciais do wizard: usa o que já foi salvo neste Trabalho (edição), senão auto-preenche do
 *  Cliente/Trabalho o que já existir — nunca inventa o que falta, só deixa em branco para o usuário completar. */
export function dadosIniciaisAverbacao(trabalho: Process, cliente: Client | undefined): AverbacaoData {
  if (trabalho.averbacao) return trabalho.averbacao;

  const data: AverbacaoData = {
    matricula: trabalho.tecnico?.matricula || undefined,
    imovelEndereco: trabalho.endereco || undefined,
    dataDocumento: new Date().toISOString().slice(0, 10),
  };

  if (cliente) {
    data.requerenteNome = cliente.nome || undefined;
    data.requerenteDocumento = cliente.documento || undefined;
    const enderecoFmt = enderecoClienteFmt(cliente);
    if (enderecoFmt) data.requerenteEndereco = enderecoFmt;

    if (cliente.tipo === 'Pessoa jurídica') {
      // pessoa jurídica não tem representante cadastrado no Cliente 360 hoje — o usuário preenche no wizard
    } else {
      data.requerenteEstadoCivil = cliente.qualificacao?.estadoCivil;
      data.requerenteProfissao = cliente.qualificacao?.profissao;
      if (cliente.qualificacao?.conjuge?.assina && cliente.qualificacao.conjuge.nome) {
        data.requerenteConjugeNome = cliente.qualificacao.conjuge.nome;
      }
    }
  }

  return data;
}

/** true quando o cliente ou o trabalho sinalizam um cenário de condomínio — a ferramenta certa nesse caso
 *  costuma ser Instituição/Convenção de Condomínio, não este requerimento de averbação. Não bloqueia, só avisa. */
export function trabalhoPareceCondominio(trabalho: Process, cliente: Client | undefined): boolean {
  return cliente?.tipo === 'Condomínio' || (trabalho.tecnico?.units?.length || 0) > 1;
}

export interface CampoFaltante {
  campo: keyof AverbacaoData | 'tipoAto';
  mensagem: string;
}

/** Os únicos campos que bloqueiam a geração — os demais podem ficar em branco (aparecem como placeholder no texto). */
export function validarAverbacao(data: AverbacaoData): CampoFaltante[] {
  const erros: CampoFaltante[] = [];
  if (!data.requerenteNome?.trim()) erros.push({ campo: 'requerenteNome', mensagem: 'Informe o nome do requerente.' });
  if (!data.requerenteDocumento?.trim()) erros.push({ campo: 'requerenteDocumento', mensagem: 'Informe o CPF/CNPJ do requerente.' });
  if (!data.matricula?.trim()) erros.push({ campo: 'matricula', mensagem: 'Informe a matrícula do imóvel.' });
  if (!data.imovelEndereco?.trim()) erros.push({ campo: 'imovelEndereco', mensagem: 'Informe o endereço do imóvel.' });
  if (!data.areaConstruida || data.areaConstruida <= 0) erros.push({ campo: 'areaConstruida', mensagem: 'Informe a área construída.' });
  if (!data.tipoAto) erros.push({ campo: 'tipoAto', mensagem: 'Selecione o tipo de ato.' });
  if (!data.valorConstrucao || data.valorConstrucao <= 0) erros.push({ campo: 'valorConstrucao', mensagem: 'Informe o valor atribuído à construção.' });
  return erros;
}

function fmtMoney(v: number | undefined): string {
  if (v === undefined || v === null) return PLACEHOLDER;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Primeira letra minúscula — usado para estado civil no meio da frase (o enum é exibido com
 *  inicial maiúscula no formulário, mas em prosa corrida só o nome do requerente fica em caixa alta). */
function lowerFirst(v: string): string {
  return v.charAt(0).toLowerCase() + v.slice(1);
}

function enderecoImovelCompleto(data: AverbacaoData): string {
  const partes = [data.imovelEndereco, data.imovelNumero, data.imovelComplemento, data.imovelBairro, data.imovelCidade, data.imovelEstado].filter(Boolean);
  return partes.length ? partes.join(', ') : '';
}

function qualificacaoRequerente(data: AverbacaoData, cliente: Client | undefined): string {
  const isPJ = cliente?.tipo === 'Pessoa jurídica';
  const nome = (data.requerenteNome || '').toUpperCase();
  if (!nome) return PLACEHOLDER;

  if (isPJ) {
    const partes = [nome];
    if (data.requerenteDocumento) partes.push(`inscrita no CNPJ nº ${data.requerenteDocumento}`);
    if (data.requerenteEndereco) partes.push(`com sede em ${data.requerenteEndereco}`);
    if (data.representanteNome) {
      const repPartes = [`neste ato representada por ${data.representanteNome.toUpperCase()}`];
      if (data.representanteCpf) repPartes.push(`CPF nº ${data.representanteCpf}`);
      if (data.representanteQualificacao) repPartes.push(data.representanteQualificacao);
      partes.push(repPartes.join(', '));
    }
    return partes.join(', ');
  }

  const partes = [nome, 'maior, capaz'];
  if (data.requerenteEstadoCivil) {
    const estadoCivil = lowerFirst(data.requerenteEstadoCivil);
    partes.push(data.requerenteConjugeNome ? `${estadoCivil} com ${data.requerenteConjugeNome}` : estadoCivil);
  }
  if (data.requerenteProfissao) partes.push(data.requerenteProfissao);
  if (data.requerenteDocumento) partes.push(`inscrito(a) no CPF nº ${data.requerenteDocumento}`);
  if (data.requerenteEndereco) partes.push(`residente e domiciliado(a) em ${data.requerenteEndereco}`);
  return partes.join(', ');
}

function listaDocumentos(data: AverbacaoData): string {
  const itens: string[] = [];
  if (data.temAlvara) itens.push('Alvará');
  if (data.temHabiteSe) itens.push('Habite-se / documento municipal equivalente');
  if (data.temArt) itens.push('ART');
  if (data.temRrt) itens.push('RRT');
  if (data.temTrt) itens.push('TRT');
  if (data.temCertidao) itens.push('Certidão');
  if (data.temPlantasAprovadas) itens.push('Plantas Aprovadas pela Prefeitura');
  if (data.outrosDocumentos?.trim()) itens.push(data.outrosDocumentos.trim());
  if (itens.length === 0) return '';
  if (itens.length === 1) return itens[0];
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

export interface RequerimentoAverbacaoDoc {
  cartorio: string;
  tituloAto: string;
  qualificacao: string;
  matricula: string;
  tipoAtoTexto: string;
  enderecoImovel: string;
  area: string;
  finalidade: string;
  pavimentos: string;
  valor: string;
  documentos: string;
  municipio: string;
  data: string;
  nomeRequerente: string;
  documentoRequerente: string;
}

/** Monta o texto do requerimento a partir do que foi preenchido — nunca inventa dado ausente,
 *  usa o placeholder padrão em qualquer campo crítico que não tenha sido informado. */
export function montarRequerimentoAverbacao(data: AverbacaoData, cliente: Client | undefined): RequerimentoAverbacaoDoc {
  const ato = TIPOS_ATO.find(t => t.key === data.tipoAto);
  const enderecoImovel = enderecoImovelCompleto(data);

  return {
    cartorio: data.cartorio?.trim() || PLACEHOLDER,
    tituloAto: ato ? ato.label.toUpperCase() : PLACEHOLDER,
    qualificacao: qualificacaoRequerente(data, cliente),
    matricula: data.matricula?.trim() || PLACEHOLDER,
    tipoAtoTexto: ato ? ato.textoDocumento : PLACEHOLDER,
    enderecoImovel: enderecoImovel || PLACEHOLDER,
    area: data.areaConstruida ? `${data.areaConstruida.toLocaleString('pt-BR')} m²` : PLACEHOLDER,
    finalidade: data.finalidade?.trim() || 'não informada',
    pavimentos: data.pavimentos ? String(data.pavimentos) : '(não informado)',
    valor: fmtMoney(data.valorConstrucao),
    documentos: listaDocumentos(data) || 'a documentação a ser complementada',
    municipio: data.imovelCidade?.trim() || '(Município)',
    data: data.dataDocumento ? new Date(data.dataDocumento + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    nomeRequerente: data.requerenteNome?.trim() || PLACEHOLDER,
    documentoRequerente: data.requerenteDocumento?.trim() || PLACEHOLDER,
  };
}
