// Estados/regiões e municípios por país + corretor de digitação.
//   BR: IBGE (27 estados, 5.571 municípios)  ·  PT: distritos e concelhos  ·  PY: departamentos e municípios (Wikidata; valida e corrige nomes,
//   não é o cadastro oficial). Serve para: validar a cidade de uma busca, achar a região quando o Victor não diz ("Franca" só existe em SP)
//   e consertar erro de escrita ou de reconhecimento de voz ("Ribeirão Preot" → "Ribeirão Preto").
// Sem `pais`, tudo continua valendo para o Brasil.
import fs from 'node:fs';

const ARQUIVOS = { BR: 'localidades.json', PT: 'localidades-PT.json', PY: 'localidades-PY.json' };
export const PAISES_COM_LOCALIDADES = Object.keys(ARQUIVOS);

export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/['’`´]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function construir(dados) {
  const indice = new Map();
  const lista = [];
  for (const [uf, nomes] of Object.entries(dados.municipios)) {
    for (const cidade of nomes) {
      const n = normalizar(cidade);
      const item = { cidade, uf, n };
      lista.push(item);
      indice.set(n, [...(indice.get(n) || []), item]);
    }
  }
  const porNomeUf = new Map(dados.estados.flatMap((e) => [[normalizar(e.nome), e.sigla], [e.sigla.toLowerCase(), e.sigla]]));
  return { dados, indice, lista, porNomeUf, estados: dados.estados, ufs: dados.estados.map((e) => e.sigla) };
}

const CACHE = new Map();
function base(pais = 'BR') {
  const p = String(pais || 'BR').toUpperCase();
  if (!ARQUIVOS[p]) throw new Error(`país sem lista de cidades: ${pais}`);
  if (!CACHE.has(p)) CACHE.set(p, construir(JSON.parse(fs.readFileSync(new URL(`./dados/${ARQUIVOS[p]}`, import.meta.url), 'utf8'))));
  return CACHE.get(p);
}

export const ESTADOS = base('BR').estados;
export const UFS = base('BR').ufs;
export const estadosDe = (pais = 'BR') => base(pais).estados;
export const totalMunicipios = (pais = 'BR') => base(pais).lista.length;
export const cidadesDe = (uf, pais = 'BR') => (base(pais).dados.municipios[String(uf).toUpperCase()] || []).slice();

// "são paulo", "sp", "SÃO PAULO (SP)" → "SP"
export const resolverUF = (texto, pais = 'BR') => base(pais).porNomeUf.get(normalizar(String(texto ?? '').replace(/\([A-Za-z]{2,3}\)/, ''))) || null;

// distância de Damerau-Levenshtein (troca de letras vizinhas conta 1: "preot" → "preto")
function distancia(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
const limiteDe = (n) => (n <= 4 ? 0 : n <= 7 ? 1 : 2); // nomes curtos não admitem erro: "Poá" ≠ "Pau"

// Devolve { ok, cidade, uf, corrigido, motivo, sugestoes }.
//  ok + corrigido=false → nome exato.  ok + corrigido=true → achamos UM candidato claro (ex.: Preot→Preto).
//  ok=false → ambíguo (mesmo nome em várias regiões) ou desconhecido; `sugestoes` traz até 5 opções.
export function resolverCidade(texto, ufDica = null, pais = 'BR') {
  const b = base(pais);
  const uf = ufDica ? (resolverUF(ufDica, pais) || String(ufDica).toUpperCase()) : null;
  const n = normalizar(texto);
  if (!n) return { ok: false, motivo: 'vazia', sugestoes: [] };
  const doEstado = (itens) => (uf ? itens.filter((i) => i.uf === uf) : itens);

  const exatos = doEstado(b.indice.get(n) || []);
  if (exatos.length === 1) return { ok: true, cidade: exatos[0].cidade, uf: exatos[0].uf, corrigido: false, ufInferida: !uf };
  if (exatos.length > 1) return { ok: false, motivo: 'ambigua', sugestoes: exatos.map(({ cidade, uf: u }) => ({ cidade, uf: u })).slice(0, 5) };

  const lim = limiteDe(n.length);
  const achados = [];
  for (const it of doEstado(b.lista)) {
    const dist = distancia(n, it.n, lim);
    if (dist <= lim) achados.push({ cidade: it.cidade, uf: it.uf, dist });
    else if (it.n.startsWith(n) && n.length >= 5) achados.push({ cidade: it.cidade, uf: it.uf, dist: lim + 1 }); // "ribeirao pre" → começo do nome
  }
  achados.sort((a, c) => a.dist - c.dist || a.cidade.localeCompare(c.cidade, 'pt-BR'));
  const sugestoes = achados.slice(0, 5).map(({ cidade, uf: u }) => ({ cidade, uf: u }));
  const melhor = achados[0];
  if (melhor && melhor.dist <= lim && (achados.length === 1 || achados[1].dist > melhor.dist)) {
    return { ok: true, cidade: melhor.cidade, uf: melhor.uf, corrigido: true, sugestoes, ufInferida: !uf };
  }
  return { ok: false, motivo: achados.length ? 'incerta' : 'desconhecida', sugestoes };
}

// Frase para o Victor quando a cidade não foi aceita (vale para a API e para o comando de voz).
export function mensagemCidade(texto, uf, r) {
  const lista = (r.sugestoes || []).map((s) => `${s.cidade}-${s.uf}`).join(', ');
  if (r.motivo === 'pais_ambiguo') return `"${texto}" existe em mais de um país (${(r.sugestoes || []).map((s) => `${s.cidade}, ${s.pais}`).join('; ')}). Diga o país, por exemplo: "${texto} Portugal".`;
  if (r.motivo === 'ambigua') return `"${texto}" existe em mais de uma região (${lista}). Diga a região, por exemplo: "${texto} ${r.sugestoes[0]?.uf}".`.replace('mais de uma região', 'mais de um estado');
  if (r.motivo === 'vazia') return 'Qual cidade?';
  return `Não achei a cidade "${texto}"${uf ? ` em ${uf}` : ''}.${lista ? ` Quis dizer: ${lista}?` : ''}`;
}

// Cidade sem país dito ("Lisboa", "Ciudad del Este", "Franca"): procura nos três e só aceita se houver UM candidato claro.
// Com `uf` (a região) o país sai dela; com `pais` só procura nele.
export function resolverLocal(texto, { uf = null, pais = null } = {}) {
  if (pais) return { ...resolverCidade(texto, uf, pais), pais: String(pais).toUpperCase() };
  const paises = PAISES_COM_LOCALIDADES.filter((p) => !uf || resolverUF(uf, p));
  const por = paises.map((p) => ({ p, r: resolverCidade(texto, uf, p) }));
  const exatos = por.filter((x) => x.r.ok && !x.r.corrigido);
  const aceitos = exatos.length ? exatos : por.filter((x) => x.r.ok);
  if (aceitos.length === 1) return { ...aceitos[0].r, pais: aceitos[0].p };
  if (aceitos.length > 1) return { ok: false, motivo: 'pais_ambiguo', sugestoes: aceitos.map((x) => ({ cidade: x.r.cidade, uf: x.r.uf, pais: x.p })) };
  const amb = por.find((x) => x.r.motivo === 'ambigua');
  if (amb) return { ...amb.r, pais: amb.p };
  const sugestoes = por.flatMap((x) => (x.r.sugestoes || []).map((s) => ({ ...s, pais: x.p }))).slice(0, 5);
  return { ok: false, motivo: sugestoes.length ? 'incerta' : 'desconhecida', sugestoes };
}
