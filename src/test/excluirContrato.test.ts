import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Contrato, Process, Proposta } from '@/lib/types';

const storage = vi.hoisted(() => ({
  deleteContrato: vi.fn(), updateProcess: vi.fn(), updateProposta: vi.fn(), registrarEvento: vi.fn(), getProcesses: vi.fn(),
  addContrato: vi.fn(), getNextContratoCodigo: vi.fn(), getContrato: vi.fn(), updateContrato: vi.fn(), addTransaction: vi.fn(),
}));
vi.mock('@/lib/storage', () => storage);

import { excluirContrato } from '@/lib/comercial/fluxo';

function contrato(parcial: Partial<Contrato> = {}): Contrato {
  return { id: 'ct1', codigo: 'CTR-0070', propostaId: 'p1', clienteId: 'c1', valor: 5000, parcelas: [], status: 'Ativo', createdAt: 0, updatedAt: 0, ...parcial };
}
const proposta = (status: Proposta['status']) => ({ id: 'p1', codigo: 'PRP-020', status } as Proposta);
const trabalho = (parcial: Partial<Process> = {}) => ({ id: 't1', objeto: 'Regularização', contratoId: 'ct1', ...parcial } as Process);

beforeEach(() => {
  Object.values(storage).forEach(f => f.mockReset());
  storage.getProcesses.mockReturnValue([]);
});

describe('excluir contrato', () => {
  it('sem trabalho: apaga o contrato e devolve a proposta para "Em aprovação"', () => {
    excluirContrato(contrato(), proposta('Aprovada'));
    expect(storage.deleteContrato).toHaveBeenCalledWith('ct1');
    expect(storage.updateProposta).toHaveBeenCalledTimes(1);
    expect(storage.updateProposta.mock.calls[0][0]).toMatchObject({ id: 'p1', status: 'Em aprovação' });
    expect(storage.updateProcess).not.toHaveBeenCalled();
  });

  it('com trabalho: o trabalho continua, só deixa de apontar para o contrato', () => {
    storage.getProcesses.mockReturnValue([trabalho()]);
    excluirContrato(contrato({ trabalhoId: 't1', parcelas: [{ id: 'a', descricao: 'Entrada', valor: 2500, transactionId: 'tx1' }] }), proposta('Aprovada'));
    expect(storage.updateProcess).toHaveBeenCalledTimes(1);
    expect(storage.updateProcess.mock.calls[0][0]).toMatchObject({ id: 't1', objeto: 'Regularização', contratoId: undefined });
    // os lançamentos financeiros não são tocados: a exclusão não usa nenhuma função de transação
    expect(storage.addTransaction).not.toHaveBeenCalled();
    expect(Object.keys(storage).filter(k => /transaction/i.test(k) && k !== 'addTransaction')).toEqual([]);
  });

  it('trabalho que já aponta para outro contrato não é mexido', () => {
    storage.getProcesses.mockReturnValue([trabalho({ contratoId: 'outro' })]);
    excluirContrato(contrato({ trabalhoId: 't1' }), proposta('Aprovada'));
    expect(storage.updateProcess).not.toHaveBeenCalled();
  });

  it('proposta que não estava aprovada mantém o status; sem proposta não quebra', () => {
    excluirContrato(contrato(), proposta('Perdida'));
    expect(storage.updateProposta).not.toHaveBeenCalled();
    excluirContrato(contrato());
    expect(storage.deleteContrato).toHaveBeenCalledTimes(2);
  });

  it('registra o evento sem contratoId (o histórico tem FK para o contrato que acabou de sumir)', () => {
    excluirContrato(contrato({ trabalhoId: 't1' }), proposta('Aprovada'));
    const evento = storage.registrarEvento.mock.calls[0][0];
    expect(evento).toMatchObject({ modulo: 'Comercial', texto: 'Contrato CTR-0070 excluído', clienteId: 'c1', propostaId: 'p1', trabalhoId: 't1' });
    expect(evento).not.toHaveProperty('contratoId');
  });
});
