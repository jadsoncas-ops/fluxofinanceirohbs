import { Client, QualificacaoJuridica, Process, DadosTecnicosTrabalho } from '@/lib/types';
import { fmtProsa, LinhaFracaoFormatada } from './fracaoIdeal';

/** Helpers de texto compartilhados pelos 7 geradores — portado de cota_saas (lib/documentos/shared.ts). */

export function precisaQualificarConjuge(estadoCivil: string | null | undefined): boolean {
  return estadoCivil === 'Casado(a)' || estadoCivil === 'União Estável';
}

export function tituloDocumento(label: string, nomeTrabalho?: string | null): string {
  return nomeTrabalho ? `${label} — ${nomeTrabalho}` : label;
}

export interface ProprietarioRef {
  nome: string;
  cpf?: string;
  /** Qualificação inline (quando o proprietário não é um Client cadastrado) — ver ProprietarioGeral. */
  nacionalidade?: string;
  estadoCivil?: string;
  conjugeNome?: string;
  profissao?: string;
  rg?: string;
  endereco?: string;
}

/** Verdadeiro quando há qualificação preenchida diretamente no proprietário (não depende de achar
 *  um Client cadastrado com esse CPF). */
export function temQualificacaoInline(p: ProprietarioRef): boolean {
  return !!(p.nacionalidade || p.estadoCivil || p.profissao || p.rg || p.endereco);
}

/** Monta a frase de qualificação a partir dos dados inline do proprietário — mesmo formato de
 *  qualificacaoCompleta, mas sem depender de um Client cadastrado. */
export function qualificacaoInlineTexto(p: ProprietarioRef): string {
  const nomeCaps = (p.nome || '(a preencher)').toUpperCase();
  const partes = [nomeCaps];
  if (p.nacionalidade) partes.push(p.nacionalidade);
  partes.push('maior, capaz');
  if (p.estadoCivil) {
    const precisaConjuge = p.estadoCivil === 'Casado(a)' || p.estadoCivil === 'União Estável';
    partes.push(precisaConjuge && p.conjugeNome ? `${p.estadoCivil} com ${p.conjugeNome}` : p.estadoCivil);
  }
  if (p.profissao) partes.push(p.profissao);
  if (p.rg) partes.push(`RG nº ${p.rg}`);
  if (p.cpf) partes.push(`inscrito(a) no CPF/CNPJ nº ${p.cpf}`);
  if (p.endereco) partes.push(`residente e domiciliado(a) em ${p.endereco}`);
  return `${partes.join(', ')}.`;
}

/** Compõe a frase "Um lote de terreno, medindo X metros de frente..." a partir dos 4 lados — terreno regular. */
export function compoemMedidas(frente?: number, fundo?: number, lateralDireita?: number, lateralEsquerda?: number): string {
  const f = frente || 0, fu = fundo || 0, d = lateralDireita || 0, e = lateralEsquerda || 0;
  if (!f && !fu && !d && !e) return '';
  return `Um lote de terreno, medindo ${fmtProsa(f)} metros de frente, ${fmtProsa(fu)} metros de fundo, ${fmtProsa(d)} metros do lado direito e ${fmtProsa(e)} metros do lado esquerdo.`;
}

/** Texto de medidas do lote usado nos documentos — terreno regular compõe a frase a partir dos 4 lados; irregular usa o texto livre digitado. */
export function medidasTexto(tecnico: DadosTecnicosTrabalho | undefined): string {
  if (!tecnico) return '';
  if (tecnico.formatoTerreno === 'regular') {
    return compoemMedidas(tecnico.frente, tecnico.fundo, tecnico.lateralDireita, tecnico.lateralEsquerda);
  }
  return tecnico.medidas || '';
}

/** Proprietários do trabalho — usa proprietariosGerais quando cadastrados; senão cai no cliente do trabalho (sempre existe). */
export function proprietariosDoTrabalho(trabalho: Process, cliente: Client | undefined): ProprietarioRef[] {
  const gerais = trabalho.tecnico?.proprietariosGerais;
  if (gerais && gerais.length) {
    return gerais.map(p => ({
      nome: p.nome, cpf: p.cpf,
      nacionalidade: p.nacionalidade, estadoCivil: p.estadoCivil, conjugeNome: p.conjugeNome,
      profissao: p.profissao, rg: p.rg, endereco: p.endereco,
    }));
  }
  if (cliente) return [{ nome: cliente.nome, cpf: cliente.documento || undefined }];
  return [];
}

/** Fonte única da frase de áreas — usada por Memorial, Instituição e Convenção. Quando `formatado` é
 *  passado (linha já arredondada coluna a coluna pelo Quadro de Fração Ideal), usa esses valores em vez
 *  de arredondar de novo isoladamente — evita o texto dizer um número e a tabela mostrar outro para a
 *  mesma unidade. */
export function descricaoAreas(
  p: { unidade: { areaComum: number; areaGaragem: number; areaPrivativa: number; garagemNoPavimento?: boolean }; soma: number; fracaoPct: number },
  semFracao: boolean,
  incluirFracao = true,
  formatado?: LinhaFracaoFormatada
): string {
  const areaComum = formatado ? formatado.areaComum : fmtProsa(p.unidade.areaComum);
  const areaGaragem = formatado ? formatado.areaGaragem : fmtProsa(p.unidade.areaGaragem);
  const areaPrivativa = formatado ? formatado.areaPrivativa : fmtProsa(p.unidade.areaPrivativa);
  const soma = formatado ? formatado.soma : fmtProsa(p.soma);
  const fracaoPct = formatado ? formatado.fracaoPct : fmtProsa(p.fracaoPct);

  if (semFracao) return `Área total de ${soma}m²`;

  const partes: string[] = [];
  if (p.unidade.areaComum > 0) partes.push(`área comum de ${areaComum}m²`);
  if (p.unidade.areaGaragem > 0 && p.unidade.garagemNoPavimento !== false) {
    partes.push(`área de garagem de ${areaGaragem}m²`);
  }
  if (p.unidade.areaPrivativa > 0) partes.push(`área privativa de ${areaPrivativa}m²`);
  partes.push(`área total de ${soma}m²`);
  if (incluirFracao) partes.push(`fração ideal de ${fracaoPct}%`);

  const texto = partes.join(', ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function normalizarCpf(v: string) {
  return v.replace(/\D/g, '');
}

function clienteByCpf(cpf: string | undefined, clientes: Client[]): Client | undefined {
  if (!cpf) return undefined;
  return clientes.find(c => c.documento && normalizarCpf(c.documento) === normalizarCpf(cpf));
}

function fraseEstadoCivil(q: QualificacaoJuridica): string | undefined {
  if (!q.estadoCivil) return undefined;
  if (!precisaQualificarConjuge(q.estadoCivil) || !q.conjuge?.nome) return q.estadoCivil;
  const regime = q.regimeBens ? `, sob o regime de ${q.regimeBens}` : '';
  return `${q.estadoCivil} com ${q.conjuge.nome}${regime}`;
}

/** Qualificação jurídica completa de um proprietário — usa os dados cadastrados em Clientes quando disponíveis. */
export function qualificacaoCompleta(nome: string, cpf: string | undefined, clientes: Client[]): string {
  const nomeCaps = (nome || '').toUpperCase();
  const cliente = clienteByCpf(cpf, clientes);
  const q = cliente?.qualificacao;

  if (!cliente || !q) {
    return `${nomeCaps}${cpf ? `, inscrito(a) no CPF/CNPJ nº ${cpf}` : ''}.`;
  }

  const partes = [nomeCaps];
  if (q.nacionalidade) partes.push(q.nacionalidade);
  partes.push('maior, capaz');
  const estadoCivilTexto = fraseEstadoCivil(q);
  if (estadoCivilTexto) partes.push(estadoCivilTexto);
  if (q.profissao) partes.push(q.profissao);
  if (q.rg) partes.push(`RG nº ${q.rg}`);
  if (cpf) partes.push(`inscrito(a) no CPF/CNPJ nº ${cpf}`);
  if (q.filiacao) partes.push(q.filiacao);
  const endereco = cliente.endereco ? [cliente.endereco.rua, cliente.endereco.numero, cliente.endereco.bairro, cliente.endereco.cidade, cliente.endereco.estado].filter(Boolean).join(', ') : '';
  if (endereco) partes.push(`residente e domiciliado(a) em ${endereco}`);
  return `${partes.join(', ')}.`;
}

/** Qualificação jurídica completa do casal (titular + cônjuge), quando o cônjuge também assina. */
export function qualificacaoCasal(nomeTitular: string, cliente: Client, clausulasTitular: string[] = []): string | undefined {
  const q = cliente.qualificacao;
  if (!q?.conjuge?.assina || !precisaQualificarConjuge(q.estadoCivil) || !q.conjuge?.nome) return undefined;

  const conjugeCaps = q.conjuge.nome.toUpperCase();
  const titularCaps = (nomeTitular || '').toUpperCase();

  const partes = [conjugeCaps];
  if (q.conjuge.nacionalidade) partes.push(q.conjuge.nacionalidade);
  partes.push('maior, capaz');
  if (q.conjuge.profissao) partes.push(q.conjuge.profissao);
  if (q.conjuge.rg) partes.push(`RG nº ${q.conjuge.rg}`);
  if (q.conjuge.cpf) partes.push(`inscrito(a) no CPF nº ${q.conjuge.cpf}`);

  const dadosTitular = [titularCaps];
  if (q.nacionalidade) dadosTitular.push(q.nacionalidade);
  if (q.profissao) dadosTitular.push(q.profissao);
  if (q.rg) dadosTitular.push(`RG nº ${q.rg}`);
  if (cliente.documento) dadosTitular.push(`inscrito(a) no CPF/CNPJ nº ${cliente.documento}`);
  dadosTitular.push(...clausulasTitular);
  partes.push(`${q.estadoCivil} com ${dadosTitular.join(', ')}`);

  if (q.regimeBens) partes.push(`sob o regime de ${q.regimeBens}`);
  const endereco = cliente.endereco ? [cliente.endereco.rua, cliente.endereco.numero, cliente.endereco.bairro, cliente.endereco.cidade, cliente.endereco.estado].filter(Boolean).join(', ') : '';
  if (endereco) partes.push(`ambos residentes e domiciliados(as) em ${endereco}`);

  return `${partes.join(', ')}.`;
}

/** Uma qualificação (com cônjuge embutido no mesmo parágrafo, quando aplicável) por proprietário.
 *  Prioridade: qualificação inline no próprio proprietário > Client cadastrado com o mesmo CPF > só nome+CPF. */
export function qualificacoesComConjuge(proprietarios: ProprietarioRef[], clientes: Client[]): string[] {
  return proprietarios.map(p => {
    if (temQualificacaoInline(p)) return qualificacaoInlineTexto(p);
    const cliente = clienteByCpf(p.cpf, clientes);
    const combinada = cliente ? qualificacaoCasal(p.nome || '(a preencher)', cliente) : undefined;
    return combinada || qualificacaoCompleta(p.nome || '(a preencher)', p.cpf, clientes);
  });
}

export interface ConjugeAssinatura {
  nome: string;
  cpf?: string;
}

/** Cônjuge para o bloco de assinaturas — só quando marcado para assinar. */
export function conjugeParaAssinatura(cpf: string | undefined, clientes: Client[]): ConjugeAssinatura | undefined {
  const cliente = clienteByCpf(cpf, clientes);
  const q = cliente?.qualificacao;
  if (!q?.conjuge?.assina || !precisaQualificarConjuge(q.estadoCivil) || !q.conjuge?.nome) return undefined;
  return { nome: q.conjuge.nome, cpf: q.conjuge.cpf || undefined };
}

export const ENDERECO_ESCRITORIO = {
  linha1: 'HBS Engineering',
  linha2: 'Plataforma de Engenharia Civil Inteligente',
};

export const TEXTO_ATIPICIDADE_SIMPLIFICADA =
  'Cientes de que o presente empreendimento é atípico nos termos do art. 1.179 do Provimento 15/2023 do TJBA, os proprietários declaram ciência de que o empreendimento está em situação atípica perante o ente Municipal e/ou perante o Cartório de Imóveis, não tendo sido apresentado o habite-se para a averbação da construção das unidades, conforme previsto no art. 1.143, I do CNBA.';

export const AREAS_COMUNS_BOILERPLATE =
  'Áreas e partes comuns, indivisíveis e inalienáveis: o terreno sobre o qual foram edificadas as unidades autônomas, bem como as fundações, colunas e vigas de sustentação, telhados, cobertura, paredes externas, paredes laterais e perimetrais de cada unidade, pisos de concreto armado, encanamentos e respectivas instalações de água e esgoto, bem como luz, força e telefone, assim também seus medidores, tudo até o ponto de interseção com as ligações de propriedade dos condôminos, calhas e condutores de águas pluviais, hall de entrada, garagem, playground, jardim, escadas, áreas internas, reservatórios superiores de água, bombas de elevação de água e respectivos pertences, instalações contra incêndio, calçadas, enfim, tudo o que mais sirva a qualquer dependência de uso comum dos condôminos, destacados das unidades autônomas, bem como qualquer instalação que, por sua natureza, se destine a uso comum.';
