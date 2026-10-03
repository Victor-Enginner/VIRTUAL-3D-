// npm run estado -- "descrição" — salva um ESTADO DE PRODUÇÃO: só depois de verificar tudo.
//  1. roda a verificação (falhou = não salva)
//  2. exige árvore limpa (o estado é exatamente um commit)
//  3. tag git anotada producao-AAAA-MM-DD[-N] com a descrição
//  4. cópia consistente do banco em data/estados/<tag>.db (VACUUM INTO; fica só no PC, nunca no git)
//  5. registra em docs/ESTADOS.md (você faz o commit desse registro)
// Voltar a um estado: ver docs/ESTADOS.md, seção "Como voltar".
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...a) => spawnSync('git', a, { cwd: RAIZ, encoding: 'utf8' });
const descricao = process.argv.slice(2).join(' ').trim();
if (!descricao) { console.log('Uso: npm run estado -- "o que este estado tem"'); process.exit(1); }

if (git('status', '--porcelain').stdout.trim()) { console.log('Há mudanças sem commit. Faça o commit antes de salvar um estado.'); process.exit(1); }
const v = spawnSync(process.execPath, ['scripts/verificar.mjs'], { cwd: RAIZ, stdio: 'inherit' });
if (v.status !== 0) { console.log('\nEstado NÃO salvo: a verificação falhou.'); process.exit(1); }

const dia = new Date().toISOString().slice(0, 10);
const existentes = git('tag', '--list', `producao-${dia}*`).stdout.split('\n').filter(Boolean);
const tag = existentes.length ? `producao-${dia}-${existentes.length + 1}` : `producao-${dia}`;
const commit = git('rev-parse', '--short', 'HEAD').stdout.trim();
const testes = spawnSync(process.execPath, ['--test'], { cwd: RAIZ, encoding: 'utf8' }).stdout.match(/ℹ tests (\d+)/)?.[1];
const r = git('tag', '-a', tag, '-m', `Estado de produção: ${descricao}`);
if (r.status !== 0) { console.log(r.stderr); process.exit(1); }

const dataDir = process.env.DATA_DIR || path.join(RAIZ, 'data');
const banco = path.join(dataDir, 'prospector.db');
let copia = 'sem banco';
if (fs.existsSync(banco)) {
  const destino = path.join(dataDir, 'estados', `${tag}.db`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const db = new DatabaseSync(banco);
  db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`); // cópia consistente mesmo com o servidor ligado
  db.close();
  copia = `data/estados/${tag}.db`;
}

const reg = path.join(RAIZ, 'docs', 'ESTADOS.md');
const linha = `| \`${tag}\` | ${commit} | ${dia} | ${testes} | ${copia} | ${descricao.replace(/\|/g, '/')} |\n`;
fs.appendFileSync(reg, linha);
console.log(`\nEstado salvo: ${tag} (commit ${commit}, ${testes} testes, banco: ${copia})`);
console.log('Registrado em docs/ESTADOS.md — faça o commit desse registro.');
