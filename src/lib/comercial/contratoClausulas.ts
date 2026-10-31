/**
 * Texto do Contrato de Prestação de Serviços Técnicos de Engenharia — reproduz o modelo do próprio profissional
 * (CONTRATO_ISAILTON_MATHEUS.pdf). O que muda de um contrato para outro entra como variável:
 *   - contratantes (qualificação e singular/plural),
 *   - valor, valor por extenso e parcelas,
 *   - serviço: objeto (cláusula I), fases (II) e o trecho de prazo/limite de responsabilidade (III).
 * Todo o resto é texto fixo, igual ao modelo. É este o ÚNICO arquivo com o texto jurídico: para revisar com o
 * advogado, é só editar aqui.
 *
 * Singular/plural: o modelo foi escrito com "CONTRATANTE"; com mais de um contratante o texto troca os artigos e os
 * verbos ("Os CONTRATANTES deverão…"), sem mexer no conteúdo.
 */

import { TextoContrato } from '@/lib/types';
import { inteiroPorExtenso } from '@/lib/extenso';

export interface ParcelaContrato {
  descricao: string;
  /** Já formatado ("R$ 2.500,00"). */
  valor: string;
  /** Fatia do total ("50"), quando o total é conhecido. */
  percentual?: string;
  /** dd/mm/aaaa, quando a parcela já tem vencimento definido. */
  vencimento?: string;
}

export interface ContextoContrato {
  plural: boolean;
  /** Parágrafo da cláusula I, já resolvido (texto do profissional ou o padrão). */
  objeto: string;
  /** Itens da cláusula II, já resolvidos. */
  fases: string[];
  /** Alínea (c) da cláusula III. */
  prazoEntrega: string;
  /** Parágrafo único da cláusula III; vazio = não aparece. */
  paragrafoUnico?: string;
  valor: string;
  valorExtenso: string;
  parcelas: ParcelaContrato[];
}

export interface BlocoTexto {
  texto: string;
  /** Itens de lista (alíneas, fases, parcelas) saem recuados. */
  recuo?: boolean;
}

export interface Clausula {
  titulo: string;
  blocos: BlocoTexto[];
}

/** Itens terminam em ";" e o último em "." (a menos que o texto digitado já termine em pontuação). */
function comPontuacao(texto: string, ultimo: boolean): string {
  const t = texto.trim();
  if (/[.;:]$/.test(t)) return t;
  return t + (ultimo ? '.' : ';');
}

// ----------------------------------------------------------------------------------------------------------------
// Padrões gerados a partir da proposta — o profissional pode sobrescrever cada um no painel "Ajustar texto".
// ----------------------------------------------------------------------------------------------------------------

/** Endereços digitados à mão costumam ter espaço antes da vírgula ("Oliveira , 50"): normaliza. */
const limpaEndereco = (e: string) => e.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();

export function objetoPadrao(titulo: string, imovel?: { endereco?: string; matricula?: string }): string {
  const partes = [
    imovel?.endereco?.trim() ? `situado em ${limpaEndereco(imovel.endereco)}` : '',
    imovel?.matricula?.trim() ? `matrícula nº ${imovel.matricula.trim()}` : '',
  ].filter(Boolean);
  const local = partes.length ? `, ${partes.join(', ')}` : '';
  return `O presente contrato tem como objeto a elaboração de documentação técnica de engenharia para ${titulo.trim().toLowerCase() || '(serviço a preencher)'}${local}, compreendendo os serviços especificados na cláusula II.`;
}

export function prazoEntregaPadrao(dias: number): string {
  return `Após o recebimento integral da documentação necessária, o CONTRATADO terá o prazo de até ${dias} (${inteiroPorExtenso(dias)}) dias úteis para concluir e entregar a documentação técnica de engenharia objeto deste contrato.`;
}

/** O texto de Instituição de Condomínio do modelo do profissional — botão "Usar modelo de Instituição de Condomínio". */
export function modeloInstituicaoCondominio(o: { plural: boolean; prazoDias: number; endereco?: string; matricula?: string }): TextoContrato {
  const pelo = o.plural ? 'pelos CONTRATANTES' : 'pelo CONTRATANTE';
  return {
    objeto: `O presente contrato tem como objeto a elaboração de documentação técnica de engenharia para a regularização do prédio residencial situado ${o.endereco?.trim() ? `em ${limpaEndereco(o.endereco)}` : 'em (endereço a preencher)'}${o.matricula?.trim() ? `, matrícula nº ${o.matricula.trim()}` : ''}, compreendendo os serviços especificados na cláusula II.`,
    fases: [
      'Elaboração de projetos da edificação e unidades',
      'Elaboração de memorial descritivo das unidades e cálculo de frações ideais',
      'Elaboração de requerimento de instituição e convenção de condomínio',
      'Elaboração dos quadros de áreas conforme ABNT NBR 12.721',
      'Elaboração de memorial descritivo técnico da edificação',
    ],
    prazoEntrega: `Após o recebimento integral da documentação necessária, o CONTRATADO terá o prazo de até ${o.prazoDias} (${inteiroPorExtenso(o.prazoDias)}) dias úteis para concluir e entregar a documentação técnica de engenharia objeto deste contrato, destinada a subsidiar o procedimento de Instituição e Convenção de Condomínio, cuja instrução, protocolo, acompanhamento e demais providências perante o Cartório de Registro de Imóveis serão de responsabilidade de outro profissional designado ${pelo}.`,
    paragrafoUnico: 'A responsabilidade do CONTRATADO limita-se aos serviços técnicos de engenharia expressamente previstos neste contrato, não abrangendo a condução do procedimento registral, o atendimento de exigências de natureza jurídica ou administrativa, nem a efetiva aprovação ou registro da Instituição e Convenção de Condomínio, ressalvada a responsabilidade por eventuais correções de documentos técnicos de sua autoria.',
  };
}

// ----------------------------------------------------------------------------------------------------------------

export function montarClausulas(c: ContextoContrato): Clausula[] {
  const P = c.plural;
  const s = (singular: string, plural: string) => (P ? plural : singular);

  const parcelas: BlocoTexto[] = c.parcelas.map(p => {
    const jaTemPercentual = /^\d+([.,]\d+)?\s*%/.test(p.descricao.trim());
    const pct = p.percentual && !jaTemPercentual ? ` (${p.percentual}%)` : '';
    const venc = p.vencimento ? `, vencimento em ${p.vencimento}` : '';
    return { texto: `- ${p.descricao.trim()} – ${p.valor}${pct}${venc}`, recuo: true };
  });

  const terceira: BlocoTexto[] = [
    { texto: `Os prazos para conclusão dos trabalhos serão aqueles especificados abaixo e estarão condicionados ao cumprimento ${s('pelo CONTRATANTE', 'pelos CONTRATANTES')} de seus próprios prazos de aprovação:` },
    { texto: 'a) Imediatamente após a assinatura do contrato e o recebimento da documentação necessária, o CONTRATADO dará início à elaboração dos projetos, memoriais descritivos, quadros técnicos e demais documentos de engenharia previstos neste instrumento.', recuo: true },
    { texto: `b) ${s('O CONTRATANTE deverá', 'Os CONTRATANTES deverão')} fornecer, às suas expensas, todos os documentos e informações necessários à execução dos serviços, devidamente atualizados, no prazo de até 05 (cinco) dias úteis, contados da respectiva solicitação pelo CONTRATADO.`, recuo: true },
    { texto: `c) ${c.prazoEntrega.trim()}`, recuo: true },
    ...(c.paragrafoUnico?.trim() ? [{ texto: `Parágrafo único: ${c.paragrafoUnico.trim()}` }] : []),
  ];

  return [
    { titulo: 'I – OBJETO DO CONTRATO', blocos: [{ texto: c.objeto.trim() }] },
    {
      titulo: 'II – FASES',
      blocos: c.fases.filter(f => f.trim()).map((f, i, todas) => ({ texto: `${i + 1}. ${comPontuacao(f, i === todas.length - 1)}`, recuo: true })),
    },
    { titulo: 'III – DOS PRAZOS', blocos: terceira },
    {
      titulo: 'IV – DOS VALORES DOS SERVIÇOS TÉCNICOS PRESTADOS',
      blocos: [
        { texto: `Os valores referentes aos serviços técnicos objeto deste contrato serão aqueles previamente acordados entre as partes, conforme proposta comercial específica apresentada ${s('ao CONTRATANTE', 'aos CONTRATANTES')}.` },
        { texto: `O valor total para execução dos serviços descritos neste contrato é de ${c.valor} (${c.valorExtenso}).` },
        ...(parcelas.length
          ? [{ texto: 'Os pagamentos deverão ocorrer da seguinte forma:' }, ...parcelas]
          : [{ texto: 'Os pagamentos deverão ocorrer na forma ajustada entre as partes.' }]),
        { texto: 'Os pagamentos deverão ser realizados via transferência bancária eletrônica (PIX), conforme dados fornecidos pelo CONTRATADO.' },
      ],
    },
    {
      titulo: s('V – OBRIGAÇÕES DO CONTRATANTE', 'V – OBRIGAÇÕES DOS CONTRATANTES'),
      blocos: [
        { texto: `a) Viabilizar a conclusão dos eventos dentro dos prazos estipulados, no que ${s('lhe couber', 'lhes couber')}, inclusive com a entrega de todos os elementos necessários ao desenvolvimento dos trabalhos, sempre dentro dos prazos indicados pelo CONTRATADO.`, recuo: true },
        { texto: `b) Prestar todas as informações necessárias ao cabal desempenho deste contrato, entregando ao CONTRATADO os documentos que ${s('dispuser', 'dispuserem')} acerca do objeto do mesmo.`, recuo: true },
        { texto: 'c) Proceder ao pagamento de todas as taxas necessárias para os serviços contratados;', recuo: true },
        { texto: 'd) Proceder ao pagamento total dos honorários contratados.', recuo: true },
        { texto: `Parágrafo único: ${s('O CONTRATANTE é totalmente responsável', 'Os CONTRATANTES são totalmente responsáveis')} pela veracidade e autenticidade dos relatos e documentos apresentados.` },
      ],
    },
    {
      titulo: 'VI – OBRIGAÇÕES DO CONTRATADO',
      blocos: [
        { texto: `a) Atender e/ou retornar aos chamados ${s('do CONTRATANTE', 'dos CONTRATANTES')} e vice-versa, com prazo máximo de 24 horas.`, recuo: true },
        { texto: 'b) Provisionar com a antecedência necessária ao CONTRATADO, as verbas necessárias ao pagamento das Taxas, Impostos e Emolumentos, para a realização do ato, quando houver;', recuo: true },
        { texto: 'c) Entrar em contato imediato com o CONTRATADO, quando receber qualquer intimação, notificação, citação, aviso, carta, telegramas, etc., enfim, tudo que originar da execução dos serviços em questão;', recuo: true },
        { texto: 'd) Cumprir os prazos e etapas estipuladas para o bom e fiel cumprimento do presente instrumento, sendo sua responsabilidade a execução dos serviços contratados conforme descrição da cláusula II.', recuo: true },
        { texto: `e) Fornecer ${s('ao CONTRATANTE', 'aos CONTRATANTES')}, em meio digital, a documentação para regularização da edificação, ART (Registro de Responsabilidade Técnica) do serviço, protocolo do processo de regularização, bem como qualquer taxa gerada para pagamento decorrente deste processo.`, recuo: true },
        { texto: `Parágrafo único: O CONTRATADO é responsável pelo envio da taxa e do comprovante de pagamento ${s('ao CONTRATANTE, quando este lhe auferir', 'aos CONTRATANTES, quando estes lhe auferirem')} esta responsabilidade, realizando crédito prévio na conta do CONTRATADO para este fim, desde que este procedimento seja previamente acordado entre as partes.` },
      ],
    },
    {
      titulo: 'VII – CLÁUSULA PENAL',
      blocos: [
        { texto: `a) Se ${s('o CONTRATANTE rescindir', 'os CONTRATANTES rescindirem')}, injustificadamente, o presente contrato antes da conclusão integral de todas as fases do trabalho, além de ${s('não possuir', 'não possuírem')} qualquer direito sobre os valores já quitados pelas fases já concluídas, ${s('pagará', 'pagarão')} ao CONTRATADO o saldo remanescente para a conclusão do processo, além de multa de 20% sobre o saldo pendente no momento da rescisão.`, recuo: true },
        { texto: `b) Se o CONTRATADO rescindir, injustificadamente, o presente contrato sem concluir integralmente todas as fases do presente trabalho, perderá todos os direitos autorais sobre as fases já concluídas, sub-rogando tais direitos a qualquer outro profissional que vier a ser contratado ${s('pelo CONTRATANTE', 'pelos CONTRATANTES')}, além de ter que pagar em favor ${s('desse último', 'desses últimos')}, multa de 20% sobre o saldo que remanescer para a conclusão dos trabalhos.`, recuo: true },
      ],
    },
  ];
}
