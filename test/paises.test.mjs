import test from 'node:test';
import assert from 'node:assert/strict';
import { codigoDoPais, normalizarTelefoneDoPais as n, normalizarTelefonePT, normalizarTelefonePY, paisDe, PAISES } from '../src/paises.mjs';

test('Brasil continua igual (padrão quando não diz o país)', () => {
  assert.deepEqual(n('(16) 99385-0531', 'BR'), { telefone: '5516993850531', tipo: 'celular' });
  assert.equal(codigoDoPais(undefined), 'BR');
  assert.equal(codigoDoPais('xx'), 'BR');
  assert.equal(paisDe('PT').idioma, 'pt-PT');
});

test('Portugal: móvel 9x, fixo 2x, com ou sem +351/00351, e recusa número de serviço', () => {
  assert.deepEqual(normalizarTelefonePT('+351 912 345 678'), { telefone: '351912345678', tipo: 'celular' });
  assert.deepEqual(normalizarTelefonePT('00351 21 123 4567'), { telefone: '351211234567', tipo: 'fixo' });
  assert.deepEqual(normalizarTelefonePT('934 567 890'), { telefone: '351934567890', tipo: 'celular' });
  assert.deepEqual(normalizarTelefonePT('808 200 000'), { telefone: null, tipo: null });
  assert.deepEqual(normalizarTelefonePT('12345'), { telefone: null, tipo: null });
  assert.deepEqual(normalizarTelefonePT('(16) 99385-0531'), { telefone: null, tipo: null }); // número do Brasil não vale em Portugal
});

test('Paraguai: móvel 09xx com o 0 nacional, +595, e fixo com código de área', () => {
  assert.deepEqual(normalizarTelefonePY('0981 123 456'), { telefone: '595981123456', tipo: 'celular' });
  assert.deepEqual(normalizarTelefonePY('+595 971 654 321'), { telefone: '595971654321', tipo: 'celular' });
  assert.deepEqual(normalizarTelefonePY('(021) 212 345'), { telefone: '59521212345', tipo: 'fixo' });
  assert.deepEqual(normalizarTelefonePY('061 512 345'), { telefone: '59561512345', tipo: 'fixo' });
  assert.deepEqual(normalizarTelefonePY('123'), { telefone: null, tipo: null });
});

test('cada país tem DDI, idioma e parâmetros de busca', () => {
  for (const p of Object.values(PAISES)) {
    assert.ok(p.ddi && p.idioma && p.maps.hl && p.maps.gl && p.maps.avaliacao && p.osm.iso && p.osm.nivel, p.id);
  }
});

test('telefone mostrado na tela respeita o país (o Brasil não mudou)', async () => {
  const { formatarTelefone } = await import('../src/regras.mjs');
  assert.equal(formatarTelefone('5516993850531'), '(16) 99385-0531');
  assert.equal(formatarTelefone('551637221000'), '(16) 3722-1000');
  assert.equal(formatarTelefone('351960403461'), '+351 960 403 461');
  assert.equal(formatarTelefone('351211234567'), '+351 211 234 567');
  assert.equal(formatarTelefone('595981123456'), '+595 981 123 456');
  assert.equal(formatarTelefone('59521212345'), '+595 21 212 345');
  assert.equal(formatarTelefone(null), '');
});
