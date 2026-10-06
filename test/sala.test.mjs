import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloquear, buscarCaminho, criarGrade, livre, paraCelula } from '../public/sala/caminhos.js';
import { EQUIPE_OCUPADA_MS, PAUSA_APOS_MS, proximoEstado, sortearPonto } from '../public/sala/comportamento.js';

test('A* contorna um móvel em vez de atravessar', () => {
  const g = criarGrade({ largura: 10, profundidade: 10, celula: 0.5 });
  bloquear(g, -1, -3, 1, 3, 0); // mesa comprida no meio
  const c = buscarCaminho(g, [-3, 0], [3, 0]);
  assert.ok(c && c.length >= 2);
  assert.deepEqual(c.at(-1), [3, 0]);
  // nenhum ponto intermediário cai dentro do obstáculo
  for (const [x, z] of c.slice(0, -1)) assert.ok(livre(g, ...paraCelula(g, x, z)), `ponto ${x},${z} bloqueado`);
  assert.ok(c.some(([, z]) => Math.abs(z) >= 3), 'passa pela ponta da mesa');
});

test('caminho reto quando não há obstáculo (suavização por visada)', () => {
  const g = criarGrade({ largura: 10, profundidade: 10 });
  const c = buscarCaminho(g, [-4, -4], [4, 4]);
  assert.equal(c.length, 2);
});

test('destino dentro de móvel (cadeira na mesa) leva ao ponto livre mais próximo e termina no alvo', () => {
  const g = criarGrade({ largura: 10, profundidade: 10 });
  bloquear(g, -0.5, -0.5, 0.5, 0.5, 0);
  const c = buscarCaminho(g, [-4, 0], [0, 0]);
  assert.deepEqual(c.at(-1), [0, 0]);
});

test('sem saída devolve null', () => {
  const g = criarGrade({ largura: 6, profundidade: 6 });
  bloquear(g, -3, -0.5, 3, 0.5, 0); // parede atravessando a sala inteira
  assert.equal(buscarCaminho(g, [0, -2], [0, 2]), null);
});

test('máquina de estados segue o estado real da API', () => {
  const t = 1_000_000;
  assert.deepEqual(proximoEstado({ trabalhando: true, ultimaAtividade: 0 }, t), { estado: 'trabalhando', destino: 'mesa' });
  assert.equal(proximoEstado({ trabalhando: false, ultimaAtividade: t - 1000 }, t).estado, 'na_mesa');
  assert.equal(proximoEstado({ trabalhando: false, ultimaAtividade: t - PAUSA_APOS_MS - 1, pontoDePausa: 'copa' }, t).destino, 'copa');
  assert.equal(proximoEstado({ trabalhando: true, pausadoGlobal: true }, t).estado, 'desligado');
  assert.equal(proximoEstado({ trabalhando: false, ultimaAtividade: 0, apresentarAte: t + 5 }, t).destino, 'tv');
  assert.equal(proximoEstado({ trabalhando: false, ultimaAtividade: 0, chamadoAteMs: t + 5 }, t).destino, 'mesa');
  assert.equal(sortearPonto('atlas', () => 0.5), 'copa'); // só saem para o café
});

test('equipe ocupada: quem não está trabalhando espera na mesa, não sai passear (defeito visto em 04/10)', () => {
  const t = 5_000_000;
  const ocioso = { trabalhando: false, ultimaAtividade: 0, pontoDePausa: 'copa' }; // ocioso há muito tempo
  // o Atlas varrendo agora: Alva, Maia e Leo (ociosos) ficam na mesa
  assert.deepEqual(proximoEstado({ ...ocioso, ultimaAtividadeEquipe: t - 1000 }, t), { estado: 'na_mesa', destino: 'mesa' });
  // continua assim por alguns minutos depois que o trabalho acabou
  assert.equal(proximoEstado({ ...ocioso, ultimaAtividadeEquipe: t - EQUIPE_OCUPADA_MS + 1000 }, t).estado, 'na_mesa');
  // a rotina do dia (café) também espera enquanto há trabalho
  const cafe = { atividade: 'cafe', area: 'copa', rotulo: 'Café' };
  assert.equal(proximoEstado({ ...ocioso, bloco: cafe, ultimaAtividadeEquipe: t - 1000 }, t).estado, 'na_mesa');
});

test('equipe parada há tempo: a vida da sala volta (pausa e rotina)', () => {
  const t = 5_000_000;
  const parado = { trabalhando: false, ultimaAtividade: 0, pontoDePausa: 'copa', ultimaAtividadeEquipe: t - EQUIPE_OCUPADA_MS - 1 };
  assert.deepEqual(proximoEstado(parado, t), { estado: 'pausa', destino: 'copa' });
  const cafe = { atividade: 'cafe', area: 'copa', rotulo: 'Café' };
  assert.equal(proximoEstado({ ...parado, bloco: cafe }, t).estado, 'rotina');
  assert.ok(PAUSA_APOS_MS >= 60_000 && EQUIPE_OCUPADA_MS >= PAUSA_APOS_MS, 'ninguém passeia em menos de 1 min nem antes de a equipe parar');
});

test('equipe ocupada não atrapalha o que tem prioridade: pausado por você e briefing da Alva', () => {
  const t = 5_000_000;
  assert.equal(proximoEstado({ trabalhando: false, pausadoGlobal: true, ultimaAtividadeEquipe: t - 1 }, t).estado, 'desligado');
  assert.equal(proximoEstado({ trabalhando: false, apresentarAte: t + 5, ultimaAtividadeEquipe: t - 1 }, t).estado, 'apresentando');
  assert.equal(proximoEstado({ trabalhando: true, ultimaAtividadeEquipe: t - 1 }, t).estado, 'trabalhando');
});
