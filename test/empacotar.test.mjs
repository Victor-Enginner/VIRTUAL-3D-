import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { cifrar, decifrar } from '../scripts/empacotar.mjs';

test('banco criptografado volta igual com a senha certa', () => {
  const original = crypto.randomBytes(5000);
  const enc = cifrar(original, 'senha-forte-123');
  assert.ok(!enc.includes(original.subarray(0, 32)), 'o conteúdo não aparece em claro');
  assert.deepEqual(decifrar(enc, 'senha-forte-123'), original);
});

test('senha errada ou arquivo adulterado é recusado', () => {
  const enc = cifrar(Buffer.from('dados'), 'senha-forte-123');
  assert.throws(() => decifrar(enc, 'outra-senha-456'), /senha errada/);
  enc[enc.length - 1] ^= 1;
  assert.throws(() => decifrar(enc, 'senha-forte-123'), /senha errada/);
  assert.throws(() => decifrar(Buffer.from('qualquer coisa'), 'x'), /não é um banco/);
});
