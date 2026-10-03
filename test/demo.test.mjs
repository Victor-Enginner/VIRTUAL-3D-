// Demonstração pública (DEMO=1): só dados fictícios, só a sandbox aberta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.mjs';
import { semearDemo, criarSimulador, BLOQUEADAS_NA_DEMO } from '../src/demo.mjs';

test('demo: todas as empresas são fictícias e marcadas "(exemplo)"', () => {
  const db = abrirBanco(':memory:');
  semearDemo(db);
  const leads = db.prepare('SELECT nome, telefone, site FROM leads').all();
  assert.ok(leads.length >= 15);
  for (const l of leads) {
    assert.match(l.nome, /\(exemplo\)$/);
    if (l.site) assert.match(l.site, /\.invalid$/, 'site fictício não aponta para domínio real');
    assert.match(l.telefone, /^55\d{2}[39]0000\d{4}$/, 'telefone no padrão fictício');
  }
  const etapas = new Set(db.prepare('SELECT DISTINCT etapa FROM leads').all().map((r) => r.etapa));
  for (const e of ['descoberto', 'mensagem', 'enviado', 'respondeu']) assert.ok(etapas.has(e), `pipeline sem ${e}`);
});

test('demo: rotas que mexem fora da sandbox ficam bloqueadas; aprovar/descartar não', () => {
  const bloqueada = (p) => BLOQUEADAS_NA_DEMO.some((r) => r.test(p));
  for (const p of ['/api/comando', '/api/varreduras', '/api/varreduras/1/ativa', '/api/ajustes', '/api/whatsapp/conectar', '/api/config-agentes', '/api/agentes/pausar', '/api/leads/x/reprocessar', '/webhooks/openwa'])
    assert.ok(bloqueada(p), p);
  for (const p of ['/api/leads/x/aprovar', '/api/leads/x/descartar', '/api/leads/x/mensagem', '/api/habilidades/x/aceitar'])
    assert.ok(!bloqueada(p), p);
});

test('demo: simulador tem a mesma interface do orquestrador', () => {
  const db = abrirBanco(':memory:');
  semearDemo(db);
  const s = criarSimulador(db);
  const e = s.estado();
  assert.deepEqual(Object.keys(e).sort(), ['alva', 'atlas', 'leo', 'maia', 'nova']);
  for (const a of Object.values(e)) assert.ok(['ocioso', 'trabalhando', 'pausado'].includes(a.status));
  assert.equal(typeof s.controlador.ultimas(), 'object');
  s.pausar(true); assert.equal(s.pausado, true);
});
