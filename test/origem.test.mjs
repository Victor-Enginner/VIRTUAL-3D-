import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { abrirBanco } from '../src/db.mjs';
import { ficha } from '../src/origem.mjs';
import { novaSessaoDeRastreio } from '../src/sessoes.mjs';

test('origem: a ficha diz tabela, filtro, sessão e consulta', () => {
  const db = abrirBanco(':memory:');
  novaSessaoDeRastreio(db, 'Outubro');
  const f = ficha(db, { tabela: 'leads', filtro: 'por etapa', sql: 'SELECT  etapa,\n COUNT(*) FROM leads' });
  assert.equal(f.tabela, 'leads');
  assert.match(f.filtro, /por etapa · sessão "Outubro"/);
  assert.equal(f.consulta, 'SELECT etapa, COUNT(*) FROM leads');
  assert.equal(f.sessao.nome, 'Outubro');
});

// contrato: todo bloco numérico do /api/estado declara a origem (número sem ficha não se audita)
test('origem: /api/estado declara ficha para funil, situações, envio e resumo', () => {
  const src = fs.readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
  const bloco = src.slice(src.indexOf('origem: {'), src.indexOf('origem: {') + 1500);
  for (const k of ['funil', 'situacoes', 'envio', 'briefing']) assert.match(bloco, new RegExp(`\\b${k}: ficha\\(`), k);
});
