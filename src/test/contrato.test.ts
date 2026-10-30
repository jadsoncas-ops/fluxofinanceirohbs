import { describe, it, expect } from 'vitest';
import type { Client, CompanyConfig, Contrato, Proposta } from '@/lib/types';
import { montarContrato, pendenciasDoContrato } from '@/lib/comercial/contratoDoc';

const HOJE = new Date(2026, 9, 30); // 30/10/2026

const config: CompanyConfig = {
  razaoSocial: 'HBS Engenharia Civil Ltda', cnpj: '12.345.678/0001-90', endereco: 'Av. Ilhéus, 100, Centro, Itabuna, BA',
  responsavelNome: 'Jádson Castro', responsavelCrea: '0512345678-BA',
};

const jose = {
  id: 'c1', nome: 'José Almeida dos Santos', tipo: 'Pessoa física', documento: '357.666.625-72', createdAt: 0,
  endereco: { rua: 'Rua 01', numero: '28A', bairro: 'Loteamento Paraíso', cidade: 'Itabuna', estado: 'BA' },
  qualificacao: { nacionalidade: 'brasileiro', estadoCivil: 'Divorciado(a)', profissao: 'comerciário', rg: '1234567' },
} as Client;

function proposta(parcial: Partial<Proposta> = {}): Proposta {
  return {
    id: 'p1', codigo: 'PRP-007', clienteId: 'c1', titulo: 'Regularização de Imóvel', status: 'Aprovada', createdAt: 0, updatedAt: 0,
    itens: [{ etapaId: 'levantamento', nome: 'Levantamento Cadastral', grupo: 'Módulo Projeto', visitas: 1, horas: 0 }],
    custoHoraBase: 0, lucroPercent: 0, impostosPercent: 0, comissaoPercent: 0, custosProtocolo: { art: false, assinatura: false },
    resultado: { custoTecnico: 0, custoProtocolos: 0, custoTotal: 0, lucro: 0, imposto: 0, comissao: 0, precoVenda: 4000, margem: 0 },
    prazoDias: 30, ...parcial,
  };
}

function contrato(parcial: Partial<Contrato> = {}): Contrato {
  return { id: 'ct1', codigo: 'CTR-003', propostaId: 'p1', clienteId: 'c1', valor: 4000, parcelas: [], status: 'Ativo', createdAt: 0, updatedAt: 0, ...parcial };
}

const textoDe = (doc: ReturnType<typeof montarContrato>) => doc.clausulas.flatMap(c => [c.titulo, ...c.paragrafos]).join('\n');
const clausula = (doc: ReturnType<typeof montarContrato>, inicio: string) => doc.clausulas.find(c => c.titulo.startsWith(inicio))!;

describe('contrato com um contratante', () => {
  const doc = montarContrato(contrato(), proposta(), jose, config, HOJE);

  it('qualifica as duas partes', () => {
    expect(doc.contratada.qualificacao).toContain('HBS ENGENHARIA CIVIL LTDA');
    expect(doc.contratada.qualificacao).toContain('CNPJ nº 12.345.678/0001-90');
    expect(doc.contratada.qualificacao).toContain('representada por Jádson Castro, CREA nº 0512345678-BA');
    expect(doc.contratantes).toHaveLength(1);
    expect(doc.contratantes[0].qualificacao).toContain('JOSÉ ALMEIDA DOS SANTOS, brasileiro, maior, capaz, divorciado(a), comerciário, RG nº 1234567');
    expect(doc.contratantes[0].qualificacao).toContain('CPF/CNPJ nº 357.666.625-72');
    expect(doc.contratantes[0].qualificacao).toContain('Rua 01, 28A, Loteamento Paraíso, Itabuna, BA');
    expect(doc.plural).toBe(false);
  });

  it('usa o singular e não tem cláusula de solidariedade', () => {
    const t = textoDe(doc);
    expect(t).toContain('o CONTRATANTE pagará');
    expect(t).not.toContain('CONTRATANTES');
    expect(t).not.toContain('solidariamente');
  });

  it('traz valor, valor por extenso, prazo e objeto', () => {
    const t = textoDe(doc);
    expect(t).toContain('4.000,00 (quatro mil reais)');
    expect(t).toContain('30 (trinta) dias');
    expect(t).toContain('regularização de imóvel');
    expect(t).toContain('Proposta Comercial nº PRP-007');
    expect(t).toContain('a) Levantamento Cadastral — Visita técnica e medição');
    expect(t).not.toContain('.;');
  });

  it('a taxa de ART só aparece como "não incluída" quando não está no preço', () => {
    expect(textoDe(doc)).toContain('taxa de emissão de ART/RRT');
    const comArt = montarContrato(contrato(), proposta({ custosProtocolo: { art: true, assinatura: false } }), jose, config, HOJE);
    expect(textoDe(comArt)).not.toContain('taxa de emissão de ART/RRT');
  });

  it('data por extenso e cidade', () => {
    expect(doc.data).toBe('30 de outubro de 2026');
    expect(doc.cidade).toBe('Itabuna/BA');
    expect(textoDe(doc)).toContain('Comarca de Itabuna/BA');
  });
});

describe('contrato com mais de um contratante', () => {
  const sione = { nome: 'Sione Ferreira Nascimento', documento: '885.363.945-87', estadoCivil: 'Divorciado(a)' as const, profissao: 'do lar', endereco: 'Rua 01, nº 28B, Itabuna, BA' };
  const doc = montarContrato(contrato({ contratantesAdicionais: [sione] }), proposta(), jose, config, HOJE);

  it('qualifica todos e passa para o plural', () => {
    expect(doc.plural).toBe(true);
    expect(doc.contratantes.map(c => c.nome)).toEqual(['José Almeida dos Santos', 'Sione Ferreira Nascimento']);
    expect(doc.contratantes[1].qualificacao).toContain('SIONE FERREIRA NASCIMENTO, maior, capaz, divorciado(a), do lar');
    expect(doc.contratantes[1].documento).toBe('885.363.945-87');
  });

  it('o texto vai para o plural e o pagamento é solidário', () => {
    const t = textoDe(doc);
    expect(t).toContain('os CONTRATANTES pagarão');
    expect(t).toContain('pelos CONTRATANTES');
    expect(t).toContain('OBRIGAÇÕES DOS CONTRATANTES');
    expect(clausula(doc, 'CLÁUSULA QUINTA').paragrafos.join(' ')).toContain('respondem solidariamente');
  });

  it('adicional sem nome é ignorado', () => {
    const d = montarContrato(contrato({ contratantesAdicionais: [{ nome: '  ' }] }), proposta(), jose, config, HOJE);
    expect(d.plural).toBe(false);
    expect(d.contratantes).toHaveLength(1);
  });

  it('adicional sem CPF sai com "(a preencher)" na assinatura', () => {
    const d = montarContrato(contrato({ contratantesAdicionais: [{ nome: 'Maria' }] }), proposta(), jose, config, HOJE);
    expect(d.contratantes[1].documento).toBe('(a preencher)');
  });

  it('divorciado não leva "com <cônjuge>" mesmo com nome de cônjuge antigo guardado', () => {
    const d = montarContrato(contrato({ contratantesAdicionais: [{ ...sione, conjugeNome: 'José Almeida dos Santos' }] }), proposta(), jose, config, HOJE);
    expect(d.contratantes[1].qualificacao).not.toContain('divorciado(a) com');
  });
});

describe('parcelas', () => {
  it('usa as parcelas do contrato, com vencimento', () => {
    const d = montarContrato(contrato({ parcelas: [
      { id: 'a', descricao: 'Entrada', valor: 2000, vencimento: '2026-11-05' },
      { id: 'b', descricao: 'Na entrega', valor: 2000, vencimento: '2026-12-05' },
    ] }), proposta(), jose, config, HOJE);
    const q = clausula(d, 'CLÁUSULA QUINTA').paragrafos.join('\n');
    expect(q).toContain('a) Entrada: ');
    expect(q).toContain('com vencimento em 05/11/2026');
    expect(q).toContain('b) Na entrega');
    expect(q).toContain('05/12/2026');
  });

  it('sem parcelas no contrato, usa as condições da proposta se somarem o valor', () => {
    const p = proposta({ parcelasPagamento: [{ descricao: '50% na assinatura', valor: 2000 }, { descricao: '50% na entrega', valor: 2000 }] });
    const q = clausula(montarContrato(contrato(), p, jose, config, HOJE), 'CLÁUSULA QUINTA').paragrafos.join('\n');
    expect(q).toContain('50% na assinatura');
    expect(q).not.toContain('com vencimento');
  });

  it('se as condições da proposta não somam o valor do contrato, não as usa (nunca inventa parcela)', () => {
    const p = proposta({ parcelasPagamento: [{ descricao: 'Pagamento único', valor: 3000 }] });
    const q = clausula(montarContrato(contrato({ valor: 4000 }), p, jose, config, HOJE), 'CLÁUSULA QUINTA').paragrafos.join('\n');
    expect(q).not.toContain('Pagamento único');
    expect(q).toContain('na forma e nas datas ajustadas entre as partes');
  });
});

describe('outras situações', () => {
  it('nota do parceiro entra na cláusula de pagamento, com a numeração certa', () => {
    const p = proposta({ observacaoParceiro: 'O valor inclui honorários do despachante.' });
    const um = clausula(montarContrato(contrato(), p, jose, config, HOJE), 'CLÁUSULA QUINTA').paragrafos;
    expect(um.some(x => x.startsWith('5.4. O valor inclui honorários'))).toBe(true);
    const dois = clausula(montarContrato(contrato({ contratantesAdicionais: [{ nome: 'Maria', documento: '1' }] }), p, jose, config, HOJE), 'CLÁUSULA QUINTA').paragrafos;
    expect(dois.some(x => x.startsWith('5.5. O valor inclui honorários'))).toBe(true);
  });

  it('cliente pessoa jurídica é representado; condomínio, pelo síndico', () => {
    const pj = { ...jose, tipo: 'Pessoa jurídica', nome: 'Construtora Beta Ltda', documento: '11.222.333/0001-44', qualificacao: undefined } as Client;
    const d = montarContrato(contrato(), proposta(), pj, config, HOJE);
    expect(d.contratantes[0].qualificacao).toContain('pessoa jurídica de direito privado, inscrito(a) no CNPJ nº 11.222.333/0001-44');
    expect(d.contratantes[0].qualificacao).toContain('representada por seu representante legal');
    expect(d.contratantes[0].representado).toBe(true);
    const cond = montarContrato(contrato(), proposta(), { ...pj, tipo: 'Condomínio' } as Client, config, HOJE);
    expect(cond.contratantes[0].qualificacao).toContain('representado por seu síndico');
  });

  it('empresa sem configuração sai com marcadores, nunca com dado inventado', () => {
    const d = montarContrato(contrato(), proposta(), jose, {}, HOJE);
    expect(d.contratada.qualificacao).toContain('configure em Configurações');
    expect(d.contratada.qualificacao).toContain('CNPJ nº (a preencher)');
  });

  it('prazo ausente não quebra o texto', () => {
    const d = montarContrato(contrato(), proposta({ prazoDias: undefined }), jose, config, HOJE);
    expect(textoDe(d)).toContain('será o ajustado entre as partes por escrito');
  });
});

describe('pendências antes de imprimir', () => {
  it('tudo completo: nenhuma pendência', () => {
    expect(pendenciasDoContrato(contrato(), jose, config)).toEqual([]);
  });

  it('lista o que falta na empresa, no cliente e nos adicionais', () => {
    const semNada = { ...jose, documento: null, qualificacao: undefined } as Client;
    const p = pendenciasDoContrato(contrato({ contratantesAdicionais: [{ nome: 'Maria' }] }), semNada, {});
    expect(p).toContain('Razão social da HBS (Configurações)');
    expect(p).toContain('CNPJ da HBS (Configurações)');
    expect(p).toContain('Responsável técnico da HBS (Configurações)');
    expect(p).toContain('CPF/CNPJ de José Almeida dos Santos (cadastro do cliente)');
    expect(p).toContain('Estado civil e profissão de José Almeida dos Santos (cadastro do cliente)');
    expect(p).toContain('CPF de Maria');
  });
});
