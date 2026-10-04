// B15 (arXiv 2610.01768): a busca na web não pode ser canal de saída nem alcançar a rede interna.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { auditarSite, buscarSeguro, lookupSeguro, ORIGENS_CONFIAVEIS } from '../src/auditoria.mjs';

test('só maps e osm são origens confiáveis', () => {
  assert.deepEqual([...ORIGENS_CONFIAVEIS].sort(), ['maps', 'osm']);
});

test('URL sem origem ou de texto livre/modelo é recusada antes de qualquer rede', async () => {
  for (const origem of [undefined, 'modelo', 'texto_livre', 'site', 'resposta_whatsapp', 'demo']) {
    await assert.rejects(buscarSeguro('https://exemplo.com.br/?lead=5516999999999', { origem }), /origem da URL não confiável/);
  }
  const r = await auditarSite('https://exemplo.com.br', 'modelo');
  assert.match(r.erro, /origem da URL não confiável/);
});

test('lookup da conexão recusa nome que resolve para IP interno (anti-rebinding)', async () => {
  const res = await new Promise((ok) => lookupSeguro('localhost', {}, (err, ...r) => ok({ err, r })));
  assert.match(res.err?.message ?? '', /destino interno recusado/);
  const todos = await new Promise((ok) => lookupSeguro('localhost', { all: true }, (err) => ok(err)));
  assert.match(todos?.message ?? '', /destino interno recusado/);
});

test('servidor na própria máquina é inalcançável mesmo com origem confiável', async () => {
  let acessos = 0;
  const srv = http.createServer((q, s) => { acessos++; s.end('segredo'); });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const porta = srv.address().port;
  try {
    await assert.rejects(buscarSeguro(`http://127.0.0.1:${porta}/`, { origem: 'maps' }), /destino interno recusado/);
    await assert.rejects(buscarSeguro(`http://localhost:${porta}/`, { origem: 'osm' }), /destino interno recusado/);
    await assert.rejects(buscarSeguro(`http://[::1]:${porta}/`, { origem: 'maps' }), /destino interno recusado/);
    assert.equal(acessos, 0, 'nenhuma conexão chegou ao servidor interno');
  } finally { srv.close(); }
});

test('endereço com esquema estranho nunca lê arquivo: sem http:// ele vira nome de host e falha', async () => {
  await assert.rejects(buscarSeguro('file:///etc/passwd', { origem: 'maps' }));
});
