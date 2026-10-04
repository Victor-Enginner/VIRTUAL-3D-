import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { AJUSTES_PADRAO } from './config.mjs';
import { migrar } from './migracoes.mjs';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT,
  nicho TEXT,
  cidade TEXT,
  uf TEXT,
  endereco TEXT,
  telefone TEXT,              -- só dígitos com DDI (5516...), NULL se a fonte não trouxe
  telefone_tipo TEXT,         -- celular | fixo | NULL
  site TEXT,
  rating REAL,
  avaliacoes INTEGER,
  maps_url TEXT,
  fonte TEXT NOT NULL,
  varredura_id INTEGER,
  etapa TEXT NOT NULL DEFAULT 'descoberto',
  situacao_site TEXT,
  auditoria TEXT,             -- JSON com os fatos medidos
  decisao TEXT,               -- JSON com as probabilidades do motor de decisão
  score REAL,
  motivo TEXT,
  mensagem TEXT,
  mensagem_origem TEXT,       -- modelo | modelo_recusado (texto fixo) | operador
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_etapa ON leads(etapa);
CREATE INDEX IF NOT EXISTS leads_tel ON leads(telefone);

CREATE TABLE IF NOT EXISTS varreduras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  nicho TEXT NOT NULL,
  fonte TEXT NOT NULL,
  limite INTEGER NOT NULL,
  ativa INTEGER NOT NULL DEFAULT 1,
  ultima_execucao TEXT,
  ultimo_resultado TEXT,
  criado_em TEXT NOT NULL,
  UNIQUE(cidade, uf, nicho, fonte)
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  ref TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pendente',
  tentativas INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  disponivel_em TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_fila ON jobs(tipo, status, disponivel_em);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_unico_aberto ON jobs(tipo, ref) WHERE status IN ('pendente', 'rodando');

CREATE TABLE IF NOT EXISTS envios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  telefone TEXT NOT NULL,
  texto TEXT NOT NULL,
  status TEXT NOT NULL,       -- aprovado | enviado | erro | cancelado
  agendado_para TEXT,
  enviado_em TEXT,
  resposta TEXT,
  criado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS envios_status ON envios(status, agendado_para);

CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  agente TEXT NOT NULL,
  tipo TEXT NOT NULL,
  lead_id TEXT,
  msg TEXT NOT NULL,
  dados TEXT
);
CREATE INDEX IF NOT EXISTS eventos_ts ON eventos(ts);

CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL);

-- agentes criados pelo operador no Configurador (além dos 5 do pipeline)
CREATE TABLE IF NOT EXISTS agentes_custom (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,       -- em_criacao | ativo
  etapa TEXT NOT NULL,
  voltar_para TEXT,
  ficha TEXT NOT NULL DEFAULT '{}',
  cor TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
-- belief state explícito por lead (PoS, arXiv 2610.01415): fatos com fonte e validade + progresso
CREATE TABLE IF NOT EXISTS crencas (
  lead_id TEXT PRIMARY KEY,
  versao INTEGER NOT NULL DEFAULT 0,
  fatos TEXT NOT NULL DEFAULT '[]',
  conflitos TEXT NOT NULL DEFAULT '[]', -- chaves em que duas fontes discordam
  ciclos_sem_novidade INTEGER NOT NULL DEFAULT 0,
  preso INTEGER NOT NULL DEFAULT 0,
  motivo TEXT,
  bloqueio TEXT, -- último handoff recusado pelo portão: {para, falta, em}
  historico TEXT, -- últimos ciclos {assinatura, novidade, lacuna} para os 3 sinais de saúde
  diagnostico TEXT, -- {padrao, saude, sinais, chaves, recuperacao} quando preso
  atualizado_em TEXT NOT NULL
);

-- negócio fechado à mão (o ciclo de resultado): um por lead, com o valor que você informou
CREATE TABLE IF NOT EXISTS negocios (
  lead_id TEXT PRIMARY KEY REFERENCES leads(id),
  valor REAL NOT NULL,
  servico TEXT,
  fechado_em TEXT NOT NULL
);

-- o que você mudou nos textos da Maia: par original x editado, base de treino futuro (src/tocomas/edicoes.mjs)
CREATE TABLE IF NOT EXISTS edicoes (
  lead_id TEXT PRIMARY KEY REFERENCES leads(id),
  original TEXT NOT NULL,
  editado TEXT NOT NULL,
  origem_original TEXT,
  nicho TEXT,
  angulo TEXT,
  em TEXT NOT NULL
);

-- por que a Maia (ou outro componente) recusou um texto: uma linha por causa (B13, 2609.31937)
CREATE TABLE IF NOT EXISTS rejeicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT,
  componente TEXT NOT NULL,   -- maia_modelo | maia_validacao | maia_contradicao | maia_observacao
  causa TEXT NOT NULL,        -- código curto estável (ex.: longa_demais)
  detalhe TEXT,
  nicho TEXT,
  em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rejeicoes_causa ON rejeicoes(componente, causa);

-- previsão que existia quando cada rótulo seu chegou (antes de aprender com ele): base da calibração (B10)
CREATE TABLE IF NOT EXISTS previsoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT,
  nicho TEXT,
  alvo TEXT NOT NULL, -- aprovacao | resposta
  p_cabeca REAL NOT NULL,
  p_score REAL,
  y INTEGER NOT NULL,
  peso REAL NOT NULL DEFAULT 1,
  n_antes INTEGER NOT NULL,
  em TEXT NOT NULL
);

-- meta-skills (arXiv 2609.38143): regras que os agentes propõem a partir dos seus descartes.
-- Só valem depois que você aceita (estado = 'ativa').
CREATE TABLE IF NOT EXISTS habilidades (
  id TEXT PRIMARY KEY,
  motivo TEXT NOT NULL,
  quando TEXT NOT NULL,
  fornecer TEXT NOT NULL,
  condicao TEXT NOT NULL,
  efeito TEXT NOT NULL,
  evidencias TEXT NOT NULL DEFAULT '[]',
  estado TEXT NOT NULL DEFAULT 'proposta',  -- proposta | ativa | revisada | descartada
  aplicada INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversas_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agente_id TEXT NOT NULL REFERENCES agentes_custom(id) ON DELETE CASCADE,
  papel TEXT NOT NULL,        -- operador | sistema
  texto TEXT NOT NULL,
  opcoes TEXT,
  anexo TEXT,
  ts TEXT NOT NULL
);
`;

export const agora = () => new Date().toISOString();

export function abrirBanco(dataDir) {
  let file = ':memory:';
  if (dataDir !== ':memory:') {
    fs.mkdirSync(dataDir, { recursive: true });
    file = path.join(dataDir, 'prospector.db');
  }
  const db = new DatabaseSync(file);
  migrar(db, file === ':memory:' ? null : file, SCHEMA); // src/migracoes.mjs: versão, backup antes, idempotente
  // jobs que estavam rodando quando o processo caiu voltam para a fila
  db.prepare("UPDATE jobs SET status = 'pendente' WHERE status = 'rodando'").run();
  return db;
}

export const json = (v) => (v == null ? null : JSON.stringify(v));
export const parse = (s, d = null) => { if (s == null) return d; try { return JSON.parse(s); } catch { return d; } };

export function lerAjustes(db) {
  const row = db.prepare("SELECT v FROM config WHERE k = 'ajustes'").get();
  const salvo = parse(row?.v, {});
  return { ...AJUSTES_PADRAO, ...salvo, envio: { ...AJUSTES_PADRAO.envio, ...(salvo.envio || {}) }, varredura: { ...AJUSTES_PADRAO.varredura, ...(salvo.varredura || {}) } };
}

export function salvarAjustes(db, ajustes) {
  db.prepare("INSERT INTO config (k, v) VALUES ('ajustes', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(ajustes));
}

export function lerFlag(db, k, d) { return parse(db.prepare('SELECT v FROM config WHERE k = ?').get(k)?.v, d); }
export function salvarFlag(db, k, v) { db.prepare('INSERT INTO config (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, JSON.stringify(v)); }

// ---------- fila de jobs ----------

export function enfileirar(db, tipo, ref, payload = {}, atrasoMs = 0) {
  const t = agora();
  const disp = new Date(Date.now() + atrasoMs).toISOString();
  const r = db.prepare(`INSERT INTO jobs (tipo, ref, payload, disponivel_em, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`).run(tipo, ref, JSON.stringify(payload), disp, t, t);
  return r.changes > 0;
}

export function pegarJob(db, tipo) {
  const job = db.prepare(`SELECT * FROM jobs WHERE tipo = ? AND status = 'pendente' AND disponivel_em <= ?
    ORDER BY disponivel_em, id LIMIT 1`).get(tipo, agora());
  if (!job) return null;
  const r = db.prepare("UPDATE jobs SET status = 'rodando', tentativas = tentativas + 1, atualizado_em = ? WHERE id = ? AND status = 'pendente'").run(agora(), job.id);
  if (!r.changes) return null;
  return { ...job, payload: parse(job.payload, {}), tentativas: job.tentativas + 1 };
}

export function concluirJob(db, id) {
  db.prepare("UPDATE jobs SET status = 'feito', erro = NULL, atualizado_em = ? WHERE id = ?").run(agora(), id);
}

// Erro transitório volta para a fila com espera crescente; após 3 tentativas, fica como erro.
export function falharJob(db, job, erro) {
  const msg = String(erro?.message || erro).slice(0, 500);
  if (job.tentativas >= 3) {
    db.prepare("UPDATE jobs SET status = 'erro', erro = ?, atualizado_em = ? WHERE id = ?").run(msg, agora(), job.id);
    return false;
  }
  const disp = new Date(Date.now() + 60_000 * 2 ** job.tentativas).toISOString();
  db.prepare("UPDATE jobs SET status = 'pendente', erro = ?, disponivel_em = ?, atualizado_em = ? WHERE id = ?").run(msg, disp, agora(), job.id);
  return true;
}
