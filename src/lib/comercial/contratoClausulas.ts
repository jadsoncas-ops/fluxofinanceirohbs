/**
 * Cláusulas-padrão do Contrato de Prestação de Serviços Técnicos de Engenharia.
 *
 * ESTE É O ÚNICO ARQUIVO COM O TEXTO JURÍDICO do contrato — para revisar com o advogado, é só editar aqui.
 * Tudo o que vem do sistema (partes, escopo, valor, parcelas, prazo) entra por `ContextoClausulas`; o resto é texto
 * fixo. Singular/plural: com mais de um contratante, o texto usa "OS CONTRATANTES" e a responsabilidade pelo
 * pagamento passa a ser solidária (cláusula 5.4).
 *
 * Valores de referência que o advogado pode querer ajustar: multa 2%, juros 1% a.m., rescisão com 10 dias de aviso,
 * foro de Itabuna/BA.
 */

import { inteiroPorExtenso } from '@/lib/extenso';

export interface ItemEscopo {
  nome: string;
  descricao?: string;
}

export interface ParcelaContrato {
  descricao: string;
  valor: string;
  /** dd/mm/aaaa, quando a parcela já tem vencimento definido. */
  vencimento?: string;
}

export interface ContextoClausulas {
  titulo: string;
  propostaCodigo: string;
  plural: boolean;
  itens: ItemEscopo[];
  /** A taxa de ART/RRT está no preço? Se não, entra na lista "não incluso". */
  artIncluida: boolean;
  prazoDias?: number;
  valor: string;
  valorExtenso: string;
  parcelas: ParcelaContrato[];
  notaParceiro?: string;
  responsavelNome: string;
  /** Já formatado ("CREA nº 123-BA" ou "CREA-BA 123"). */
  responsavelCrea?: string;
  foro: string;
}

export interface Clausula {
  titulo: string;
  /** Cada item vira um parágrafo; os que começam com "a) ", "b) "… são renderizados como lista recuada. */
  paragrafos: string[];
}

export function montarClausulas(c: ContextoClausulas): Clausula[] {
  const P = c.plural;
  const oContratante = P ? 'os CONTRATANTES' : 'o CONTRATANTE';
  const doContratante = P ? 'dos CONTRATANTES' : 'do CONTRATANTE';
  const peloContratante = P ? 'pelos CONTRATANTES' : 'pelo CONTRATANTE';
  const resp = c.responsavelCrea ? `${c.responsavelNome} (${c.responsavelCrea})` : c.responsavelNome;

  // Itens de lista terminam em ";" e o último em ".".
  const fimDeItem = (idx: number, total: number) => (idx === total - 1 ? '.' : ';');

  const escopo = c.itens.length
    ? c.itens.map((i, idx) => `${String.fromCharCode(97 + idx)}) ${i.nome}${i.descricao ? ` — ${i.descricao.replace(/\.$/, '')}` : ''}${fimDeItem(idx, c.itens.length)}`)
    : ['(escopo a definir)'];

  const parcelas = c.parcelas.length
    ? c.parcelas.map((p, idx) => `${String.fromCharCode(97 + idx)}) ${p.descricao}: ${p.valor}${p.vencimento ? `, com vencimento em ${p.vencimento}` : ''}${fimDeItem(idx, c.parcelas.length)}`)
    : [];

  const quinta: string[] = [
    `5.1. Pelos serviços objeto deste contrato, ${oContratante} pagar${P ? 'ão' : 'á'} à CONTRATADA o valor total de ${c.valor} (${c.valorExtenso}).`,
    ...(parcelas.length
      ? ['5.2. O pagamento será feito nas seguintes condições:', ...parcelas]
      : ['5.2. O pagamento será feito na forma e nas datas ajustadas entre as partes, por escrito.']),
    `5.3. Em caso de atraso, incidirão multa de 2% (dois por cento) sobre o valor em atraso, juros de mora de 1% (um por cento) ao mês, calculados pro rata die, e correção monetária pelo IPCA, até o efetivo pagamento.`,
    ...(P ? ['5.4. Havendo mais de um CONTRATANTE, todos respondem solidariamente pelo pagamento integral do preço e pelas demais obrigações assumidas neste contrato.'] : []),
    ...(c.notaParceiro ? [`${P ? '5.5' : '5.4'}. ${c.notaParceiro}`] : []),
  ];

  return [
    {
      titulo: 'CLÁUSULA PRIMEIRA — DO OBJETO',
      paragrafos: [
        `1.1. O presente contrato tem por objeto a prestação, pela CONTRATADA, de serviços técnicos de engenharia para ${c.titulo.toLowerCase()}, conforme a Proposta Comercial nº ${c.propostaCodigo}, aceita ${peloContratante} e que passa a integrar este instrumento.`,
        '1.2. Os serviços compreendem exclusivamente o seguinte escopo:',
        ...escopo,
        `1.3. Não estão incluídos no preço: taxas e tributos municipais; emolumentos de cartório; impostos incidentes sobre o imóvel${c.artIncluida ? '' : '; e a taxa de emissão de ART/RRT'}, que correm por conta ${doContratante}.`,
      ],
    },
    {
      titulo: 'CLÁUSULA SEGUNDA — DAS OBRIGAÇÕES DA CONTRATADA',
      paragrafos: [
        `2.1. Executar os serviços com observância das normas técnicas aplicáveis e da legislação vigente, sob a responsabilidade técnica de ${resp}, emitindo a respectiva ART/RRT quando exigida.`,
        `2.2. Manter ${oContratante} informado${P ? 's' : ''} sobre o andamento dos serviços.`,
        '2.3. Utilizar os documentos e informações recebidos somente para a execução deste contrato, guardando sigilo sobre eles.',
      ],
    },
    {
      titulo: `CLÁUSULA TERCEIRA — DAS OBRIGAÇÕES ${P ? 'DOS CONTRATANTES' : 'DO CONTRATANTE'}`,
      paragrafos: [
        `3.1. Fornecer, no início dos trabalhos, os documentos do imóvel e ${doContratante} necessários à execução dos serviços, bem como garantir o acesso ao imóvel para vistoria e medição.`,
        '3.2. Efetuar os pagamentos nas datas ajustadas.',
        '3.3. Arcar com as taxas, emolumentos e tributos indicados na cláusula 1.3.',
        '3.4. Atender, em tempo hábil, às solicitações de documentos e informações feitas pela CONTRATADA ou pelos órgãos competentes.',
      ],
    },
    {
      titulo: 'CLÁUSULA QUARTA — DO PRAZO',
      paragrafos: [
        c.prazoDias
          ? `4.1. O prazo estimado para a execução das peças técnicas é de ${c.prazoDias} (${inteiroPorExtenso(c.prazoDias)}) dias, contados da última das seguintes datas: assinatura deste contrato, pagamento da primeira parcela e entrega dos documentos necessários.`
          : '4.1. O prazo para a execução das peças técnicas será o ajustado entre as partes por escrito, contado da última das seguintes datas: assinatura deste contrato, pagamento da primeira parcela e entrega dos documentos necessários.',
        '4.2. O prazo refere-se à execução das peças técnicas sob responsabilidade da CONTRATADA. A tramitação e a aprovação junto a órgãos públicos e cartórios não estão sob o controle da CONTRATADA e não integram esse prazo.',
        '4.3. O prazo fica suspenso enquanto houver documentos, informações ou pagamentos pendentes por parte ' + (P ? 'dos CONTRATANTES' : 'do CONTRATANTE') + '.',
      ],
    },
    { titulo: 'CLÁUSULA QUINTA — DO PREÇO E DA FORMA DE PAGAMENTO', paragrafos: quinta },
    {
      titulo: 'CLÁUSULA SEXTA — DAS ALTERAÇÕES DE ESCOPO',
      paragrafos: [
        `6.1. Qualquer serviço não previsto na cláusula 1.2, ou alteração de escopo solicitada ${peloContratante} após a assinatura, será objeto de termo aditivo, com preço e prazo próprios.`,
      ],
    },
    {
      titulo: 'CLÁUSULA SÉTIMA — DA PROPRIEDADE E DO USO DOS PROJETOS',
      paragrafos: [
        `7.1. Os projetos, desenhos e demais documentos técnicos elaborados são de autoria da CONTRATADA, nos termos da Lei nº 9.610/1998. Com a quitação integral do preço, ${oContratante} passa${P ? 'm' : ''} a poder utilizá-los para a finalidade e o imóvel objeto deste contrato.`,
      ],
    },
    {
      titulo: 'CLÁUSULA OITAVA — DA RESCISÃO',
      paragrafos: [
        '8.1. Qualquer das partes poderá rescindir este contrato mediante aviso por escrito, com antecedência mínima de 10 (dez) dias.',
        `8.2. Na rescisão, ${oContratante} pagar${P ? 'ão' : 'á'} os serviços já executados até a data do aviso, proporcionalmente ao escopo concluído, não havendo restituição dos valores pagos por etapas já concluídas.`,
        '8.3. O descumprimento de qualquer cláusula deste contrato autoriza a outra parte a rescindi-lo de imediato, sem prejuízo das perdas e danos apurados.',
      ],
    },
    {
      titulo: 'CLÁUSULA NONA — DA PROTEÇÃO DE DADOS',
      paragrafos: [
        '9.1. As partes tratarão os dados pessoais a que tiverem acesso em razão deste contrato em conformidade com a Lei nº 13.709/2018 (LGPD), exclusivamente para a execução do contrato e o cumprimento de obrigações legais.',
      ],
    },
    {
      titulo: 'CLÁUSULA DÉCIMA — DO FORO',
      paragrafos: [`10.1. Fica eleito o foro da Comarca de ${c.foro} para dirimir quaisquer questões decorrentes deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.`],
    },
  ];
}
