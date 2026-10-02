// Nichos que os agentes sabem varrer. `maps` é o termo de busca no Google Maps;
// `osm` são as tags do OpenStreetMap (https://wiki.openstreetmap.org/wiki/Map_features).
export const NICHOS = {
  odontologia: { rotulo: 'Odontologia & Implantes', maps: 'dentista', osm: [['amenity', 'dentist'], ['healthcare', 'dentist']] },
  estetica: { rotulo: 'Clínica de estética', maps: 'clínica de estética', osm: [['shop', 'beauty'], ['amenity', 'clinic']] },
  advocacia: { rotulo: 'Advocacia', maps: 'escritório de advocacia', osm: [['office', 'lawyer']] },
  imobiliaria: { rotulo: 'Imobiliária', maps: 'imobiliária', osm: [['office', 'estate_agent']] },
  energia_solar: { rotulo: 'Energia solar', maps: 'energia solar', osm: [['craft', 'photovoltaic'], ['shop', 'solar']] },
  barbearia: { rotulo: 'Barbearia', maps: 'barbearia', osm: [['shop', 'hairdresser']] },
  salao_unhas: { rotulo: 'Salão de unhas', maps: 'salão de unhas', osm: [['shop', 'beauty'], ['beauty', 'nails']] },
  academia: { rotulo: 'Academia', maps: 'academia', osm: [['leisure', 'fitness_centre']] },
  pet_shop: { rotulo: 'Pet shop', maps: 'pet shop', osm: [['shop', 'pet'], ['amenity', 'veterinary']] },
  restaurante: { rotulo: 'Restaurante', maps: 'restaurante', osm: [['amenity', 'restaurant']] },
  padaria: { rotulo: 'Padaria', maps: 'padaria', osm: [['shop', 'bakery']] },
  oficina: { rotulo: 'Oficina mecânica', maps: 'oficina mecânica', osm: [['shop', 'car_repair']] },
};

export const FONTES = { maps: 'Google Maps (navegador local)', osm: 'OpenStreetMap (Overpass)' };
