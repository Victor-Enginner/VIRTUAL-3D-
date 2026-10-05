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

// ---------------------------------------------------------------------------------------------------------------------
// Termos de busca por idioma. O Maps entende o idioma em que se escreve: em Portugal vale o vocabulário de Portugal
// ("ginásio", "canalizador") e no Paraguai o espanhol. O que não está aqui usa os termos em português do Brasil acima.
export const TERMOS_POR_IDIOMA = {
  'pt-PT': {
    odontologia: ['dentista', 'implantes dentários', 'ortodontia', 'clínica dentária', 'medicina dentária'],
    clinicas_terapias: ['fisioterapia', 'psicólogo', 'nutricionista', 'quiroprático', 'terapia da fala'],
    estetica: ['clínica de estética', 'harmonização facial', 'micropigmentação', 'depilação a laser', 'massagens'],
    advocacia: ['escritório de advogados', 'advogado', 'gabinete de contabilidade', 'contabilista', 'despachante'],
    educacao_cursos: ['escola de condução', 'escola de idiomas', 'centro de explicações', 'creche', 'escola de música'],
    energia_solar: ['energia solar', 'painéis solares', 'domótica', 'ar condicionado', 'câmaras de segurança'],
    fotografia: ['fotografia', 'fotógrafo', 'estúdio fotográfico', 'filmagem', 'sessão fotográfica'],
    eventos_buffet: ['catering', 'quinta de eventos', 'salão de festas', 'espaço de eventos', 'decoração de festas'],
    marcenaria: ['móveis por medida', 'carpintaria', 'serralharia', 'marmoraria', 'vidraria'],
    moda_noivas: ['loja de noivas', 'aluguer de fatos', 'moda feminina', 'loja de roupa', 'roupa em segunda mão'],
    salao_unhas: ['unhas de gel', 'manicure', 'design de sobrancelhas', 'cabeleireiro', 'extensão de pestanas'],
    academia: ['ginásio', 'crossfit', 'pilates', 'personal trainer', 'estúdio de treino'],
    restaurante: ['restaurante', 'pizzaria', 'hamburgaria', 'snack-bar', 'take-away'],
    padaria: ['padaria', 'pastelaria', 'confeitaria', 'café', 'pastelaria artesanal'],
    acai_lanches: ['açaí', 'gelataria', 'snack-bar', 'food truck', 'creperia'],
    hospedagem_turismo: ['alojamento local', 'hotel', 'pensão', 'parque de campismo', 'turismo rural'],
    pet_shop: ['loja de animais', 'tosquia de animais', 'clínica veterinária', 'veterinário', 'hotel para animais'],
    joalheria_otica: ['joalharia', 'ótica', 'relojoaria', 'perfumaria', 'loja de presentes'],
    oficina: ['oficina mecânica', 'pneus', 'chapa e pintura', 'peças auto', 'lavagem automóvel'],
    construcao_reforma: ['empresa de construção', 'remodelações', 'pintor', 'eletricista', 'canalizador'],
    casa_manutencao: ['desinfestação', 'serralheiro', 'piscinas', 'desentupimentos', 'jardinagem'],
  },
  'es-PY': {
    odontologia: ['dentista', 'implantes dentales', 'ortodoncia', 'clínica odontológica', 'consultorio dental'],
    clinicas_terapias: ['fisioterapia', 'psicólogo', 'nutricionista', 'quiropráctico', 'fonoaudiología'],
    estetica: ['clínica de estética', 'armonización facial', 'micropigmentación', 'depilación láser', 'masajes'],
    advocacia: ['estudio jurídico', 'abogado', 'estudio contable', 'contador', 'gestor'],
    imobiliaria: ['inmobiliaria', 'corredor de inmuebles', 'arquitectura', 'diseño de interiores', 'ingeniería'],
    educacao_cursos: ['autoescuela', 'escuela de idiomas', 'academia de cursos', 'jardín de infantes', 'escuela de música'],
    energia_solar: ['energía solar', 'paneles solares', 'automatización del hogar', 'aire acondicionado', 'cámaras de seguridad'],
    fotografia: ['fotografía', 'fotógrafo', 'estudio fotográfico', 'filmación', 'sesión de fotos'],
    eventos_buffet: ['catering', 'salón de fiestas', 'espacio para eventos', 'quinta para eventos', 'decoración de fiestas'],
    marcenaria: ['muebles a medida', 'carpintería', 'herrería', 'marmolería', 'vidriería'],
    tatuagem: ['estudio de tatuajes', 'tatuador', 'piercing', 'body art'],
    moda_noivas: ['tienda de novias', 'alquiler de trajes', 'moda femenina', 'tienda de ropa', 'ropa usada'],
    barbearia: ['barbería', 'barber shop', 'peluquería para hombres', 'corte de pelo hombre'],
    salao_unhas: ['salón de uñas', 'manicura', 'diseño de cejas', 'peluquería', 'extensión de pestañas'],
    academia: ['gimnasio', 'crossfit', 'pilates', 'entrenador personal', 'estudio de entrenamiento'],
    restaurante: ['restaurante', 'pizzería', 'hamburguesería', 'comidas rápidas', 'delivery de comida'],
    padaria: ['panadería', 'confitería', 'cafetería', 'pastelería', 'tortas'],
    acai_lanches: ['açaí', 'heladería', 'empanadas', 'food truck', 'crepería'],
    hospedagem_turismo: ['hotel', 'posada', 'hostal', 'camping', 'pesquero'],
    pet_shop: ['pet shop', 'peluquería canina', 'clínica veterinaria', 'veterinario', 'hotel para mascotas'],
    joalheria_otica: ['joyería', 'óptica', 'relojería', 'perfumería', 'tienda de regalos'],
    oficina: ['taller mecánico', 'auto center', 'chapería y pintura', 'repuestos', 'lavadero de autos', 'gomería'],
    construcao_reforma: ['constructora', 'reformas', 'pintor', 'electricista', 'plomero'],
    casa_manutencao: ['fumigación', 'cerrajero', 'piscinas', 'destapaciones', 'jardinería'],
  },
};

// termos de busca do nicho no idioma do país; se o nicho não tem tradução, cai nos termos do Brasil
export const termosDoNicho = (id, idioma = 'pt-BR') => TERMOS_POR_IDIOMA[idioma]?.[id] || NICHOS[id]?.termos || [NICHOS[id]?.maps || id];
