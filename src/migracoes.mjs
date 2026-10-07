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
  { v: 3, nome: 'negocios: ciclo de resultado (fechado/perdido à mão); a tabela vem do SCHEMA', up() {} },
  { v: 4, nome: 'eventos.causa_id: cadeia de causa (B5)', up(db) {
    adicionarColuna(db, 'eventos', 'causa_id', 'INTEGER');
    db.exec('CREATE INDEX IF NOT EXISTS eventos_lead ON eventos(lead_id, id); CREATE INDEX IF NOT EXISTS eventos_causa ON eventos(causa_id)');
  } },
  { v: 5, nome: 'edicoes: pares original x editado para treino futuro; a tabela vem do SCHEMA', up() {} },
  { v: 6, nome: 'rejeicoes: por que a Maia recusou cada texto (B13); a tabela vem do SCHEMA', up() {} },
  { v: 7, nome: 'mensagens + acks_orfaos: conversa e estado de entrega do WhatsApp; as tabelas vêm do SCHEMA', up() {} },
  { v: 8, nome: 'lotes de busca (histórico por cidade x ramo) e leads.lote_id; a tabela vem do SCHEMA', up(db) {
    adicionarColuna(db, 'leads', 'lote_id', 'INTEGER');
    // o que já foi buscado antes dos lotes vira o "lote 1" de cada busca, para o histórico não começar do zero
    for (const v of db.prepare('SELECT id, limite, ultima_execucao, criado_em FROM varreduras').all()) {
      const n = db.prepare('SELECT COUNT(*) n FROM leads WHERE varredura_id = ? AND lote_id IS NULL').get(v.id).n;
      if (!n || db.prepare('SELECT 1 FROM lotes WHERE varredura_id = ?').get(v.id)) continue;
      const r = db.prepare("INSERT INTO lotes (varredura_id, numero, meta, pedido, coletados, novos, repetidos, status, iniciado_em, coletado_em) VALUES (?, 1, ?, ?, ?, ?, 0, 'coletado', ?, ?)")
        .run(v.id, v.limite || n, n, n, n, v.criado_em, v.ultima_execucao || v.criado_em);
      db.prepare('UPDATE leads SET lote_id = ? WHERE varredura_id = ? AND lote_id IS NULL').run(Number(r.lastInsertRowid), v.id);
    }
  } },
  { v: 9, nome: 'pais em varreduras e leads (Brasil, Portugal, Paraguai); o padrão é BR', up(db) { adicionarColuna(db, 'varreduras', 'pais', "TEXT NOT NULL DEFAULT 'BR'"); adicionarColuna(db, 'leads', 'pais', "TEXT NOT NULL DEFAULT 'BR'"); } },
  { v: 10, nome: 'sessões de rastreamento: leads.sessao_id; o que já existe vira a "Sessão 1"; a tabela vem do SCHEMA', up(db) {
    adicionarColuna(db, 'leads', 'sessao_id', 'INTEGER');
    db.exec('CREATE INDEX IF NOT EXISTS leads_sessao ON leads(sessao_id, etapa)');
    // qualquer caminho que cria lead (coletor, demonstração, teste) cai na sessão ativa sem precisar lembrar disso
    db.exec(`CREATE TRIGGER IF NOT EXISTS leads_na_sessao AFTER INSERT ON leads WHEN NEW.sessao_id IS NULL BEGIN
      UPDATE leads SET sessao_id = COALESCE((SELECT CAST(v AS INTEGER) FROM config WHERE k = 'sessao_ativa'), (SELECT MAX(id) FROM sessoes)) WHERE id = NEW.id;
    END`);
    if (db.prepare('SELECT 1 FROM sessoes').get()) return;
    const inicio = db.prepare('SELECT MIN(criado_em) t FROM leads').get().t || new Date().toISOString();
    const id = Number(db.prepare("INSERT INTO sessoes (nome, criada_em) VALUES ('Sessão 1', ?)").run(inicio).lastInsertRowid);
    db.prepare('UPDATE leads SET sessao_id = ? WHERE sessao_id IS NULL').run(id);
  } },
  { v: 11, nome: 'campanhas de território com bandit (ramo x estado inteiro) e o histórico de cada escolha; as tabelas vêm do SCHEMA', up() {} },
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
