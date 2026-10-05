import test from 'node:test';
import assert from 'node:assert/strict';
import { cidadesDe, ESTADOS, mensagemCidade, resolverCidade, resolverUF, totalMunicipios } from '../src/localidades.mjs';
import { catalogo, GRUPOS, NICHOS, nichosDoGrupo, TERMOS_MAPS_POR_VARREDURA } from '../src/nichos.mjs';
import { extrairLiterais } from '../src/comando.mjs';

test('IBGE: 27 estados e 5.571 municípios (645 em SP, como no Repass)', () => {
  assert.equal(ESTADOS.length, 27);
  assert.equal(totalMunicipios(), 5571);
  assert.equal(cidadesDe('SP').length, 645);
  assert.equal(resolverUF('São Paulo'), 'SP');
  assert.equal(resolverUF('minas gerais'), 'MG');
});

test('cidade exata acha a UF quando só existe em um estado', () => {
  assert.deepEqual(['Franca', 'SP', true], ((r) => [r.cidade, r.uf, r.ufInferida])(resolverCidade('franca')));
  const r = resolverCidade('Goiania');
  assert.equal(r.cidade, 'Goiânia'); assert.equal(r.uf, 'GO');
});

test('erro de digitação ou de voz é corrigido (Ribeirão Preot → Preto)', () => {
  const r = resolverCidade('Ribeirão Preot');
  assert.deepEqual([r.ok, r.cidade, r.uf, r.corrigido], [true, 'Ribeirão Preto', 'SP', true]);
  assert.equal(resolverCidade('Sao Jose do Rio Pret', 'SP').cidade, 'São José do Rio Preto');
});

test('nome que existe em vários estados pede o estado; nome inexistente não inventa cidade', () => {
  const a = resolverCidade('Bom Jesus');
  assert.equal(a.ok, false); assert.equal(a.motivo, 'ambigua');
  assert.ok(a.sugestoes.length >= 2);
  assert.match(mensagemCidade('Bom Jesus', null, a), /mais de um estado/);
  assert.equal(resolverCidade('Bom Jesus', 'PI').uf, 'PI');
  const d = resolverCidade('Xyzabc');
  assert.deepEqual([d.ok, d.motivo], [false, 'desconhecida']);
});

test('nome curto não aceita erro, para "Poá" não virar outra cidade', () => {
  assert.equal(resolverCidade('Poa', 'SP').cidade, 'Poá');
  assert.equal(resolverCidade('Pau', 'SP').ok, false);
});

test('catálogo: 4 grupos, ids antigos preservados, termos e tags em todos', () => {
  assert.equal(Object.keys(GRUPOS).length, 4);
  for (const antigo of ['odontologia', 'estetica', 'advocacia', 'imobiliaria', 'energia_solar', 'barbearia', 'salao_unhas', 'academia', 'pet_shop', 'restaurante', 'padaria', 'oficina']) assert.ok(NICHOS[antigo], `id antigo ${antigo}`);
  assert.ok(Object.keys(NICHOS).length >= 24);
  for (const [id, n] of Object.entries(NICHOS)) {
    assert.ok(GRUPOS[n.grupo], `${id}: grupo`);
    assert.ok(n.termos.length >= 4 && n.termos.length <= 6, `${id}: de 4 a 6 termos`);
    assert.equal(n.maps, n.termos[0], `${id}: maps = primeiro termo`);
    assert.ok(n.osm.length >= 1 && n.osm.every((t) => t.length === 2), `${id}: tags OSM`);
  }
  assert.equal(catalogo().flatMap((g) => g.nichos).length, Object.keys(NICHOS).length);
  assert.ok(nichosDoGrupo('urgencia').includes('oficina'));
  assert.ok(TERMOS_MAPS_POR_VARREDURA >= 2);
});

test('chat: acha o nicho pelo termo mais específico', () => {
  assert.equal(extrairLiterais('procura hotel para pets em Campinas').nicho, 'pet_shop');
  assert.equal(extrairLiterais('varre ortodontia em Franca').nicho, 'odontologia');
  assert.equal(extrairLiterais('busca tatuador em Goiania').nicho, 'tatuagem');
  assert.equal(extrairLiterais('varre pizzaria em Santo André').nicho, 'restaurante');
});
