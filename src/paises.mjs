// Países em que o Prospector sabe prospectar: o que muda de um para outro (telefone, idioma das mensagens, busca no Maps e no OSM).
// Brasil é o padrão: tudo que não diz `pais` continua valendo para o Brasil.
import { normalizarTelefone as normalizarTelefoneBR } from './regras.mjs';

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const SEM = { telefone: null, tipo: null };

// Portugal: +351, 9 dígitos. Móvel: 91, 92, 93, 96. Fixo: começa por 2.
export function normalizarTelefonePT(bruto) {
  let d = soDigitos(bruto);
  if (!d) return SEM;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('351') && d.length === 12) d = d.slice(3);
  if (d.length !== 9) return SEM;
  if (/^9[1236]/.test(d)) return { telefone: `351${d}`, tipo: 'celular' };
  if (/^2\d/.test(d)) return { telefone: `351${d}`, tipo: 'fixo' };
  return SEM; // 30x/70x/80x: números de serviço, não de cliente
}

// Paraguai: +595. Móvel: 9 dígitos começando por 96, 97, 98 ou 99 (em formato nacional leva um 0 na frente: 0981 123 456).
// Fixo: código de área (2 a 3 dígitos, ex.: 21 = Asunción) + 6 ou 7 dígitos.
export function normalizarTelefonePY(bruto) {
  let d = soDigitos(bruto);
  if (!d) return SEM;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('595')) d = d.slice(3);
  d = d.replace(/^0+/, '');
  if (/^9[6-9]\d{7}$/.test(d)) return { telefone: `595${d}`, tipo: 'celular' };
  if (/^[2-8]\d{7,8}$/.test(d)) return { telefone: `595${d}`, tipo: 'fixo' };
  return SEM;
}

export const PAISES = {
  BR: {
    id: 'BR', nome: 'Brasil', ddi: '55', idioma: 'pt-BR', regiao: 'Estado', preposicao: 'em',
    normalizarTelefone: normalizarTelefoneBR,
    maps: { hl: 'pt-BR', gl: 'br', avaliacao: 'avalia' },
    osm: { iso: 'BR', nivel: '8' }, // município
  },
  PT: {
    id: 'PT', nome: 'Portugal', ddi: '351', idioma: 'pt-PT', regiao: 'Distrito', preposicao: 'em',
    normalizarTelefone: normalizarTelefonePT,
    maps: { hl: 'pt-PT', gl: 'pt', avaliacao: 'avalia' },
    osm: { iso: 'PT', nivel: '7' }, // concelho (município); 6 = distrito, 8 = freguesia
  },
  PY: {
    id: 'PY', nome: 'Paraguai', nomeLocal: 'Paraguay', ddi: '595', idioma: 'es-PY', regiao: 'Departamento', preposicao: 'en',
    normalizarTelefone: normalizarTelefonePY,
    maps: { hl: 'es-419', gl: 'py', avaliacao: 'reseñ' },
    osm: { iso: 'PY', nivel: '6|8' }, // distrito/município: o nível varia no OSM do Paraguai, aceita 6 ou 8
  },
};

export const PAIS_PADRAO = 'BR';
export const codigoDoPais = (p) => (PAISES[String(p || PAIS_PADRAO).toUpperCase()] ? String(p || PAIS_PADRAO).toUpperCase() : PAIS_PADRAO);
export const paisDe = (p) => PAISES[codigoDoPais(p)];
export const normalizarTelefoneDoPais = (bruto, pais) => paisDe(pais).normalizarTelefone(bruto);
