import { registrarEdicao } from './tocomas/edicoes.mjs';
import { cadeia, TIPOS_DA_CADEIA } from './tocomas/causa.mjs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { CONFIG, ROOT } from './config.mjs';
import { abrirBanco, agora, enfileirar, lerAjustes, lerFlag, parse, salvarAjustes, salvarFlag } from './db.mjs';
import { estatisticasDecide } from './decide/index.mjs';
import { resumoRejeicoes } from './rejeicoes.mjs';
import { canal, lerEvento } from './envio/canal.mjs';
import { avancarEstado, conversaDoLead, registrarMensagem, envioPausadoPelaConexao, registrarConexao, resumoDeEntrega } from './conversa.mjs';
import { calcularCapacidade, fraseDaCapacidade } from './capacidade.mjs';
import { abrirLote, cobertura, META_MAXIMA, META_PADRAO } from './lotes.mjs';
import { cidadesDe, ESTADOS, estadosDe, mensagemCidade, PAISES_COM_LOCALIDADES, resolverLocal, resolverUF } from './localidades.mjs';
import { codigoDoPais, PAISES } from './paises.mjs';
import { backupDiario } from './backup.mjs';
import { contarQuentes, LIMITE_QUENTE, proximoCartao, trocarCidade } from './comandos-acao.mjs';
import { versaoDoBanco } from './migracoes.mjs';
import { ativarSessao, novaSessaoDeRastreio, idSessaoAtiva, listarSessoes, sessaoAtiva } from './sessoes.mjs';
import { barramento, registrar } from './eventos.mjs';
import { NICHOS, FONTES, GRUPOS, TERMOS_MAPS_POR_VARREDURA, catalogo, nichosDoGrupo } from './nichos.mjs';
import { SITUACOES, formatarTelefone } from './regras.mjs';
import { AGENTES, ROTULO_ABORDAGEM, reavaliarBloqueados, aprovarEnvio, briefing, criarOrquestrador, receberMensagem, situacaoDoEnvio, marcarRespondeu, fecharNegocio, marcarPerdido } from './agentes.mjs';
import { interpretar, LIMIAR_COMANDO, SUGESTAO } from './comando.mjs';
import { saudeOllama } from './llm.mjs';
import { definirSessao, enviarTexto, garantirSessao, garantirWebhook, iniciarSessao, lerMensagemRecebida, qrSessao, saudeOpenwa, sessaoId, temChave } from './envio/openwa.mjs';
import { aprender, resumoAprendizado } from './aprendizado.mjs';
import { LIMITE_ANEXO, registrarRotasConfigurador } from './rotas-configurador.mjs';
import { relatorio as relatorioCalibracao } from './tocomas/calibracao.mjs';
import { LIMITES as LIMITES_ZONA, resumoZonas } from './tocomas/zonas.mjs';
import { lerCrenca, liberar, presos } from './tocomas/crenca.mjs';
import { semearDemo, criarSimulador, BLOQUEADAS_NA_DEMO } from './demo.mjs';
import { ARESTAS, NOS, REQUISITOS } from './tocomas/grafo.mjs';
import { prontidao } from './tocomas/zonas.mjs';
import { MOTIVOS, listar as listarHabilidades, mudarEstado, propor, retrato } from './tocomas/habilidades.mjs';
import { permitido, mascarar } from './espectador.mjs';
import { COOKIE_ESPECTADOR, LIVRES, cookieSair, cookieSessao, criarLimitador, criarSessao, ehLocal, iguais, ipDe, lerCookie, sessaoValida } from './acesso.mjs';

// demonstração: banco em memória com empresas fictícias e simulador no lugar dos agentes reais
const db = abrirBanco(CONFIG.demo ? ':memory:' : CONFIG.dataDir);
if (CONFIG.demo) semearDemo(db);
const orq = CONFIG.demo ? criarSimulador(db) : criarOrquestrador(db);
if (!sessaoId()) definirSessao(lerFlag(db, 'openwa_sessao', null)); // sessão conectada pelo Painel
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
  const funil = Object.fromEntries(db.prepare('SELECT etapa, COUNT(*) n FROM leads WHERE sessao_id IS ? GROUP BY etapa').all(idSessaoAtiva(db)).map((r) => [r.etapa, r.n]));
  const situacoes = Object.fromEntries(db.prepare('SELECT situacao_site s, COUNT(*) n FROM leads WHERE situacao_site IS NOT NULL AND sessao_id IS ? GROUP BY s').all(idSessaoAtiva(db)).map((r) => [r.s, r.n]));
  return {
    agentes: Object.fromEntries(Object.entries(AGENTES).map(([k, a]) => [k, { ...a, ...orq.estado()[k] }])),
    pausado: orq.pausado,
    demo: CONFIG.demo,
    saude: { ollama, openwa, motor: { backend: CONFIG.decideBackend, modelo_decisao: CONFIG.decideModel, modelo_escrita: CONFIG.writeModel, modelo_comando: CONFIG.modelos.comando.modelo } },
    sessao: sessaoAtiva(db), funil, situacoes, envio: situacaoDoEnvio(db), briefing: briefing(db), agentes_custom: configurador.ativos(),
    nichos: Object.fromEntries(Object.entries(NICHOS).map(([k, n]) => [k, n.rotulo])), fontes: FONTES, situacoes_rotulos: SITUACOES, abordagens: ROTULO_ABORDAGEM,
    ajustes: lerAjustes(db),
    tocomas: { controlador: orq.controlador.ultimas(), fidelidade: lerFlag(db, 'fidelidade', { total: 0, preservados: 0, ultimos_desvios: [] }), presos: presos(db).slice(0, 20), zonas: { limites: LIMITES_ZONA, nichos: resumoZonas(db) } },
  };
});

// leve e sem rede: serve para o atalho, o monitor e o teste saberem se o processo e o banco estão de pé
rota('GET', '/api/saude', () => {
  const ultimo = fs.existsSync(path.join(CONFIG.dataDir, 'backups')) ? fs.readdirSync(path.join(CONFIG.dataDir, 'backups')).filter((f) => f.startsWith('diario-')).sort().at(-1) || null : null;
  return { ok: true, banco: versaoDoBanco(db), leads: db.prepare('SELECT COUNT(*) n FROM leads').get().n, pausado: orq.pausado, demo: CONFIG.demo, ultimo_backup: ultimo, uptime_s: Math.round(process.uptime()) };
});

rota('GET', '/api/leads', ({ url }) => {
  const etapa = url.searchParams.get('etapa');
  const q = texto(url.searchParams.get('q'));
  const where = [], args = [];
  // padrão: só a sessão ativa; ?sessao=todas mostra o histórico inteiro
  const sessao = url.searchParams.get('sessao');
  if (sessao !== 'todas') { where.push('sessao_id IS ?'); args.push(sessao ? Number(sessao) : idSessaoAtiva(db)); }
  if (etapa) { where.push('etapa = ?'); args.push(etapa); }
  if (q) { where.push('(nome LIKE ? OR cidade LIKE ? OR categoria LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (url.searchParams.get('fraco') === '1') where.push("situacao_site IS NOT NULL AND situacao_site != 'site_proprio'");
  const sql = `SELECT * FROM leads ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY score IS NULL, score DESC, atualizado_em DESC LIMIT 300`;
  return { leads: db.prepare(sql).all(...args).map(leadPublico) };
});

rota('GET', '/api/leads/:id', ({ params }) => {
  const l = db.prepare('SELECT * FROM leads WHERE id = ?').get(params.id);
  if (!l) throw new HttpError(404, 'lead não encontrado');
  const eventos = db.prepare('SELECT * FROM eventos WHERE lead_id = ? ORDER BY id DESC LIMIT 50').all(l.id);
  const envios = db.prepare('SELECT * FROM envios WHERE lead_id = ? ORDER BY id DESC').all(l.id);
  const doCaminho = db.prepare(`SELECT * FROM eventos WHERE lead_id = ? AND tipo IN (${TIPOS_DA_CADEIA.map(() => '?').join(',')}) ORDER BY id`).all(l.id, ...TIPOS_DA_CADEIA);
  return { lead: leadPublico(l), eventos, envios, conversa: conversaDoLead(db, l.id), crenca: lerCrenca(db, l.id, l.etapa), causa: cadeia(doCaminho) };
});

rota('POST', '/api/leads/:id/mensagem', async ({ params, body }) => {
  const t = texto(body.texto, 1000);
  if (!t) throw new HttpError(400, 'mensagem vazia');
  const antes = db.prepare('SELECT * FROM leads WHERE id = ?').get(params.id);
  if (antes) registrarEdicao(db, antes, t); // guarda o original da Maia antes de sobrescrever
  const r = db.prepare("UPDATE leads SET mensagem = ?, mensagem_origem = 'operador', atualizado_em = ? WHERE id = ?").run(t, agora(), params.id);
  if (!r.changes) throw new HttpError(404, 'lead não encontrado');
  return { ok: true };
});

rota('POST', '/api/leads/:id/aprovar', ({ params, body }) => {
  try { aprovarEnvio(db, params.id, body.texto ? texto(body.texto, 1000) : null); } catch (e) { throw new HttpError(409, e.message); }
  return { ok: true };
});

rota('POST', '/api/leads/:id/descartar', ({ params, body }) => {
  const l = db.prepare('SELECT * FROM leads WHERE id = ?').get(params.id);
  if (!l) throw new HttpError(404, 'lead não encontrado');
  const motivo = body.motivo == null ? null : String(body.motivo);
  if (motivo && !MOTIVOS[motivo]) throw new HttpError(400, 'motivo desconhecido');
  db.prepare("UPDATE leads SET etapa = 'descartado', atualizado_em = ? WHERE id = ?").run(agora(), l.id);
  db.prepare("UPDATE envios SET status = 'cancelado' WHERE lead_id = ? AND status = 'aprovado'").run(l.id);
  registrar(db, 'leo', 'descartado', `${l.nome}: descartado por você${motivo ? ` (${MOTIVOS[motivo].toLowerCase()})` : ''}`, { lead_id: l.id, dados: motivo ? { motivo, retrato: retrato(l) } : null });
  // meta-skills: seus motivos repetidos viram proposta de regra (só vale depois que você aceitar)
  for (const h of propor(db)) registrar(db, 'alva', 'habilidade_proposta', `Proposta de regra: quando ${h.quando} → ${h.fornecer}. Aceite ou recuse na Base do Mestre.`, { dados: { habilidade: h.id } });
  // descartar um lead que os agentes recomendaram é o sinal mais claro de gosto do operador
  if (l.decisao && ['qualificado', 'mensagem', 'sem_contato'].includes(l.etapa)) {
    const a = aprender(db, 'aprovacao', l, 0);
    registrar(db, 'nova', 'aprendizado', `Aprendi com seu descarte de ${l.nome} (previa ${Math.round(a.p_antes * 100)}% · ${a.n} exemplos)`, { lead_id: l.id });
  }
  return { ok: true };
});

rota('GET', '/api/decide/stats', () => ({ papeis: estatisticasDecide() }));
rota('GET', '/api/rejeicoes', () => resumoRejeicoes(db));
rota('GET', '/api/aprendizado', () => ({ cabecas: resumoAprendizado(db) }));
rota('GET', '/api/calibracao', () => relatorioCalibracao(db));
rota('GET', '/api/habilidades', () => ({ habilidades: listarHabilidades(db), motivos: MOTIVOS }));
rota('POST', '/api/habilidades/:id/:acao', ({ params }) => {
  try {
    const h = mudarEstado(db, params.id, params.acao);
    registrar(db, 'alva', 'habilidade', `Regra ${{ ativa: 'aceita', descartada: 'recusada', revisada: 'desativada' }[h.estado] || h.estado}: quando ${h.quando}`, { dados: { habilidade: h.id } });
    return { habilidade: h };
  } catch (e) { throw new HttpError(409, e.message); }
});

rota('POST', '/api/leads/:id/enviado-manual', ({ params }) => {
  const l = db.prepare('SELECT * FROM leads WHERE id = ?').get(params.id);
  if (!l) throw new HttpError(404, 'lead não encontrado');
  db.prepare("UPDATE envios SET status = 'enviado', enviado_em = ?, resposta = '{\"manual\":true}' WHERE lead_id = ? AND status = 'aprovado'").run(agora(), l.id);
  db.prepare("UPDATE leads SET etapa = 'enviado', atualizado_em = ? WHERE id = ?").run(agora(), l.id);
  registrar(db, 'leo', 'enviado', `${l.nome}: marcado como enviado à mão (wa.me)`, { lead_id: l.id });
  return { ok: true };
});

// ciclo de resultado: o que acontece depois que você manda a mensagem à mão
const comStatus = (fn) => { try { return fn(); } catch (e) { throw new HttpError(e.status || 409, e.message); } };
rota('POST', '/api/leads/:id/respondeu', ({ params, body }) => comStatus(() => { marcarRespondeu(db, params.id, { sair: Boolean(body.sair) }); return { ok: true }; }));
rota('POST', '/api/leads/:id/fechou', ({ params, body }) => comStatus(() => { const r = fecharNegocio(db, params.id, { valor: body.valor, servico: body.servico }); return { ok: true, valor: r.valor }; }));
rota('POST', '/api/leads/:id/perdeu', ({ params, body }) => comStatus(() => { marcarPerdido(db, params.id, { motivo: body.motivo }); return { ok: true }; }));

rota('POST', '/api/leads/:id/reprocessar', ({ params }) => {
  const l = db.prepare('SELECT id FROM leads WHERE id = ?').get(params.id);
  if (!l) throw new HttpError(404, 'lead não encontrado');
  db.prepare("UPDATE leads SET etapa = 'descoberto', atualizado_em = ? WHERE id = ?").run(agora(), l.id);
  liberar(db, l.id); // o operador pediu: sai do estado "preso" e tenta de novo
  enfileirar(db, 'auditar', l.id);
  return { ok: true };
});

function criarVarredura({ cidade, uf, nicho, fonte, limite, pais = null }) {
  // cidade e estado vêm validados pela lista do IBGE: conserta erro de digitação/voz (Preot → Preto) e acha a UF quando só há uma
  const achada = resolverLocal(texto(cidade, 80), { uf: texto(uf, 20) || null, pais: pais ? codigoDoPais(pais) : null });
  if (!achada.ok) throw new HttpError(400, mensagemCidade(texto(cidade, 80), texto(uf, 20) || null, achada));
  const original = texto(cidade, 80);
  cidade = achada.cidade; uf = achada.uf;
  if (!NICHOS[nicho]) throw new HttpError(400, 'nicho desconhecido');
  if (!FONTES[fonte]) throw new HttpError(400, 'fonte desconhecida');
  const meta = Math.min(Math.max(Math.round(Number(limite)) || META_PADRAO, 1), META_MAXIMA); // sem número dito (voz), o lote é o padrão de 50
  let v = db.prepare('SELECT * FROM varreduras WHERE cidade = ? AND uf = ? AND nicho = ? AND fonte = ?').get(cidade, uf, nicho, fonte);
  if (!v) {
    db.prepare('INSERT INTO varreduras (cidade, uf, nicho, fonte, limite, criado_em, pais) VALUES (?, ?, ?, ?, ?, ?, ?)').run(cidade, uf, nicho, fonte, meta, agora(), achada.pais || 'BR');
    v = db.prepare('SELECT * FROM varreduras WHERE cidade = ? AND uf = ? AND nicho = ? AND fonte = ?').get(cidade, uf, nicho, fonte);
  }
  const lote = pedirLote(v, meta, achada.corrigido ? ` (corrigi "${original}")` : '');
  return { ...db.prepare('SELECT * FROM varreduras WHERE id = ?').get(v.id), lote, correcao: achada.corrigido ? { de: original, para: cidade } : null, uf_inferida: Boolean(achada.ufInferida) };
}

// Pedir uma busca = abrir um LOTE. O portão (src/lotes.mjs) recusa se o lote anterior ainda tem lead esperando você ou os agentes.
// Dar o comando é o que tira a equipe da espera: ela sempre sobe parada.
function pedirLote(v, meta, nota = '') {
  const lote = abrirLote(db, v.id, meta); // lança 409 com o motivo se o portão estiver fechado
  db.prepare('UPDATE varreduras SET ativa = 1, limite = ? WHERE id = ?').run(lote.meta, v.id);
  enfileirar(db, 'varrer', String(v.id), { lote: lote.id });
  registrar(db, 'alva', 'varredura_agendada', `Lote ${lote.numero} de ${NICHOS[v.nicho].rotulo} em ${v.cidade}-${v.uf} entrou na fila (${lote.meta} empresas)${nota}`);
  if (orq.pausado) { orq.pausar(false); registrar(db, 'alva', 'retomada', 'Equipe saiu da espera: você pediu uma busca'); }
  return lote;
}

// catálogo para o formulário: 4 grupos de nichos, estados e cidades por estado (IBGE)
rota('GET', '/api/catalogo', () => ({
  grupos: catalogo(), estados: ESTADOS, fontes: FONTES, termos_maps_por_varredura: TERMOS_MAPS_POR_VARREDURA,
  paises: Object.values(PAISES).map((p) => ({ id: p.id, nome: p.nome, regiao: p.regiao, idioma: p.idioma, ddi: p.ddi })),
  estados_por_pais: Object.fromEntries(PAISES_COM_LOCALIDADES.map((p) => [p, estadosDe(p)])),
}));
rota('GET', '/api/localidades/cidades', ({ url }) => {
  const pais = codigoDoPais(url.searchParams.get('pais'));
  const uf = resolverUF(url.searchParams.get('uf'), pais);
  if (!uf) throw new HttpError(400, 'estado desconhecido');
  return { pais, uf, cidades: cidadesDe(uf, pais) };
});
rota('GET', '/api/localidades/resolver', ({ url }) => {
  const q = texto(url.searchParams.get('cidade'), 80), uf = texto(url.searchParams.get('uf'), 20) || null;
  const p = url.searchParams.get('pais');
  const r = resolverLocal(q, { uf, pais: p ? codigoDoPais(p) : null });
  return { ...r, mensagem: r.ok ? null : mensagemCidade(q, uf, r) };
});
// varredura em lote: um grupo inteiro ou uma lista de nichos na mesma cidade (cada nicho vira uma varredura na fila do Atlas)
const LIMITE_LOTE = 8;
rota('POST', '/api/varreduras/lote', ({ body }) => {
  const ids = Array.isArray(body.nichos) && body.nichos.length ? body.nichos : (GRUPOS[body.grupo] ? nichosDoGrupo(body.grupo) : []);
  if (!ids.length) throw new HttpError(400, 'diga um grupo ou uma lista de nichos');
  if (ids.length > LIMITE_LOTE) throw new HttpError(400, `no máximo ${LIMITE_LOTE} nichos por vez (cada um é uma busca demorada)`);
  const criadas = ids.map((nicho) => criarVarredura({ cidade: body.cidade, uf: body.uf, pais: body.pais, nicho, fonte: body.fonte || 'maps', limite: body.limite }));
  return { varreduras: criadas };
});
rota('GET', '/api/capacidade', ({ url }) => { const c = calcularCapacidade(db, { metaDia: url.searchParams.get('meta'), porLote: Number(url.searchParams.get('por_lote')) || META_PADRAO }); return { ...c, frase: fraseDaCapacidade(c) }; });
rota('GET', '/api/cobertura', () => ({ buscas: cobertura(db).map((b) => ({ ...b, nicho_rotulo: NICHOS[b.nicho]?.rotulo || b.nicho })), meta_padrao: META_PADRAO }));
rota('POST', '/api/varreduras/:id/proximo-lote', ({ params, body }) => {
  const v = db.prepare('SELECT * FROM varreduras WHERE id = ?').get(Number(params.id));
  if (!v) throw new HttpError(404, 'busca não encontrada');
  return { lote: pedirLote(v, body.meta || v.limite) };
});
rota('GET', '/api/varreduras', () => ({ varreduras: db.prepare('SELECT * FROM varreduras ORDER BY id DESC').all().map((v) => ({ ...v, ultimo_resultado: parse(v.ultimo_resultado), nicho_rotulo: NICHOS[v.nicho]?.rotulo })) }));
rota('POST', '/api/varreduras', ({ body }) => ({ varredura: criarVarredura(body) }));
rota('POST', '/api/varreduras/:id/ativa', ({ params, body }) => {
  db.prepare('UPDATE varreduras SET ativa = ? WHERE id = ?').run(body.ativa ? 1 : 0, Number(params.id));
  if (body.ativa) enfileirar(db, 'varrer', params.id);
  return { ok: true };
});

rota('GET', '/api/envios', () => ({
  envios: db.prepare('SELECT e.*, l.nome FROM envios e JOIN leads l ON l.id = e.lead_id WHERE l.sessao_id IS ? ORDER BY e.id DESC LIMIT 200').all(idSessaoAtiva(db)).map((e) => ({ ...e, telefone_fmt: formatarTelefone(e.telefone), resposta: parse(e.resposta) })),
  situacao: situacaoDoEnvio(db),
}));
rota('POST', '/api/envios/:id/cancelar', ({ params }) => {
  const e = db.prepare("SELECT * FROM envios WHERE id = ? AND status = 'aprovado'").get(Number(params.id));
  if (!e) throw new HttpError(404, 'envio não está na fila');
  db.prepare("UPDATE envios SET status = 'cancelado' WHERE id = ?").run(e.id);
  db.prepare("UPDATE leads SET etapa = 'mensagem', atualizado_em = ? WHERE id = ?").run(agora(), e.lead_id);
  return { ok: true };
});

// filtros opcionais: agente (aba Agentes) e lead; sem filtro, igual a antes
rota('GET', '/api/eventos', ({ url }) => {
  const where = ['id > ?'], args = [Number(url.searchParams.get('desde')) || 0];
  const agente = url.searchParams.get('agente');
  if (agente) { if (!AGENTES[agente]) throw new HttpError(400, 'agente desconhecido'); where.push('agente = ?'); args.push(agente); }
  const lead = url.searchParams.get('lead');
  if (lead) { where.push('lead_id = ?'); args.push(texto(lead, 40)); }
  const limite = Math.min(300, Math.max(1, Number(url.searchParams.get('limite')) || 120));
  return { eventos: db.prepare(`SELECT * FROM eventos WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ${limite}`).all(...args) };
});

// grafo de tarefas (TOCOMAS): quem é dono de cada nó, ferramentas, arestas e o que cada nó exige
rota('GET', '/api/grafo', () => ({ nos: NOS, arestas: ARESTAS, requisitos: REQUISITOS }));

// cada nicho como um "universo" (aba Nichos): leads por etapa, varreduras e se a Nova já decide sozinha
rota('GET', '/api/nichos', () => {
  const porEtapa = db.prepare('SELECT nicho, etapa, COUNT(*) n FROM leads WHERE sessao_id IS ? GROUP BY nicho, etapa').all(idSessaoAtiva(db));
  const varreduras = db.prepare('SELECT id, cidade, uf, nicho, fonte, ativa, ultima_execucao FROM varreduras ORDER BY criado_em DESC').all();
  const usados = new Set([...porEtapa.map((r) => r.nicho), ...varreduras.map((v) => v.nicho)]);
  return {
    nichos: Object.entries(NICHOS).map(([id, n]) => {
      const etapas = Object.fromEntries(porEtapa.filter((r) => r.nicho === id).map((r) => [r.etapa, r.n]));
      return { id, rotulo: n.rotulo, usado: usados.has(id), total: Object.values(etapas).reduce((a, b) => a + b, 0), etapas,
        varreduras: varreduras.filter((v) => v.nicho === id), calibracao: prontidao(db, id) };
    }),
  };
});

// sessões de rastreamento (src/sessoes.mjs): nova começa zerada na tela; nada é apagado
rota('GET', '/api/sessoes', () => ({ sessoes: listarSessoes(db), ativa: idSessaoAtiva(db) }));
rota('POST', '/api/sessoes', ({ body }) => {
  const s = novaSessaoDeRastreio(db, texto(body.nome));
  registrar(db, 'alva', 'sessao', `Nova sessão de rastreamento: ${s.nome} (as anteriores ficam guardadas)`);
  return { sessao: s };
});
rota('POST', '/api/sessoes/:id/ativar', ({ params }) => {
  const s = ativarSessao(db, params.id);
  if (!s) throw new HttpError(404, 'sessão não encontrada');
  registrar(db, 'alva', 'sessao', `Voltando para a ${s.nome}`);
  return { sessao: s };
});

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
      so_escuta: Boolean(e.so_escuta),
    },
  };
  salvarAjustes(db, novo);
  // B16: desligar "só celular" libera na hora os leads fixos que estavam parados antes da Maia
  if (atual.envio.so_celular !== false && novo.envio.so_celular === false) {
    const n = reavaliarBloqueados(db);
    if (n) registrar(db, 'alva', 'reavaliacao', `"Só celular" desligado: ${n} lead(s) de telefone fixo foram para a Maia`);
  }
  return { ajustes: novo };
});

rota('POST', '/api/comando', async ({ body }) => {
  const fala = texto(body.texto, 300);
  if (!fala) throw new HttpError(400, 'comando vazio');
  const c = await interpretar(fala);
  let resposta;
  if (c.confianca < LIMIAR_COMANDO) resposta = c.origem === 'modelo_indisponivel' ? 'Não entendi, e o modelo de linguagem está desligado. Tente: "varre barbearias em Franca SP".' : c.intencao !== 'outro' && SUGESTAO[c.intencao] ? `Não tenho certeza (${Math.round(c.confianca * 100)}%). Você quis ${SUGESTAO[c.intencao]}? Se sim, diga de um jeito mais direto.` : `Não entendi (${Math.round(c.confianca * 100)}%). Tente: "varre barbearias em Franca SP".`;
  else if (c.intencao === 'varrer') {
    if (!c.nicho || !c.cidade) resposta = `Entendi que é para varrer, mas faltou ${!c.nicho ? 'o ramo' : 'a cidade'}. Ramos que conheço: ${Object.values(NICHOS).map((n) => n.rotulo).join(', ')}.`;
    else {
      try {
        const v = criarVarredura({ cidade: c.cidade, uf: c.uf, pais: c.pais, nicho: c.nicho, fonte: c.fonte });
        resposta = `Atlas vai varrer ${NICHOS[c.nicho].rotulo} em ${v.cidade}-${v.uf}${v.correcao ? ` (entendi "${v.correcao.de}" como ${v.cidade})` : ''}${v.uf_inferida ? ` (estado ${v.uf} pelo nome da cidade)` : ''}.`;
      } catch (e) { if (!e.status) throw e; resposta = e.message; }
    }
  } else if (c.intencao === 'pausar') { orq.pausar(true); resposta = 'Agentes pausados.'; }
  else if (c.intencao === 'retomar') { orq.pausar(false); resposta = 'Agentes retomados.'; }
  else if (c.intencao === 'resumo') { const b = briefing(db); resposta = `${b.leads} leads, ${b.para_aprovar} mensagens para aprovar, ${b.responderam} responderam, ${b.enviados_hoje} de ${b.limite} envios hoje.`; }
  else if (c.intencao === 'quentes') { const q = contarQuentes(db); resposta = `${q.quentes} lead(s) quente(s) (prioridade ${LIMITE_QUENTE}+), ${q.para_aprovar} esperando sua aprovação.`; }
  else if (c.intencao === 'aprovar_proximo' || c.intencao === 'descartar_proximo') {
    const l = proximoCartao(db);
    if (!l) resposta = 'Não há cartão esperando sua decisão.';
    else if (c.intencao === 'aprovar_proximo') {
      try { aprovarEnvio(db, l.id); resposta = `Aprovei a mensagem para ${l.nome} (prioridade ${l.score ?? '?'}). Ela entra na fila; você envia à mão ou o sistema segue o modo de envio.`; }
      catch (e) { resposta = `Não aprovei ${l.nome}: ${e.message}.`; }
    } else {
      db.prepare("UPDATE leads SET etapa = 'descartado', atualizado_em = ? WHERE id = ?").run(agora(), l.id);
      registrar(db, 'leo', 'descartado', `${l.nome}: descartado por você (comando de voz)`, { lead_id: l.id });
      resposta = `Descartei ${l.nome}.`;
    }
  } else if (c.intencao === 'mais_leads') {
    const v = db.prepare('SELECT v.* FROM varreduras v JOIN lotes l ON l.varredura_id = v.id ORDER BY l.iniciado_em DESC, l.id DESC LIMIT 1').get();
    if (!v) resposta = 'Ainda não há busca para continuar. Diga, por exemplo: "varre dentistas em Franca SP".';
    else {
      try { const l = pedirLote(v, v.limite); resposta = `Atlas vai buscar o lote ${l.numero} de ${NICHOS[v.nicho].rotulo} em ${v.cidade}-${v.uf} (${l.meta} empresas).`; }
      catch (e) { if (!e.status) throw e; resposta = e.message; }
    }
  } else if (c.intencao === 'cidade') {
    if (!c.cidade) resposta = 'Qual cidade? Diga, por exemplo: "troca a cidade para Ribeirão Preto SP".';
    else {
      const achada = resolverLocal(c.cidade, { uf: c.uf, pais: c.pais });
      if (!achada.ok) { resposta = mensagemCidade(c.cidade, c.uf, achada); }
      else {
      const r = trocarCidade(db, achada.cidade, achada.uf, criarVarredura, achada.pais);
      resposta = r.base ? `Troquei para ${achada.cidade}-${achada.uf}${achada.corrigido ? ` (entendi "${c.cidade}")` : ''}: ${r.criadas} varredura(s) nova(s), ${r.desativadas} antiga(s) desativada(s).${r.bloqueadas ? ` ${r.bloqueadas} ficou(aram) de fora porque o lote anterior ainda não foi tratado.` : ''}` : 'Não há varredura anterior para copiar o ramo. Diga: "varre barbearias em ' + c.cidade + '".';
      }
    }
  }
  else resposta = 'Não é um comando que eu sei executar.';
  registrar(db, 'alva', 'comando', `"${fala}" → ${resposta}`, { dados: c });
  return { comando: c, resposta };
});

const configurador = registrarRotasConfigurador({ rota, db, dataDir: CONFIG.dataDir, HttpError });
// identidade visual vem do projeto Agentes Money (mesmos 5 agentes): retrato/ícone lidos de lá, nada copiado.
// Sem a pasta no PC, responde 404 e a tela cai para a letra inicial.
const MONEY_DIR = process.env.AGENTES_MONEY_DIR || path.resolve(ROOT, '..', '..', 'Agentes Money');
const MONEY_URL = process.env.AGENTES_MONEY_URL || 'http://127.0.0.1:3100';
rota('GET', '/api/agentes/identidade', () => ({ landing: MONEY_URL, agentes: Object.fromEntries(Object.keys(AGENTES).map((id) => [id, {
  retrato: fs.existsSync(path.join(MONEY_DIR, `${id}.png`)),
  icone: fs.existsSync(path.join(MONEY_DIR, 'apps/web/public/agents/icones', `${id}.png`)),
  landing: `${MONEY_URL}/preview/${id}`,
}])) }));
rota('GET', '/api/agentes/:id/:tipo', ({ res, params }) => {
  if (!AGENTES[params.id] || !['retrato', 'icone'].includes(params.tipo)) throw new HttpError(404, 'agente não encontrado');
  const f = params.tipo === 'retrato' ? path.join(MONEY_DIR, `${params.id}.png`) : path.join(MONEY_DIR, 'apps/web/public/agents/icones', `${params.id}.png`);
  if (!fs.existsSync(f)) throw new HttpError(404, 'imagem não encontrada no Agentes Money');
  res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=3600' });
  fs.createReadStream(f).pipe(res);
  return SEM_RESPOSTA;
});
rota('GET', '/api/anexos/:arquivo', ({ res, params }) => { configurador.servirAnexo(res, params.arquivo); return SEM_RESPOSTA; });

rota('POST', '/webhooks/openwa', ({ url, body }) => {
  const tok = url.searchParams.get('token') || '';
  const esperado = CONFIG.webhookToken;
  if (!esperado || tok.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(esperado))) throw new HttpError(401, 'token inválido');
  // o provedor (hoje o OpenWA) fica atrás de envio/canal.mjs: aqui só chegam eventos já normalizados
  const e = lerEvento(body);
  if (e.tipo === 'conexao') {
    const c = registrarConexao(db, { status: e.status, restricao: e.evento === 'session.restriction' ? e.restricao : null });
    if (c.mudou) {
      const motivo = envioPausadoPelaConexao(db);
      registrar(db, 'leo', 'whatsapp', `WhatsApp: ${e.evento === 'session.restriction' ? (e.restricao ? 'restrição na conta' : 'restrição levantada') : `sessão ${e.status}`}${motivo ? `. Envio pausado: ${motivo}` : ''}`, { dados: { evento: e.evento } });
    }
    return { ok: true };
  }
  if (e.tipo === 'recibo') { return { ok: true, resultado: avancarEstado(db, e.waId, e.recibo, e.erro) }; }
  if (e.tipo === 'mensagem') {
    const lead = receberMensagem(db, e);
    if (!lead && e.telefone && !e.deMim) registrar(db, 'leo', 'webhook', `Evento ${e.evento || '?'} de número fora da base`, { dados: { evento: e.evento } });
  }
  return { ok: true };
});

// ---------- WhatsApp (OpenWA): conectar pelo QR, status e um teste para o seu próprio número
const exigirChave = () => { if (!temChave()) throw new HttpError(409, 'OpenWA sem chave: defina OPENWA_API_KEY no .env (o OpenWA grava a chave em data/.api-key no 1º boot)'); };
rota('GET', '/api/whatsapp', async () => ({ chave: temChave(), sessao: sessaoId(), ...(await saudeOpenwa()), envio_pausado_por: envioPausadoPelaConexao(db), entrega: resumoDeEntrega(db) }));
rota('POST', '/api/whatsapp/conectar', async () => {
  exigirChave();
  if (!CONFIG.webhookToken || CONFIG.webhookToken.length < 16) throw new HttpError(409, 'defina WEBHOOK_TOKEN (16+ caracteres) no .env');
  try {
    const id = await garantirSessao();
    definirSessao(id); salvarFlag(db, 'openwa_sessao', id);
    const s = await saudeOpenwa();
    if (!s.ok && !['qr_ready', 'initializing', 'authenticating'].includes(s.status)) await iniciarSessao();
    const webhook = await garantirWebhook(`http://127.0.0.1:${CONFIG.port}/webhooks/openwa?token=${CONFIG.webhookToken}`, CONFIG.webhookToken);
    registrar(db, 'leo', 'whatsapp', `Sessão do WhatsApp iniciada; webhook ${webhook}. Escaneie o QR no Painel.`);
    return { sessao: id, webhook, ...(await saudeOpenwa()) };
  } catch (e) { throw new HttpError(502, e.message); }
});
rota('GET', '/api/whatsapp/qr', async () => {
  exigirChave();
  try { return await qrSessao(); } catch (e) { return { qrCode: null, ...(await saudeOpenwa()), aviso: e.message }; }
});
// o único envio que não passa pela fila: para o seu próprio número, para provar que a conexão funciona
rota('POST', '/api/whatsapp/teste', async () => {
  const s = await saudeOpenwa();
  if (!s.ok || !s.telefone) throw new HttpError(409, `WhatsApp não está pronto (${s.status || s.erro || 'sem sessão'})`);
  try {
    const texto = 'Teste do Prospector: o WhatsApp está conectado. Nenhum cliente recebeu esta mensagem.';
    const resp = await enviarTexto(s.telefone, texto);
    // entra na conversa (sem lead): quando o recibo de entrega/leitura chegar pelo webhook, o estado avança e dá para conferir o caminho todo
    registrarMensagem(db, { leadId: null, telefone: s.telefone, direcao: 'saida', origem: 'sistema', texto, waId: canal.idDaResposta(resp), status: 'enviada' });
  }
  catch (e) { throw new HttpError(502, e.message); }
  registrar(db, 'leo', 'whatsapp', `Teste enviado para o seu próprio número (${formatarTelefone(s.telefone)})`);
  return { ok: true, telefone: s.telefone };
});

const limitador = criarLimitador();
rota('POST', '/api/entrar', ({ req, res, body }) => {
  if (!CONFIG.acessoSenha && !CONFIG.espectadorSenha) throw new HttpError(403, 'acesso remoto desligado (defina ACESSO_SENHA no .env)');
  const ip = ipDe(req);
  if (limitador.bloqueado(ip)) throw new HttpError(429, 'muitas tentativas; espere 10 minutos');
  const https = req.headers['x-forwarded-proto'] === 'https';
  const senha = String(body.senha ?? '');
  if (CONFIG.espectadorSenha && CONFIG.espectadorSenha.length >= 8 && iguais(senha, CONFIG.espectadorSenha)) {
    res.setHeader('Set-Cookie', cookieSessao(criarSessao(CONFIG.espectadorSenha), https, COOKIE_ESPECTADOR));
    return { ok: true, espectador: true };
  }
  if (!iguais(senha, CONFIG.acessoSenha)) { limitador.errou(ip); throw new HttpError(401, 'senha incorreta'); }
  res.setHeader('Set-Cookie', cookieSessao(criarSessao(CONFIG.acessoSenha), https));
  return { ok: true };
});
rota('POST', '/api/sair', ({ res }) => { res.setHeader('Set-Cookie', cookieSair()); return { ok: true }; });

// quem não está no próprio PC só passa com sessão válida
function barrarRemoto(req, res, url) {
  if (CONFIG.demo) return barrarNaDemo(req, res, url);
  if (ehLocal(req)) return false;
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (LIVRES.has(url.pathname) || url.pathname.startsWith('/webhooks/')) return false;
  if (CONFIG.acessoSenha && sessaoValida(CONFIG.acessoSenha, lerCookie(req))) return false;
  // espectador: só leitura, em lista fechada, com telefones mascarados (src/espectador.mjs)
  if (CONFIG.espectadorSenha?.length >= 8 && sessaoValida(CONFIG.espectadorSenha, lerCookie(req, COOKIE_ESPECTADOR))) {
    if (!permitido(req.method, url.pathname)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ erro: 'modo espectador: só dá para olhar' }));
      return true;
    }
    req.espectador = true;
    if (url.pathname === '/api/stream') { const w = res.write.bind(res); res.write = (c, ...r) => w(typeof c === 'string' ? mascarar(c) : c, ...r); }
    return false;
  }
  if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
    res.writeHead(302, { Location: `/entrar.html?volta=${encodeURIComponent(url.pathname)}` }).end();
  } else {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ erro: 'entre com a senha' }));
  }
  return true;
}

// demonstração: aberta a todos, mas só a sandbox (aprovar/descartar/editar dados fictícios); nada
// que varra de verdade, chame modelo, mexa em ajustes ou WhatsApp
function barrarNaDemo(req, res, url) {
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method === 'GET' && url.pathname !== '/api/whatsapp/qr') return false;
  if (!BLOQUEADAS_NA_DEMO.some((r) => r.test(url.pathname))) return false;
  res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ erro: 'na demonstração isso fica desligado' }));
  return true;
}

function sse(req, res) {
  // X-Accel-Buffering: proxies (Netlify, nginx) não seguram os eventos; ping curto mantém a conexão viva
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  const envia = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  barramento.on('evento', envia);
  const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
  req.on('close', () => { barramento.off('evento', envia); clearInterval(ping); });
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8' };

function arquivo(req, res, p) {
  const alvo = path.normalize(path.join(PUBLIC, p === '/' ? 'index.html' : p));
  if (!alvo.startsWith(PUBLIC) || !fs.existsSync(alvo) || fs.statSync(alvo).isDirectory()) { res.writeHead(404).end('não encontrado'); return; }
  // ETag por tamanho+data: o navegador revalida e recebe 304 em vez de baixar de novo.
  // Modelos 3D quase nunca mudam: guardados 1 dia sem nem perguntar.
  const st = fs.statSync(alvo);
  const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
  const cache = p.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache';
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': cache }).end(); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo)] || 'application/octet-stream', 'Cache-Control': cache, ETag: etag });
  fs.createReadStream(alvo).pipe(res);
}

// CSP: o front usa <script>/<style> inline e Three.js via jsDelivr, então 'unsafe-inline' fica; o resto é fechado
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: https:; font-src 'self' data:; connect-src 'self' blob: data: https://cdn.jsdelivr.net; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    if (barrarRemoto(req, res, url)) return;
    if (url.pathname === '/api/stream') return sse(req, res);
    const r = rotas.find((x) => x.metodo === req.method && x.re.test(url.pathname));
    if (!r) {
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) return arquivo(req, res, url.pathname);
      throw new HttpError(404, 'rota não encontrada');
    }
    // escrita só por JSON vindo do próprio painel: bloqueia formulário de outro site (CSRF) contra o localhost
    if (req.method === 'POST' && !url.pathname.startsWith('/webhooks/') && !String(req.headers['content-type']).includes('application/json')) throw new HttpError(415, 'use application/json');
    // anexo vem em base64 (+33%): limite maior só nessa rota
    const limite = url.pathname.endsWith('/anexo') ? Math.ceil(LIMITE_ANEXO * 1.4) + 4096 : undefined;
    const body = req.method === 'POST' ? await lerCorpo(req, limite) : {};
    const out = await r.fn({ req, res, url, body, params: url.pathname.match(r.re).groups || {} });
    if (out === SEM_RESPOSTA) return;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(req.espectador ? mascarar(JSON.stringify(out)) : JSON.stringify(out));
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ erro: e.message }));
  }
});

// 127.0.0.1: nada da rede chega direto. Acesso de fora só pelo túnel, e aí com senha (src/acesso.mjs).
// A demonstração (DEMO=1) escuta em 0.0.0.0 porque roda num servidor na nuvem (Render).
servidor.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`Prospector em http://${CONFIG.host}:${CONFIG.port}  ${CONFIG.demo ? '(DEMONSTRAÇÃO: dados fictícios)' : `(decisão: ${CONFIG.decideBackend}/${CONFIG.decideModel})`}`);
  orq.iniciar();
  if (!CONFIG.demo) {
    const fazer = () => { try { const b = backupDiario(db, CONFIG.dataDir); if (b.criado) console.log(`backup diário: ${b.arquivo}`); } catch (e) { console.error('backup diário falhou:', e.message); } };
    fazer();
    setInterval(fazer, 6 * 3600_000).unref();
  }
});

for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => { orq.parar(); servidor.close(); db.close(); process.exit(0); });
