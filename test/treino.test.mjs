import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, lerAjustes, salvarAjustes } from '../src/db.mjs';
import { anonimizador, exportarTreino, temDadoPessoal } from '../src/treino.mjs';

test('anonimizador tira nome do negócio, seu nome, endereço, telefone, e-mail e link', () => {
  const a = anonimizador({ nome: 'Barbearia do Zé Boareto', endereco: 'Rua das Flores, 10' }, { remetente_nome: 'Victor Ads' });
  const t = a('Oi, aqui é o Victor Ads. Vi a Barbearia do Zé Boareto na Rua das Flores, 10. Fale em (16) 99999-0001, a@b.com ou https://x.com/y. Boareto!');
  assert.doesNotMatch(t, /Victor|Boareto|Flores|9999|a@b|https/);
  assert.match(t, /\[REMETENTE\].*\[NEGOCIO\].*\[ENDERECO\].*\[TELEFONE\].*\[EMAIL\].*\[LINK\]/s);
});

test('B18: exporta edições, aprovações, respostas e fechamentos sem dado pessoal', () => {
  const db = abrirBanco(':memory:');
  salvarAjustes(db, { ...lerAjustes(db), remetente_nome: 'Victor Ads' });
  const ins = db.prepare("INSERT INTO leads (id, nome, fonte, etapa, nicho, telefone, situacao_site, mensagem, mensagem_origem, decisao, criado_em, atualizado_em) VALUES (?, ?, 'maps', ?, 'estetica', '5516999990001', 'sem_site', ?, 'modelo', '{\"answers\":{\"abordagem\":{\"choice\":\"ser_encontrado\"}}}', 't', 't')");
  ins.run('1', 'Studio Bella Ltda', 'fechado', 'Oi, sou Victor Ads. Vi o Studio Bella Ltda. Posso mandar? 16999990001');
  ins.run('2', 'Clínica Sol', 'descartado', 'Oi Clínica Sol');
  db.prepare("INSERT INTO envios (lead_id, telefone, texto, status, criado_em) VALUES ('1','5516999990001','x','enviado','t')").run();
  db.prepare("INSERT INTO negocios (lead_id, valor, servico, fechado_em) VALUES ('1', 1500, 'Site da Studio Bella Ltda', 't')").run();
  db.prepare("INSERT INTO edicoes (lead_id, original, editado, nicho, em) VALUES ('1', 'Oi Studio Bella Ltda', 'Olá, Victor Ads aqui, Studio Bella Ltda', 'estetica', 't')").run();
  const l = exportarTreino(db);
  assert.deepEqual(l.map((x) => x.tipo).sort(), ['aprovacao', 'aprovacao', 'edicao', 'fechamento', 'resposta']);
  assert.equal(l.find((x) => x.tipo === 'resposta').respondeu, 1);
  assert.equal(l.find((x) => x.tipo === 'aprovacao' && x.aprovado === 0).texto, 'Oi [NEGOCIO]');
  assert.equal(temDadoPessoal(l), false);
  assert.doesNotMatch(JSON.stringify(l), /Bella|Victor|Sol\b/);
});
