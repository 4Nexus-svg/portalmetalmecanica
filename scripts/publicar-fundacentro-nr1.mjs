import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nsixodvejuhnsofpavvc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const fonteUrl = 'https://www.gov.br/fundacentro/pt-br/comunicacao/noticias/noticias/2026/maio/fundacentro-lanca-diretrizes-para-aplicar-nr-1-com-inclusao-dos-riscos-psicossociais';

const conteudo = `<p>A Fundacentro lançou publicação com diretrizes para aplicar a Norma Regulamentadora NR-1 com a inclusão dos riscos psicossociais no ambiente de trabalho. O novo texto da norma, que passou a vigorar em 26 de maio de 2026, impõe às empresas a obrigação de identificar, avaliar e controlar os riscos psicossociais como parte do Programa de Gerenciamento de Riscos (PGR).</p>

<p>Sob a coordenação da médica e pesquisadora da Fundacentro, Maria Maeno, a publicação <em>Diretrizes para Aplicar a NR-1 com a Inclusão dos Riscos Psicossociais: analisar a organização e gestão do trabalho para intervir</em> oferece fundamentos teóricos, conceituais e práticos para que empresas do setor industrial possam cumprir a norma e promover ambientes de trabalho mais saudáveis.</p>

<p>A obra é dividida em cinco capítulos: riscos psicossociais como fatores derivados de processos de trabalho; disposições gerais da NR-1 sobre processos psicossociais à luz de normas nacionais e internacionais; participação ativa dos trabalhadores para um ambiente mais saudável; o poder de agir dos trabalhadores na promoção da saúde e prevenção do adoecimento físico e mental; e um capítulo de perguntas e respostas elaborado a partir de dúvidas levantadas em eventos com os autores.</p>

<p>A publicação destaca que um aspecto essencial é a participação dos trabalhadores em todo o processo de gerenciamento de riscos psicossociais, que são derivados das condições de organização e gestão do trabalho. Entre os fatores de risco abordados estão jornadas excessivas, pressão por metas, assédio moral, falta de autonomia e insegurança no emprego — todos reconhecidos como causas de adoecimento mental e físico na indústria.</p>

<p>O trabalho foi desenvolvido em parceria entre a Fundacentro, o Instituto Walter Leser da Fundação Escola de Sociologia e Política de São Paulo e o Núcleo Semente — Saúde Mental e Direitos Humanos Relacionados ao Trabalho, do Instituto Sedes Sapientiae. A publicação está disponível na biblioteca digital da Fundacentro, acessível pelo portal gov.br/Fundacentro.</p>

<p>Para o setor metalmecânico, a nova exigência da NR-1 representa um desafio concreto: as empresas precisarão revisar seus PGRs para incluir a avaliação dos riscos psicossociais, envolver equipes de saúde e segurança do trabalho nesse processo e documentar as medidas adotadas. Empresas que não adequarem seus programas estão sujeitas a autuações fiscais e processos trabalhistas.</p>`;

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: existe } = await supabase.from('posts').select('id').eq('fonte_url', fonteUrl).maybeSingle();
  if (existe) { console.log('Já publicado.'); return; }

  const titulo = 'Fundacentro lança diretrizes para aplicar NR-1 com riscos psicossociais';
  const slugBase = slugify(titulo);
  let slug = slugBase, t = 0;
  while (true) {
    const { data } = await supabase.from('posts').select('id').eq('slug', slug).maybeSingle();
    if (!data) break;
    slug = `${slugBase}-${++t}`;
  }

  const { error } = await supabase.from('posts').insert({
    slug,
    title: titulo,
    excerpt: 'Novo texto da NR-1, em vigor desde 26 de maio, exige que empresas identifiquem e controlem riscos psicossociais no PGR. Fundacentro disponibiliza guia prático.',
    content: conteudo,
    featured_image: null,
    category: 'Legislacao',
    region: 'Brasil',
    author_id: null,
    published_at: '2026-05-26T01:09:38+00:00',
    is_exclusive: false,
    fonte_url: fonteUrl,
    fonte_nome: 'Fundacentro',
    is_auto: true,
  });

  if (error) { console.error('Erro:', error.message); process.exit(1); }
  console.log('Publicado com slug:', slug);
}

main().catch(console.error);
