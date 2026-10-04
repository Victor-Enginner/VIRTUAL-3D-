// Migrações do banco, versionadas por PRAGMA user_version. Regras para durar anos:
//  - só se ACRESCENTA ao fim da lista; nunca se edita uma migração já lançada
//  - cada migração é idempotente (roda em banco que já tem a mudança sem quebrar)
//  - antes de migrar um banco que já tem dados, sai uma cópia em data/backups/
//  - banco de versão MAIOR que o código é recusado (nunca rebaixar dados sem querer)
import fs from 'node:fs';
import path from 'node:path';

const temColuna = (db, tabela, col) => db.prepare(`PRAGMA table_info(${tabela})`).all().some((c) => c.name === col);
export const adicionarColuna = (db, tabela, col, tipo) => { if (!temColuna(db, tabela, col)) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${col} ${tipo}`); };

export const MIGRACOES = [
  { v: 1, nome: 'base: tabelas do SCHEMA (criadas com IF NOT EXISTS)', up() {} },
  { v: 2, nome: 'crencas: bloqueio, historico, diagnostico (B7)', up(db) { for (const c of ['bloqueio', 'historico', 'diagnostico']) adicionarColuna(db, 'crencas', c, 'TEXT'); } },
];
export const VERSAO_ATUAL = MIGRACOES.at(-1).v;

export const versaoDoBanco = (db) => db.prepare('PRAGMA user_version').get().user_version;
const temDados = (db) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'leads'").get());

// `arquivo` = caminho do .db (null em memória). Devolve { de, para, aplicadas, backup }.
export function migrar(db, arquivo, schema) {
  const de = versaoDoBanco(db);
  if (de > VERSAO_ATUAL) throw new Error(`o banco é da versão ${de}, mas este código só entende até a ${VERSAO_ATUAL}. Atualize o código (não rebaixe o banco).`);
  let backup = null;
  if (arquivo && de < VERSAO_ATUAL && temDados(db)) {
    const pasta = path.join(path.dirname(arquivo), 'backups');
    fs.mkdirSync(pasta, { recursive: true });
    backup = path.join(pasta, `pre-v${VERSAO_ATUAL}-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
    db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
  }
  db.exec(schema);
  const aplicadas = [];
  for (const m of MIGRACOES.filter((x) => x.v > de)) {
    db.exec('BEGIN');
    try { m.up(db); db.exec(`PRAGMA user_version = ${m.v}`); db.exec('COMMIT'); aplicadas.push(m.v); } catch (e) { db.exec('ROLLBACK'); throw new Error(`migração ${m.v} (${m.nome}) falhou: ${e.message}`); }
  }
  return { de, para: versaoDoBanco(db), aplicadas, backup };
}
