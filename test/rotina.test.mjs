// Rotina do dia (camada de plano dos Generative Agents, arXiv 2304.03442) e prioridade sobre ela.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planoDoDia, blocoAgora, proximoBloco, REUNIAO, diaDe } from '../public/sala/rotina.js';
import { proximoEstado } from '../public/sala/comportamento.js';

const em = (h, m = 0) => new Date(2026, 9, 5, h, m);

test('plano estável no mesmo dia, diferente em outro dia', () => {
  assert.deepEqual(planoDoDia('maia', '2026-10-05'), planoDoDia('maia', '2026-10-05'));
  const dias = new Set(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map((d) => JSON.stringify(planoDoDia('maia', d).map((b) => b.inicio))));
  assert.ok(dias.size > 1, 'o plano varia de um dia para o outro');
});

test('todos têm reunião às 9h; a Alva conduz na TV, os outros sentam à mesa', () => {
  for (const id of ['alva', 'atlas', 'nova', 'maia', 'leo', 'agente-criado']) {
    const r = planoDoDia(id, '2026-10-05').find((b) => b.atividade === 'reuniao');
    assert.deepEqual([r.inicio, r.fim], [REUNIAO.inicio, REUNIAO.fim]);
    assert.equal(r.area, id === 'alva' ? 'tv' : 'reuniao');
  }
});

test('blocos em ordem, sem sobreposição, horários plausíveis', () => {
  for (const id of ['alva', 'atlas', 'nova', 'maia', 'leo']) for (const d of ['2026-10-05', '2026-11-20', '2027-01-02']) {
    const p = planoDoDia(id, d);
    for (let i = 1; i < p.length; i++) assert.ok(p[i].inicio >= p[i - 1].fim, `${id} ${d}: ${p[i - 1].rotulo} invade ${p[i].rotulo}`);
    assert.ok(p[0].inicio >= 8 * 60 && p.at(-1).fim <= 17 * 60);
  }
});

test('o que fazer agora e o próximo compromisso', () => {
  const p = planoDoDia('leo', '2026-10-05');
  assert.equal(blocoAgora(p, em(9, 5)).atividade, 'reuniao');
  assert.equal(blocoAgora(p, em(10, 30)), null);
  assert.equal(proximoBloco(p, em(10, 30)).atividade, 'almoco');
  assert.equal(diaDe(em(9)), '2026-10-05');
});

test('prioridade: trabalho real e você chamando passam na frente do plano', () => {
  const bloco = { atividade: 'almoco', area: 'lounge', rotulo: 'Almoço' };
  assert.equal(proximoEstado({ trabalhando: true, bloco }, 0).destino, 'mesa');
  assert.equal(proximoEstado({ chamadoAteMs: 10, bloco }, 0).destino, 'mesa');
  assert.equal(proximoEstado({ pausadoGlobal: true, bloco }, 0).destino, 'mesa');
  assert.deepEqual(proximoEstado({ bloco, ultimaAtividade: 0 }, 0), { estado: 'rotina', destino: 'lounge', rotulo: 'Almoço' });
  assert.equal(proximoEstado({ bloco: { atividade: 'reuniao', area: 'reuniao' } }, 0).estado, 'reuniao');
  assert.equal(proximoEstado({ bloco: { atividade: 'reuniao', area: 'tv' } }, 0).estado, 'apresentando');
});
