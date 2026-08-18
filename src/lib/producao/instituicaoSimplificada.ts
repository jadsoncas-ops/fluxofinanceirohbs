import { Process, Client, Unidade } from '@/lib/types';
import { agruparPorPavimento, somaUnidade, areaTotalAutonomas, calcularQuadroFracao, verificacaoQuadro, LinhaFracao } from './fracaoIdeal';
import { proprietariosDoTrabalho, qualificacaoCompleta, qualificacaoCasal, conjugeParaAssinatura, AREAS_COMUNS_BOILERPLATE, ConjugeAssinatura, medidasTexto } from './documentoShared';

function normalizarCpf(v: string) {
  return v.replace(/\D/g, '');
}

export interface ParagrafoPavimento {
  pavimento: string;
  unidade: Unidade;
  soma: number;
  fracaoPct: number;
}

export interface QualificacaoTitular {
  nome: string;
  cpf?: string;
  texto: string;
  conjuge?: ConjugeAssinatura;
}

export interface InstituicaoSimplificadaData {
  nomeTrabalho: string;
  endereco: string;
  qualificacoes: QualificacaoTitular[];
  matriculaMae: string;
  terreno: number;
  medidas: string;
  paragrafos: ParagrafoPavimento[];
  quadro: LinhaFracao[];
  verificacao: ReturnType<typeof verificacaoQuadro> | null;
  areasComunsTexto: string;
  areasComunsBoilerplate: string;
  semFracao: boolean;
  somaTotal: number;
}

/** Instituição Simplificada — portado de cota_saas (lib/documentos/instituicaoSimplificada.ts). */
export function montarInstituicaoSimplificada(trabalho: Process, cliente: Client | undefined, clientes: Client[]): InstituicaoSimplificadaData {
  const tecnico = trabalho.tecnico;
  const units = tecnico?.units || [];
  const semFracao = !!tecnico?.semFracao;
  const terreno = tecnico?.terreno || 0;
  const somaTotal = areaTotalAutonomas(units);
  const proprietarios = proprietariosDoTrabalho(trabalho, cliente);

  const qualificacoes: QualificacaoTitular[] = proprietarios.map(p => {
    const clienteDoProprietario = p.cpf ? clientes.find(c => c.documento && normalizarCpf(c.documento) === normalizarCpf(p.cpf!)) : undefined;
    const unidadesDoProprietario = p.cpf ? units.filter(u => u.proprietarioCpf && normalizarCpf(u.proprietarioCpf) === normalizarCpf(p.cpf!)) : [];
    const clausulas = unidadesDoProprietario.map(u => {
      const partes = [`titular de direito real da unidade ${u.pavimento} (${u.nome})`];
      if (u.matriculaIndividual) partes.push(`matrícula nº ${u.matriculaIndividual}`);
      let texto = partes.join(', ');
      if (u.origemAquisicao) texto += ` ${u.origemAquisicao}`;
      return texto;
    });

    const combinada = clienteDoProprietario ? qualificacaoCasal(p.nome || '(a preencher)', clienteDoProprietario, clausulas) : undefined;
    let texto: string;
    if (combinada) {
      texto = combinada;
    } else {
      const base = qualificacaoCompleta(p.nome || '(a preencher)', p.cpf, clientes);
      const semPonto = base.replace(/\.\s*$/, '');
      texto = clausulas.length ? `${semPonto}, ${clausulas.join('; ')}.` : `${semPonto}.`;
    }

    return { nome: p.nome, cpf: p.cpf, texto, conjuge: conjugeParaAssinatura(p.cpf, clientes) };
  });

  const grupos = agruparPorPavimento(units);
  const paragrafos: ParagrafoPavimento[] = [];
  for (const [pavimento, unidades] of grupos) {
    for (const u of unidades) {
      const soma = somaUnidade(u);
      const fracaoPct = u.autonoma !== false && somaTotal ? (soma / somaTotal) * 100 : 0;
      paragrafos.push({ pavimento, unidade: u, soma, fracaoPct });
    }
  }

  const quadro = semFracao ? [] : calcularQuadroFracao(units, terreno);
  const verificacao = quadro.length ? verificacaoQuadro(quadro) : null;

  return {
    nomeTrabalho: trabalho.objeto,
    endereco: trabalho.endereco || '',
    qualificacoes,
    matriculaMae: tecnico?.matricula || '',
    terreno,
    medidas: medidasTexto(tecnico),
    paragrafos,
    quadro,
    verificacao,
    areasComunsTexto: tecnico?.areasComuns || '',
    areasComunsBoilerplate: tecnico?.areasComunsDescricao || AREAS_COMUNS_BOILERPLATE,
    semFracao,
    somaTotal,
  };
}
