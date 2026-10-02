import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, agora } from '../src/db.mjs';
import { alfa, aprender, caracteristicas, DIM, lerCabecas, misturar, NOMES, novaCabeca, prever, treinarPasso } from '../src/aprendizado.mjs';
import { verificarSemResposta } from '../src/agentes.mjs';

const lead = (o) => ({ id: o.id || 'x', nome: 'N', nicho: 'barbearia', rating: 4.8, avaliacoes: 120, telefone_tipo: 'celular', auditoria: null,
  decisao: JSON.stringify({ answers: { abordagem: { choice: 'ser_encontrado' } }, score_regra: 80 }), ...o });

test('vetor de características tem nome para cada dimensão', () => {
  const x = caracteristicas(lead({ situacao_site: 'sem_site' }));
  assert.equal(x.length, DIM);
  assert.equal(NOMES.length, DIM);
  assert.equal(x[0], 1);
  assert.equal(x[NOMES.indexOf('situação: Sem site')], 1);
  assert.equal(x[NOMES.indexOf('ângulo: ser_encontrado')], 1);
});

test('SGD aprende a preferência do operador', () => {
  const c = novaCabeca();
  const gosta = caracteristicas(lead({ situacao_site: 'sem_site' }));
  const naoGosta = caracteristicas(lead({ situacao_site: 'so_agendamento' }));
  assert.equal(prever(c, gosta), 0.5);
  for (let i = 0; i < 40; i++) { treinarPasso(c, gosta, 1); treinarPasso(c, naoGosta, 0); }
  assert.ok(prever(c, gosta) > 0.8, `gosta=${prever(c, gosta)}`);
  assert.ok(prever(c, naoGosta) < 0.2, `naoGosta=${prever(c, naoGosta)}`);
  assert.equal(c.n, 80);
});

test('sem exemplos, só a regra manda; o peso do aprendizado cresce até 30%', () => {
  const vazio = { aprovacao: novaCabeca(), resposta: novaCabeca() };
  const x = caracteristicas(lead({ situacao_site: 'sem_site' }));
  assert.equal(misturar(73, vazio, x).score, 73);
  assert.equal(alfa({ n: 6 }), 0.1);
  assert.equal(alfa({ n: 600 }), 0.3);
});

test('aprender persiste, recalcula leads abertos e o silêncio de 72 h vira negativo', () => {
  const db = abrirBanco(':memory:');
  const ins = db.prepare(`INSERT INTO leads (id, nome, nicho, cidade, uf, telefone, telefone_tipo, rating, avaliacoes, fonte, etapa, situacao_site, decisao, score, criado_em, atualizado_em)
    VALUES (?, ?, 'barbearia', 'Franca', 'SP', ?, 'celular', 4.8, 120, 'maps', ?, ?, ?, 80, ?, ?)`);
  const dec = JSON.stringify({ answers: { abordagem: { choice: 'ser_encontrado' } }, score_regra: 80 });
  const t = agora();
  ins.run('a', 'Aberto', '5516999990001', 'mensagem', 'sem_site', dec, t, t);
  ins.run('b', 'Enviado', '5516999990002', 'enviado', 'sem_site', dec, t, t);
  db.prepare("INSERT INTO envios (lead_id, telefone, texto, status, enviado_em, criado_em) VALUES ('b', '5516999990002', 'oi', 'enviado', ?, ?)")
    .run(new Date(Date.now() - 80 * 3600_000).toISOString(), t);

  for (let i = 0; i < 30; i++) aprender(db, 'aprovacao', db.prepare("SELECT * FROM leads WHERE id = 'a'").get(), 1);
  assert.equal(lerCabecas(db).aprovacao.n, 30);
  const a = db.prepare("SELECT * FROM leads WHERE id = 'a'").get();
  assert.ok(a.score > 80, `score do lead aberto subiu: ${a.score}`);
  assert.ok(JSON.parse(a.decisao).aprendizado.p_aprovacao > 0.9);

  assert.equal(verificarSemResposta(db), 1);
  assert.equal(db.prepare("SELECT etapa FROM leads WHERE id = 'b'").get().etapa, 'sem_resposta');
  assert.equal(lerCabecas(db).resposta.n, 1);
  assert.equal(verificarSemResposta(db), 0); // não conta duas vezes
});
