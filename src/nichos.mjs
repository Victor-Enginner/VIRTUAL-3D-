// Nichos que os agentes sabem varrer, organizados nos 4 grupos do Repass (backend/osm_engine.py e src/views/LeadsView.jsx).
// Cada nicho é um PACOTE de termos de busca: o Atlas roda até TERMOS_MAPS_POR_VARREDURA deles no Google Maps (e todas as tags no
// OpenStreetMap), então "Odontologia" acha dentista, ortodontia, implante… e não só uma palavra.
//   termos: buscas no Maps, do mais geral ao mais específico (o primeiro vale como `maps`, por compatibilidade)
//   osm:    tags do OpenStreetMap (https://wiki.openstreetmap.org/wiki/Map_features)
// Os ids antigos (odontologia, estetica, advocacia…) continuam valendo: leads e varreduras já gravados usam eles.

export const GRUPOS = {
  decisao_cara: '1 · Decisão cara — o cliente pesquisa antes',
  vende_mostrando: '2 · Vende mostrando — precisa de portfólio',
  agendamento_cardapio: '3 · Agendamento e cardápio — tira trabalho do dono',
  urgencia: '4 · Urgência — aqui o site pesa menos',
};

// Quantos termos o Atlas usa por varredura no Maps (cada um abre uma busca; o limite de leads se divide entre eles).
export const TERMOS_MAPS_POR_VARREDURA = 3;

const n = (grupo, rotulo, termos, osm, extra = {}) => ({ grupo, rotulo, termos, maps: termos[0], osm, ...extra });

export const NICHOS = {
  // ---- 1 · Decisão cara
  odontologia: n('decisao_cara', 'Odontologia & Implantes', ['dentista', 'implante dentário', 'ortodontia', 'clínica odontológica', 'aparelho dentário'], [['amenity', 'dentist'], ['healthcare', 'dentist']]),
  clinicas_terapias: n('decisao_cara', 'Clínicas & Terapias', ['fisioterapia', 'psicólogo', 'nutricionista', 'quiropraxia', 'fonoaudiologia'], [['healthcare', 'physiotherapist'], ['healthcare', 'psychotherapist'], ['healthcare', 'nutrition_counselling'], ['amenity', 'clinic']]),
  estetica: n('decisao_cara', 'Estética avançada', ['clínica de estética', 'harmonização facial', 'micropigmentação', 'depilação a laser', 'massoterapia'], [['shop', 'beauty'], ['shop', 'massage'], ['leisure', 'spa'], ['amenity', 'clinic']]),
  advocacia: n('decisao_cara', 'Advocacia & Contabilidade', ['escritório de advocacia', 'advogado', 'escritório contábil', 'contabilidade', 'despachante'], [['office', 'lawyer'], ['office', 'accountant']]),
  imobiliaria: n('decisao_cara', 'Imobiliária & Arquitetura', ['imobiliária', 'corretor de imóveis', 'arquitetura', 'design de interiores', 'engenharia'], [['office', 'estate_agent'], ['office', 'architect']]),
  educacao_cursos: n('decisao_cara', 'Educação & Cursos', ['autoescola', 'escola de idiomas', 'curso profissionalizante', 'escola infantil', 'escola de música'], [['amenity', 'driving_school'], ['amenity', 'language_school'], ['amenity', 'music_school'], ['amenity', 'kindergarten']]),
  energia_solar: n('decisao_cara', 'Energia solar & Automação', ['energia solar', 'automação residencial', 'ar condicionado', 'câmeras de segurança', 'alarmes'], [['craft', 'photovoltaic'], ['shop', 'solar'], ['craft', 'electrician'], ['craft', 'hvac']]),

  // ---- 2 · Vende mostrando
  fotografia: n('vende_mostrando', 'Fotografia & Filmagem', ['fotografia', 'fotógrafo', 'estúdio fotográfico', 'filmagem', 'ensaio fotográfico'], [['shop', 'photo'], ['craft', 'photographer']]),
  eventos_buffet: n('vende_mostrando', 'Eventos & Buffet', ['buffet', 'salão de festas', 'espaço de eventos', 'chácara para eventos', 'decoração de festas'], [['amenity', 'events_venue'], ['craft', 'caterer'], ['amenity', 'social_centre']]),
  marcenaria: n('vende_mostrando', 'Marcenaria & Planejados', ['móveis planejados', 'marcenaria', 'serralheria', 'marmoraria', 'vidraçaria'], [['craft', 'carpenter'], ['shop', 'furniture'], ['craft', 'metal_construction'], ['craft', 'glaziery']]),
  tatuagem: n('vende_mostrando', 'Tatuagem & Body Art', ['estúdio de tatuagem', 'tatuador', 'piercing', 'body art'], [['shop', 'tattoo']]),
  moda_noivas: n('vende_mostrando', 'Moda & Noivas', ['loja de noivas', 'aluguel de trajes', 'moda feminina', 'loja de roupas', 'brechó'], [['shop', 'wedding'], ['shop', 'clothes'], ['shop', 'boutique']]),

  // ---- 3 · Agendamento e cardápio
  barbearia: n('agendamento_cardapio', 'Barbearia & Estilo VIP', ['barbearia', 'barber shop', 'salão masculino', 'corte masculino'], [['shop', 'hairdresser'], ['craft', 'hairdresser']]),
  salao_unhas: n('agendamento_cardapio', 'Salão, Unhas & Sobrancelhas', ['salão de unhas', 'manicure', 'design de sobrancelhas', 'cabeleireiro', 'lash designer'], [['shop', 'beauty'], ['beauty', 'nails'], ['shop', 'hairdresser']]),
  academia: n('agendamento_cardapio', 'Academias & Fitness', ['academia', 'crossfit', 'pilates', 'personal trainer', 'studio de treino'], [['leisure', 'fitness_centre']]),
  restaurante: n('agendamento_cardapio', 'Restaurantes & Delivery', ['restaurante', 'pizzaria', 'hamburgueria', 'lanchonete', 'marmitaria'], [['amenity', 'restaurant'], ['amenity', 'fast_food']]),
  padaria: n('agendamento_cardapio', 'Padaria, Doces & Café', ['padaria', 'confeitaria', 'cafeteria', 'doceria', 'casa de bolos'], [['shop', 'bakery'], ['shop', 'confectionery'], ['shop', 'pastry'], ['amenity', 'cafe']]),
  acai_lanches: n('agendamento_cardapio', 'Açaí, Sorvete & Lanches', ['açaí', 'sorveteria', 'pastelaria', 'food truck', 'creperia'], [['amenity', 'ice_cream'], ['shop', 'ice_cream'], ['amenity', 'fast_food']]),
  hospedagem_turismo: n('agendamento_cardapio', 'Hospedagem & Turismo', ['pousada', 'hotel', 'chácara de hospedagem', 'camping', 'pesqueiro'], [['tourism', 'guest_house'], ['tourism', 'hotel'], ['tourism', 'camp_site']]),
  pet_shop: n('agendamento_cardapio', 'Pet Shop & Veterinária', ['pet shop', 'banho e tosa', 'clínica veterinária', 'veterinário', 'hotel para pets'], [['shop', 'pet'], ['shop', 'pet_grooming'], ['amenity', 'veterinary']]),
  joalheria_otica: n('agendamento_cardapio', 'Joalheria, Ótica & Presentes', ['joalheria', 'ótica', 'relojoaria', 'perfumaria', 'loja de presentes'], [['shop', 'jewelry'], ['shop', 'optician'], ['shop', 'perfumery'], ['shop', 'gift']]),

  // ---- 4 · Urgência
  oficina: n('urgencia', 'Automotivo', ['oficina mecânica', 'auto center', 'funilaria', 'autopeças', 'lava rápido', 'borracharia'], [['shop', 'car_repair'], ['shop', 'car_parts'], ['amenity', 'car_wash'], ['shop', 'tyres']]),
  construcao_reforma: n('urgencia', 'Construção & Reforma', ['construtora', 'reforma', 'pintura predial', 'eletricista', 'encanador'], [['craft', 'builder'], ['office', 'construction_company'], ['craft', 'painter'], ['craft', 'electrician'], ['craft', 'plumber']]),
  casa_manutencao: n('urgencia', 'Casa & Manutenção', ['dedetizadora', 'chaveiro', 'piscinas', 'desentupidora', 'jardinagem'], [['craft', 'key_cutter'], ['shop', 'locksmith'], ['craft', 'gardener'], ['shop', 'swimming_pool']]),
};

export const FONTES = { maps: 'Google Maps (navegador local)', osm: 'OpenStreetMap (Overpass)' };

// Para o formulário: os 4 grupos com os nichos de cada um.
export function catalogo() {
  return Object.entries(GRUPOS).map(([id, rotulo]) => ({
    id, rotulo,
    nichos: Object.entries(NICHOS).filter(([, x]) => x.grupo === id).map(([k, x]) => ({ id: k, rotulo: x.rotulo, termos: x.termos })),
  }));
}
export const nichosDoGrupo = (grupo) => Object.entries(NICHOS).filter(([, x]) => x.grupo === grupo).map(([k]) => k);
