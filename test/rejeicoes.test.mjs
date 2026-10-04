import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.mjs';
import { codigoDaCausa, registrarRejeicoes, resumoRejeicoes } from '../src/rejeicoes.mjs';

test('código da causa é estável, sem acento nem pontuação', () => {
  assert.equal(codigoDaCausa('não cita o nome do negócio'), 'nao_cita_o_nome_do_negocio');
  assert.equal(codigoDaCausa('longa demais'), 'longa_demais');
  assert.equal(codigoDaCausa('???'), 'desconhecida');
});

test('B13: recusas ficam por componente e causa, com exemplos e contagem de textos', () => {
  const db = abrirBanco(':memory:');
  db.prepare("INSERT INTO leads (id, nome, fonte, etapa, nicho, mensagem_origem, criado_em, atualizado_em) VALUES ('a','A','maps','mensagem','estetica','modelo_recusado','t','t'), ('b','B','maps','mensagem','estetica','modelo','t','t')").run();
  assert.equal(registrarRejeicoes(db, { id: 'a', nicho: 'estetica' }, 'maia_contradicao', ['não se apresenta', 'cita nota sem ter nota']), 2);
  registrarRejeicoes(db, { id: 'b', nicho: 'estetica' }, 'maia_contradicao', ['não se apresenta']);
  registrarRejeicoes(db, { id: 'a', nicho: 'estetica' }, 'maia_validacao', []);
  const r = resumoRejeicoes(db);
  assert.equal(r.textos_recusados, 2);
  assert.equal(r.textos_escritos, 2);
  assert.deepEqual(r.causas.map((c) => [c.componente, c.causa, c.n]), [['maia_contradicao', 'nao_se_apresenta', 2], ['maia_contradicao', 'cita_nota_sem_ter_nota', 1]]);
});
