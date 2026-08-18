import { Process, Client, Unidade } from '@/lib/types';
import { agruparPorPavimento, somaUnidade, areaTotalAutonomas } from './fracaoIdeal';
import { proprietariosDoTrabalho, conjugeParaAssinatura, qualificacoesComConjuge, ConjugeAssinatura } from './documentoShared';
import { CONVENCAO_ARTIGOS, CONVENCAO_DUAS_UNIDADES } from './convencaoArtigos';

function normalizarCpf(v: string) {
  return v.replace(/\D/g, '');
}

export interface ParagrafoUnidade {
  pavimento: string;
  unidade: Unidade;
  soma: number;
  fracaoPct: number;
}

export interface ConvencaoData {
  nomeTrabalho: string;
  endereco: string;
  inscricoes: string;
  semFracao: boolean;
  somaTotal: number;
  paragrafos: ParagrafoUnidade[];
  artigos: string[];
  qualificacoes: string[];
  proprietarios: { nome: string; cpf?: string; unidades: string; conjuge?: ConjugeAssinatura }[];
}

/** Convenção de Condomínio — portado de cota_saas (lib/documentos/convencao.ts). */
export function montarConvencao(trabalho: Process, cliente: Client | undefined, clientes: Client[]): ConvencaoData {
  const tecnico = trabalho.tecnico;
  const units = tecnico?.units || [];
  const semFracao = !!tecnico?.semFracao;
  const somaTotal = areaTotalAutonomas(units);
  const proprietariosBase = proprietariosDoTrabalho(trabalho, cliente);
  const inscricoes = units.map(u => u.inscricao).filter(Boolean).join(', ');

  const grupos = agruparPorPavimento(units);
  const paragrafos: ParagrafoUnidade[] = [];
  for (const [pavimento, unidades] of grupos) {
    for (const u of unidades) {
      const soma = somaUnidade(u);
      const fracaoPct = u.autonoma !== false && somaTotal ? (soma / somaTotal) * 100 : 0;
      paragrafos.push({ pavimento, unidade: u, soma, fracaoPct });
    }
  }

  const algumaUnidadeTemTitular = units.some(u => !!u.proprietarioCpf);
  const proprietarios = proprietariosBase.map(p => {
    const unidadesDoProprietario = p.cpf ? units.filter(u => u.proprietarioCpf && normalizarCpf(u.proprietarioCpf) === normalizarCpf(p.cpf!)) : [];
    const unidadesRelevantes = algumaUnidadeTemTitular ? unidadesDoProprietario : units;
    return {
      nome: p.nome,
      cpf: p.cpf,
      unidades: unidadesRelevantes.map(u => `${u.pavimento} (${u.nome})`).join(', '),
      conjuge: conjugeParaAssinatura(p.cpf, clientes),
    };
  });

  return {
    nomeTrabalho: trabalho.objeto,
    endereco: trabalho.endereco || '',
    inscricoes,
    semFracao,
    somaTotal,
    paragrafos,
    artigos: tecnico?.condominioDuasUnidades ? [...CONVENCAO_ARTIGOS, ...CONVENCAO_DUAS_UNIDADES] : CONVENCAO_ARTIGOS,
    qualificacoes: qualificacoesComConjuge(proprietariosBase, clientes),
    proprietarios,
  };
}
