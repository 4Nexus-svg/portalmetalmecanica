import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import {
  GRUPOS_CARD,
  buscarCards,
  formatarVariacao,
  type GrupoCard,
  type ItemCard,
} from '@/lib/telegram/indicadores';

/**
 * Card de indicadores (PNG 1080x1080) enviado como foto no resumo do Telegram.
 * Um card por grupo: /og/indicadores/financeiros | commodities | regional.
 */

const AZUL = '#1A2B4A';
const DOURADO = '#C9A84C';
const VERDE = '#22C55E';
const VERMELHO = '#EF4444';

export async function GET(_request: Request, { params }: { params: Promise<{ grupo: string }> }) {
  const { grupo } = await params;
  if (!GRUPOS_CARD.includes(grupo as GrupoCard)) return new Response('Not found', { status: 404 });

  const [card] = await buscarCards([grupo as GrupoCard]);
  if (!card) return new Response('Sem dados', { status: 404 });

  const [regular, extraBold, logo] = await Promise.all([
    // Caminhos literais: com caminho variável o Turbopack rastreia o projeto inteiro.
    readFile(join(process.cwd(), 'assets', 'fonts', 'Inter-400.ttf')),
    readFile(join(process.cwd(), 'assets', 'fonts', 'Inter-800.ttf')),
    readFile(join(process.cwd(), 'public', 'logo-variants', 'logo-instagram.png')),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  const data = card.atualizadoEm.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hora = card.atualizadoEm.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: AZUL,
          padding: '64px 72px',
          fontFamily: 'Inter',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src={logoSrc} width={340} height={109} alt="" />
          <div style={{ display: 'flex', fontSize: 30, color: DOURADO, fontWeight: 800 }}>{data}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 52 }}>
          <div style={{ display: 'flex', fontSize: 26, letterSpacing: 4, color: DOURADO, fontWeight: 800 }}>
            INDICADORES DE MERCADO
          </div>
          <div style={{ display: 'flex', fontSize: 62, fontWeight: 800, marginTop: 6 }}>{card.titulo}</div>
          <div style={{ display: 'flex', width: 120, height: 6, background: DOURADO, marginTop: 20 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 22 }}>
          {card.itens.map((item) => (
            <Linha key={item.nome} item={item} />
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '2px solid rgba(255,255,255,0.15)',
            paddingTop: 24,
            fontSize: 24,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          <div style={{ display: 'flex' }}>portalmetalmecanica.com.br/indicadores</div>
          <div style={{ display: 'flex' }}>Atualizado às {hora}</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: extraBold, weight: 800, style: 'normal' },
      ],
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300' },
    }
  );
}

function Linha({ item }: { item: ItemCard }) {
  const cor = item.variacao === null ? null : item.variacao > 0 ? VERDE : item.variacao < 0 ? VERMELHO : '#94A3B8';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: '18px 30px 18px 0',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', width: 8, height: 64, background: DOURADO, marginRight: 30 }} />
        <div style={{ display: 'flex', fontSize: 36, color: 'rgba(255,255,255,0.9)' }}>{item.nome}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 800 }}>{item.valor}</div>
        {item.variacao !== null && cor && (
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, marginTop: 4, color: cor, fontWeight: 800 }}>
            {formatarVariacao(item.variacao)}
            {item.legenda && (
              <span style={{ marginLeft: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 400 }}>{item.legenda}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
