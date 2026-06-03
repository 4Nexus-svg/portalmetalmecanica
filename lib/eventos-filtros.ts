export type TipoEvento = 'feira' | 'congresso' | 'seminario' | 'workshop' | 'treinamento';

export const TIPO_LABELS: Record<TipoEvento, string> = {
  feira:       'Feira',
  congresso:   'Congresso',
  seminario:   'Seminário',
  workshop:    'Workshop',
  treinamento: 'Treinamento',
};

export const TIPO_CORES: Record<TipoEvento, string> = {
  feira:       'bg-orange-100 text-orange-700',
  congresso:   'bg-blue-100 text-blue-700',
  seminario:   'bg-green-100 text-green-700',
  workshop:    'bg-purple-100 text-purple-700',
  treinamento: 'bg-teal-100 text-teal-700',
};

type FiltroEvento = {
  label: string;
  descricao: string;
  tipo?: TipoEvento;
  state?: string;
  todos?: boolean;
};

export const EVENTOS_FILTROS: Record<string, FiltroEvento> = {
  feiras:       { label: 'Feiras',               descricao: 'Feiras industriais e exposições do setor',         tipo: 'feira' },
  congressos:   { label: 'Congressos',            descricao: 'Congressos técnicos e científicos industriais',    tipo: 'congresso' },
  seminarios:   { label: 'Seminários',            descricao: 'Seminários e encontros do setor metalmecânico',    tipo: 'seminario' },
  workshops:    { label: 'Workshops',             descricao: 'Workshops práticos e capacitações técnicas',       tipo: 'workshop' },
  treinamentos: { label: 'Treinamentos',          descricao: 'Cursos e treinamentos para profissionais do setor',tipo: 'treinamento' },
  'agenda-es':  { label: 'Agenda Industrial ES',  descricao: 'Eventos industriais no Espírito Santo',           state: 'ES' },
  'agenda-mg':  { label: 'Agenda Industrial MG',  descricao: 'Eventos industriais em Minas Gerais',             state: 'MG' },
  calendario:   { label: 'Calendário de Eventos', descricao: 'Todos os próximos eventos em ordem cronológica',  todos: true },
};

export const CHIPS_FILTRO = [
  { label: 'Todos',       href: '/eventos' },
  { label: 'Feiras',      href: '/eventos/feiras' },
  { label: 'Congressos',  href: '/eventos/congressos' },
  { label: 'Seminários',  href: '/eventos/seminarios' },
  { label: 'Workshops',   href: '/eventos/workshops' },
  { label: 'Treinamentos',href: '/eventos/treinamentos' },
  { label: 'ES',          href: '/eventos/agenda-es' },
  { label: 'MG',          href: '/eventos/agenda-mg' },
];
