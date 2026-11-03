import { describe, it, expect } from 'vitest';
import {
  formatarValor,
  formatarVariacao,
  legendaMensal,
  legendaTelegram,
  montarCards,
  textoWhatsApp,
  variacaoDiaria,
  type SnapshotIndicador,
} from './indicadores';

const agora = new Date('2026-11-03T11:00:00Z'); // 08:00 de 03/11 em SP

function snap(value: number, iso: string, variation: number | null = null, raw_data?: Record<string, unknown>): SnapshotIndicador {
  return { value, variation, captured_at: iso, raw_data };
}

describe('formatarValor', () => {
  it('formata cada tipo em pt-BR', () => {
    expect(formatarValor(5.346831, { formato: 'real', casas: 2 })).toBe('R$ 5,35');
    expect(formatarValor(171006.1, { formato: 'pontos', casas: 0 })).toBe('171.006 pts');
    expect(formatarValor(13.75, { formato: 'taxa', casas: 2 })).toBe('13,75% a.a.');
    expect(formatarValor(3158.25, { formato: 'usd', casas: 0, sufixo: '/t' })).toBe('US$ 3.158/t');
    expect(formatarValor(885, { formato: 'usd_mi', casas: 0 })).toBe('US$ 885 mi');
    expect(formatarValor(144.1, { formato: 'indice', casas: 1 })).toBe('144,1');
  });
});

describe('formatarVariacao', () => {
  it('põe sinal e duas casas', () => {
    expect(formatarVariacao(0.4234)).toBe('+0,42%');
    expect(formatarVariacao(-2.68)).toBe('-2,68%');
    expect(formatarVariacao(0.001)).toBe('0,00%');
  });
});

describe('legendaMensal', () => {
  it('lê o período do IBGE (AAAAMM) e do MDIC (AAAA-MM)', () => {
    expect(legendaMensal({ period: '202608' })).toBe('ago/26 x ago/25');
    expect(legendaMensal({ period: '2026-07' })).toBe('jul/26 x jul/25');
  });
  it('cai num texto genérico sem período', () => {
    expect(legendaMensal(null)).toBe('x ano anterior');
  });
});

describe('variacaoDiaria', () => {
  it('usa a variação gravada quando existe', () => {
    expect(variacaoDiaria([snap(10, '2026-11-03T09:00:00Z', 1.5)])).toBe(1.5);
  });
  it('calcula contra a captura de ~24h antes quando a fonte não grava', () => {
    const v = variacaoDiaria([
      snap(5.5, '2026-11-03T09:00:00Z'),
      snap(5.45, '2026-11-03T06:00:00Z'), // só 3h antes: ignora
      snap(5.0, '2026-11-02T09:00:00Z'),
    ]);
    expect(v).toBeCloseTo(10);
  });
  it('null quando a captura anterior tem mais de 48h (coleta parada)', () => {
    expect(
      variacaoDiaria([snap(5.43, '2026-11-03T12:00:00Z'), snap(5.34, '2026-10-29T09:00:00Z')])
    ).toBeNull();
  });
  it('null sem base de comparação', () => {
    expect(variacaoDiaria([snap(5.5, '2026-11-03T09:00:00Z')])).toBeNull();
  });
});

describe('montarCards', () => {
  it('monta os 3 cards e omite cotação parada há mais de 4 dias', () => {
    const cards = montarCards(
      {
        dolar: [snap(5.5, '2026-11-03T09:00:00Z'), snap(5.0, '2026-11-02T09:00:00Z')],
        selic: [snap(13.75, '2026-11-03T09:00:00Z')],
        aco: [snap(1406, '2026-10-20T09:00:00Z', 0.5)], // parado: sai
        cobre: [snap(6.36, '2026-11-03T09:00:00Z', -0.3)],
        producao_es: [snap(144.1, '2026-09-01T09:00:00Z', 8, { period: '202608' })], // mensal: fica
      },
      agora
    );

    expect(cards.map((c) => c.grupo)).toEqual(['financeiros', 'commodities', 'regional']);
    const [fin, com, reg] = cards;
    expect(fin.itens.map((i) => i.nome)).toEqual(['Dólar', 'Selic']);
    expect(fin.itens[0]).toMatchObject({ valor: 'R$ 5,50', legenda: 'no dia' });
    expect(fin.itens[0].variacao).toBeCloseTo(10);
    expect(fin.itens[1]).toMatchObject({ variacao: null, legenda: null });
    expect(com.itens.map((i) => i.nome)).toEqual(['Cobre']);
    expect(reg.itens[0]).toMatchObject({ valor: '144,1', variacao: 8, legenda: 'ago/26 x ago/25' });
  });

  it('não gera card sem nenhum item', () => {
    expect(montarCards({ dolar: [snap(5.5, '2026-11-03T09:00:00Z')] }, agora).map((c) => c.grupo)).toEqual([
      'financeiros',
    ]);
  });
});

describe('textos do card', () => {
  const [card] = montarCards(
    { dolar: [snap(5.5, '2026-11-03T09:00:00Z'), snap(5.0, '2026-11-02T09:00:00Z')] },
    agora
  );

  it('legenda do Telegram em HTML', () => {
    expect(legendaTelegram(card)).toContain('💵 Dólar: <b>R$ 5,50</b> (+10,00% no dia)');
    expect(legendaTelegram(card)).toContain('Atualizado em 03/11');
  });

  it('texto do WhatsApp com negrito e link dos indicadores', () => {
    const texto = textoWhatsApp(card);
    expect(texto).toContain('💵 Dólar: *R$ 5,50* (+10,00% no dia)');
    expect(texto).toContain('https://www.portalmetalmecanica.com.br/indicadores');
  });
});
