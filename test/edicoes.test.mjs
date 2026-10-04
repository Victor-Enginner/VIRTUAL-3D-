// Edições do operador: o original da Maia não pode se perder (base de treino futuro, arXiv 2601.19055 / 2610.00061).
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.mjs';
import { aprovarEnvio } from '../src/agentes.mjs';
import { contarEdicoes, registrarEdicao } from '../src/tocomas/edicoes.mjs';
import { escolherVoz } from '../public/ui/audio.js';

function banco(mensagem = 'Olá, vi seu negócio em Franca.') {
  const db = abrirBanco(':memory:');
  db.prepare(`INSERT INTO leads (id, nome, fonte, etapa, criado_em, atualizado_em, cidade, uf, nicho, telefone, telefone_tipo, mensagem, mensagem_origem, decisao)
    VALUES ('L1','Barbearia Teste','maps','mensagem','t','t','Franca','SP','barbearia','5516999990000','celular',?,'modelo_recusado','{"answers":{"abordagem":{"choice":"ser_encontrado"}}}')`).run(mensagem);
  return db;
}
const lead = (db) => db.prepare("SELECT * FROM leads WHERE id = 'L1'").get();

test('a primeira edição guarda o original da Maia, o seu texto, o nicho e o ângulo', () => {
  const db = banco();
  registrarEdicao(db, lead(db), 'Oi! Vi a Barbearia Teste no Google e achei que merece um site.');
  const e = db.prepare("SELECT * FROM edicoes WHERE lead_id = 'L1'").get();
  assert.equal(e.original, 'Olá, vi seu negócio em Franca.');
  assert.match(e.editado, /merece um site/);
  assert.deepEqual([e.nicho, e.angulo, e.origem_original], ['barbearia', 'ser_encontrado', 'modelo_recusado']);
});

test('editar de novo mantém o original da Maia e atualiza só a sua última versão', () => {
  const db = banco();
  registrarEdicao(db, lead(db), 'versão 1 do Victor');
  db.prepare("UPDATE leads SET mensagem = 'versão 1 do Victor', mensagem_origem = 'operador'").run();
  registrarEdicao(db, lead(db), 'versão 2 do Victor');
  const e = db.prepare("SELECT * FROM edicoes WHERE lead_id = 'L1'").get();
  assert.equal(e.original, 'Olá, vi seu negócio em Franca.');
  assert.equal(e.editado, 'versão 2 do Victor');
  assert.equal(contarEdicoes(db), 1);
});

test('texto igual (só espaços diferentes) não é edição, e voltar ao original apaga o par', () => {
  const db = banco();
  assert.equal(registrarEdicao(db, lead(db), '  Olá,   vi seu negócio em Franca. '), null);
  assert.equal(contarEdicoes(db), 0);
  registrarEdicao(db, lead(db), 'outra coisa');
  db.prepare("UPDATE leads SET mensagem = 'outra coisa'").run();
  registrarEdicao(db, lead(db), 'Olá, vi seu negócio em Franca.');
  assert.equal(contarEdicoes(db), 0);
});

test('editar ao aprovar também guarda o original; aprovar sem mexer não guarda nada', () => {
  const db = banco();
  aprovarEnvio(db, 'L1', 'Texto ajustado pelo Victor na hora de aprovar');
  const e = db.prepare("SELECT original, editado FROM edicoes WHERE lead_id = 'L1'").get();
  assert.equal(e.original, 'Olá, vi seu negócio em Franca.');
  const db2 = banco();
  aprovarEnvio(db2, 'L1', null);
  assert.equal(contarEdicoes(db2), 0);
});

test('voz: se a escolhida não existe neste navegador, cai na melhor natural e avisa; senão respeita', () => {
  const v = (name) => ({ name, lang: 'pt-BR' });
  const edge = [v('Microsoft Antônio Online (Natural) - Portuguese (Brazil)'), v('Microsoft Thalita Online (Natural) - Portuguese (Brazil)'), v('Microsoft Daniel - Portuguese (Brazil)')];
  assert.equal(escolherVoz(edge, 'Microsoft Thalita Online (Natural) - Portuguese (Brazil)').trocou, false);
  const chrome = [v('Google português do Brasil'), v('Microsoft Daniel - Portuguese (Brazil)'), v('Microsoft Maria - Portuguese (Brazil)')];
  const r = escolherVoz(chrome, 'Microsoft Thalita Online (Natural) - Portuguese (Brazil)');
  assert.deepEqual([r.trocou, r.voz.name], [true, 'Microsoft Maria - Portuguese (Brazil)']);
  assert.equal(escolherVoz(edge, null).voz.name.includes('Thalita'), true, 'sem escolha, prefere a natural feminina conhecida');
  assert.equal(escolherVoz([], 'x').voz, null);
});
