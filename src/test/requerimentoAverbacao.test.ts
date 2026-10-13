import { describe, it, expect } from 'vitest';
import type { AverbacaoData, Client, Process } from '@/lib/types';
import {
  dadosIniciaisAverbacao,
  montarRequerimentoAverbacao,
  proprietariosAdicionaisDoTrabalho,
  validarAverbacao,
} from '@/lib/producao/requerimentoAverbacao';

const cliente = {
  id: 'c1', nome: 'José Almeida dos Santos', documento: '357.666.625-72', tipo: 'Pessoa física', createdAt: 0,
  qualificacao: { estadoCivil: 'Divorciado(a)', profissao: 'comerciário' },
} as Client;

function trabalhoCom(tecnico?: Process['tecnico']): Process {
  return { id: 't1', clienteId: 'c1', objeto: 'Teste', status: 'Levantamento', notas: [], createdAt: 0, updatedAt: 0, tecnico } as Process;
}

const sione = { nome: 'Sione Ferreira Nascimento', cpf: '885.363.945-87', profissao: 'do lar', endereco: 'Rua 01, nº 28B' };

const base: AverbacaoData = {
  requerenteNome: 'José Almeida dos Santos', requerenteDocumento: '357.666.625-72',
  requerenteEstadoCivil: 'Divorciado(a)', requerenteProfissao: 'comerciário',
  matricula: '28591', imovelEndereco: 'Rua 01', areaConstruida: 100, tipoAto: 'averbacao_construcao', valorConstrucao: 50000,
};

describe('averbação com mais de um proprietário', () => {
  it('um só requerente: uma qualificação e uma assinatura (comportamento de sempre)', () => {
    const doc = montarRequerimentoAverbacao(base, cliente);
    expect(doc.qualificacoes).toHaveLength(1);
    expect(doc.assinaturas).toEqual([{ nome: 'José Almeida dos Santos', documento: '357.666.625-72' }]);
    expect(doc.qualificacoes[0]).toContain('JOSÉ ALMEIDA DOS SANTOS, maior, capaz, divorciado(a), comerciário, inscrito(a) no CPF nº 357.666.625-72');
  });

  it('dois proprietários: ambos qualificados e ambos assinam', () => {
    const doc = montarRequerimentoAverbacao(
      { ...base, coRequerentes: [{ nome: 'Sione Ferreira Nascimento', documento: '885.363.945-87', profissao: 'do lar', endereco: 'Rua 01, nº 28B' }] },
      cliente,
    );
    expect(doc.qualificacoes).toHaveLength(2);
    expect(doc.qualificacoes[1]).toBe('SIONE FERREIRA NASCIMENTO, maior, capaz, do lar, inscrito(a) no CPF nº 885.363.945-87, residente e domiciliado(a) em Rua 01, nº 28B');
    expect(doc.assinaturas.map(a => a.nome)).toEqual(['José Almeida dos Santos', 'Sione Ferreira Nascimento']);
    expect(doc.assinaturas[1].documento).toBe('885.363.945-87');
  });

  it('linha de proprietário sem nome é ignorada', () => {
    const doc = montarRequerimentoAverbacao({ ...base, coRequerentes: [{ nome: '  ' }] }, cliente);
    expect(doc.qualificacoes).toHaveLength(1);
    expect(doc.assinaturas).toHaveLength(1);
  });

  it('divorciado nunca leva "com <cônjuge>", mesmo com nome de cônjuge antigo guardado', () => {
    const doc = montarRequerimentoAverbacao({ ...base, requerenteConjugeNome: 'Sione Ferreira Nascimento' }, cliente);
    expect(doc.qualificacoes[0]).toContain('divorciado(a),');
    expect(doc.qualificacoes[0]).not.toContain('divorciado(a) com');
  });

  it('casado(a) com cônjuge informado continua saindo "casado(a) com X"', () => {
    const doc = montarRequerimentoAverbacao(
      { ...base, requerenteEstadoCivil: 'Casado(a)', requerenteConjugeNome: 'Maria', coRequerentes: [{ nome: 'Ana', estadoCivil: 'Casado(a)', conjugeNome: 'Pedro', documento: '1' }] },
      cliente,
    );
    expect(doc.qualificacoes[0]).toContain('casado(a) com Maria');
    expect(doc.qualificacoes[1]).toContain('casado(a) com Pedro');
  });
});

describe('proprietários já cadastrados em Dados técnicos', () => {
  const principal = { nome: cliente.nome, documento: cliente.documento || undefined };

  it('traz só os outros, comparando CPF sem depender de pontuação', () => {
    const t = trabalhoCom({ units: [], proprietariosGerais: [{ nome: 'José Almeida dos Santos', cpf: '35766662572' }, sione] });
    const extras = proprietariosAdicionaisDoTrabalho(t, principal);
    expect(extras).toHaveLength(1);
    expect(extras[0]).toMatchObject({ nome: 'Sione Ferreira Nascimento', documento: '885.363.945-87', profissao: 'do lar' });
  });

  it('sem CPF de um dos lados, compara pelo nome', () => {
    const t = trabalhoCom({ units: [], proprietariosGerais: [{ nome: ' josé almeida dos santos ', cpf: '' }, sione] });
    expect(proprietariosAdicionaisDoTrabalho(t, { nome: cliente.nome })).toHaveLength(1);
  });

  it('trabalho sem proprietariosGerais não tem adicionais', () => {
    expect(proprietariosAdicionaisDoTrabalho(trabalhoCom(), principal)).toEqual([]);
  });

  it('o wizard já abre com o segundo proprietário carregado', () => {
    const t = trabalhoCom({ units: [], proprietariosGerais: [{ nome: 'José Almeida dos Santos', cpf: '357.666.625-72' }, sione] });
    const inicial = dadosIniciaisAverbacao(t, cliente);
    expect(inicial.requerenteNome).toBe('José Almeida dos Santos');
    expect(inicial.coRequerentes?.map(r => r.nome)).toEqual(['Sione Ferreira Nascimento']);
  });

  it('averbação já salva é respeitada, sem sobrescrever com os Dados técnicos', () => {
    const t = { ...trabalhoCom({ units: [], proprietariosGerais: [sione] }), averbacao: base } as Process;
    expect(dadosIniciaisAverbacao(t, cliente).coRequerentes).toBeUndefined();
  });
});

describe('validação de proprietário adicional', () => {
  it('exige CPF de quem tem nome', () => {
    const erros = validarAverbacao({ ...base, coRequerentes: [{ nome: 'Sione Ferreira Nascimento' }] });
    expect(erros.map(e => e.campo)).toContain('coRequerentes');
    expect(erros.find(e => e.campo === 'coRequerentes')?.mensagem).toContain('Sione Ferreira Nascimento');
  });

  it('com CPF, passa', () => {
    expect(validarAverbacao({ ...base, coRequerentes: [{ nome: 'Sione', documento: '885.363.945-87' }] })).toEqual([]);
  });

  it('linha totalmente vazia não bloqueia', () => {
    expect(validarAverbacao({ ...base, coRequerentes: [{ nome: '' }] })).toEqual([]);
  });
});
