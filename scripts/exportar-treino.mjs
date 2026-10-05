// npm run exportar-treino — grava data/treino/treino-AAAA-MM-DD.jsonl (anonimizado). Só lê o banco; não manda nada para lugar nenhum.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/config.mjs';
import { abrirBanco } from '../src/db.mjs';
import { exportarTreino, temDadoPessoal } from '../src/treino.mjs';

const db = abrirBanco(CONFIG.dataDir);
const linhas = exportarTreino(db);
if (temDadoPessoal(linhas)) { console.log('Abortei: sobrou algo parecido com telefone, e-mail ou link no arquivo. Nada foi gravado.'); process.exit(1); }
const pasta = path.join(CONFIG.dataDir, 'treino');
fs.mkdirSync(pasta, { recursive: true });
const arq = path.join(pasta, `treino-${new Date().toISOString().slice(0, 10)}.jsonl`);
fs.writeFileSync(arq, linhas.map((l) => JSON.stringify(l)).join('\n') + (linhas.length ? '\n' : ''));
const por = (t) => linhas.filter((l) => l.tipo === t).length;
console.log(`${linhas.length} exemplo(s) em ${arq}\n  edições: ${por('edicao')} · aprovações/descartes: ${por('aprovacao')} · respostas: ${por('resposta')} · fechamentos: ${por('fechamento')}`);
db.close();
