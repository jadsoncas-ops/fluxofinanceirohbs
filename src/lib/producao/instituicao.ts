import { Process, Client, Unidade } from '@/lib/types';
import { agruparPorPavimento, somaUnidade, areaTotalAutonomas } from './fracaoIdeal';
import { proprietariosDoTrabalho, qualificacoesComConjuge, conjugeParaAssinatura, ConjugeAssinatura } from './documentoShared';

export interface ParagrafoUnidade {
  pavimento: string;
  unidade: Unidade;
  soma: number;
  fracaoPct: number;
}

export interface InstituicaoData {
  nomeTrabalho: string;
  endereco: string;
  qualificacoes: string[];
  medidas: string;
  terreno: number;
  inscricoes: string;
  matricula: string;
  paragrafos: ParagrafoUnidade[];
  somaTotal: number;
  semFracao: boolean;
  areasComunsTexto: string;
  proprietariosAssinatura: { nome: string; cpf?: string; conjuge?: ConjugeAssinatura }[];
}

/** Instituição de Condomínio — portado de cota_saas (lib/documentos/instituicao.ts). */
export function montarInstituicao(trabalho: Process, cliente: Client | undefined, clientes: Client[]): InstituicaoData {
  const tecnico = trabalho.tecnico;
  const units = tecnico?.units || [];
  const semFracao = !!tecnico?.semFracao;
  const somaTotal = areaTotalAutonomas(units);
  const proprietarios = proprietariosDoTrabalho(trabalho, cliente);
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

  return {
    nomeTrabalho: trabalho.objeto,
    endereco: trabalho.endereco || '',
    qualificacoes: qualificacoesComConjuge(proprietarios, clientes),
    medidas: tecnico?.medidas || '',
    terreno: tecnico?.terreno || 0,
    inscricoes,
    matricula: tecnico?.matricula || '',
    paragrafos,
    somaTotal,
    semFracao,
    areasComunsTexto: tecnico?.areasComuns || '',
    proprietariosAssinatura: proprietarios.map(p => ({ nome: p.nome, cpf: p.cpf, conjuge: conjugeParaAssinatura(p.cpf, clientes) })),
  };
}
