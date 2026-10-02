// Validador dos contratos TOCOMAS (contratos.schema.json). Cobre só o pedaço do JSON Schema que os
// contratos usam: type, enum, required, properties, additionalProperties:false, items, minItems,
// minimum, maximum, $ref local e format date-time. Palavra-chave desconhecida = erro (nada passa calado).
import fs from 'node:fs';

const SCHEMA = JSON.parse(fs.readFileSync(new URL('./contratos.schema.json', import.meta.url), 'utf8'));
const CONHECIDAS = new Set(['type', 'enum', 'required', 'properties', 'additionalProperties', 'items', 'minItems', 'minimum', 'maximum', '$ref', 'format', 'description']);
const DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const tipoDe = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const casaTipo = (v, t) => tipoDe(v) === t || (t === 'number' && typeof v === 'number');

function checar(esquema, v, caminho, erros) {
  if (esquema.$ref) {
    const nome = esquema.$ref.replace('#/$defs/', '');
    if (!SCHEMA.$defs[nome]) throw new Error(`$ref desconhecido: ${esquema.$ref}`);
    return checar(SCHEMA.$defs[nome], v, caminho, erros);
  }
  for (const k of Object.keys(esquema)) if (!CONHECIDAS.has(k)) throw new Error(`palavra-chave não suportada: ${k}`);
  if (esquema.type) {
    const tipos = [].concat(esquema.type);
    if (!tipos.some((t) => casaTipo(v, t))) { erros.push(`${caminho}: esperado ${tipos.join('|')}, veio ${tipoDe(v)}`); return; }
  }
  if (esquema.enum && !esquema.enum.includes(v)) erros.push(`${caminho}: "${v}" fora de ${esquema.enum.join('|')}`);
  if (esquema.format === 'date-time' && typeof v === 'string' && !DATA_HORA.test(v)) erros.push(`${caminho}: data-hora inválida`);
  if (typeof v === 'number') {
    if (esquema.minimum != null && v < esquema.minimum) erros.push(`${caminho}: menor que ${esquema.minimum}`);
    if (esquema.maximum != null && v > esquema.maximum) erros.push(`${caminho}: maior que ${esquema.maximum}`);
  }
  if (Array.isArray(v)) {
    if (esquema.minItems != null && v.length < esquema.minItems) erros.push(`${caminho}: precisa de ${esquema.minItems}+ itens`);
    if (esquema.items) v.forEach((x, i) => checar(esquema.items, x, `${caminho}[${i}]`, erros));
  }
  if (tipoDe(v) === 'object') {
    for (const r of esquema.required || []) if (!(r in v)) erros.push(`${caminho}.${r}: obrigatório`);
    const props = esquema.properties || {};
    for (const [k, x] of Object.entries(v)) {
      if (props[k]) checar(props[k], x, `${caminho}.${k}`, erros);
      else if (esquema.additionalProperties === false) erros.push(`${caminho}.${k}: campo não previsto`);
    }
  }
}

export const CONTRATOS = Object.keys(SCHEMA.$defs);

export function validar(nome, obj) {
  if (!SCHEMA.$defs[nome]) throw new Error(`contrato desconhecido: ${nome}`);
  const erros = [];
  checar(SCHEMA.$defs[nome], obj, nome, erros);
  return { ok: !erros.length, erros };
}

// para pontos do código onde um contrato quebrado é bug (não dado ruim de fora)
export function exigir(nome, obj) {
  const r = validar(nome, obj);
  if (!r.ok) throw new Error(`contrato ${nome} quebrado: ${r.erros.slice(0, 3).join('; ')}`);
  return obj;
}
