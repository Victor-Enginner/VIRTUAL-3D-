// node scripts/baixar-populacao.mjs — população estimada de cada município (IBGE, tabela 6579, variável 9324).
// Usada pelo bandit do território (src/territorio.mjs) para estimar QUANTAS empresas cada cidade deve ter:
// sem isso, entre cidades nunca buscadas, a escolha era às cegas e podia gastar um lote numa cidade de 2 mil habitantes.
// Autorizado pelo Victor em 08/10/2026. Rodar de novo uma vez por ano (o IBGE publica nova estimativa).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = 'https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[all]';
const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
if (!r.ok) throw new Error(`IBGE respondeu ${r.status}`);
const [variavel] = await r.json();
const series = variavel.resultados[0].series;
const ano = Object.keys(series[0].serie)[0];
const porUf = {};
for (const s of series) {
  const m = s.localidade.nome.match(/^(.*) - ([A-Z]{2})$/); // "Franca - SP"
  const pop = Number(s.serie[ano]);
  if (!m || !Number.isFinite(pop)) continue;
  (porUf[m[2]] ??= {})[m[1]] = pop;
}
const total = Object.values(porUf).reduce((a, u) => a + Object.keys(u).length, 0);
const saida = path.join(raiz, 'src/dados/populacao-BR.json');
fs.writeFileSync(saida, JSON.stringify({ fonte: `IBGE, agregado 6579 (estimativa da população residente), variável 9324, ano ${ano}; ${url}`, baixado_em: new Date().toISOString().slice(0, 10), ano, por_uf: porUf }));
console.log(`${total} municípios, estimativa de ${ano} → ${path.relative(raiz, saida)} (${Math.round(fs.statSync(saida).size / 1024)} KB)`);
