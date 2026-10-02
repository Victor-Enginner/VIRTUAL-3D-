import test from 'node:test';
import assert from 'node:assert/strict';
import { criarLimitador, criarSessao, ehLocal, lerCookie, sessaoValida } from '../src/acesso.mjs';

const req = (ip, headers = {}) => ({ socket: { remoteAddress: ip }, headers });

test('local só sem cabeçalho de túnel', () => {
  assert.equal(ehLocal(req('127.0.0.1')), true);
  assert.equal(ehLocal(req('::1')), true);
  assert.equal(ehLocal(req('127.0.0.1', { 'cf-connecting-ip': '200.1.2.3' })), false); // veio pelo cloudflared
  assert.equal(ehLocal(req('127.0.0.1', { 'x-forwarded-for': '200.1.2.3' })), false);
  assert.equal(ehLocal(req('192.168.0.10')), false);
});

test('sessão assinada: vale com a senha certa, expira e cai ao trocar a senha', () => {
  const s = criarSessao('senha-a', 1_800_000_000);
  assert.equal(sessaoValida('senha-a', s, 1_800_000_001), true);
  assert.equal(sessaoValida('senha-b', s, 1_800_000_001), false);
  assert.equal(sessaoValida('senha-a', s, 1_800_000_000 + 8 * 24 * 3600), false);
  assert.equal(sessaoValida('senha-a', s.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), 1_800_000_001), false);
  assert.equal(sessaoValida('senha-a', 'lixo', 1_800_000_001), false);
});

test('cookie é lido entre outros', () => {
  assert.equal(lerCookie(req('x', { cookie: 'a=1; prospector_sessao=abc.def; b=2' })), 'abc.def');
  assert.equal(lerCookie(req('x', {})), null);
});

test('limitador: 5 erros por IP, 20 no total, janela de 10 min', () => {
  let t = 0;
  const l = criarLimitador({ relogio: () => t });
  for (let i = 0; i < 5; i++) l.errou('1.1.1.1');
  assert.equal(l.bloqueado('1.1.1.1'), true);
  assert.equal(l.bloqueado('2.2.2.2'), false);
  for (let i = 0; i < 15; i++) l.errou(`9.9.9.${i}`);
  assert.equal(l.bloqueado('2.2.2.2'), true); // teto global
  t = 10 * 60_000 + 1;
  assert.equal(l.bloqueado('1.1.1.1'), false);
});
