// Integração HTTP: sobe o servidor de verdade num banco temporário e exercita as rotas do painel.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { abrirBanco } from '../src/db.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
let srv, base, tmp;

const portaLivre = () => new Promise((ok) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });
const chamar = async (metodo, rota, corpo) => {
  const r = await fetch(base + rota, { method: metodo, headers: corpo !== undefined ? { 'Content-Type': 'application/json' } : {}, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
  const txt = await r.text();
  let json = null; try { json = JSON.parse(txt); } catch { /* HTML etc. */ }
  return { status: r.status, json, headers: r.headers, txt };
};
const MSG = 'Oi, vi que a barbearia ainda não tem site e preparei uma ideia rápida. Posso mandar o exemplo?';
const lead = (db, id, nome, etapa, extra = {}) => db.prepare(`INSERT INTO leads (id, nome, fonte, etapa, criado_em, atualizado_em, cidade, uf, nicho, telefone, telefone_tipo, situacao_site, mensagem, decisao)
  VALUES (?, ?, 'maps', ?, 't', 't', 'Franca', 'SP', 'barbearia', ?, 'celular', 'sem_site', ?, '{"answers":{"abordagem":{"choice":"ser_encontrado"}}}')`).run(id, nome, etapa, extra.tel ?? null, extra.msg ?? null);

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prospector-http-'));
  const db = abrirBanco(tmp);
  lead(db, 'R1', 'Respondeu Ltda', 'enviado', { tel: '5516999990001' });
  lead(db, 'F1', 'Fechou Ltda', 'enviado', { tel: '5516999990002' });
  lead(db, 'P1', 'Perdeu Ltda', 'enviado', { tel: '5516999990003' });
  lead(db, 'A1', 'Aprovar Ltda', 'mensagem', { tel: '5516999990004', msg: MSG });
  lead(db, 'D1', 'Descartar Ltda', 'mensagem', { tel: '5516999990005', msg: MSG });
  lead(db, 'M1', 'Manual Ltda', 'mensagem', { tel: '5516999990006', msg: MSG });
  db.close();
  const porta = await portaLivre();
  base = `http://127.0.0.1:${porta}`;
  srv = spawn(process.execPath, ['src/server.mjs'], { cwd: RAIZ, env: { ...process.env, PORT: String(porta), DATA_DIR: tmp, ACESSO_SENHA: '', OPENWA_URL: 'http://127.0.0.1:1', OLLAMA_URL: 'http://127.0.0.1:1' }, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/saude')).ok) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 150)); }
  await chamar('POST', '/api/agentes/pausar', {}); // nenhum agente mexe nos leads durante o teste
});
after(() => { srv?.kill(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* o Windows às vezes segura o arquivo */ } });

test('/api/saude responde com banco migrado e backup diário', async () => {
  const r = await chamar('GET', '/api/saude');
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.ok(r.json.banco >= 5);
  assert.equal(r.json.leads, 6);
  assert.match(r.json.ultimo_backup, /^diario-\d{4}-\d{2}-\d{2}\.db$/);
});

test('todas as respostas levam CSP, nosniff e Referrer-Policy', async () => {
  for (const rota of ['/', '/api/saude', '/nao-existe.js']) {
    const r = await chamar('GET', rota);
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'.*object-src 'none'.*frame-ancestors 'none'/, rota);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff', rota);
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer', rota);
  }
});

test('leitura: páginas e rotas GET do painel', async () => {
  for (const rota of ['/', '/sala.html', '/base.html', '/api/estado', '/api/leads', '/api/leads?etapa=mensagem', '/api/leads?q=Fechou', '/api/leads/R1', '/api/aprendizado', '/api/calibracao', '/api/habilidades', '/api/varreduras', '/api/envios', '/api/eventos', '/api/eventos?agente=nova', '/api/grafo', '/api/nichos', '/api/rejeicoes']) {
    const r = await chamar('GET', rota);
    assert.equal(r.status, 200, rota);
  }
  assert.equal((await chamar('GET', '/api/leads')).json.leads.length, 6);
  assert.equal((await chamar('GET', '/api/leads/R1')).json.lead.nome, 'Respondeu Ltda');
});

test('erros: 404, 415 e corpo inválido', async () => {
  assert.equal((await chamar('GET', '/api/leads/NAO')).status, 404);
  assert.equal((await chamar('GET', '/api/nao-existe')).status, 404);
  const r415 = await fetch(base + '/api/agentes/retomar', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
  assert.equal(r415.status, 415);
  assert.equal((await chamar('POST', '/api/leads/NAO/mensagem', { texto: 'oi' })).status, 404);
  assert.equal((await chamar('POST', '/api/leads/A1/mensagem', { texto: '' })).status, 400);
});

test('ciclo de resultado: respondeu, fechou, perdeu', async () => {
  assert.equal((await chamar('POST', '/api/leads/R1/respondeu', {})).status, 200);
  assert.equal((await chamar('GET', '/api/leads/R1')).json.lead.etapa, 'respondeu');
  assert.equal((await chamar('POST', '/api/leads/F1/fechou', { valor: 1800, servico: 'Landing page' })).json.valor, 1800);
  assert.equal((await chamar('GET', '/api/leads/F1')).json.lead.etapa, 'fechado');
  assert.equal((await chamar('POST', '/api/leads/P1/perdeu', { motivo: 'sem_interesse' })).status, 200);
  assert.equal((await chamar('GET', '/api/leads/P1')).json.lead.etapa, 'perdido');
});

test('mensagem, aprovar, cancelar envio, enviado à mão, descartar, reprocessar', async () => {
  assert.equal((await chamar('POST', '/api/leads/A1/mensagem', { texto: MSG + ' Abraço.' })).status, 200);
  assert.equal((await chamar('GET', '/api/leads/A1')).json.lead.mensagem_origem, 'operador');
  assert.equal((await chamar('POST', '/api/leads/A1/aprovar', {})).status, 200);
  assert.equal((await chamar('GET', '/api/leads/A1')).json.lead.etapa, 'aprovado');
  const { envios } = (await chamar('GET', '/api/envios')).json;
  assert.equal(envios.length, 1);
  assert.equal((await chamar('POST', `/api/envios/${envios[0].id}/cancelar`, {})).status, 200);
  assert.equal((await chamar('POST', `/api/envios/${envios[0].id}/cancelar`, {})).status, 404);

  assert.equal((await chamar('POST', '/api/leads/M1/aprovar', {})).status, 200);
  assert.equal((await chamar('POST', '/api/leads/M1/enviado-manual', {})).status, 200);
  assert.equal((await chamar('GET', '/api/leads/M1')).json.lead.etapa, 'enviado');

  assert.equal((await chamar('POST', '/api/leads/D1/descartar', { motivo: 'motivo_que_nao_existe' })).status, 400);
  assert.equal((await chamar('POST', '/api/leads/D1/descartar', {})).status, 200);
  assert.equal((await chamar('GET', '/api/leads/D1')).json.lead.etapa, 'descartado');
  assert.equal((await chamar('POST', '/api/leads/D1/reprocessar', {})).status, 200);
  assert.equal((await chamar('GET', '/api/leads/D1')).json.lead.etapa, 'descoberto');
});

test('varreduras: criar, validar, ativar e desativar', async () => {
  assert.equal((await chamar('POST', '/api/varreduras', { cidade: '', uf: 'SP', nicho: 'estetica', fonte: 'maps' })).status, 400);
  assert.equal((await chamar('POST', '/api/varreduras', { cidade: 'Franca', uf: 'SP', nicho: 'nichoinexistente', fonte: 'maps' })).status, 400);
  const v = (await chamar('POST', '/api/varreduras', { cidade: 'Franca', uf: 'SP', nicho: 'estetica', fonte: 'maps', limite: 10 })).json.varredura;
  assert.equal(v.cidade, 'Franca');
  assert.equal((await chamar('POST', `/api/varreduras/${v.id}/ativa`, { ativa: false })).status, 200);
  assert.equal((await chamar('GET', '/api/varreduras')).json.varreduras.find((x) => x.id === v.id).ativa, 0);
});

test('ajustes, pausa/retomada e comando por regra', async () => {
  const a = (await chamar('POST', '/api/ajustes', { remetente_nome: 'Victor', envio: { limite_diario: 99, so_escuta: true } })).json.ajustes;
  assert.equal(a.remetente_nome, 'Victor');
  assert.equal(a.envio.limite_diario, 50); // teto
  assert.equal((await chamar('POST', '/api/agentes/retomar', {})).status, 200);
  assert.equal((await chamar('POST', '/api/agentes/pausar', {})).status, 200);
  assert.equal((await chamar('GET', '/api/saude')).json.pausado, true);
  assert.equal((await chamar('POST', '/api/comando', { texto: '' })).status, 400);
  const c = await chamar('POST', '/api/comando', { texto: 'pausar' });
  assert.equal(c.status, 200);
  assert.ok(c.json.resposta);
});

test('habilidades e WhatsApp: a rota existe e falha com educação sem o OpenWA', async () => {
  assert.ok((await chamar('POST', '/api/habilidades/inexistente/aceitar', {})).status >= 400);
  assert.equal((await chamar('GET', '/api/whatsapp')).status, 200);
});

test('acesso remoto desligado: /api/entrar recusa e /api/sair limpa o cookie', async () => {
  assert.equal((await chamar('POST', '/api/entrar', { senha: 'x' })).status, 403);
  const s = await chamar('POST', '/api/sair', {});
  assert.equal(s.status, 200);
  assert.ok(s.headers.get('set-cookie'));
});

test('comandos de voz novos pelo HTTP: quentes, aprovar o próximo, trocar a cidade', async () => {
  const q = await chamar('POST', '/api/comando', { texto: 'quantos leads quentes' });
  assert.match(q.json.resposta, /quente/);
  const a = await chamar('POST', '/api/comando', { texto: 'aprova o próximo' });
  assert.equal(a.status, 200);
  assert.match(a.json.resposta, /Aprovei|Não aprovei|Não há cartão/);
  const c = await chamar('POST', '/api/comando', { texto: 'troca a cidade para Batatais SP' });
  assert.equal(c.status, 200);
  assert.match(c.json.resposta, /Troquei para Batatais-SP|Não há varredura anterior/);
});
