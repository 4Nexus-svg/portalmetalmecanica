/**
 * Popula indicadores_comex com dados do MDIC (Dados Abertos)
 * Uso: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/populate-comex.mjs [ano]
 * Ex:  node scripts/populate-comex.mjs 2024 2025 2026
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nsixodvejuhnsofpavvc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY não definida'); process.exit(1); }

const BASE_URL = 'https://balanca.economia.gov.br/balanca/bd/comexstat-bd/ncm';
const UFS = new Set(['ES', 'MG']);

const CAPITULOS_DESC = {
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

async function processarArquivo(tipo, ano, agregado, tentativa = 1) {
  const url = `${BASE_URL}/${tipo}_${ano}.csv`;
  console.log(`  Baixando ${url}... (tentativa ${tentativa})`);
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(180000) });
  } catch (e) {
    if (tentativa < 3) {
      console.warn(`  Erro, tentando novamente em 5s...`);
      await new Promise(r => setTimeout(r, 5000));
      return processarArquivo(tipo, ano, agregado, tentativa + 1);
    }
    throw e;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const linhas = text.split('\n');
  let proc = 0;
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const cols = linha.replace(/"/g, '').split(';');
    if (cols.length < 11) continue;
    const uf = cols[5];
    if (!UFS.has(uf)) continue;
    const coAno = cols[0];
    const coMes = cols[1].padStart(2, '0');
    const cap = cols[2].slice(0, 2);
    const fob = Number(cols[10] || 0);
    const kg  = Number(cols[9]  || 0);

    // Por capítulo
    const kCap = `${tipo}|${uf}|${coAno}|${coMes}|${cap}`;
    const eCap = agregado.get(kCap) ?? { vl_fob: 0, kg_liquido: 0 };
    eCap.vl_fob += fob; eCap.kg_liquido += kg;
    agregado.set(kCap, eCap);

    // Total do estado/mês
    const kTot = `${tipo}|${uf}|${coAno}|${coMes}|__TOTAL__`;
    const eTot = agregado.get(kTot) ?? { vl_fob: 0, kg_liquido: 0 };
    eTot.vl_fob += fob; eTot.kg_liquido += kg;
    agregado.set(kTot, eTot);

    proc++;
  }
  console.log(`  → ${proc} linhas ES/MG processadas`);
}

async function processarAno(supabase, ano) {
  console.log(`\n=== Ano ${ano} ===`);
  const agregado = new Map();
  // Sequencial para não sobrecarregar o servidor
  await processarArquivo('EXP', ano, agregado);
  await new Promise(r => setTimeout(r, 3000));
  await processarArquivo('IMP', ano, agregado);

  const registros = Array.from(agregado.entries()).map(([k, v]) => {
    const [tipo, uf, anoStr, mes, capRaw] = k.split('|');
    const capitulo = capRaw === '__TOTAL__' ? null : capRaw;
    return {
      tipo, uf,
      ano: parseInt(anoStr),
      mes: parseInt(mes),
      capitulo,
      capitulo_desc: capitulo ? (CAPITULOS_DESC[capitulo] ?? null) : null,
      vl_fob: v.vl_fob,
      kg_liquido: v.kg_liquido,
      updated_at: new Date().toISOString(),
    };
  });

  console.log(`  Upserting ${registros.length} registros...`);
  const LOTE = 500;
  let erros = 0;
  for (let i = 0; i < registros.length; i += LOTE) {
    const { error } = await supabase
      .from('indicadores_comex')
      .upsert(registros.slice(i, i + LOTE), { onConflict: 'tipo,uf,ano,mes,capitulo' });
    if (error) { console.error('  Erro lote:', error.message); erros++; }
    process.stdout.write(`\r  Progresso: ${Math.min(i + LOTE, registros.length)}/${registros.length}   `);
  }
  console.log(`\n  ✓ Concluído: ${registros.length} registros, ${erros} erros`);
}

async function main() {
  const anos = process.argv.slice(2).map(Number).filter(Boolean);
  if (anos.length === 0) { console.error('Informe os anos: node populate-comex.mjs 2024 2025 2026'); process.exit(1); }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  for (const ano of anos) {
    await processarAno(supabase, ano);
  }
  console.log('\n=== Todos os anos concluídos ===');
}

main().catch(console.error);
