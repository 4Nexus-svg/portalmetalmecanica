import { describe, it, expect } from 'vitest';
import {
  calcularJanela,
  edicaoPorHoraSp,
  formatarDataResumo,
  limparTitulo,
  obterHoraSp,
  pegarEdicao,
  selecionarArtigosJanela,
  RESUMO_EDICOES,
} from './resumo';

// São Paulo é UTC-3 (sem DST desde 2019).
const sp = (isoUtc: string) => new Date(isoUtc);
const agora19hSp = sp('2026-10-24T22:00:00Z'); // 19:00 de 24/10 em SP

describe('formatarDataResumo', () => {
  it('formata a data no fuso de São Paulo', () => {
    expect(formatarDataResumo(sp('2026-10-24T12:00:00Z'))).toBe('24/10/2026');
  });

  it('usa o dia de São Paulo mesmo quando UTC já virou o dia', () => {
    // 02:00 UTC de 25/10 = 23:00 de 24/10 em São Paulo
    expect(formatarDataResumo(sp('2026-10-25T02:00:00Z'))).toBe('24/10/2026');
  });
});

describe('limparTitulo', () => {
  it('remove newlines e tabs (quebrariam a mensagem do Telegram)', () => {
    expect(limparTitulo('Título\ncom\tquebra')).toBe('Título com quebra');
  });

  it('colapsa espaços e apar trim', () => {
    expect(limparTitulo('  a   b  ')).toBe('a b');
  });
});

describe('obterHoraSp', () => {
  it('retorna a hora de São Paulo, não a UTC', () => {
    // 11:00 UTC = 08:00 em SP
    expect(obterHoraSp(sp('2026-10-24T11:00:00Z'))).toBe(8);
    // 23:30 UTC = 20:30 em SP
    expect(obterHoraSp(sp('2026-10-24T23:30:00Z'))).toBe(20);
  });
});

describe('edicaoPorHoraSp', () => {
  it('mapeia as faixas das 3 edições', () => {
    expect(edicaoPorHoraSp(0).slug).toBe('manha');
    expect(edicaoPorHoraSp(8).slug).toBe('manha');
    expect(edicaoPorHoraSp(11).slug).toBe('manha');
    expect(edicaoPorHoraSp(12).slug).toBe('meio');
    expect(edicaoPorHoraSp(16).slug).toBe('meio');
    expect(edicaoPorHoraSp(17).slug).toBe('tarde');
    expect(edicaoPorHoraSp(23).slug).toBe('tarde');
  });

  it('não deixa nenhuma hora sem edição', () => {
    for (let h = 0; h < 24; h++) {
      expect(() => edicaoPorHoraSp(h)).not.toThrow();
    }
  });
});

describe('calcularJanela', () => {
  it('as 3 janelas do dia se encaixam exatas, sem buraco e sem sobreposição', () => {
    const manha = calcularJanela(pegarEdicao('manha'), agora19hSp);
    const meio = calcularJanela(pegarEdicao('meio'), agora19hSp);
    const tarde = calcularJanela(pegarEdicao('tarde'), agora19hSp);

    // [18h de ontem → 08h] [08h → 13h] [13h → 18h] em SP
    expect(manha.inicio.toISOString()).toBe('2026-10-23T21:00:00.000Z');
    expect(manha.fim.toISOString()).toBe('2026-10-24T11:00:00.000Z');
    expect(meio.inicio.toISOString()).toBe('2026-10-24T11:00:00.000Z');
    expect(meio.fim.toISOString()).toBe('2026-10-24T16:00:00.000Z');
    expect(tarde.inicio.toISOString()).toBe('2026-10-24T16:00:00.000Z');
    expect(tarde.fim.toISOString()).toBe('2026-10-24T21:00:00.000Z');

    // Encaixe exato fim→início entre edições consecutivas
    expect(manha.fim.getTime()).toBe(meio.inicio.getTime());
    expect(meio.fim.getTime()).toBe(tarde.inicio.getTime());
    // O fim da tarde de ontem é o início da manhã de hoje
    const tardeOntem = calcularJanela(
      pegarEdicao('tarde'),
      sp('2026-10-24T14:00:00Z') // 11:00 de 24/10: tarde ainda não rodou hoje
    );
    expect(tardeOntem.fim.getTime()).toBe(manha.inicio.getTime());
  });

  it('teste manual antes da hora agendada não puxa notícia futura', () => {
    // 07:00 de 24/10 em SP (10:00 UTC), edição das 08h: fim = agora, não 08h
    const janela = calcularJanela(pegarEdicao('manha'), sp('2026-10-24T10:00:00Z'));
    expect(janela.fim.toISOString()).toBe('2026-10-24T10:00:00.000Z');
    expect(janela.inicio.toISOString()).toBe('2026-10-23T21:00:00.000Z');
  });

  it('run atrasado ainda usa a hora agendada como fim (janela não muda)', () => {
    const noHorario = calcularJanela(pegarEdicao('manha'), sp('2026-10-24T11:00:00Z'));
    const atrasado = calcularJanela(pegarEdicao('manha'), sp('2026-10-24T12:20:00Z'));
    expect(atrasado.fim).toEqual(noHorario.fim);
    expect(atrasado.inicio).toEqual(noHorario.inicio);
  });

  it('?slot=tarde de madrugada não inverte a janela (usa ocorrência de ontem)', () => {
    // 02:00 de 25/10 em SP (05:00 UTC): tarde de hoje ainda não existe
    const janela = calcularJanela(pegarEdicao('tarde'), sp('2026-10-25T05:00:00Z'));
    expect(janela.inicio.getTime()).toBeLessThan(janela.fim.getTime());
    expect(janela.fim.toISOString()).toBe('2026-10-24T21:00:00.000Z'); // 18h de ontem
    expect(janela.inicio.toISOString()).toBe('2026-10-24T16:00:00.000Z'); // 13h de ontem
  });
});

describe('selecionarArtigosJanela', () => {
  const janela = { inicio: new Date('2026-10-24T11:00:00Z'), fim: new Date('2026-10-24T16:00:00Z') };
  const com = (published_at: string | null) => ({ title: 'X', published_at });

  it('só inclui notícias da janela [inicio, fim)', () => {
    const escolhidas = selecionarArtigosJanela(
      [
        com('2026-10-24T16:30:00Z'), // depois do fim (futuro)
        com('2026-10-24T15:00:00Z'), // dentro
        com('2026-10-24T12:00:00Z'), // dentro
        com('2026-10-24T10:00:00Z'), // antes do início
        com(null), // sem data (rascunho não publicado)
      ],
      janela,
      5
    );
    expect(escolhidas.map((a) => a.published_at)).toEqual([
      '2026-10-24T15:00:00Z',
      '2026-10-24T12:00:00Z',
    ]);
  });

  it('inclui a borda do início e exclui a borda do fim (sem duplicar entre edições)', () => {
    const escolhidas = selecionarArtigosJanela(
      [com('2026-10-24T11:00:00Z'), com('2026-10-24T16:00:00Z')],
      janela,
      5
    );
    expect(escolhidas.map((a) => a.published_at)).toEqual(['2026-10-24T11:00:00Z']);
  });

  it('ordena do mais recente pro mais antigo e respeita o limite', () => {
    const escolhidas = selecionarArtigosJanela(
      [
        com('2026-10-24T12:00:00Z'),
        com('2026-10-24T15:00:00Z'),
        com('2026-10-24T13:00:00Z'),
      ],
      janela,
      2
    );
    expect(escolhidas.map((a) => a.published_at)).toEqual([
      '2026-10-24T15:00:00Z',
      '2026-10-24T13:00:00Z',
    ]);
  });

  it('publicação com fuso do Supabase (+00:00) é comparada certo', () => {
    // O Supabase devolve "2026-10-24T12:00:00+00:00" (com offset, não Z)
    const escolhidas = selecionarArtigosJanela(
      [com('2026-10-24T12:00:00+00:00'), com('2026-10-24T10:59:59+00:00')],
      janela,
      5
    );
    expect(escolhidas.map((a) => a.published_at)).toEqual(['2026-10-24T12:00:00+00:00']);
  });
});

describe('RESUMO_EDICOES', () => {
  it('tem as 3 edições com slugs únicos e janelas que cobrem as 24h', () => {
    expect(RESUMO_EDICOES).toHaveLength(3);
    const slugs = RESUMO_EDICOES.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(3);
    // manha 14h + meio 5h + tarde 5h = 24h (a manhã cobre a noite anterior)
    const totalHoras = RESUMO_EDICOES.reduce((soma, e) => soma + e.janelaHorasAtras, 0);
    expect(totalHoras).toBe(24);
  });

  it('cada edição manda pelo menos uma notícia', () => {
    for (const edicao of RESUMO_EDICOES) {
      expect(edicao.maxTitulos).toBeGreaterThanOrEqual(1);
    }
  });
});
