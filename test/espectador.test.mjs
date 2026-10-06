import test from 'node:test';
import assert from 'node:assert/strict';
import { ehLocal } from '../src/acesso.mjs';
import { mascarar, ocultarNumero, permitido } from '../src/espectador.mjs';

const req = (ip, headers = {}) => ({ socket: { remoteAddress: ip }, headers });

test('espectador: só lê, em lista fechada de rotas', () => {
  assert.equal(permitido('GET', '/api/estado'), true);
  assert.equal(permitido('GET', '/api/leads'), true);
  assert.equal(permitido('GET', '/sala.html'), true);
  assert.equal(permitido('POST', '/api/estado'), false);
  assert.equal(permitido('POST', '/api/leads/abc/aprovar'), false);
  assert.equal(permitido('GET', '/api/ajustes'), false);
  assert.equal(permitido('GET', '/api/whatsapp/qr'), false);
  assert.equal(permitido('GET', '/api/whatsapp/status'), false);
});

test('espectador: telefones saem mascarados, o resto do JSON fica igual', () => {
  assert.equal(ocultarNumero('5516991740262'), '•••••••••••62');
  const json = JSON.stringify({ nome: 'Clínica X', telefone: '5516991740262', telefone_tipo: 'celular', nota: 5 });
  const m = JSON.parse(mascarar(json));
  assert.equal(m.telefone, '•••••••••••62');
  assert.equal(m.telefone_tipo, 'celular');
  assert.equal(m.nome, 'Clínica X');
  assert.equal(m.nota, 5);
});

test('quem chega pelo túnel nunca é "local", mesmo vindo do loopback e sem cabeçalho de proxy', () => {
  assert.equal(ehLocal(req('127.0.0.1', { host: '127.0.0.1:4300' })), true);
  assert.equal(ehLocal(req('127.0.0.1', { host: 'localhost:4300' })), true);
  assert.equal(ehLocal(req('127.0.0.1', { host: '8765qg53-4300.brs.devtunnels.ms' })), false);
});
