-- Tabela de colunistas
CREATE TABLE public.columnists (
  id            SERIAL      PRIMARY KEY,
  nome          TEXT        NOT NULL,
  slug          TEXT        UNIQUE NOT NULL,
  cargo         TEXT,
  especialidade TEXT,
  bio           TEXT,
  iniciais      TEXT,
  cor           TEXT,
  foto_url      TEXT,
  ativo         BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.columnists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "columnists_select" ON public.columnists FOR SELECT USING (ativo = true OR public.is_admin());
CREATE POLICY "columnists_write"  ON public.columnists FOR ALL   USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.columnists TO anon, authenticated;
GRANT ALL    ON public.columnists TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.columnists_id_seq TO service_role;

-- Seed: migrar colunistas hardcoded
INSERT INTO public.columnists (nome, slug, cargo, especialidade, bio, iniciais, cor) VALUES
  ('Ricardo Mendonça',     'ricardo-mendonca',       'Engenheiro de Automação Industrial', 'Automação & Indústria 4.0',     'Mais de 20 anos de experiência em automação industrial. Especialista em CLP, SCADA e sistemas de controle para grandes plantas industriais do ES e MG.', 'RM', 'bg-blue-700'),
  ('Fernanda Castelo',     'fernanda-castelo',        'Diretora de Operações',              'Gestão Industrial & Lean',      'Especialista em Lean Manufacturing e TPM. Consultora para indústrias de médio e grande porte. Doutora em Engenharia de Produção pela UFMG.', 'FC', 'bg-amber-700'),
  ('Carlos Drummond Neto', 'carlos-drummond-neto',    'Especialista em Soldagem',           'Soldagem & Metalurgia',         'Inspetor de soldagem nível 3 pelo IIW. Colunista técnico especializado em processos de soldagem MIG, TIG, SAW e soldagem robotizada.', 'CD', 'bg-orange-700'),
  ('Patrícia Sousa',       'patricia-sousa',          'Analista de Mercado Industrial',     'Mercado & Investimentos',       'Economista especializada no setor industrial de ES e MG. Acompanha indicadores de produção, emprego e investimentos na indústria regional há 15 anos.', 'PS', 'bg-green-700'),
  ('Marcos Vinicius Teixeira', 'marcos-vinicius-teixeira', 'Técnico em Manutenção Industrial', 'Manutenção Preditiva',      '30 anos de chão de fábrica. Referência em manutenção preditiva, análise de vibração e termografia industrial. Voz dos técnicos no portal.', 'MV', 'bg-red-700'),
  ('Juliana Faria',        'juliana-faria',           'Consultora em Qualidade',            'ISO 9001 & Qualidade Industrial','Auditora líder ISO 9001 e ISO 14001. Consultora em sistemas de gestão da qualidade para o setor metal-mecânico e de bebidas.', 'JF', 'bg-purple-700'),
  ('André Lopes',          'andre-lopes',             'Engenheiro Eletricista',             'Energia & Eficiência Energética','Especialista em eficiência energética industrial. Projetos de redução de consumo e geração distribuída para indústrias de grande porte em MG.', 'AL', 'bg-yellow-700'),
  ('Renata Oliveira',      'renata-oliveira',         'Especialista em RH Industrial',      'Carreira & Mercado de Trabalho','Head de RH com foco no setor industrial. Especialista em atração de talentos técnicos, salários do setor e desenvolvimento de lideranças industriais.', 'RO', 'bg-pink-700'),
  ('Fábio Nascimento',     'fabio-nascimento',        'Especialista em Logística Industrial','Supply Chain & Logística',     '15 anos em supply chain industrial. Especialista em gestão de estoques, logística de insumos e distribuição para o setor metalmecânico.', 'FN', 'bg-teal-700'),
  ('Wellington Costa',     'wellington-costa',        'Especialista em Segurança do Trabalho','NRs & Segurança Industrial',  'Técnico e engenheiro de segurança do trabalho com 25 anos de experiência. Especialista nas NRs do setor metalmecânico e petroquímico.', 'WC', 'bg-slate-700');
