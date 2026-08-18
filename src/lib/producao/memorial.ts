import { Process, Client, CompanyConfig, Unidade } from '@/lib/types';
import { agruparPorPavimento, calcularQuadroFracao, verificacaoQuadro, somaUnidade, areaTotalAutonomas, LinhaFracao } from './fracaoIdeal';
import { proprietariosDoTrabalho, conjugeParaAssinatura, ConjugeAssinatura, ProprietarioRef } from './documentoShared';

export interface ParagrafoPavimento {
  pavimento: string;
  unidade: Unidade;
  soma: number;
  fracaoPct: number;
}

export interface MemorialData {
  nomeTrabalho: string;
  responsavel: CompanyConfig;
  proprietarios: (ProprietarioRef & { conjuge?: ConjugeAssinatura })[];
  endereco: string;
  terreno: number;
  medidas: string;
  art: string;
  matricula: string;
  semFracao: boolean;
  paragrafos: ParagrafoPavimento[];
  quadro: LinhaFracao[];
  verificacao: ReturnType<typeof verificacaoQuadro> | null;
  somaTotal: number;
  areasComunsTexto: string;
  temAreaComum: boolean;
}

/** Monta os dados do Memorial Descritivo — portado verbatim de cota_saas (lib/documentos/memorial.ts). */
export function montarMemorial(trabalho: Process, cliente: Client | undefined, config: CompanyConfig, clientes: Client[]): MemorialData {
  const tecnico = trabalho.tecnico;
  const units = tecnico?.units || [];
  const semFracao = !!tecnico?.semFracao;
  const terreno = tecnico?.terreno || 0;
  const somaTotal = areaTotalAutonomas(units);
  const somaComum = units.reduce((s, u) => s + (u.areaComum || 0), 0);

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
    responsavel: config,
    proprietarios: proprietariosDoTrabalho(trabalho, cliente).map(p => ({ ...p, conjuge: conjugeParaAssinatura(p.cpf, clientes) })),
    endereco: trabalho.endereco || '',
    terreno,
    medidas: tecnico?.medidas || '',
    art: tecnico?.art || '',
    matricula: tecnico?.matricula || '',
    semFracao,
    paragrafos,
    quadro,
    verificacao,
    somaTotal,
    areasComunsTexto: tecnico?.areasComunsDescricao || tecnico?.areasComuns || '',
    temAreaComum: somaComum > 0 && !semFracao,
  };
}
