import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, agora, salvarAjustes } from '../src/db.mjs';
import { AJUSTES_PADRAO } from '../src/config.mjs';
import { CONTRATOS, validar } from '../src/tocomas/contratos.mjs';
import { exigirHandoff, HandoffInvalido, podeHandoff, visao } from '../src/tocomas/grafo.mjs';
import { fecharCiclo, lerCrenca, liberar, LIMITE_PRESO, registrarFatos, semearDoLead, versaoDe } from '../src/tocomas/crenca.mjs';
import { abrirPlano } from '../src/tocomas/fidelidade.mjs';
import { criarControlador, decidir } from '../src/tocomas/controlador.mjs';

const T0 = '2026-10-02T12:00:00.000Z';

test('contratos: válido passa, inválido explica o erro', () => {
  assert.ok(CONTRATOS.includes('crenca') && CONTRATOS.includes('decisao-controlador'));
  assert.equal(validar('fato', { chave: 'telefone', valor: '5516', fonte: 'maps', observado_em: T0 }).ok, true);
  const r = validar('fato', { chave: 'telefone', valor: '5516', fonte: 'chute', observado_em: 'ontem', extra: 1 });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => e.includes('fonte')));
  assert.ok(r.erros.some((e) => e.includes('data-hora')));
  assert.ok(r.erros.some((e) => e.includes('campo não previsto')));
  assert.throws(() => validar('nao_existe', {}), /desconhecido/);
});

test('grafo: handoff só por aresta; Controle reabre qualquer nó', () => {
  assert.equal(podeHandoff('T2_auditar', 'T3_qualificar'), true);
  assert.equal(podeHandoff('T2_auditar', 'T4_redigir'), false);
  assert.doesNotThrow(() => exigirHandoff('auditar', 'qualificar'));
  assert.throws(() => exigirHandoff('varrer', 'redigir'), HandoffInvalido); // Atlas não fala com a Maia
  assert.doesNotThrow(() => exigirHandoff('controle', 'redigir'));
});

test('grafo: a Maia não enxerga o HTML medido pelo Atlas', () => {
  const lead = { id: 'x', nome: 'Barbearia Y', situacao_site: 'site_proprio', auditoria: JSON.stringify({ html: '<html>…', tecnologias: ['wix'], sinais: ['sem https'] }) };
  const v = visao(lead, 'escrita');
  assert.deepEqual(JSON.parse(v.auditoria), { sinais: ['sem https'] });
  assert.equal(visao(lead, 'coleta'), lead);
});

test('crença: nulo não é fato, repetição não é novidade, fonte divergente vira conflito', () => {
  const db = abrirBanco(':memory:');
  let r = registrarFatos(db, 'L1', [{ chave: 'telefone', valor: '5516999990000', fonte: 'maps' }, { chave: 'site', valor: null, fonte: 'maps' }], T0);
  assert.equal(r.novidade, true);
  r = registrarFatos(db, 'L1', [{ chave: 'telefone', valor: '5516999990000', fonte: 'maps' }], T0);
  assert.equal(r.novidade, false);
  r = registrarFatos(db, 'L1', [{ chave: 'telefone', valor: '5516988880000', fonte: 'osm' }], T0);
  assert.deepEqual(r.conflitos, ['telefone']);
  const c = lerCrenca(db, 'L1', 'auditado', T0);
  assert.equal(c.fatos.length, 1);
  assert.ok(c.pendencias.some((p) => p.chave === 'telefone' && p.tipo === 'conflito'));
  assert.ok(c.pendencias.some((p) => p.chave === 'situacao_site' && p.tipo === 'falta_dado'));
});

test('crença: fato vence e volta a ser pendência', () => {
  const db = abrirBanco(':memory:');
  registrarFatos(db, 'L2', [{ chave: 'rating', valor: 4.7, fonte: 'maps' }, { chave: 'telefone', valor: '55169', fonte: 'maps' }, { chave: 'situacao_site', valor: 'sem_site', fonte: 'auditoria' }], T0);
  const depois = new Date(Date.parse(T0) + 15 * 86_400_000).toISOString(); // rating vale 14 dias
  const c = lerCrenca(db, 'L2', 'qualificado', depois);
  assert.deepEqual(c.pendencias.map((p) => p.chave), ['rating']);
});

test('preso: N ciclos sem fato novo tiram o lead da fila; reprocessar libera', () => {
  const db = abrirBanco(':memory:');
  registrarFatos(db, 'L3', [{ chave: 'telefone', valor: '55169', fonte: 'maps' }], T0);
  let r;
  for (let i = 0; i < LIMITE_PRESO; i++) r = fecharCiclo(db, 'L3', versaoDe(db, 'L3'), 'descoberto');
  assert.equal(r.preso, true);
  assert.match(r.motivo, /sem fato novo · falta: situacao_site/);
  liberar(db, 'L3');
  assert.equal(lerCrenca(db, 'L3').progresso.preso, false);
  // progresso de verdade zera a contagem
  const v = versaoDe(db, 'L3');
  registrarFatos(db, 'L3', [{ chave: 'situacao_site', valor: 'sem_site', fonte: 'auditoria' }]);
  assert.deepEqual(fecharCiclo(db, 'L3', v), { preso: false, ciclos: 0 });
});

test('fidelidade: ferramenta fora do plano é desvio', () => {
  const p = abrirPlano('redigir', 7);
  assert.equal(p.plano.modo, 'predefinido');
  p.usar('gerar_texto'); p.usar('texto_fixo');
  assert.equal(p.fechar().preservou, true);
  const q = abrirPlano('auditar', 8);
  q.usar('buscar_seguro'); q.usar('openwa');
  const f = q.fechar();
  assert.equal(f.preservou, false);
  assert.deepEqual(f.desvios, ['ferramenta não declarada: openwa']);
  assert.equal(abrirPlano('varrer', 9).plano.modo, 'busca');
});

function comMensagens(n) {
  const db = abrirBanco(':memory:');
  salvarAjustes(db, AJUSTES_PADRAO);
  const ins = db.prepare("INSERT INTO leads (id, nome, fonte, etapa, criado_em, atualizado_em) VALUES (?, ?, 'maps', 'mensagem', ?, ?)");
  for (let i = 0; i < n; i++) ins.run(`m${i}`, `Negócio ${i}`, agora(), agora());
  return db;
}

test('controlador: segura a Maia quando as mensagens passam de 2 dias de envio', () => {
  assert.equal(decidir(comMensagens(5), 'redigir').escolhida, 'redigir');
  const d = decidir(comMensagens(20), 'redigir'); // teto = 2 × 10
  assert.equal(d.escolhida, 'esperar');
  assert.match(d.motivo, /20 mensagens esperando você/);
  assert.equal(validar('decisao-controlador', d).ok, true);
});

test('controlador: para a varredura com estoque de 4 dias e respeita o cache', () => {
  const db = comMensagens(40);
  assert.equal(decidir(db, 'varrer').escolhida, 'parar_varredura');
  let t = 0;
  const c = criarControlador(db, { relogio: () => t });
  assert.equal(c.permite('varrer'), false);
  assert.equal(c.permite('auditar'), true); // auditar é barato: não passa pelo controle
  db.prepare("UPDATE leads SET etapa = 'descartado'").run();
  assert.equal(c.permite('varrer'), false); // ainda no cache
  t = 11_000;
  assert.equal(c.permite('varrer'), true);
});

test('crença: lead antigo (de antes da crença) é semeado com o que a linha já sabe', () => {
  const db = abrirBanco(':memory:');
  const lead = { id: 'V1', fonte: 'maps', telefone: '55169', site: null, rating: 4.2, avaliacoes: 10, situacao_site: 'sem_site', auditoria: null, atualizado_em: T0 };
  assert.equal(semearDoLead(db, lead), true);
  assert.deepEqual(lerCrenca(db, 'V1', 'auditado', T0).pendencias, []);
  assert.equal(semearDoLead(db, lead), false); // só uma vez
});
