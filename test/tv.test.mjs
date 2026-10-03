// TV ao vivo da Sala 3D: só aceita link de canal da Famelack e sinal HLS por HTTPS (dado de terceiro).
import test from 'node:test';
import assert from 'node:assert/strict';
import { lerLinkFamelack, streamValido } from '../public/sala/tv-canal.js';

test('link da Famelack: país e id, mesmo colado no meio de um texto', () => {
  assert.deepEqual(lerLinkFamelack('https://famelack.com/tv/br/lua1c7mx0j9rv8'), { pais: 'br', id: 'lua1c7mx0j9rv8' });
  assert.deepEqual(lerLinkFamelack('olha esse: famelack.com/tv/US/abc123xyz?x=1'), { pais: 'us', id: 'abc123xyz' });
  assert.equal(lerLinkFamelack('https://youtube.com/watch?v=1'), null);
  assert.equal(lerLinkFamelack(''), null);
});

test('sinal: só HTTPS terminando em .m3u8, sem aspas nem espaço', () => {
  assert.equal(streamValido('https://cdn.live.br1.jmvstream.com/w/LVW-9359/LVW9359_XSyReL0QVf/playlist.m3u8'), true);
  assert.equal(streamValido('https://x.com/a.m3u8?token=1'), true);
  assert.equal(streamValido('http://x.com/a.m3u8'), false);
  assert.equal(streamValido('https://x.com/a.mp4'), false);
  assert.equal(streamValido('javascript:alert(1)//.m3u8'), false);
  assert.equal(streamValido('https://x.com/a.m3u8" onerror="x'), false);
});
