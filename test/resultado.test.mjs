// Ciclo de resultado: o que acontece depois que Victor manda a mensagem à mão.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.mjs';
import { briefing, fecharNegocio, marcarPerdido, marcarRespondeu } from '../src/agentes.mjs';
import { taxaResposta } from '../src/tocomas/controlador.mjs';
import { lerCabecas } from '../src/aprendizado.mjs';

function cenario(etapa = 'enviado') {
  const db = abrirBanco(':memory:');
  db.prepare(`INSERT INTO leads (id, nome, fonte, etapa, criado_em, atualizado_em, cidade, uf, nicho, telefone, situacao_site, decisao)
    VALUES ('L1','Barbearia Teste','maps',?,'t','t','Franca','SP','barbearia','5516999990000','sem_site','{"answers":{"abordagem":{"choice":"ser_encontrado"}}}')`).run(etapa);
  return db;
}
const etapa = (db) => db.prepare("SELECT etapa FROM leads WHERE id = 'L1'").get().etapa;

test('"respondeu" à mão vira exemplo positivo e muda a etapa', () => {
  const db = cenario();
  marcarRespondeu(db, 'L1');
  assert.equal(etapa(db), 'respondeu');
  assert.equal(lerCabecas(db).resposta.positivos, 1);
  assert.equal(briefing(db).responderam, 1);
});

test('repetir "respondeu" não conta duas vezes no aprendizado', () => {
  const db = cenario();
  marcarRespondeu(db, 'L1'); marcarRespondeu(db, 'L1');
  assert.equal(lerCabecas(db).resposta.n, 1);
});

test('"pediu para sair" é exemplo negativo e cancela o que estava na fila', () => {
  const db = cenario();
  marcarRespondeu(db, 'L1', { sair: true });
  assert.equal(etapa(db), 'nao_contatar');
  assert.equal(lerCabecas(db).resposta.positivos, 0);
});

test('fechou: guarda o valor, soma a receita e conta como resposta', () => {
  const db = cenario();
  const r = fecharNegocio(db, 'L1', { valor: '1800,5'.replace(',', '.'), servico: 'Landing page' });
  assert.equal(r.valor, 1800.5);
  assert.equal(etapa(db), 'fechado');
  const b = briefing(db);
  assert.deepEqual([b.fechados, b.receita, b.responderam], [1, 1800.5, 1]);
  assert.equal(lerCabecas(db).resposta.positivos, 1, 'fechar implica que respondeu');
});

test('fechou depois de respondeu não duplica o exemplo', () => {
  const db = cenario();
  marcarRespondeu(db, 'L1'); fecharNegocio(db, 'L1', { valor: 500 });
  assert.equal(lerCabecas(db).resposta.n, 1);
});

test('valor inválido é recusado e nada muda', () => {
  const db = cenario();
  for (const valor of [-1, 'abc', NaN, 1e12, undefined]) assert.throws(() => fecharNegocio(db, 'L1', { valor }), /valor inválido/);
  assert.equal(etapa(db), 'enviado');
});

test('só vale depois do envio: lead que nem foi enviado é recusado com orientação', () => {
  const db = cenario('mensagem');
  assert.throws(() => marcarRespondeu(db, 'L1'), /Já enviei à mão/);
  assert.throws(() => fecharNegocio(db, 'L1', { valor: 100 }), /só vale depois do envio/);
  assert.throws(() => marcarRespondeu(db, 'inexistente'), /não encontrado/);
});

test('não fechou: conta como resposta, não como venda', () => {
  const db = cenario();
  marcarPerdido(db, 'L1', { motivo: 'achou caro' });
  const b = briefing(db);
  assert.equal(etapa(db), 'perdido');
  assert.deepEqual([b.responderam, b.fechados, b.receita], [1, 0, 0]);
});

test('a taxa de resposta do controlador enxerga fechados e perdidos', () => {
  const db = cenario();
  fecharNegocio(db, 'L1', { valor: 100 });
  assert.equal(taxaResposta(db), 2 / 3); // (1 resposta + 1) / (1 envio + 2): prior de Laplace
});
