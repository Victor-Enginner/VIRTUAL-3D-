// B7 — lead preso pelos 3 sinais do PoS (arXiv 2610.01415): estagnação, recorrência e persistência,
// cada padrão com sua recuperação. Sequências artificiais, sem modelo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.mjs';
import { validar } from '../src/tocomas/contratos.mjs';
import { diagnosticar, fecharCiclo, jaccard, lacunaAtiva, lerCrenca, liberar, registrarFatos, versaoDe } from '../src/tocomas/crenca.mjs';

const T0 = Date.parse('2026-10-02T12:00:00.000Z');
const em = (h) => new Date(T0 + h * 3600_000).toISOString();

// um ciclo = um job: registra os fatos que o job trouxe e fecha
function ciclo(db, fatos, etapa, h) {
  const v = versaoDe(db, 'L');
  if (fatos.length) registrarFatos(db, 'L', fatos, em(h));
  return fecharCiclo(db, 'L', v, etapa, em(h));
}
const site = { chave: 'situacao_site', valor: 'sem_site', fonte: 'auditoria' };

test('jaccard: mesmo conjunto 0, disjunto 1', () => {
  assert.equal(jaccard(['a', 'b'], ['b', 'a']), 0);
  assert.equal(jaccard(['a'], ['b']), 1);
});

test('Parado: 3 ciclos sem fato novo', () => {
  const db = abrirBanco(':memory:');
  ciclo(db, [site], 'auditado', 0);
  let r;
  for (let i = 1; i <= 3; i++) r = ciclo(db, [site], 'auditado', i);
  assert.equal(r.padrao, 'parado');
  const d = lerCrenca(db, 'L', 'auditado', em(3)).progresso.diagnostico;
  assert.equal(d.lacuna, 'telefone');
  assert.match(d.recuperacao, /Refazer auditoria para buscar telefone/);
});

test('Ciclo: fato alternando A→B→A→B prende (antes, cada troca zerava o contador)', () => {
  const db = abrirBanco(':memory:');
  const tel = (v) => ({ chave: 'telefone', valor: v, fonte: 'maps' }); // mesma fonte: não vira conflito sozinho
  ciclo(db, [site, tel('5516111')], 'qualificado', 0);
  ciclo(db, [tel('5516222')], 'qualificado', 1);
  let r = ciclo(db, [tel('5516111')], 'qualificado', 2);
  assert.equal(r.preso, false); // uma volta só ainda pode ser correção legítima
  r = ciclo(db, [tel('5516222')], 'qualificado', 3);
  assert.equal(r.padrao, 'ciclo');
  const c = lerCrenca(db, 'L', 'qualificado', em(3));
  assert.deepEqual(c.progresso.diagnostico.chaves, ['telefone']);
  // corta a aresta: o telefone que oscila vira conflito para você resolver
  assert.ok(c.pendencias.some((p) => p.chave === 'telefone' && p.tipo === 'conflito'));
});

test('Deriva: muda outras coisas e a mesma lacuna não fecha', () => {
  const db = abrirBanco(':memory:');
  let r;
  for (let i = 0; i < 3; i++) r = ciclo(db, [site, { chave: 'rating', valor: 4 + i / 10, fonte: 'maps' }], 'auditado', i);
  assert.equal(r.padrao, 'deriva');
  const d = lerCrenca(db, 'L', 'auditado', em(2)).progresso.diagnostico;
  assert.deepEqual(d.sinais, { estagnacao: 0, recorrencia: 0, persistencia: 3 });
  assert.match(d.recuperacao, /telefone não se resolve sozinho/);
});

test('fluxo normal não prende: auditar → qualificar → redigir com fatos novos', () => {
  const db = abrirBanco(':memory:');
  assert.equal(ciclo(db, [{ chave: 'telefone', valor: '5516111', fonte: 'maps' }, site], 'auditado', 0).preso, false);
  assert.equal(ciclo(db, [{ chave: 'angulo', valor: 'ser_encontrado', fonte: 'regra' }], 'qualificado', 1).preso, false);
  const r = ciclo(db, [], 'mensagem', 2); // esperando você não é armadilha
  assert.equal(r.preso, false);
  assert.ok(r.saude > 0);
});

test('lacuna ativa: só em etapa de trabalho; portão bloqueado vem primeiro', () => {
  const c = { fatos: [], conflitos: [], bloqueio: { para: 'redigir', falta: [{ chave: 'angulo', tipo: 'falta_dado' }] } };
  assert.equal(lacunaAtiva(c, 'qualificado'), 'angulo');
  assert.equal(lacunaAtiva(c, 'mensagem'), null);
  assert.equal(lacunaAtiva({ fatos: [], conflitos: [] }, 'auditado'), 'telefone');
});

test('saúde cai conforme o sinal mais forte; diagnóstico segue o contrato', () => {
  const h = [{ assinatura: ['a=1'], novidade: true, lacuna: null }, { assinatura: ['a=1'], novidade: false, lacuna: null }];
  assert.equal(diagnosticar(h).saude, 0.67);
  const db = abrirBanco(':memory:');
  for (let i = 0; i < 4; i++) ciclo(db, [site], 'auditado', i);
  assert.equal(validar('crenca', lerCrenca(db, 'L', 'auditado', em(3))).ok, true);
});

test('Reprocessar zera conflito, janela e diagnóstico (débito: antes o conflito ficava para sempre)', () => {
  const db = abrirBanco(':memory:');
  registrarFatos(db, 'L', [{ chave: 'telefone', valor: '1', fonte: 'maps' }], em(0));
  registrarFatos(db, 'L', [{ chave: 'telefone', valor: '2', fonte: 'osm' }], em(1));
  for (let i = 0; i < 3; i++) ciclo(db, [], 'auditado', i + 2);
  liberar(db, 'L');
  const c = lerCrenca(db, 'L', 'auditado', em(6));
  assert.equal(c.progresso.preso, false);
  assert.equal(c.progresso.diagnostico, undefined);
  assert.equal(c.pendencias.some((p) => p.tipo === 'conflito'), false);
});

test('B6: pendência epistêmica (falta saber) separada da de realização (falta fazer)', async () => {
  const { NATUREZA, pendencias } = await import('../src/tocomas/crenca.mjs');
  assert.deepEqual(Object.entries(NATUREZA).filter(([, n]) => n === 'realizacao').map(([t]) => t).sort(), ['aguardando_humano', 'aguardando_resposta']);
  const c = { fatos: [], conflitos: ['telefone'], bloqueio: null };
  const p = pendencias(c, 'mensagem');
  assert.ok(p.every((x) => x.natureza === NATUREZA[x.tipo]));
  assert.equal(p.find((x) => x.tipo === 'aguardando_humano').natureza, 'realizacao');
  assert.equal(p.find((x) => x.tipo === 'conflito').natureza, 'epistemica');
});
