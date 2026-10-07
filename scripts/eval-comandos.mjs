// npm run eval-comandos — mede se o comando de voz/texto ENTENDE de verdade (evolução 1, "selo de verdade").
// Roda as frases de test/fixtures/comandos-reais.json no interpretador real (regra + LLM se o Ollama estiver ligado)
// e mostra acerto por campo. Não toca no banco. Com --so-regra, desliga o LLM (o que o teste automático cobre).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if (process.argv.includes('--so-regra')) process.env.COMANDO_MODEL = '';
const { interpretar, LIMIAR_COMANDO } = await import('../src/comando.mjs');
const { casos } = JSON.parse(fs.readFileSync(path.join(raiz, 'test/fixtures/comandos-reais.json'), 'utf8'));
const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const campos = {}, falhas = [];
let certos = 0, ms = 0, abstencoes = 0;
const naoCobertas = [];
for (const c of casos) {
  const r = await interpretar(c.frase);
  // igual ao servidor: abaixo do limiar ele se abstém (não executa) — conta como "outro"
  const absteve = r.confianca < LIMIAR_COMANDO;
  if (absteve) { abstencoes++; r.intencao = 'outro'; }
  if (absteve && c.esperado.intencao !== 'outro') naoCobertas.push(c.frase);
  ms += r.latency_ms || 0;
  const erros = Object.entries(c.esperado).filter(([k, v]) => sem(r[k]) !== sem(v));
  for (const k of Object.keys(c.esperado)) { campos[k] ??= { ok: 0, n: 0 }; campos[k].n++; if (!erros.some(([e]) => e === k)) campos[k].ok++; }
  if (erros.length) falhas.push({ frase: c.frase, origem: r.origem, erros: erros.map(([k, v]) => `${k}: queria ${JSON.stringify(v)}, veio ${JSON.stringify(r[k])}`) });
  else certos++;
}
console.log(`\nComandos reais: ${certos}/${casos.length} frases 100% certas (${Math.round((100 * certos) / casos.length)}%) · LLM ${Math.round(ms / casos.length)} ms/frase em média`);
for (const [k, v] of Object.entries(campos)) console.log(`  ${k.padEnd(9)} ${v.ok}/${v.n}`);
// risco × cobertura: o pior erro é EXECUTAR a coisa errada; perguntar de volta é só cobertura perdida
const executouErrado = falhas.filter((f) => !naoCobertas.includes(f.frase)).length;
console.log(`  abstenções (perguntou em vez de executar): ${abstencoes} · pedidos reais que não executou: ${naoCobertas.length}`);
console.log(`  RISCO (executou a coisa errada): ${executouErrado}/${casos.length}`);
if (falhas.length) console.log('\nFalhas:');
for (const f of falhas) console.log(`  ✗ "${f.frase}" [${f.origem}]\n      ${f.erros.join('\n      ')}`);
