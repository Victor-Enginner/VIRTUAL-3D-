// Rotas do Configurador de Agentes: conversa guiada, anexos e ativação.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { agora, json, parse } from './db.mjs';
import { registrar } from './eventos.mjs';
import { CORES, ETAPAS, FERRAMENTAS, pergunta, promptDeSistema, responder } from './configurador.mjs';

// Tipos aceitos, conferidos pela assinatura dos primeiros bytes (não pela extensão que o navegador diz).
const TIPOS = {
  'image/png': { ext: 'png', confere: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg': { ext: 'jpg', confere: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { ext: 'webp', confere: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  'application/pdf': { ext: 'pdf', confere: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  'text/plain': { ext: 'txt', confere: (b) => !b.includes(0) },
  'text/markdown': { ext: 'md', confere: (b) => !b.includes(0) },
};
export const LIMITE_ANEXO = 2 * 1024 * 1024;
const ARQUIVO_OK = /^[0-9a-f]{32}\.(png|jpg|webp|pdf|txt|md)$/;

export function registrarRotasConfigurador({ rota, db, dataDir, HttpError }) {
  const pastaAnexos = path.join(dataDir, 'anexos');
  fs.mkdirSync(pastaAnexos, { recursive: true });

  const publico = (a) => a && ({ ...a, ficha: parse(a.ficha, {}) });
  const msgs = (id) => db.prepare('SELECT * FROM conversas_config WHERE agente_id = ? ORDER BY id').all(id)
    .map((m) => ({ ...m, opcoes: parse(m.opcoes), anexo: parse(m.anexo) }));
  const falar = (id, papel, texto, { opcoes = null, anexo = null } = {}) =>
    db.prepare('INSERT INTO conversas_config (agente_id, papel, texto, opcoes, anexo, ts) VALUES (?, ?, ?, ?, ?, ?)').run(id, papel, texto, json(opcoes), json(anexo), agora());
  const pegar = (id) => {
    const a = db.prepare('SELECT * FROM agentes_custom WHERE id = ?').get(id);
    if (!a) throw new HttpError(404, 'agente não encontrado');
    return a;
  };
  const perguntar = (a, ficha) => {
    const p = pergunta(a.etapa, ficha);
    falar(a.id, 'sistema', p.texto, { opcoes: p.opcoes ? { lista: p.opcoes, multipla: Boolean(p.multipla) } : null });
  };

  rota('GET', '/api/config-agentes', () => {
    const agentes = db.prepare('SELECT * FROM agentes_custom ORDER BY criado_em').all().map(publico);
    return { agentes, em_criacao: agentes.find((a) => a.status === 'em_criacao')?.id || null, ferramentas: FERRAMENTAS, etapas: ETAPAS };
  });

  rota('POST', '/api/config-agentes', () => {
    const aberto = db.prepare("SELECT id FROM agentes_custom WHERE status = 'em_criacao'").get();
    if (aberto) return { id: aberto.id, continuando: true };
    const id = crypto.randomBytes(8).toString('hex');
    const n = db.prepare('SELECT COUNT(*) n FROM agentes_custom').get().n;
    const t = agora();
    db.prepare("INSERT INTO agentes_custom (id, status, etapa, cor, criado_em, atualizado_em) VALUES (?, 'em_criacao', 'nome', ?, ?, ?)").run(id, CORES[n % CORES.length], t, t);
    perguntar({ id, etapa: 'nome' }, {});
    return { id, continuando: false };
  });

  rota('GET', '/api/config-agentes/:id', ({ params }) => {
    const a = pegar(params.id);
    const ficha = parse(a.ficha, {});
    return { agente: publico(a), mensagens: msgs(a.id), prompt: a.status === 'ativo' || a.etapa === 'revisao' ? promptDeSistema(ficha) : null };
  });

  rota('POST', '/api/config-agentes/:id/mensagem', ({ params, body }) => {
    const a = pegar(params.id);
    const texto = String(body.texto || '').trim().slice(0, 2000);
    if (!texto) throw new HttpError(400, 'mensagem vazia');
    falar(a.id, 'operador', texto);
    if (a.status === 'ativo') {
      // conversar com um agente já ativo exige o modelo local; sem ele, dizemos isso em vez de fingir resposta
      falar(a.id, 'sistema', 'Para conversar com o agente ativo, ligue o modelo local (Ollama). A ficha e as regras dele já estão salvas.');
      db.prepare('UPDATE agentes_custom SET atualizado_em = ? WHERE id = ?').run(agora(), a.id);
      return { ok: true };
    }
    const ficha = parse(a.ficha, {});
    const r = responder({ etapa: a.etapa, ficha, voltarPara: a.voltar_para }, texto);
    if (r.erro) {
      const p = pergunta(a.etapa, ficha);
      falar(a.id, 'sistema', r.erro, { opcoes: p.opcoes ? { lista: p.opcoes, multipla: Boolean(p.multipla) } : null });
      return { ok: true };
    }
    if (r.ativar) return ativar(a, r.ficha);
    db.prepare('UPDATE agentes_custom SET etapa = ?, voltar_para = ?, ficha = ?, atualizado_em = ? WHERE id = ?').run(r.etapa, r.voltarPara || null, json(r.ficha), agora(), a.id);
    perguntar({ ...a, etapa: r.etapa }, r.ficha);
    return { ok: true };
  });

  function ativar(a, ficha) {
    const faltando = ['nome', 'papel', 'identidade'].filter((k) => !ficha[k]);
    if (faltando.length) throw new HttpError(409, `faltam campos: ${faltando.join(', ')}`);
    db.prepare("UPDATE agentes_custom SET status = 'ativo', etapa = 'revisao', ficha = ?, atualizado_em = ? WHERE id = ?").run(json(ficha), agora(), a.id);
    falar(a.id, 'sistema', `${ficha.nome} está ativo e já ocupa uma mesa na Sala 3D.`);
    registrar(db, 'alva', 'agente_criado', `Novo agente na equipe: ${ficha.nome} (${ficha.papel})`);
    return { ok: true, ativado: true };
  }

  rota('POST', '/api/config-agentes/:id/ativar', ({ params }) => {
    const a = pegar(params.id);
    if (a.status === 'ativo') return { ok: true };
    if (a.etapa !== 'revisao') throw new HttpError(409, 'termine a entrevista antes de ativar');
    return ativar(a, parse(a.ficha, {}));
  });

  rota('POST', '/api/config-agentes/:id/descartar', ({ params }) => {
    const a = pegar(params.id);
    if (a.status !== 'em_criacao') throw new HttpError(409, 'só dá para descartar um agente em criação');
    for (const m of msgs(a.id)) if (m.anexo?.arquivo && ARQUIVO_OK.test(m.anexo.arquivo)) fs.rmSync(path.join(pastaAnexos, m.anexo.arquivo), { force: true });
    db.prepare('DELETE FROM agentes_custom WHERE id = ?').run(a.id);
    return { ok: true };
  });

  rota('POST', '/api/config-agentes/:id/anexo', ({ params, body }) => {
    const a = pegar(params.id);
    const tipo = TIPOS[body.tipo];
    if (!tipo) throw new HttpError(415, 'aceito PNG, JPG, WEBP, PDF, TXT e MD');
    const bytes = Buffer.from(String(body.base64 || ''), 'base64');
    if (!bytes.length || bytes.length > LIMITE_ANEXO) throw new HttpError(413, 'arquivo vazio ou maior que 2 MB');
    if (!tipo.confere(bytes)) throw new HttpError(415, 'o conteúdo do arquivo não bate com o tipo informado');
    const arquivo = `${crypto.randomBytes(16).toString('hex')}.${tipo.ext}`;
    fs.writeFileSync(path.join(pastaAnexos, arquivo), bytes);
    const nome = String(body.nome || arquivo).replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 80);
    const anexo = { arquivo, nome, tipo: body.tipo, bytes: bytes.length };
    falar(a.id, 'operador', '', { anexo });
    // texto vira base de conhecimento do agente; imagem e PDF ficam guardados (sem extração de texto)
    const ficha = parse(a.ficha, {});
    ficha.conhecimento = [...(ficha.conhecimento || []), { arquivo, nome, tipo: body.tipo, texto: tipo.ext === 'txt' || tipo.ext === 'md' ? bytes.toString('utf8').slice(0, 200_000) : null }];
    db.prepare('UPDATE agentes_custom SET ficha = ?, atualizado_em = ? WHERE id = ?').run(json(ficha), agora(), a.id);
    falar(a.id, 'sistema', `Guardei "${nome}" na base de conhecimento do agente${tipo.ext === 'txt' || tipo.ext === 'md' ? ' (texto lido)' : ' (arquivo guardado; o texto de imagem e PDF ainda não é extraído)'}.`);
    return { ok: true, anexo };
  });

  return {
    // arquivo de anexo: nome validado por regex (sem caminho), tipo fixo e nosniff
    servirAnexo(res, arquivo) {
      if (!ARQUIVO_OK.test(arquivo)) throw new HttpError(404, 'anexo não encontrado');
      const alvo = path.join(pastaAnexos, arquivo);
      if (!fs.existsSync(alvo)) throw new HttpError(404, 'anexo não encontrado');
      const ext = arquivo.split('.').pop();
      const ct = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf', txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8' }[ext];
      res.writeHead(200, { 'Content-Type': ct, 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': ['png', 'jpg', 'webp'].includes(ext) ? 'inline' : 'attachment', 'Cache-Control': 'private, max-age=86400' });
      fs.createReadStream(alvo).pipe(res);
    },
    ativos: () => db.prepare("SELECT * FROM agentes_custom WHERE status = 'ativo' ORDER BY criado_em").all().map((a) => {
      const f = parse(a.ficha, {});
      const ultima = db.prepare('SELECT ts FROM conversas_config WHERE agente_id = ? ORDER BY id DESC LIMIT 1').get(a.id)?.ts;
      return { id: a.id, nome: f.nome, papel: f.papel, funcao: (f.modos || []).join(', '), cor: a.cor, ultima_atividade: ultima || a.atualizado_em };
    }),
  };
}
