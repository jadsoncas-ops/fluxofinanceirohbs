import { Process, Client } from '@/lib/types';
import { proprietariosDoTrabalho, conjugeParaAssinatura, qualificacoesComConjuge, ConjugeAssinatura } from './documentoShared';

function normalizarCpf(v: string) {
  return v.replace(/\D/g, '');
}

export interface RequerimentoData {
  nomeTrabalho: string;
  endereco: string;
  inscricoes: string;
  qualificacoes: string[];
  proprietarios: { nome: string; cpf?: string; unidade: string; conjuge?: ConjugeAssinatura }[];
  pedidos: string[];
}

/** Opções do checklist "Atos registrais a requerer" — a ordem aqui é a ordem em que os pedidos saem no documento. */
export const ATOS_REGISTRAIS_OPCOES: { key: string; label: string }[] = [
  { key: 'especificacao', label: 'Especificação Simplificada de Condomínio' },
  { key: 'instituicao', label: 'Instituição de Condomínio' },
  { key: 'convencao', label: 'Convenção de Condomínio' },
  { key: 'inventario', label: 'Averbação de Inventário' },
  { key: 'partilha', label: 'Averbação de Partilha' },
  { key: 'transmissao', label: 'Registro/Averbação de Transmissão' },
  { key: 'doacao', label: 'Registro de Escritura Pública de Doação' },
  { key: 'outros', label: 'Outros atos registrais decorrentes da regularização' },
];

function textoAto(key: string, nomeTrabalho: string): string | null {
  switch (key) {
    case 'especificacao':
      return `o processamento e registro da Especificação Simplificada de Condomínio do empreendimento "${nomeTrabalho.toUpperCase()}", com a correspondente individualização e caracterização das unidades autônomas`;
    case 'instituicao':
      return 'o processamento e registro da Instituição de Condomínio, conforme a documentação apresentada';
    case 'convencao':
      return 'o processamento e registro da Convenção de Condomínio, conforme a documentação apresentada';
    case 'inventario':
      return 'a averbação do Inventário, conforme a documentação apresentada';
    case 'partilha':
      return 'a averbação da Partilha, conforme a documentação apresentada';
    case 'transmissao':
      return 'o registro e/ou a averbação da Transmissão, conforme o título apresentado';
    case 'doacao':
      return 'o registro da Escritura Pública de Doação, conforme o título apresentado';
    case 'outros':
      return 'a prática dos demais atos registrais decorrentes da regularização, conforme a documentação apresentada';
    default:
      return null;
  }
}

function montarPedidos(atosSelecionados: string[], nomeTrabalho: string): string[] {
  const selecionados = new Set(atosSelecionados);
  const itens = ATOS_REGISTRAIS_OPCOES.filter(o => selecionados.has(o.key))
    .map(o => textoAto(o.key, nomeTrabalho))
    .filter((t): t is string => !!t)
    .map(t => `${t};`);

  if (itens.length === 0) return [];

  itens.push('que os atos requeridos sejam processados observada a ordem registral necessária, praticando-se os atos subsequentes que deles decorram, quando juridicamente cabíveis.');
  return itens;
}

/** Requerimento de Especificação Simplificada — portado de cota_saas (lib/documentos/requerimento.ts). */
export function montarRequerimento(trabalho: Process, cliente: Client | undefined, clientes: Client[]): RequerimentoData {
  const tecnico = trabalho.tecnico;
  const units = tecnico?.units || [];
  const proprietariosBase = proprietariosDoTrabalho(trabalho, cliente);
  const inscricoes = units.map(u => u.inscricao).filter(Boolean).join(', ');

  const proprietarios = proprietariosBase.map(p => {
    const unidadesDoProprietario = p.cpf ? units.filter(u => u.proprietarioCpf && normalizarCpf(u.proprietarioCpf) === normalizarCpf(p.cpf!)) : [];
    const unidade = unidadesDoProprietario.map(u => `${u.pavimento} (${u.nome})`).join(', ');
    return { nome: p.nome, cpf: p.cpf, unidade, conjuge: conjugeParaAssinatura(p.cpf, clientes) };
  });

  return {
    nomeTrabalho: trabalho.objeto,
    endereco: trabalho.endereco || '',
    inscricoes,
    qualificacoes: qualificacoesComConjuge(proprietariosBase, clientes),
    proprietarios,
    pedidos: montarPedidos(tecnico?.atosRegistraisRequerimento || [], trabalho.objeto),
  };
}
