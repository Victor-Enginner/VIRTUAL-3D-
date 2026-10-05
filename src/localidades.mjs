// Estados e municípios do Brasil (IBGE, src/dados/localidades.json) + corretor de digitação.
// Serve para: validar a cidade de uma varredura, achar a UF quando o Victor não diz ("Franca" só existe em SP) e
// consertar erro de escrita ou de reconhecimento de voz ("Ribeirão Preot" → "Ribeirão Preto").
import fs from 'node:fs';

const DADOS = JSON.parse(fs.readFileSync(new URL('./dados/localidades.json', import.meta.url), 'utf8'));
export const ESTADOS = DADOS.estados;
export const UFS = ESTADOS.map((e) => e.sigla);

export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/['’`´]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// índice: nome normalizado → [{ cidade, uf }]
const INDICE = new Map();
const LISTA = [];
for (const [uf, nomes] of Object.entries(DADOS.municipios)) {
  for (const cidade of nomes) {
    const n = normalizar(cidade);
    const item = { cidade, uf, n };
    LISTA.push(item);
    INDICE.set(n, [...(INDICE.get(n) || []), item]);
  }
}
export const totalMunicipios = () => LISTA.length;
export const cidadesDe = (uf) => (DADOS.municipios[String(uf).toUpperCase()] || []).slice();

// "são paulo", "sp", "SÃO PAULO (SP)" → "SP"
const POR_NOME_UF = new Map(ESTADOS.flatMap((e) => [[normalizar(e.nome), e.sigla], [e.sigla.toLowerCase(), e.sigla]]));
export const resolverUF = (texto) => POR_NOME_UF.get(normalizar(String(texto ?? '').replace(/\([A-Za-z]{2}\)/, ''))) || null;

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
//  ok=false → ambíguo (mesmo nome em vários estados) ou desconhecido; `sugestoes` traz até 5 opções.
export function resolverCidade(texto, ufDica = null) {
  const uf = ufDica ? (resolverUF(ufDica) || String(ufDica).toUpperCase()) : null;
  const n = normalizar(texto);
  if (!n) return { ok: false, motivo: 'vazia', sugestoes: [] };
  const doEstado = (itens) => (uf ? itens.filter((i) => i.uf === uf) : itens);

  const exatos = doEstado(INDICE.get(n) || []);
  if (exatos.length === 1) return { ok: true, cidade: exatos[0].cidade, uf: exatos[0].uf, corrigido: false, ufInferida: !uf };
  if (exatos.length > 1) return { ok: false, motivo: 'ambigua', sugestoes: exatos.map(({ cidade, uf: u }) => ({ cidade, uf: u })).slice(0, 5) };

  const lim = limiteDe(n.length);
  const achados = [];
  for (const it of doEstado(LISTA)) {
    const dist = distancia(n, it.n, lim);
    if (dist <= lim) achados.push({ cidade: it.cidade, uf: it.uf, dist });
    else if (it.n.startsWith(n) && n.length >= 5) achados.push({ cidade: it.cidade, uf: it.uf, dist: lim + 1 }); // "ribeirao pre" → começo do nome
  }
  achados.sort((a, b) => a.dist - b.dist || a.cidade.localeCompare(b.cidade, 'pt-BR'));
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
  if (r.motivo === 'ambigua') return `"${texto}" existe em mais de um estado (${lista}). Diga o estado, por exemplo: "${texto} ${r.sugestoes[0]?.uf}".`;
  if (r.motivo === 'vazia') return 'Qual cidade?';
  return `Não achei a cidade "${texto}"${uf ? ` em ${uf}` : ''}.${lista ? ` Quis dizer: ${lista}?` : ''}`;
}
