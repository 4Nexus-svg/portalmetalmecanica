export type FiltroNoticias = {
  tipo: 'region' | 'category';
  valor: string;
  label: string;
  descricao: string;
};

export const NOTICIAS_FILTROS: Record<string, FiltroNoticias> = {
  es:              { tipo: 'region',   valor: 'ES',         label: 'Espírito Santo',        descricao: 'Notícias do setor industrial capixaba' },
  mg:              { tipo: 'region',   valor: 'MG',         label: 'Minas Gerais',          descricao: 'Notícias do setor industrial mineiro' },
  brasil:          { tipo: 'region',   valor: 'Brasil',     label: 'Brasil Industrial',     descricao: 'Panorama da indústria nacional' },
  economia:        { tipo: 'category', valor: 'Mercado',    label: 'Economia',              descricao: 'Mercado, investimentos e indicadores econômicos' },
  tecnologia:      { tipo: 'category', valor: 'Tecnologia', label: 'Tecnologia',            descricao: 'Inovação, automação e indústria 4.0' },
  sustentabilidade:{ tipo: 'category', valor: 'Energia',    label: 'Sustentabilidade',      descricao: 'Energia, meio ambiente e eficiência energética' },
  seguranca:       { tipo: 'category', valor: 'Industria',  label: 'Segurança do Trabalho', descricao: 'NRs, EPIs e saúde do trabalhador industrial' },
};
