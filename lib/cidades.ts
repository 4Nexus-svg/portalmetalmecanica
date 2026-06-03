export const CIDADES_POR_ESTADO: Record<string, string[]> = {
  ES: [
    "Aracruz", "Cachoeiro de Itapemirim", "Cariacica", "Colatina",
    "Guarapari", "Linhares", "São Mateus", "Serra", "Vila Velha", "Vitória",
  ],
  MG: [
    "Araxá", "Belo Horizonte", "Betim", "Contagem", "Coronel Fabriciano",
    "Divinópolis", "Governador Valadares", "Ipatinga", "Itabira", "Itajubá",
    "Juiz de Fora", "Montes Claros", "Ouro Preto", "Poços de Caldas",
    "Sete Lagoas", "Timóteo", "Uberlândia", "Uberaba", "Varginha",
  ],
  SP: [
    "Americana", "Bauru", "Campinas", "Diadema", "Guarulhos",
    "Indaiatuba", "Jundiaí", "Limeira", "Mauá", "Osasco",
    "Piracicaba", "Ribeirão Preto", "Santo André", "São Bernardo do Campo",
    "São Caetano do Sul", "São José do Rio Preto", "São José dos Campos",
    "São Paulo", "Sorocaba", "Taubaté",
  ],
  RJ: [
    "Campos dos Goytacazes", "Duque de Caxias", "Macaé", "Niterói",
    "Nova Iguaçu", "Petrópolis", "Resende", "Rio de Janeiro",
    "São Gonçalo", "Volta Redonda",
  ],
  PR: [
    "Araucária", "Cascavel", "Colombo", "Curitiba", "Foz do Iguaçu",
    "Guarapuava", "Londrina", "Maringá", "Paranaguá",
    "Ponta Grossa", "São José dos Pinhais",
  ],
  RS: [
    "Caxias do Sul", "Canoas", "Gravataí", "Novo Hamburgo", "Passo Fundo",
    "Pelotas", "Porto Alegre", "Santa Maria", "São Leopoldo", "Viamão",
  ],
  SC: [
    "Blumenau", "Chapecó", "Criciúma", "Florianópolis", "Indaial",
    "Itajaí", "Jaraguá do Sul", "Joinville", "Navegantes", "São José",
  ],
  BA: [
    "Camaçari", "Feira de Santana", "Ilhéus", "Itabuna",
    "Lauro de Freitas", "Salvador", "Simões Filho", "Vitória da Conquista",
  ],
  GO: [
    "Águas Lindas de Goiás", "Anápolis", "Aparecida de Goiânia",
    "Goiânia", "Luziânia", "Rio Verde",
  ],
  DF: [
    "Brasília", "Ceilândia", "Gama", "Planaltina", "Samambaia", "Taguatinga",
  ],
};

export const ESTADOS = Object.keys(CIDADES_POR_ESTADO).sort();
