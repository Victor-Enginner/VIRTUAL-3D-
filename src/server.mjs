import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { CONFIG, ROOT } from './config.mjs';
import { abrirBanco, agora, enfileirar, lerAjustes, parse, salvarAjustes } from './db.mjs';
import { barramento, registrar } from './eventos.mjs';
import { NICHOS, FONTES } from './nichos.mjs';
import { SITUACOES, formatarTelefone } from './regras.mjs';
import { AGENTES, ROTULO_ABORDAGEM, aprovarEnvio, briefing, criarOrquestrador, receberMensagem, situacaoDoEnvio } from './agentes.mjs';
import { interpretar } from './comando.mjs';
import { saudeOllama } from './llm.mjs';
import { lerMensagemRecebida, saudeOpenwa } from './envio/openwa.mjs';
import { aprender, resumoAprendizado } from './aprendizado.mjs';
import { LIMITE_ANEXO, registrarRotasConfigurador } from './rotas-configurador.mjs';

const db = abrirBanco(CONFIG.dataDir);
const orq = criarOrquestrador(db);
const PUBLIC = path.join(ROOT, 'public');

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const SEM_RESPOSTA = Symbol('a rota já escreveu a resposta (arquivo em stream)');

function lerCorpo(req, limite = 512_000) {
  return new Promise((resolve, reject) => {
    let tam = 0; const partes = [];
    req.on('data', (c) => { tam += c.length; if (tam > limite) { reject(new HttpError(413, 'corpo grande demais')); req.destroy(); } else partes.push(c); });
    req.on('end', () => { try { resolve(partes.length ? JSON.parse(Buffer.concat(partes).toString('utf8')) : {}); } catch { reject(new HttpError(400, 'JSON inválido')); } });
    req.on('error', reject);
  });
}

const leadPublico = (l) => l && ({
  ...l,
  telefone_fmt: formatarTelefone(l.telefone),
  situacao_rotulo: SITUACOES[l.situacao_site] || null,
  auditoria: parse(l.auditoria),
  decisao: parse(l.decisao),
  wa_link: l.telefone ? `https://wa.me/${l.telefone}${l.mensagem ? `?text=${encodeURIComponent(l.mensagem)}` : ''}` : null,
});

const texto = (v, max = 100) => String(v ?? '').trim().slice(0, max);

const rotas = [];
const rota = (metodo, padrao, fn) => rotas.push({ metodo, re: new RegExp(`^${padrao.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });

rota('GET', '/api/estado', async () => {
  const [ollama, openwa] = await Promise.all([saudeOllama(), saudeOpenwa()]);
  const funil = Object.fromEntries(db.prepare('SELECT etapa, COUNT(*) n FROM leads GROUP BY etapa').all().map((r) => [r.etapa, r.n]));
  const situacoes = Object.fromEntries(db.prepare('SELECT situacao_site s, COUNT(*) n FROM leads WHERE situacao_site IS NOT NULL GROUP BY s').all().map((r) => [r.s, r.n]));
  return {
    agentes: Object.fromEntries(Object.entries(AGENTES).map(([k, a]) => [k, { ...a, ...orq.estado()[k] }])),
    pausado: orq.pausado,
    saude: { ollama, openwa, motor: { backend: CONFIG.decideBackend, modelo_decisao: CONFIG.decideModel, modelo_escrita: CONFIG.writeModel } },
    funil, situacoes, envio: situacaoDoEnvio(db), briefing: briefing(db), agentes_custom: configurador.ativos(),
    nichos: Object.fromEntries(Object.entries(NICHOS).map(([k, n]) => [k, n.rotulo])), fontes: FONTES, situacoes_rotulos: SITUACOES, abordagens: ROTULO_ABORDAGEM,
    ajustes: lerAjustes(db),
  };
});

rota('GET', '/api/leads', ({ url }) => {
  const etapa = url.searchParams.get('etapa');
  const q = texto(url.searchParams.get('q'));
  const where = [], args = [];
  if (etapa) { where.push('etapa = ?'); args.push(etapa); }
  if (q) { where.push('(nome LIKE ? OR cidade LIKE ? OR categoria LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const sql = `SELECT * FROM leads ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY score IS NULL, score DESC, atualizado_em DESC LIMIT 300`;
  return { leads: db.prepare(sql).all(...args).map(leadPublico) };
});

rota('GET', '/api/leads/:id', ({ params }) => {
  const l = db.prepare('SELECT * FROM leads WHERE id = ?').get(params.id);
  if (!l) throw new HttpError(404, 'lead não encontrado');
  const eventos = db.prepare('SELECT * FROM eventos WHERE lead_id = ? ORDER BY id DESC LIMIT 50').all(l.id);
  const envios = db.prepare('SELECT * FROM envios WHERE lead_id = ? ORDER BY id DESC').all(l.id);
  return { lead: leadPublico(l), eventos, envios };
});

rota('POST', '/api/leads/:id/mensagem', async ({ params, body }) => {
  const t = texto(body.texto, 1000);
  if (!t) throw new HttpError(400, 'mensagem vazia');
  const r = db.prepare("UPDATE leads SET mensagem = ?, mensagem_origem = 'operador', atualizado_em = ? WHERE id = ?").run(t, agora(), params.id);
  if (!r.changes) throw new HttpError(404, 'lead não encontrado');
  return { ok: true };
});

rota('POST', '/api/leads/:id/aprovar', ({ params, body }) => {
  try { aprovarEnvio(db, params.id, body.texto ? texto(body.texto, 1000) : null); } catch (e) { throw new HttpError(409, e.message); }
  return { ok: true };
});

rota('POST', '/api/leads/:id/descartar', ({ params }) => {
  const l = db.prepare('SELECT * FROM leads WHERE id = ?').get(params.id);
  if (!l) throw new HttpError(404, 'lead não encontrado');
  db.prepare("UPDATE leads SET etapa = 'descartado', atualizado_em = ? WHERE id = ?").run(agora(), l.id);
  db.prepare("UPDATE envios SET status = 'cancelado' WHERE lead_id = ? AND status = 'aprovado'").run(l.id);
  registrar(db, 'leo', 'descartado', `${l.nome}: descartado pelo operador`, { lead_id: l.id });
  // descartar um lead que os agentes recomendaram é o sinal mais claro de gosto do operador
  if (l.decisao && ['qualificado', 'mensagem', 'sem_contato'].includes(l.etapa)) {
    const a = aprender(db, 'aprovacao', l, 0);
    registrar(db, 'nova', 'aprendizado', `Aprendi com seu descarte de ${l.nome} (previa ${Math.round(a.p_antes * 100)}% · ${a.n} exemplos)`, { lead_id: l.id });
  }
  return { ok: true };
});

rota('GET', '/api/aprendizado', () => ({ cabecas: resumoAprendizado(db) }));

rota('POST', '/api/leads/:id/enviado-manual', ({ params }) => {
  const l = db.prepare('SELECT * FROM leads WHERE id = ?').get(params.id);
  if (!l) throw new HttpError(404, 'lead não encontrado');
  db.prepare("UPDATE envios SET status = 'enviado', enviado_em = ?, resposta = '{\"manual\":true}' WHERE lead_id = ? AND status = 'aprovado'").run(agora(), l.id);
  db.prepare("UPDATE leads SET etapa = 'enviado', atualizado_em = ? WHERE id = ?").run(agora(), l.id);
  registrar(db, 'leo', 'enviado', `${l.nome}: marcado como enviado à mão (wa.me)`, { lead_id: l.id });
  return { ok: true };
});

rota('POST', '/api/leads/:id/reprocessar', ({ params }) => {
  const l = db.prepare('SELECT id FROM leads WHERE id = ?').get(params.id);
  if (!l) throw new HttpError(404, 'lead não encontrado');
  db.prepare("UPDATE leads SET etapa = 'descoberto', atualizado_em = ? WHERE id = ?").run(agora(), l.id);
  enfileirar(db, 'auditar', l.id);
  return { ok: true };
});

function criarVarredura({ cidade, uf, nicho, fonte, limite }) {
  cidade = texto(cidade, 80); uf = texto(uf, 2).toUpperCase();
  if (!cidade || !/^[A-Z]{2}$/.test(uf)) throw new HttpError(400, 'cidade e UF obrigatórios');
  if (!NICHOS[nicho]) throw new HttpError(400, 'nicho desconhecido');
  if (!FONTES[fonte]) throw new HttpError(400, 'fonte desconhecida');
  const lim = Math.min(Math.max(Number(limite) || lerAjustes(db).varredura.limite_por_execucao, 1), 60);
  db.prepare(`INSERT INTO varreduras (cidade, uf, nicho, fonte, limite, criado_em) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(cidade, uf, nicho, fonte) DO UPDATE SET ativa = 1, limite = excluded.limite`).run(cidade, uf, nicho, fonte, lim, agora());
  const v = db.prepare('SELECT * FROM varreduras WHERE cidade = ? AND uf = ? AND nicho = ? AND fonte = ?').get(cidade, uf, nicho, fonte);
  enfileirar(db, 'varrer', String(v.id));
  registrar(db, 'alva', 'varredura_agendada', `Varredura de ${NICHOS[nicho].rotulo} em ${cidade}-${uf} entrou na fila`);
  return v;
}

rota('GET', '/api/varreduras', () => ({ varreduras: db.prepare('SELECT * FROM varreduras ORDER BY id DESC').all().map((v) => ({ ...v, ultimo_resultado: parse(v.ultimo_resultado), nicho_rotulo: NICHOS[v.nicho]?.rotulo })) }));
rota('POST', '/api/varreduras', ({ body }) => ({ varredura: criarVarredura(body) }));
rota('POST', '/api/varreduras/:id/ativa', ({ params, body }) => {
  db.prepare('UPDATE varreduras SET ativa = ? WHERE id = ?').run(body.ativa ? 1 : 0, Number(params.id));
  if (body.ativa) enfileirar(db, 'varrer', params.id);
  return { ok: true };
});

rota('GET', '/api/envios', () => ({
  envios: db.prepare('SELECT e.*, l.nome FROM envios e JOIN leads l ON l.id = e.lead_id ORDER BY e.id DESC LIMIT 200').all().map((e) => ({ ...e, telefone_fmt: formatarTelefone(e.telefone), resposta: parse(e.resposta) })),
  situacao: situacaoDoEnvio(db),
}));
rota('POST', '/api/envios/:id/cancelar', ({ params }) => {
  const e = db.prepare("SELECT * FROM envios WHERE id = ? AND status = 'aprovado'").get(Number(params.id));
  if (!e) throw new HttpError(404, 'envio não está na fila');
  db.prepare("UPDATE envios SET status = 'cancelado' WHERE id = ?").run(e.id);
  db.prepare("UPDATE leads SET etapa = 'mensagem', atualizado_em = ? WHERE id = ?").run(agora(), e.lead_id);
  return { ok: true };
});

rota('GET', '/api/eventos', ({ url }) => ({ eventos: db.prepare('SELECT * FROM eventos WHERE id > ? ORDER BY id DESC LIMIT 120').all(Number(url.searchParams.get('desde')) || 0) }));

rota('POST', '/api/agentes/pausar', () => { orq.pausar(true); registrar(db, 'alva', 'pausa', 'Agentes pausados pelo operador'); return { ok: true }; });
rota('POST', '/api/agentes/retomar', () => { orq.pausar(false); registrar(db, 'alva', 'retomada', 'Agentes retomados pelo operador'); return { ok: true }; });

rota('POST', '/api/ajustes', ({ body }) => {
  const atual = lerAjustes(db);
  const e = { ...atual.envio, ...(body.envio || {}) };
  const num = (v, min, max) => Math.min(Math.max(Number(v), min), max);
  const novo = {
    ...atual,
    remetente_nome: texto(body.remetente_nome ?? atual.remetente_nome, 60),
    remetente_oferta: texto(body.remetente_oferta ?? atual.remetente_oferta, 160),
    remetente_portfolio: /^https?:\/\/\S+$/.test(texto(body.remetente_portfolio ?? atual.remetente_portfolio, 200)) ? texto(body.remetente_portfolio ?? atual.remetente_portfolio, 200) : '',
    envio: {
      limite_diario: num(e.limite_diario, 1, 50),
      intervalo_min_s: num(e.intervalo_min_s, 60, 7200),
      intervalo_max_s: num(Math.max(e.intervalo_max_s, e.intervalo_min_s), 60, 7200),
      janela_inicio_h: num(e.janela_inicio_h, 0, 23),
      janela_fim_h: num(Math.max(e.janela_fim_h, Number(e.janela_inicio_h) + 1), 1, 24),
      dias_semana: (Array.isArray(e.dias_semana) ? e.dias_semana : atual.envio.dias_semana).map(Number).filter((d) => d >= 0 && d <= 6),
      exigir_aprovacao: Boolean(e.exigir_aprovacao),
      so_celular: Boolean(e.so_celular),
    },
  };
  salvarAjustes(db, novo);
  return { ajustes: novo };
});

rota('POST', '/api/comando', async ({ body }) => {
  const fala = texto(body.texto, 300);
  if (!fala) throw new HttpError(400, 'comando vazio');
  const c = await interpretar(fala);
  let resposta;
  if (c.confianca < 0.5) resposta = `Não tive certeza do que você pediu (${Math.round(c.confianca * 100)}%). Tente: "varre barbearias em Franca SP".`;
  else if (c.intencao === 'varrer') {
    if (!c.nicho || !c.cidade) resposta = `Entendi que é para varrer, mas faltou ${!c.nicho ? 'o ramo' : 'a cidade'}. Ramos que conheço: ${Object.values(NICHOS).map((n) => n.rotulo).join(', ')}.`;
    else {
      const v = criarVarredura({ cidade: c.cidade, uf: c.uf || 'SP', nicho: c.nicho, fonte: c.fonte });
      resposta = `Atlas vai varrer ${NICHOS[c.nicho].rotulo} em ${v.cidade}-${v.uf}${c.uf ? '' : ' (UF não dita, usei SP)'}.`;
    }
  } else if (c.intencao === 'pausar') { orq.pausar(true); resposta = 'Agentes pausados.'; }
  else if (c.intencao === 'retomar') { orq.pausar(false); resposta = 'Agentes retomados.'; }
  else if (c.intencao === 'resumo') { const b = briefing(db); resposta = `${b.leads} leads, ${b.para_aprovar} mensagens para aprovar, ${b.responderam} responderam, ${b.enviados_hoje} de ${b.limite} envios hoje.`; }
  else resposta = 'Não é um comando que eu sei executar.';
  registrar(db, 'alva', 'comando', `"${fala}" → ${resposta}`, { dados: c });
  return { comando: c, resposta };
});

const configurador = registrarRotasConfigurador({ rota, db, dataDir: CONFIG.dataDir, HttpError });
rota('GET', '/api/anexos/:arquivo', ({ res, params }) => { configurador.servirAnexo(res, params.arquivo); return SEM_RESPOSTA; });

rota('POST', '/webhooks/openwa', ({ url, body }) => {
  const tok = url.searchParams.get('token') || '';
  const esperado = CONFIG.webhookToken;
  if (!esperado || tok.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(esperado))) throw new HttpError(401, 'token inválido');
  const m = lerMensagemRecebida(body);
  const lead = receberMensagem(db, m);
  if (!lead && m.telefone) registrar(db, 'leo', 'webhook', `Evento ${m.evento || '?'} de número fora da base`, { dados: { evento: m.evento } });
  return { ok: true };
});

function sse(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write('retry: 3000\n\n');
  const envia = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  barramento.on('evento', envia);
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => { barramento.off('evento', envia); clearInterval(ping); });
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8' };

function arquivo(res, p) {
  const alvo = path.normalize(path.join(PUBLIC, p === '/' ? 'index.html' : p));
  if (!alvo.startsWith(PUBLIC) || !fs.existsSync(alvo) || fs.statSync(alvo).isDirectory()) { res.writeHead(404).end('não encontrado'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(alvo).pipe(res);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/stream') return sse(req, res);
    const r = rotas.find((x) => x.metodo === req.method && x.re.test(url.pathname));
    if (!r) {
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) return arquivo(res, url.pathname);
      throw new HttpError(404, 'rota não encontrada');
    }
    // escrita só por JSON vindo do próprio painel: bloqueia formulário de outro site (CSRF) contra o localhost
    if (req.method === 'POST' && !url.pathname.startsWith('/webhooks/') && !String(req.headers['content-type']).includes('application/json')) throw new HttpError(415, 'use application/json');
    // anexo vem em base64 (+33%): limite maior só nessa rota
    const limite = url.pathname.endsWith('/anexo') ? Math.ceil(LIMITE_ANEXO * 1.4) + 4096 : undefined;
    const body = req.method === 'POST' ? await lerCorpo(req, limite) : {};
    const out = await r.fn({ req, res, url, body, params: url.pathname.match(r.re).groups || {} });
    if (out === SEM_RESPOSTA) return;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(out));
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ erro: e.message }));
  }
});

// 127.0.0.1: o painel não tem login, então não pode ficar exposto na rede.
servidor.listen(CONFIG.port, '127.0.0.1', () => {
  console.log(`Prospector em http://127.0.0.1:${CONFIG.port}  (decisão: ${CONFIG.decideBackend}/${CONFIG.decideModel})`);
  orq.iniciar();
});

for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => { orq.parar(); servidor.close(); db.close(); process.exit(0); });
