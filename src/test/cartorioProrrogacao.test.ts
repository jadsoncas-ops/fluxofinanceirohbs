import { describe, it, expect } from 'vitest';
import type { RegistroImobiliario } from '@/lib/types';
import { limitePrenotacao, prorrogarExigencia, prorrogarPrenotacao, sugestoesProrrogacao } from '@/lib/cartorio';

const HOJE = '2026-10-28';
const AGORA = new Date('2026-10-28T15:00:00Z').getTime();

// Prenotação de 18/09 com 30 dias vence em 18/10 — já vencida em HOJE.
const registro: RegistroImobiliario = { oficio: '1º Ofício', protocolo: '135926', dataProtocolo: '2026-09-18', dataPrenotacao: '2026-09-18', prazoPrenotacaoDias: 30 };

describe('limite da prenotação', () => {
  it('é o início mais o prazo (30 dias por padrão)', () => {
    expect(limitePrenotacao(registro)).toBe('2026-10-18');
    expect(limitePrenotacao({ dataPrenotacao: '2026-09-18' })).toBe('2026-10-18');
  });

  it('sem prenotação, não há limite', () => {
    expect(limitePrenotacao(undefined)).toBeNull();
    expect(limitePrenotacao({ protocolo: '1' })).toBeNull();
  });
});

describe('prorrogar a prenotação', () => {
  it('estende o limite, ajusta o prazo em dias e guarda o histórico', () => {
    const novo = prorrogarPrenotacao(registro, '2026-11-27', 'Concedido pelo Oficial', AGORA, HOJE);
    expect(limitePrenotacao(novo)).toBe('2026-11-27');
    expect(novo.prazoPrenotacaoDias).toBe(70); // 18/09 → 27/11
    expect(novo.prorrogacoes).toHaveLength(1);
    expect(novo.prorrogacoes![0]).toMatchObject({ de: '2026-10-18', ate: '2026-11-27', motivo: 'Concedido pelo Oficial', em: AGORA });
  });

  it('prorrogações seguidas se somam e o histórico cresce', () => {
    const um = prorrogarPrenotacao(registro, '2026-11-12', undefined, AGORA, HOJE);
    const dois = prorrogarPrenotacao(um, '2026-12-12', 'segunda', AGORA, HOJE);
    expect(limitePrenotacao(dois)).toBe('2026-12-12');
    expect(dois.prorrogacoes!.map(p => [p.de, p.ate])).toEqual([['2026-10-18', '2026-11-12'], ['2026-11-12', '2026-12-12']]);
  });

  it('não muda o registro original (sem efeito colateral)', () => {
    prorrogarPrenotacao(registro, '2026-11-27', undefined, AGORA, HOJE);
    expect(registro.prazoPrenotacaoDias).toBe(30);
    expect(registro.prorrogacoes).toBeUndefined();
  });

  it('recusa prazo que não é depois do atual', () => {
    expect(() => prorrogarPrenotacao(registro, '2026-10-18', undefined, AGORA, HOJE)).toThrow(/depois do atual \(18\/10\/2026\)/);
    expect(() => prorrogarPrenotacao(registro, '2026-10-01', undefined, AGORA, HOJE)).toThrow(/depois do atual/);
  });

  it('recusa novo prazo ainda no passado e data vazia', () => {
    expect(() => prorrogarPrenotacao(registro, '2026-10-20', undefined, AGORA, HOJE)).toThrow(/passado/);
    expect(() => prorrogarPrenotacao(registro, '', undefined, AGORA, HOJE)).toThrow(/Informe o novo prazo/);
  });

  it('sem protocolo/prenotação não há o que prorrogar', () => {
    expect(() => prorrogarPrenotacao({ oficio: '1º Ofício' }, '2026-11-27', undefined, AGORA, HOJE)).toThrow(/protocolo/);
  });

  it('motivo em branco não vira texto vazio', () => {
    expect(prorrogarPrenotacao(registro, '2026-11-27', '   ', AGORA, HOJE).prorrogacoes![0].motivo).toBeUndefined();
  });
});

describe('prorrogar prazo de exigência', () => {
  const comExigencia: RegistroImobiliario = {
    ...registro,
    exigencias: [
      { id: 'e1', descricao: 'Apresentar certidão', prazo: '2026-11-05', status: 'Aberta', criadaEm: 1 },
      { id: 'e2', descricao: 'Outra', prazo: '2026-11-05', status: 'Cumprida', criadaEm: 1 },
      { id: 'e3', descricao: 'Sem prazo', status: 'Aberta', criadaEm: 1 },
    ],
  };

  it('move o prazo da exigência e guarda o histórico, sem tocar nas outras', () => {
    const novo = prorrogarExigencia(comExigencia, 'e1', '2026-11-20', 'Cliente buscando certidão', AGORA, HOJE);
    const e1 = novo.exigencias!.find(e => e.id === 'e1')!;
    expect(e1.prazo).toBe('2026-11-20');
    expect(e1.prorrogacoes![0]).toMatchObject({ de: '2026-11-05', ate: '2026-11-20', motivo: 'Cliente buscando certidão' });
    expect(novo.exigencias!.find(e => e.id === 'e2')!.prazo).toBe('2026-11-05');
    expect(novo.prazoPrenotacaoDias).toBe(30); // prorrogar exigência não mexe na prenotação
  });

  it('recusa prazo igual/anterior, exigência já cumprida e exigência inexistente', () => {
    expect(() => prorrogarExigencia(comExigencia, 'e1', '2026-11-05', undefined, AGORA, HOJE)).toThrow(/depois do atual/);
    expect(() => prorrogarExigencia(comExigencia, 'e2', '2026-11-20', undefined, AGORA, HOJE)).toThrow(/em aberto/);
    expect(() => prorrogarExigencia(comExigencia, 'zzz', '2026-11-20', undefined, AGORA, HOJE)).toThrow(/não encontrada/);
  });

  it('exigência sem prazo só ganha o prazo, sem registrar "prorrogação"', () => {
    const novo = prorrogarExigencia(comExigencia, 'e3', '2026-11-20', undefined, AGORA, HOJE);
    const e3 = novo.exigencias!.find(e => e.id === 'e3')!;
    expect(e3.prazo).toBe('2026-11-20');
    expect(e3.prorrogacoes).toEqual([]);
  });
});

describe('sugestões de novo prazo', () => {
  it('conta do limite atual quando ele ainda não passou', () => {
    expect(sugestoesProrrogacao('2026-11-10', HOJE)).toEqual([
      { dias: 15, data: '2026-11-25' }, { dias: 30, data: '2026-12-10' }, { dias: 60, data: '2027-01-09' },
    ]);
  });

  it('conta de hoje quando o limite já venceu', () => {
    expect(sugestoesProrrogacao('2026-10-18', HOJE).map(s => s.data)).toEqual(['2026-11-12', '2026-11-27', '2026-12-27']);
    expect(sugestoesProrrogacao(null, HOJE)[1].data).toBe('2026-11-27');
  });
});
