import { describe, it, expect } from 'vitest';
import type { Client, CompanyConfig, Contrato, Process, Proposta } from '@/lib/types';
import { creaTexto, montarContrato, parcelasDoContrato, pendenciasDoContrato } from '@/lib/comercial/contratoDoc';
import { modeloInstituicaoCondominio } from '@/lib/comercial/contratoClausulas';

const HOJE = new Date(2026, 9, 30); // 30/10/2026

// Config de teste (dados fictícios — a qualificação real do profissional fica só no banco, nunca no código).
const QUALIFICACAO_CONTRATADO = 'Fulano de Tal Engenheiro, brasileiro, casado, engenheiro civil, com registro no CREA 000000000-0, portador do CPF 000.000.000-00, RG 0000000-00, com endereço na Rua Exemplo, 1 – Centro, Itabuna/BA – CEP 45600-000, telefone (73) 90000-0000, e-mail exemplo@teste.com';
const config: CompanyConfig = {
  contratadoQualificacao: QUALIFICACAO_CONTRATADO, responsavelNome: 'Fulano de Tal Engenheiro', responsavelCrea: 'CREA-BA 000000000-0',
  responsavelTitulo: 'Engenheiro Civil', telefone: '(73) 9 0000-0000', email: 'contato@teste.com',
};

const isailton = {
  id: 'c1', nome: 'ISAILTON ALMEIDA SILVA', tipo: 'Pessoa física', documento: '292.178.638-90', createdAt: 0,
  qualificacao: { nacionalidade: 'brasileiro', estadoCivil: 'Casado(a)', profissao: 'autônomo' },
} as Client;

const matheus = { nome: 'MATHEUS SOUSA SANTOS', nacionalidade: 'brasileiro', estadoCivil: 'Solteiro(a)' as const, profissao: 'estudante', rg: '09698881-98 SSP/BA', documento: '014.518.575-35' };

function proposta(parcial: Partial<Proposta> = {}): Proposta {
  return {
    id: 'p1', codigo: 'PRP-020', clienteId: 'c1', titulo: 'Regularização de Imóvel', status: 'Aprovada', createdAt: 0, updatedAt: 0,
    itens: [
      { etapaId: 'levantamento', nome: 'Levantamento Cadastral', grupo: 'Módulo Projeto', visitas: 1, horas: 0 },
      { etapaId: 'situacao', nome: 'Planta de Situação', grupo: 'Módulo Projeto', visitas: 0, horas: 2 },
    ],
    custoHoraBase: 0, lucroPercent: 0, impostosPercent: 0, comissaoPercent: 0, custosProtocolo: { art: false, assinatura: false },
    resultado: { custoTecnico: 0, custoProtocolos: 0, custoTotal: 0, lucro: 0, imposto: 0, comissao: 0, precoVenda: 5000, margem: 0 },
    prazoDias: 15, ...parcial,
  };
}

function contrato(parcial: Partial<Contrato> = {}): Contrato {
  return {
    id: 'ct1', codigo: 'CTR-0070', propostaId: 'p1', clienteId: 'c1', valor: 5000, status: 'Ativo', createdAt: 0, updatedAt: 0,
    parcelas: [
      { id: 'a', descricao: '50% no ato da contratação', valor: 2500 },
      { id: 'b', descricao: '50% na entrega da documentação completa', valor: 2500 },
    ],
    ...parcial,
  };
}

const trabalho = { id: 't1', endereco: 'Rua Catucicaba, nº 419, bairro Conceição, Itabuna/BA', tecnico: { units: [], matricula: '8.469' } } as unknown as Process;

type Doc = ReturnType<typeof montarContrato>;
// O formatBRL usa espaço não separável após o "R$" (bom pro documento); o teste compara com espaço comum.
const semNbsp = (t: string) => t.split(String.fromCharCode(160)).join(' ');
const textoDe = (d: Doc) => semNbsp([d.abertura, ...d.clausulas.flatMap(c => [c.titulo, ...c.blocos.map(b => b.texto)])].join('\n'));
const clausula = (d: Doc, inicio: string) => d.clausulas.find(c => c.titulo.startsWith(inicio))!;
const blocos = (d: Doc, inicio: string) => clausula(d, inicio).blocos.map(b => semNbsp(b.texto));

describe('abertura — formato do modelo do profissional', () => {
  const doc = montarContrato(contrato({ contratantesAdicionais: [matheus] }), proposta(), isailton, config, { hoje: HOJE });

  it('qualifica os contratantes e o contratado como no PDF', () => {
    expect(doc.abertura).toBe(
      'Através do presente instrumento particular de contrato, de um lado, '
      + 'ISAILTON ALMEIDA SILVA, brasileiro, casado(a), autônomo, inscrito(a) no CPF sob nº 292.178.638-90 e '
      + 'MATHEUS SOUSA SANTOS, brasileiro, solteiro(a), estudante, portador(a) do RG nº 09698881-98 SSP/BA e CPF nº 014.518.575-35, '
      + `doravante denominados CONTRATANTES, e do outro lado ${QUALIFICACAO_CONTRATADO}, doravante denominado CONTRATADO, têm justo e contratado entre si o que segue:`
    );
    expect(doc.plural).toBe(true);
  });

  it('com um contratante só, "doravante denominado CONTRATANTE"', () => {
    const d = montarContrato(contrato(), proposta(), isailton, config, { hoje: HOJE });
    expect(d.plural).toBe(false);
    expect(d.abertura).toContain('doravante denominado CONTRATANTE, e do outro lado');
  });

  it('três contratantes: "A; B e C"', () => {
    const d = montarContrato(contrato({ contratantesAdicionais: [matheus, { nome: 'Maria Silva', documento: '111.111.111-11' }] }), proposta(), isailton, config, { hoje: HOJE });
    expect(d.abertura).toMatch(/CPF sob nº 292\.178\.638-90; MATHEUS SOUSA SANTOS.*CPF nº 014\.518\.575-35 e MARIA SILVA, inscrito\(a\) no CPF sob nº 111\.111\.111-11, doravante denominados/);
  });

  it('adicional sem nome é ignorado; sem CPF sai "(a preencher)"', () => {
    expect(montarContrato(contrato({ contratantesAdicionais: [{ nome: '  ' }] }), proposta(), isailton, config, { hoje: HOJE }).plural).toBe(false);
    const d = montarContrato(contrato({ contratantesAdicionais: [{ nome: 'Maria' }] }), proposta(), isailton, config, { hoje: HOJE });
    expect(d.contratantes[1].documento).toBe('(a preencher)');
    expect(d.abertura).toContain('MARIA, inscrito(a) no CPF sob nº (a preencher)');
  });

  it('nome e dados com espaço sobrando no cadastro saem limpos', () => {
    const sujo = { ...isailton, nome: 'Adriana Reis dos Santos ', qualificacao: { ...isailton.qualificacao, profissao: ' autônoma ' } } as Client;
    const d = montarContrato(contrato(), proposta(), sujo, config, { hoje: HOJE });
    expect(d.abertura).toContain('ADRIANA REIS DOS SANTOS, brasileiro');
    expect(d.abertura).toContain(', autônoma,');
    expect(d.contratantes[0].nome).toBe('Adriana Reis dos Santos');
  });

  it('pessoa jurídica e condomínio são representados', () => {
    const pj = { ...isailton, tipo: 'Pessoa jurídica', nome: 'Construtora Beta Ltda', documento: '11.222.333/0001-44', qualificacao: undefined, endereco: { rua: 'Av. Central', numero: '10', bairro: 'Centro', cidade: 'Itabuna', estado: 'BA' } } as Client;
    const d = montarContrato(contrato(), proposta(), pj, config, { hoje: HOJE });
    expect(d.abertura).toContain('CONSTRUTORA BETA LTDA, pessoa jurídica de direito privado, inscrito(a) no CNPJ sob nº 11.222.333/0001-44, com sede em Av. Central, 10, Centro, Itabuna, BA, neste ato representada por seu representante legal');
    expect(d.contratantes[0].representado).toBe(true);
    const cond = montarContrato(contrato(), proposta(), { ...pj, tipo: 'Condomínio' } as Client, config, { hoje: HOJE });
    expect(cond.abertura).toContain('condomínio edilício');
    expect(cond.abertura).toContain('representado por seu síndico');
  });
});

describe('contratado', () => {
  it('a qualificação vem das Configurações, sem ponto final sobrando', () => {
    const d = montarContrato(contrato(), proposta(), isailton, { ...config, contratadoQualificacao: `${QUALIFICACAO_CONTRATADO}. ` }, { hoje: HOJE });
    expect(d.abertura).toContain('e-mail exemplo@teste.com, doravante denominado CONTRATADO');
  });

  it('sem a qualificação, monta o mínimo com o que há — e sem nada, deixa o aviso', () => {
    const minimo = montarContrato(contrato(), proposta(), isailton, { responsavelNome: 'Fulano', responsavelCrea: '123-BA' }, { hoje: HOJE });
    expect(minimo.abertura).toContain('Fulano, engenheiro civil, com registro no CREA nº 123-BA, doravante denominado CONTRATADO');
    expect(montarContrato(contrato(), proposta(), isailton, {}, { hoje: HOJE }).abertura).toContain('(qualificação do contratado — preencha em Configurações)');
  });

  it('assinatura e rodapé', () => {
    const d = montarContrato(contrato(), proposta(), isailton, config, { hoje: HOJE });
    expect(d.contratado).toEqual({ nome: 'Fulano de Tal Engenheiro', titulo: 'Engenheiro Civil', crea: 'CREA-BA 000000000-0' });
    expect(d.rodape).toBe('Tel. (73) 9 0000-0000 / CONTATO@TESTE.COM');
    expect(montarContrato(contrato(), proposta(), isailton, { ...config, telefone: undefined, email: undefined }, { hoje: HOJE }).rodape).toBe('');
    expect(d.data).toBe('30 de outubro de 2026');
    expect(d.cidade).toBe('Itabuna/BA');
  });

  it('CREA com prefixo no cadastro não ganha "CREA nº" duplicado', () => {
    expect(creaTexto('CREA-BA 051598661-5')).toBe('CREA-BA 051598661-5');
    expect(creaTexto('0512345678-BA')).toBe('CREA nº 0512345678-BA');
    expect(creaTexto(undefined)).toBe('');
  });
});

describe('o que muda de um contrato para outro', () => {
  it('valor, valor por extenso e parcelas (cláusula IV)', () => {
    const d = montarContrato(contrato(), proposta(), isailton, config, { hoje: HOJE });
    const iv = blocos(d, 'IV');
    expect(iv).toContain('O valor total para execução dos serviços descritos neste contrato é de R$ 5.000,00 (cinco mil reais).');
    expect(iv).toContain('Os pagamentos deverão ocorrer da seguinte forma:');
    expect(iv.some(t => t.startsWith('- 50% no ato da contratação – R$ 2.500,00'))).toBe(true);
    expect(iv.some(t => t.startsWith('- 50% na entrega da documentação completa – R$ 2.500,00'))).toBe(true);
    // descrição que já começa com "50%" não ganha o percentual duplicado
    expect(iv.join('\n')).not.toContain('(50%)');
    expect(iv).toContain('Os pagamentos deverão ser realizados via transferência bancária eletrônica (PIX), conforme dados fornecidos pelo CONTRATADO.');
  });

  it('parcela sem percentual na descrição ganha o percentual, e o vencimento quando existe', () => {
    const d = montarContrato(contrato({ parcelas: [{ id: 'a', descricao: 'Entrada', valor: 1250, vencimento: '2026-11-05' }, { id: 'b', descricao: 'Na entrega', valor: 3750 }] }), proposta(), isailton, config, { hoje: HOJE });
    const iv = blocos(d, 'IV');
    expect(iv).toContain('- Entrada – R$ 1.250,00 (25%), vencimento em 05/11/2026');
    expect(iv).toContain('- Na entrega – R$ 3.750,00 (75%)');
  });

  it('sem parcelas fecha a frase sem inventar valores', () => {
    const d = montarContrato(contrato({ parcelas: [] }), proposta(), isailton, config, { hoje: HOJE });
    expect(blocos(d, 'IV')).toContain('Os pagamentos deverão ocorrer na forma ajustada entre as partes.');
  });

  it('serviço padrão vem da proposta: objeto com o imóvel, fases numeradas e prazo em dias úteis', () => {
    const d = montarContrato(contrato(), proposta(), isailton, config, { hoje: HOJE, trabalho });
    expect(blocos(d, 'I')[0]).toBe('O presente contrato tem como objeto a elaboração de documentação técnica de engenharia para regularização de imóvel, situado em Rua Catucicaba, nº 419, bairro Conceição, Itabuna/BA, matrícula nº 8.469, compreendendo os serviços especificados na cláusula II.');
    expect(blocos(d, 'II')).toEqual(['1. Levantamento Cadastral;', '2. Planta de Situação.']);
    const iii = blocos(d, 'III');
    expect(iii.some(t => t.startsWith('c) Após o recebimento integral da documentação necessária, o CONTRATADO terá o prazo de até 15 (quinze) dias úteis'))).toBe(true);
    expect(iii.some(t => t.startsWith('Parágrafo único'))).toBe(false);
  });

  it('endereço do trabalho com espaço antes da vírgula sai limpo', () => {
    const sujo = { ...trabalho, endereco: 'Travessa Valquiria Oliveira , 50, Santo Antonio , Itabuna, BA' } as Process;
    expect(blocos(montarContrato(contrato(), proposta(), isailton, config, { hoje: HOJE, trabalho: sujo }), 'I')[0]).toContain('situado em Travessa Valquiria Oliveira, 50, Santo Antonio, Itabuna, BA');
  });

  it('sem trabalho, o objeto não inventa endereço', () => {
    expect(blocos(montarContrato(contrato(), proposta(), isailton, config, { hoje: HOJE }), 'I')[0]).toBe('O presente contrato tem como objeto a elaboração de documentação técnica de engenharia para regularização de imóvel, compreendendo os serviços especificados na cláusula II.');
  });

  it('prazo da proposta vira o prazo de entrega', () => {
    const d = montarContrato(contrato(), proposta({ prazoDias: 30 }), isailton, config, { hoje: HOJE });
    expect(d.padroes.prazoEntrega).toContain('até 30 (trinta) dias úteis');
  });

  it('o texto ajustado pelo profissional substitui o padrão, campo a campo', () => {
    const d = montarContrato(contrato(), proposta(), isailton, config, {
      hoje: HOJE, texto: { objeto: 'Objeto livre.', fases: ['Fase A', 'Fase B;', ' ', 'Fase C'], prazoEntrega: 'Prazo livre.', paragrafoUnico: 'Limite livre.' },
    });
    expect(blocos(d, 'I')).toEqual(['Objeto livre.']);
    expect(blocos(d, 'II')).toEqual(['1. Fase A;', '2. Fase B;', '3. Fase C.']);
    const iii = blocos(d, 'III');
    expect(iii).toContain('c) Prazo livre.');
    expect(iii).toContain('Parágrafo único: Limite livre.');
  });

  it('texto salvo no contrato é usado quando não há rascunho', () => {
    const d = montarContrato(contrato({ textoPersonalizado: { objeto: 'Do contrato salvo.', testemunhas: true } }), proposta(), isailton, config, { hoje: HOJE });
    expect(blocos(d, 'I')).toEqual(['Do contrato salvo.']);
    expect(d.testemunhas).toBe(true);
  });

  it('testemunhas só quando pedidas', () => {
    expect(montarContrato(contrato(), proposta(), isailton, config, { hoje: HOJE }).testemunhas).toBe(false);
  });
});

describe('modelo de Instituição de Condomínio (o texto do próprio contrato do profissional)', () => {
  const modelo = modeloInstituicaoCondominio({ plural: true, prazoDias: 15, endereco: 'Rua Catucicaba, nº 419, bairro Conceição, Itabuna/BA', matricula: '8.469' });
  const d = montarContrato(contrato({ contratantesAdicionais: [matheus] }), proposta(), isailton, config, { hoje: HOJE, texto: modelo });

  it('objeto, fases e prazo iguais ao PDF', () => {
    expect(blocos(d, 'I')[0]).toBe('O presente contrato tem como objeto a elaboração de documentação técnica de engenharia para a regularização do prédio residencial situado em Rua Catucicaba, nº 419, bairro Conceição, Itabuna/BA, matrícula nº 8.469, compreendendo os serviços especificados na cláusula II.');
    expect(blocos(d, 'II')).toEqual([
      '1. Elaboração de projetos da edificação e unidades;',
      '2. Elaboração de memorial descritivo das unidades e cálculo de frações ideais;',
      '3. Elaboração de requerimento de instituição e convenção de condomínio;',
      '4. Elaboração dos quadros de áreas conforme ABNT NBR 12.721;',
      '5. Elaboração de memorial descritivo técnico da edificação.',
    ]);
    expect(blocos(d, 'III').find(t => t.startsWith('c) '))).toBe('c) Após o recebimento integral da documentação necessária, o CONTRATADO terá o prazo de até 15 (quinze) dias úteis para concluir e entregar a documentação técnica de engenharia objeto deste contrato, destinada a subsidiar o procedimento de Instituição e Convenção de Condomínio, cuja instrução, protocolo, acompanhamento e demais providências perante o Cartório de Registro de Imóveis serão de responsabilidade de outro profissional designado pelos CONTRATANTES.');
  });

  it('traz o parágrafo único de limite de responsabilidade', () => {
    expect(blocos(d, 'III').find(t => t.startsWith('Parágrafo único'))).toContain('não abrangendo a condução do procedimento registral');
  });

  it('no singular, "designado pelo CONTRATANTE"', () => {
    const m = modeloInstituicaoCondominio({ plural: false, prazoDias: 15 });
    expect(m.prazoEntrega).toContain('designado pelo CONTRATANTE.');
    expect(m.objeto).toContain('situado em (endereço a preencher)');
  });
});

describe('texto fixo do modelo, ajustado ao número de contratantes', () => {
  const plural = montarContrato(contrato({ contratantesAdicionais: [matheus] }), proposta(), isailton, config, { hoje: HOJE });
  const singular = montarContrato(contrato(), proposta(), isailton, config, { hoje: HOJE });

  it('cláusulas iguais ao PDF (partes que não mudam)', () => {
    const t = textoDe(singular);
    for (const frase of [
      'I – OBJETO DO CONTRATO', 'II – FASES', 'III – DOS PRAZOS', 'IV – DOS VALORES DOS SERVIÇOS TÉCNICOS PRESTADOS', 'V – OBRIGAÇÕES DO CONTRATANTE', 'VI – OBRIGAÇÕES DO CONTRATADO', 'VII – CLÁUSULA PENAL',
      'a) Imediatamente após a assinatura do contrato e o recebimento da documentação necessária, o CONTRATADO dará início à elaboração dos projetos, memoriais descritivos, quadros técnicos e demais documentos de engenharia previstos neste instrumento.',
      'no prazo de até 05 (cinco) dias úteis, contados da respectiva solicitação pelo CONTRATADO.',
      'd) Proceder ao pagamento total dos honorários contratados.',
      'd) Cumprir os prazos e etapas estipuladas para o bom e fiel cumprimento do presente instrumento',
      'ART (Registro de Responsabilidade Técnica) do serviço',
      'além de multa de 20% sobre o saldo pendente no momento da rescisão.',
      'multa de 20% sobre o saldo que remanescer para a conclusão dos trabalhos.',
    ]) expect(t).toContain(frase);
  });

  it('singular', () => {
    const t = textoDe(singular);
    expect(t).toContain('condicionados ao cumprimento pelo CONTRATANTE de seus próprios prazos de aprovação:');
    expect(t).toContain('b) O CONTRATANTE deverá fornecer, às suas expensas');
    expect(t).toContain('no que lhe couber');
    expect(t).toContain('Parágrafo único: O CONTRATANTE é totalmente responsável pela veracidade');
    expect(t).toContain('Se o CONTRATANTE rescindir, injustificadamente');
    expect(t).toContain('pagará ao CONTRATADO o saldo remanescente');
    expect(t).toContain('em favor desse último');
    expect(t).not.toContain('CONTRATANTES');
  });

  it('plural', () => {
    const t = textoDe(plural);
    expect(clausula(plural, 'V').titulo).toBe('V – OBRIGAÇÕES DOS CONTRATANTES');
    expect(t).toContain('condicionados ao cumprimento pelos CONTRATANTES de seus próprios prazos de aprovação:');
    expect(t).toContain('b) Os CONTRATANTES deverão fornecer, às suas expensas');
    expect(t).toContain('no que lhes couber');
    expect(t).toContain('os documentos que dispuserem acerca do objeto do mesmo');
    expect(t).toContain('Parágrafo único: Os CONTRATANTES são totalmente responsáveis pela veracidade');
    expect(t).toContain('Se os CONTRATANTES rescindirem, injustificadamente');
    expect(t).toContain('além de não possuírem qualquer direito');
    expect(t).toContain('pagarão ao CONTRATADO o saldo remanescente');
    expect(t).toContain('pelos CONTRATANTES, além de ter que pagar em favor desses últimos');
    expect(t).not.toContain('pagaráão');
  });
});

describe('parcelas e pendências', () => {
  it('sem parcelas no contrato, usa as da proposta só se somarem o valor', () => {
    const ok = proposta({ parcelasPagamento: [{ descricao: '50% na assinatura', valor: 2500 }, { descricao: '50% na entrega', valor: 2500 }] });
    expect(parcelasDoContrato(contrato({ parcelas: [] }), ok).map(p => p.descricao)).toEqual(['50% na assinatura', '50% na entrega']);
    const furada = proposta({ parcelasPagamento: [{ descricao: 'Pagamento único', valor: 3000 }] });
    expect(parcelasDoContrato(contrato({ parcelas: [] }), furada)).toEqual([]);
  });

  it('tudo completo: nenhuma pendência', () => {
    expect(pendenciasDoContrato(contrato(), isailton, config, proposta())).toEqual([]);
  });

  it('lista o que falta', () => {
    const semNada = { ...isailton, documento: null, qualificacao: undefined } as Client;
    const p = pendenciasDoContrato(contrato({ parcelas: [], contratantesAdicionais: [{ nome: 'Maria' }] }), semNada, {}, proposta());
    expect(p).toContain('Qualificação do contratado — nome, CPF, RG, endereço… (Configurações → dados da empresa)');
    expect(p).toContain('CPF/CNPJ de ISAILTON ALMEIDA SILVA (cadastro do cliente)');
    expect(p).toContain('nacionalidade, estado civil e profissão de ISAILTON ALMEIDA SILVA (cadastro do cliente)');
    expect(p).toContain('CPF de Maria');
    expect(p).toContain('Parcelas de pagamento (Editar contrato)');
  });
});
