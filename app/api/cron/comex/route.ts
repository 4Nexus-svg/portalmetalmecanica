import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://balanca.economia.gov.br/balanca/bd/comexstat-bd/ncm';

// Capítulos SH2 relevantes para indústria + todos os demais também são armazenados,
// mas esses são destacados nas queries do portal
const CAPITULOS_DESC: Record<string, string> = {
  '25': 'Sal, enxofre, terras, pedras, gesso, cal, cimento',
  '26': 'Minérios, escórias e cinzas',
  '27': 'Combustíveis minerais e óleos minerais',
  '28': 'Produtos químicos inorgânicos',
  '29': 'Produtos químicos orgânicos',
  '32': 'Extratos tanantes, pigmentos, tintas',
  '38': 'Produtos diversos das indústrias químicas',
  '39': 'Plásticos e suas obras',
  '40': 'Borracha e suas obras',
  '44': 'Madeira, carvão vegetal e obras de madeira',
  '47': 'Pastas de madeira e celulose',
  '48': 'Papel e cartão',
  '68': 'Obras de pedra, gesso, cimento, amianto',
  '69': 'Produtos cerâmicos',
  '70': 'Vidro e suas obras',
  '72': 'Ferro fundido, ferro e aço',
  '73': 'Obras de ferro fundido, ferro ou aço',
  '74': 'Cobre e suas obras',
  '75': 'Níquel e suas obras',
  '76': 'Alumínio e suas obras',
  '78': 'Chumbo e suas obras',
  '79': 'Zinco e suas obras',
  '80': 'Estanho e suas obras',
  '81': 'Outros metais comuns e ceramais',
  '82': 'Ferramentas e artefatos de cutelaria',
  '83': 'Obras diversas de metais comuns',
  '84': 'Reatores, caldeiras, máquinas e aparelhos mecânicos',
  '85': 'Máquinas, aparelhos e materiais elétricos',
  '86': 'Veículos e material para vias férreas',
  '87': 'Veículos automóveis, tratores e acessórios',
  '88': 'Aeronaves e aparelhos espaciais',
  '89': 'Embarcações e estruturas flutuantes',
  '90': 'Instrumentos de óptica, medida e precisão',
};

const UFS_INTERESSE = new Set(['ES', 'MG']);

function isAutorizado(req: NextRequest): boolean {
  return (
    req.headers.get('x-vercel-cron') === '1' ||
    req.nextUrl.searchParams.get('secret') === process.env.CRON_SECRET
  );
}

type Agregado = Map<string, { vl_fob: number; kg_liquido: number }>;

function chave(tipo: string, uf: string, ano: string, mes: string, cap: string | null) {
  return `${tipo}|${uf}|${ano}|${mes}|${cap ?? '__TOTAL__'}`;
}

async function processarArquivo(tipo: 'EXP' | 'IMP', ano: number, agregado: Agregado) {
  const url = `${BASE_URL}/${tipo}_${ano}.csv`;
  console.log(`[comex] baixando ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(55000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} para ${url}`);

  const text = await res.text();
  const linhas = text.split('\n');
  let processadas = 0;
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const cols = linha.replace(/"/g, '').split(';');
    // CO_ANO;CO_MES;CO_NCM;CO_UNID;CO_PAIS;SG_UF_NCM;CO_VIA;CO_URF;QT_ESTAT;KG_LIQUIDO;VL_FOB
    if (cols.length < 11) continue;
    const uf = cols[5];
    if (!UFS_INTERESSE.has(uf)) continue;

    const coAno = cols[0];
    const coMes = cols[1].padStart(2, '0');
    const cap = cols[2].slice(0, 2);
    const fob = Number(cols[10] || '0');
    const kg = Number(cols[9] || '0');

    const kCap = chave(tipo, uf, coAno, coMes, cap);
    const eCap = agregado.get(kCap) ?? { vl_fob: 0, kg_liquido: 0 };
    eCap.vl_fob += fob;
    eCap.kg_liquido += kg;
    agregado.set(kCap, eCap);

    const kTot = chave(tipo, uf, coAno, coMes, null);
    const eTot = agregado.get(kTot) ?? { vl_fob: 0, kg_liquido: 0 };
    eTot.vl_fob += fob;
    eTot.kg_liquido += kg;
    agregado.set(kTot, eTot);

    processadas++;
  }
  console.log(`[comex] ${tipo} ${ano}: ${processadas} linhas ES/MG processadas`);
}

async function executarComex(ano: number) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const agregado: Agregado = new Map();

  await Promise.all([
    processarArquivo('EXP', ano, agregado),
    processarArquivo('IMP', ano, agregado),
  ]);

  console.log(`[comex] ${agregado.size} combinações tipo/uf/ano/mes/capitulo`);

  // Montar registros para upsert
  const registros = Array.from(agregado.entries()).map(([k, v]) => {
    const [tipo, uf, ano, mes, capRaw] = k.split('|');
    const capitulo = capRaw === '__TOTAL__' ? null : capRaw;
    return {
      tipo,
      uf,
      ano: parseInt(ano),
      mes: parseInt(mes),
      capitulo,
      capitulo_desc: capitulo ? (CAPITULOS_DESC[capitulo] ?? null) : null,
      vl_fob: v.vl_fob,
      kg_liquido: v.kg_liquido,
      updated_at: new Date().toISOString(),
    };
  });

  // Upsert em lotes de 500
  const LOTE = 500;
  let erros = 0;
  for (let i = 0; i < registros.length; i += LOTE) {
    const lote = registros.slice(i, i + LOTE);
    const { error } = await supabase
      .from('indicadores_comex')
      .upsert(lote, { onConflict: 'tipo,uf,ano,mes,capitulo' });
    if (error) { console.error('[comex] upsert erro:', error.message); erros++; }
  }

  console.log(`[comex] concluído: ${registros.length} registros, ${erros} lotes com erro`);
  return { registros: registros.length, erros };
}

export async function GET(req: NextRequest) {
  if (!isAutorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const ano = parseInt(req.nextUrl.searchParams.get('ano') ?? String(new Date().getFullYear()));

  waitUntil(
    executarComex(ano).then(r => console.log('[comex] resultado:', JSON.stringify(r)))
  );

  return NextResponse.json({ status: 'iniciado', ano });
}
