import { describe, it, expect } from 'vitest';
import type { Client, Proposta } from '@/lib/types';
import { aprovarPropostaEGerarContrato, nomeDaProposta } from '@/lib/comercial/fluxo';

const clientes = [{ id: 'c1', nome: 'José Almeida dos Santos' }] as Client[];

function proposta(parcial: Partial<Proposta>): Proposta {
  return {
    id: 'p1', codigo: 'PRP-001', clienteId: null, titulo: 'Regularização', itens: [], custoHoraBase: 0,
    lucroPercent: 0, impostosPercent: 0, comissaoPercent: 0, custosProtocolo: { art: false, assinatura: false },
    resultado: { custoTecnico: 0, custoProtocolos: 0, custoTotal: 0, lucro: 0, imposto: 0, comissao: 0, precoVenda: 1000, margem: 0 },
    status: 'Rascunho', createdAt: 0, updatedAt: 0, ...parcial,
  };
}

describe('orçamento sem cliente cadastrado', () => {
  it('usa o nome do cliente cadastrado quando existe', () => {
    expect(nomeDaProposta(proposta({ clienteId: 'c1' }), clientes)).toBe('José Almeida dos Santos');
  });

  it('sem cadastro, usa o nome do interessado', () => {
    expect(nomeDaProposta(proposta({ prospect: { nome: 'Maria Souza' } }), clientes)).toBe('Maria Souza');
  });

  it('cliente cadastrado tem prioridade sobre um interessado esquecido na proposta', () => {
    expect(nomeDaProposta(proposta({ clienteId: 'c1', prospect: { nome: 'Maria Souza' } }), clientes)).toBe('José Almeida dos Santos');
  });

  it('cliente que não existe mais cai no interessado, depois no genérico', () => {
    expect(nomeDaProposta(proposta({ clienteId: 'apagado', prospect: { nome: 'Maria Souza' } }), clientes)).toBe('Maria Souza');
    expect(nomeDaProposta(proposta({ clienteId: 'apagado' }), clientes)).toBe('Cliente');
  });

  it('não aprova (nem gera contrato) proposta que ainda não tem cliente cadastrado', () => {
    expect(() => aprovarPropostaEGerarContrato(proposta({ prospect: { nome: 'Maria Souza' } }))).toThrow(/Cadastre o cliente/);
  });
});
