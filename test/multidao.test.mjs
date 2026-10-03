// Movimento dos agentes (arXiv 1802.02673 + cond-mat/9805244) e lugares com reserva/F-formation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarGrade, bloquear } from '../public/sala/caminhos.js';
import { PARAMS, criarMultidao, entrar, seguir, fixar, passo, tempoAteColisao, velocidade } from '../public/sala/multidao.js';
import { criarVagas, reservar, liberarVaga, roda, grupos, quemFala, lugarDe, TURNO_MS } from '../public/sala/vagas.js';
import { escolherArea } from '../public/sala/comportamento.js';

const DT = 1 / 60;
const rodar = (m, s, aCada) => { for (let i = 0; i < s / DT; i++) { passo(m, DT); aCada?.(); } };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('dois vindo de frente: nunca se atravessam e desviam de lado', () => {
  const m = criarMultidao(criarGrade({ largura: 20, profundidade: 20 }));
  const a = entrar(m, 'a', -4, 0), b = entrar(m, 'b', 4, 0);
  seguir(m, 'a', [[4, 0]]); seguir(m, 'b', [[-4, 0]]);
  let menor = Infinity, desvio = 0;
  rodar(m, 12, () => { menor = Math.min(menor, dist(a, b)); desvio = Math.max(desvio, Math.abs(a.z)); });
  assert.ok(menor >= PARAMS.raio * 2 - 0.02, `chegaram a ${menor.toFixed(3)} m`);
  assert.ok(desvio > 0.1, 'saíram da linha reta para passar');
  assert.ok(Math.abs(a.x - 4) < 0.2 && Math.abs(b.x + 4) < 0.2, 'os dois chegaram');
});

test('velocidade e aceleração de gente: sem arranque nem correria', () => {
  const m = criarMultidao(criarGrade({ largura: 30, profundidade: 10 }));
  const a = entrar(m, 'a', -12, 0);
  seguir(m, 'a', [[12, 0]]);
  passo(m, DT);
  assert.ok(velocidade(a) <= PARAMS.aMax * DT + 1e-9, 'primeiro quadro: quase parado');
  let maxV = 0;
  rodar(m, 8, () => { maxV = Math.max(maxV, velocidade(a)); });
  assert.ok(maxV <= PARAMS.vMax * 1.1 + 1e-9, `chegou a ${maxV.toFixed(2)} m/s`);
  assert.ok(maxV > 0.9, 'mas anda num passo normal');
});

test('chega devagar e para no destino', () => {
  const m = criarMultidao(criarGrade({ largura: 10, profundidade: 10 }));
  const a = entrar(m, 'a', -3, 0);
  seguir(m, 'a', [[2, 0]]);
  rodar(m, 10);
  assert.equal(a.chegou, true);
  assert.ok(Math.abs(a.x - 2) < 0.06 && velocidade(a) < 0.05);
});

test('sentado não é empurrado; quem chega desvia dele', () => {
  const m = criarMultidao(criarGrade({ largura: 10, profundidade: 10 }));
  const s = entrar(m, 's', 0, 0); fixar(m, 's', true);
  const a = entrar(m, 'a', -3, 0.05);
  seguir(m, 'a', [[3, 0.05]]);
  let menor = Infinity;
  rodar(m, 10, () => { menor = Math.min(menor, dist(a, s)); });
  assert.deepEqual([s.x, s.z], [0, 0]);
  assert.ok(menor >= PARAMS.raio * 2 - 0.02);
});

test('cinco agentes no mesmo lugar se separam (ninguém em cima do outro)', () => {
  const m = criarMultidao(criarGrade({ largura: 10, profundidade: 10 }));
  const ag = ['a', 'b', 'c', 'd', 'e'].map((id) => entrar(m, id, 0, 0));
  rodar(m, 2);
  for (let i = 0; i < ag.length; i++) for (let j = i + 1; j < ag.length; j++) assert.ok(dist(ag[i], ag[j]) >= PARAMS.raio * 2 - 0.03);
});

test('não atravessa móvel no meio do caminho', () => {
  const g = criarGrade({ largura: 10, profundidade: 10 });
  bloquear(g, -0.5, -0.5, 0.5, 0.5, 0);
  const m = criarMultidao(g);
  const a = entrar(m, 'a', -3, 0), b = entrar(m, 'b', -3, 0.8);
  seguir(m, 'a', [[-1.5, 1.5], [1.5, 1.5], [3, 0]]); seguir(m, 'b', [[-1.5, 1.5], [1.5, 1.5], [3, 0.8]]);
  rodar(m, 10, () => { for (const p of [a, b]) assert.ok(!(Math.abs(p.x) < 0.5 && Math.abs(p.z) < 0.5), 'entrou no móvel'); });
});

test('tempo até colisão: de frente é finito, afastando é infinito', () => {
  assert.ok(Math.abs(tempoAteColisao({ x: -2, z: 0, vx: 1, vz: 0 }, { x: 2, z: 0, vx: -1, vz: 0 }, 0.5) - 1.75) < 1e-9);
  assert.equal(tempoAteColisao({ x: -2, z: 0, vx: -1, vz: 0 }, { x: 2, z: 0, vx: 1, vz: 0 }, 0.5), Infinity);
});

test('reserva: um agente por lugar, com id estável (o bug do boneco em cima do outro)', () => {
  const v = criarVagas({ copa: [{ x: 0, z: 0, rot: 0 }, { x: 1, z: 0, rot: 0 }] });
  const a = reservar(v, 'alva', 'copa'), b = reservar(v, 'maia', 'copa');
  assert.notEqual(a.id, b.id);
  assert.equal(reservar(v, 'leo', 'copa'), null, 'cheio: não empilha');
  liberarVaga(v, 'alva');
  assert.ok(reservar(v, 'leo', 'copa'));
  assert.equal(lugarDe(v, 'maia').id, b.id);
});

test('roda de conversa: lugares em volta do centro, virados para o meio; prefere a roda com gente', () => {
  const r = roda(null, 0, 0, 4);
  assert.equal(r.length, 4);
  for (const l of r) {
    assert.ok(Math.abs(Math.hypot(l.x, l.z) - 0.8) < 1e-9);
    const olha = [Math.sin(l.rot), Math.cos(l.rot)];
    assert.ok(olha[0] * -l.x + olha[1] * -l.z > 0.79, 'olha para o centro');
  }
  const v = criarVagas({ copa: [...roda(null, 0, 0, 3), ...roda(null, 5, 5, 3)] });
  const primeiro = reservar(v, 'alva', 'copa');
  const segundo = reservar(v, 'maia', 'copa');
  assert.equal(primeiro.roda, segundo.roda, 'vai para onde já tem alguém');
  assert.deepEqual(grupos(v, () => true), [['alva', 'maia']]);
  assert.equal(quemFala(['alva', 'maia'], 0), 'alva');
  assert.equal(quemFala(['alva', 'maia'], TURNO_MS + 1), 'maia');
});

test('escolha da pausa por utilidade: nunca área cheia, evita repetir a última', () => {
  const r = () => 0.5;
  assert.notEqual(escolherArea('maia', { livres: (a) => (a === 'copa' ? 0 : 2), presentes: () => 0, ultima: null }, r), 'copa');
  assert.notEqual(escolherArea('atlas', { livres: () => 2, presentes: () => 0, ultima: 'biblioteca' }, r), 'biblioteca');
  assert.equal(escolherArea('leo', { livres: () => 0, presentes: () => 0, ultima: null }, r), null);
});
