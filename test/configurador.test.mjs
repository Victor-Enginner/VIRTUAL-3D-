import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ETAPAS, promptDeSistema, REGRAS_PADRAO, responder } from '../src/configurador.mjs';

function conversar(respostas) {
  let s = { etapa: 'nome', ficha: {}, voltarPara: null };
  for (const r of respostas) {
    const n = responder(s, r);
    assert.equal(n.erro, undefined, `etapa ${s.etapa}: ${n.erro}`);
    if (n.ativar) return { ...n, ativado: true };
    s = n;
  }
  return s;
}

test('entrevista completa monta a ficha e chega na revisão', () => {
  const s = conversar(['Tribuno', 'consultor tributário sênior', 'Consultivo, Revisão', 'Sênior, direto e técnico',
    'Não dar parecer sem citar a lei', 'Auditar o site, Consultar a base', 'Revisão semanal']);
  assert.equal(s.etapa, 'revisao');
  assert.equal(s.ficha.nome, 'Tribuno');
  assert.deepEqual(s.ficha.modos, ['Consultivo', 'Revisão']);
  assert.deepEqual(s.ficha.ferramentas, ['auditar_site', 'base_conhecimento']);
  assert.equal(s.ficha.regras.length, REGRAS_PADRAO.length + 1);
  assert.equal(s.ficha.aprendizado, 'Revisão semanal');
  assert.match(promptDeSistema(s.ficha), /Você é Tribuno, consultor tributário sênior/);
});

test('resposta inválida não avança', () => {
  const r = responder({ etapa: 'nome', ficha: {} }, 'x');
  assert.ok(r.erro);
  assert.equal(r.etapa, 'nome');
  assert.ok(responder({ etapa: 'ferramentas', ficha: {} }, 'foguete espacial').erro);
});

test('corrigir na revisão volta só àquela etapa e retorna à revisão', () => {
  const s = conversar(['Tribuno', 'consultor tributário', 'Consultivo', 'Formal', 'Só as regras de base', 'Nenhuma', 'Revisão diária']);
  const c = responder(s, 'Corrigir nome');
  assert.equal(c.etapa, 'nome');
  const d = responder(c, 'Tribuna');
  assert.equal(d.etapa, 'revisao');
  assert.equal(d.ficha.nome, 'Tribuna');
  assert.equal(responder(d, 'Ativar agente').ativar, true);
});

test('todas as etapas existem na ordem', () => {
  assert.deepEqual(ETAPAS, ['nome', 'papel', 'modos', 'identidade', 'regras', 'ferramentas', 'aprendizado', 'revisao']);
});
