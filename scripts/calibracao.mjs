// npm run calibracao — relatório de calibração no terminal (só leitura).
// DATA_DIR opcional, como no servidor.
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { relatorio } from '../src/tocomas/calibracao.mjs';

const arquivo = path.join(process.env.DATA_DIR || './data', 'prospector.db');
const db = new DatabaseSync(arquivo, { readOnly: true });
let r;
try { r = relatorio(db); } catch (e) {
  if (/no such table: previsoes/.test(e.message)) { console.log('Ainda não há previsões registradas (abra o servidor uma vez para criar a tabela).'); process.exit(0); }
  throw e;
}
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
console.log(`Previsões com rótulo: ${r.total} · mínimo por grupo para confiar: ${r.min_amostra}\n`);
const NOME = { aprovacao: 'Você aprova', resposta: 'O negócio responde', p_cabeca: 'cabeça aprendida', p_score: 'prioridade ÷ 100' };
for (const alvo of ['aprovacao', 'resposta']) {
  for (const prev of ['p_cabeca', 'p_score']) {
    const b = r[alvo][prev];
    if (!b.geral.n) continue;
    console.log(`${NOME[alvo]} · ${NOME[prev]}`);
    const linha = (rot, m) => console.log(`  ${rot.padEnd(18)} n=${String(m.n).padStart(3)}  taxa real ${pct(m.taxa).padStart(4)}  Brier ${m.brier.toFixed(3)}  ECE ${m.ece.toFixed(3)}${m.confiavel ? '' : '  (pouca amostra)'}`);
    linha('geral', b.geral);
    for (const [n, m] of Object.entries(b.por_nicho)) linha(n, m);
    if (b.pior_nicho) console.log(`  pior nicho: ${b.pior_nicho}`);
    console.log('');
  }
}
if (!r.total) console.log('Nada para medir ainda: cada Aprovar/Descartar seu e cada resposta no WhatsApp vira uma linha.');
