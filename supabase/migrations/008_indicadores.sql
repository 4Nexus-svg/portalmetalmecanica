-- Portal Metalmecanica - Indicadores economicos e de commodities

CREATE TABLE IF NOT EXISTS public.indicadores_snapshots (
  id           SERIAL      PRIMARY KEY,
  slug         TEXT        NOT NULL,
  value        NUMERIC     NOT NULL,
  variation    NUMERIC,
  raw_data     JSONB,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ind_slug_time ON public.indicadores_snapshots(slug, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.indicadores_config (
  slug         TEXT    PRIMARY KEY,
  name         TEXT    NOT NULL,
  group_name   TEXT    NOT NULL,
  unit         TEXT    NOT NULL,
  decimals     INT     NOT NULL DEFAULT 2,
  frequency    TEXT    NOT NULL,
  source_label TEXT    NOT NULL,
  source_url   TEXT,
  description  TEXT,
  active       BOOLEAN NOT NULL DEFAULT true
);

-- RLS: SELECT publico, INSERT/UPDATE apenas service_role
ALTER TABLE public.indicadores_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicadores_config     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ind_snapshots_select" ON public.indicadores_snapshots FOR SELECT USING (true);
CREATE POLICY "ind_snapshots_insert" ON public.indicadores_snapshots FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "ind_config_select" ON public.indicadores_config FOR SELECT USING (true);
CREATE POLICY "ind_config_write"  ON public.indicadores_config FOR ALL
  USING (public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- Seed: configuracao dos 11 indicadores
INSERT INTO public.indicadores_config (slug, name, group_name, unit, decimals, frequency, source_label, source_url, description)
VALUES
('dolar',
 'Dólar (USD/BRL)',
 'Financeiros',
 'R$', 2, 'horária',
 'AwesomeAPI', 'https://docs.awesomeapi.com.br',
 'O dólar é a principal referência para importação de matéria-prima e máquinas no setor metalmecânico. Alta do dólar encarece insumos importados como aço carbono, componentes eletrônicos e equipamentos CNC.'),

('euro',
 'Euro (EUR/BRL)',
 'Financeiros',
 'R$', 2, 'horária',
 'AwesomeAPI', 'https://docs.awesomeapi.com.br',
 'O euro impacta importações de máquinas e tecnologia europeias, especialmente de fornecedores alemães, italianos e espanhóis, que dominam o mercado de equipamentos industriais de precisão.'),

('ibovespa',
 'Ibovespa',
 'Financeiros',
 'pts', 0, 'horária',
 'brapi.dev', 'https://brapi.dev',
 'O Ibovespa reflete o humor do mercado financeiro brasileiro e influencia o acesso a crédito e investimentos nas indústrias listadas. Empresas como Gerdau, Vale e Usiminas fazem parte do índice.'),

('selic',
 'Selic (% a.a.)',
 'Financeiros',
 '% a.a.', 2, 'diária',
 'Banco Central', 'https://www.bcb.gov.br',
 'A taxa Selic é a referência para o custo do crédito industrial no Brasil. Juros altos encarecem financiamentos de expansão, compra de máquinas e capital de giro, impactando diretamente o setor metalmecânico.'),

('petroleo',
 'Petróleo Brent (USD/bbl)',
 'Commodities Industriais',
 'USD/bbl', 2, 'horária',
 'brapi.dev', 'https://brapi.dev',
 'O petróleo Brent é insumo direto na produção de plásticos, lubrificantes e combustíveis usados no setor industrial. Também influencia o custo de frete e logística das cadeias de suprimentos.'),

('minerio',
 'Minério de Ferro (USD/t)',
 'Commodities Industriais',
 'USD/t', 2, 'diária',
 'brapi.dev', 'https://brapi.dev',
 'O minério de ferro é a principal matéria-prima da produção de aço. Seu preço no mercado internacional impacta diretamente o custo do aço para a indústria metalmecânica brasileira, especialmente em MG onde Vale e Usiminas atuam.'),

('aco',
 'Aço HRC (USD/t)',
 'Commodities Industriais',
 'USD/t', 2, 'diária',
 'brapi.dev', 'https://brapi.dev',
 'O aço laminado a quente (HRC) é o principal insumo da indústria metalmecânica. Oscilações no seu preço afetam margens de fabricantes de estruturas metálicas, autopeças, máquinas e equipamentos.'),

('aluminio',
 'Alumínio (USD/t)',
 'Commodities Industriais',
 'USD/t', 2, 'diária',
 'brapi.dev', 'https://brapi.dev',
 'O alumínio é amplamente utilizado na fabricação de estruturas, embalagens industriais e componentes automotivos. ES e MG possuem capacidade instalada relevante de produção e transformação de alumínio.'),

('cobre',
 'Cobre (USD/lb)',
 'Commodities Industriais',
 'USD/lb', 2, 'diária',
 'brapi.dev', 'https://brapi.dev',
 'O cobre é insumo essencial para motores elétricos, transformadores, cabos e sistemas de automação industrial. Seu preço sinaliza a demanda global por eletrificação e infraestrutura.'),

('exportacoes',
 'Exportações ES & MG (US$ mi)',
 'Regional ES & MG',
 'US$ mi', 1, 'mensal',
 'MDIC Comex Stat', 'https://comexstat.mdic.gov.br',
 'O volume de exportações industriais do ES e MG reflete a competitividade do setor. MG lidera com minério de ferro, aço e autopeças; ES exporta principalmente minério, celulose e produtos metalmecânicos via porto de Vitória.'),

('producao',
 'Produção Industrial ES & MG',
 'Regional ES & MG',
 'Índice', 1, 'mensal',
 'IBGE SIDRA', 'https://sidra.ibge.gov.br',
 'O índice de produção industrial (PIM-PF) do ES e MG mede a variação do volume físico produzido pelas indústrias. É o principal termômetro da atividade industrial regional, com impacto direto no emprego e PIB dos estados.')

ON CONFLICT (slug) DO NOTHING;
