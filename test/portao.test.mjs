// B1 — portão de handoff (TOCOMAS, arXiv 2609.37953): o próximo nó só recebe o lead se a crença
// tem os fatos de que ele precisa; senão vira pendência, sem job.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, agora } from '../src/db.mjs';
import { passar } from '../src/agentes.mjs';
import { conferirHandoff } from '../src/tocomas/grafo.mjs';
import { lerCrenca, liberar, registrarFatos } from '../src/tocomas/crenca.mjs';

function banco() {
  const db = abrirBanco(':memory:');
  db.prepare("INSERT INTO leads (id, nome, fonte, etapa, telefone_tipo, criado_em, atualizado_em) VALUES ('L', 'Barbearia Y', 'maps', 'qualificado', 'celular', ?, ?)").run(agora(), agora());
  return db;
}
const jobs = (db, tipo) => db.prepare('SELECT COUNT(*) n FROM jobs WHERE tipo = ?').get(tipo).n;
const eventos = (db) => db.prepare("SELECT COUNT(*) n FROM eventos WHERE tipo = 'handoff_bloqueado'").get().n;

test('portão: redigir sem telefone é recusado e vira pendência', () => {
  const db = banco();
  registrarFatos(db, 'L', [{ chave: 'situacao_site', valor: 'sem_site', fonte: 'auditoria' }, { chave: 'angulo', valor: 'ser_encontrado', fonte: 'regra' }]);
  assert.equal(passar(db, 'qualificar', 'redigir', 'L'), null);
  assert.equal(jobs(db, 'redigir'), 0);
  const p = lerCrenca(db, 'L', 'qualificado').pendencias.find((x) => x.tipo === 'handoff_bloqueado');
  assert.deepEqual(p, { chave: 'redigir', tipo: 'handoff_bloqueado', falta: ['telefone'], natureza: 'epistemica' });
  // o mesmo bloqueio de novo não repete o aviso
  passar(db, 'controle', 'redigir', 'L');
  assert.equal(eventos(db), 1);
});

test('portão: fontes discordando do telefone também barram', () => {
  const db = banco();
  registrarFatos(db, 'L', [{ chave: 'telefone', valor: '5516999990000', fonte: 'maps' }, { chave: 'situacao_site', valor: 'sem_site', fonte: 'auditoria' }, { chave: 'angulo', valor: 'ser_encontrado', fonte: 'regra' }]);
  registrarFatos(db, 'L', [{ chave: 'telefone', valor: '5516988880000', fonte: 'osm' }]);
  assert.deepEqual(conferirHandoff(lerCrenca(db, 'L', 'qualificado'), 'redigir'), [{ chave: 'telefone', tipo: 'conflito' }]);
});

test('portão: com os fatos, passa e limpa o bloqueio', () => {
  const db = banco();
  registrarFatos(db, 'L', [{ chave: 'situacao_site', valor: 'sem_site', fonte: 'auditoria' }, { chave: 'angulo', valor: 'ser_encontrado', fonte: 'regra' }]);
  passar(db, 'qualificar', 'redigir', 'L');
  registrarFatos(db, 'L', [{ chave: 'telefone', valor: '5516999990000', fonte: 'maps' }]);
  assert.ok(passar(db, 'controle', 'redigir', 'L'));
  assert.equal(jobs(db, 'redigir'), 1);
  assert.equal(lerCrenca(db, 'L', 'qualificado').pendencias.some((x) => x.tipo === 'handoff_bloqueado'), false);
});

test('portão: fato vencido conta como falta; reprocessar limpa', () => {
  const db = banco();
  const antigo = new Date(Date.now() - 40 * 86_400_000).toISOString(); // situação do site vale 30 dias
  registrarFatos(db, 'L', [{ chave: 'situacao_site', valor: 'sem_site', fonte: 'auditoria' }], antigo);
  assert.equal(passar(db, 'auditar', 'qualificar', 'L'), null);
  liberar(db, 'L');
  assert.equal(lerCrenca(db, 'L', 'auditado').pendencias.some((x) => x.tipo === 'handoff_bloqueado'), false);
});

test('portão: auditar não exige fato (o lead acabou de chegar)', () => {
  const db = banco();
  assert.ok(passar(db, 'varrer', 'auditar', 'L'));
});

// B16 — "só celular": a Maia não escreve para fixo; desligar o ajuste libera na hora
import { reavaliarBloqueados } from '../src/agentes.mjs';
import { salvarAjustes, lerAjustes } from '../src/db.mjs';

function bancoFixo(tipo) {
  const db = abrirBanco(':memory:');
  db.prepare("INSERT INTO leads (id, nome, fonte, etapa, telefone, telefone_tipo, criado_em, atualizado_em) VALUES ('F', 'Oficina X', 'maps', 'qualificado', '551637000000', ?, ?, ?)").run(tipo, agora(), agora());
  registrarFatos(db, 'F', [{ chave: 'telefone', valor: '551637000000', fonte: 'maps' }, { chave: 'situacao_site', valor: 'sem_site', fonte: 'auditoria' }, { chave: 'angulo', valor: 'ser_encontrado', fonte: 'regra' }]);
  return db;
}

test('B16: com "só celular" ligado, fixo para antes da Maia com motivo de política', () => {
  const db = bancoFixo('fixo');
  assert.equal(passar(db, 'qualificar', 'redigir', 'F'), null);
  assert.equal(jobs(db, 'redigir'), 0);
  const p = lerCrenca(db, 'F', 'qualificado').pendencias.find((x) => x.tipo === 'handoff_bloqueado');
  assert.deepEqual(p.falta, ['telefone_celular']);
  assert.match(db.prepare("SELECT msg FROM eventos WHERE tipo = 'handoff_bloqueado'").get().msg, /só celular/);
});

test('B16: celular passa normalmente; política não vale para outras etapas', () => {
  const db = bancoFixo('celular');
  assert.ok(passar(db, 'qualificar', 'redigir', 'F'));
  assert.deepEqual(conferirHandoff(lerCrenca(db, 'F', 'auditado'), 'qualificar', { soCelular: true, telefoneTipo: 'fixo' }), []);
});

test('B16: desligar "só celular" reavalia e libera o fixo na hora', () => {
  const db = bancoFixo('fixo');
  passar(db, 'qualificar', 'redigir', 'F');
  const a = lerAjustes(db);
  salvarAjustes(db, { ...a, envio: { ...a.envio, so_celular: false } });
  assert.equal(reavaliarBloqueados(db), 1);
  assert.equal(jobs(db, 'redigir'), 1);
  assert.equal(lerCrenca(db, 'F', 'qualificado').pendencias.some((x) => x.tipo === 'handoff_bloqueado'), false);
});
