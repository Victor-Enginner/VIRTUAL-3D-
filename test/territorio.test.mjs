import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, agora } from '../src/db.mjs';
import { beta, escolherCidades, priorDoRamo, rngSemente } from '../src/territorio.mjs';

test('território: a amostra Beta tem a média certa', () => {
  const rng = rngSemente(7);
  let soma = 0;
  for (let i = 0; i < 4000; i++) soma += beta(3, 7, rng);
  assert.ok(Math.abs(soma / 4000 - 0.3) < 0.02, String(soma / 4000));
});

const lead = (db, id, cidade, situacao, tel = 'celular', nicho = 'barbearia') =>
  db.prepare(`INSERT INTO leads (id, nome, fonte, etapa, cidade, uf, pais, nicho, situacao_site, telefone_tipo, criado_em, atualizado_em)
    VALUES (?, ?, 'maps', 'qualificado', ?, 'SP', 'BR', ?, ?, ?, ?, ?)`).run(id, id, cidade, nicho, situacao, tel, agora(), agora());

test('território: partida a frio usa a média do ramo; cidade conhecida usa a própria evidência', () => {
  const db = abrirBanco(':memory:');
  for (let i = 0; i < 8; i++) lead(db, `f${i}`, 'Franca', i < 6 ? 'sem_site' : 'site_proprio'); // Franca: 6/8 oportunidade
  for (let i = 0; i < 8; i++) lead(db, `r${i}`, 'Ribeirão Preto', i < 1 ? 'sem_site' : 'site_proprio'); // RP: 1/8
  const prior = priorDoRamo(db, 'barbearia');
  assert.ok(Math.abs(prior.media - 7 / 16) < 1e-9);
  const r = escolherCidades(db, { uf: 'SP', nicho: 'barbearia', k: 3, cidades: ['Franca', 'Ribeirão Preto', 'Batatais'], rng: rngSemente(1) });
  const media = Object.fromEntries(r.escolhidas.map((b) => [b.cidade, b.media]));
  assert.ok(media.Franca > media.Batatais && media.Batatais > media['Ribeirão Preto']); // nova fica no meio: a média do ramo
  assert.equal(priorDoRamo(db, 'odontologia').media, null); // ramo sem histórico: Beta(1,1)
});

test('território: lead fixo ou com site próprio não conta como oportunidade', () => {
  const db = abrirBanco(':memory:');
  lead(db, 'a', 'Franca', 'sem_site', 'fixo');
  lead(db, 'b', 'Franca', 'site_proprio', 'celular');
  const r = escolherCidades(db, { uf: 'SP', nicho: 'barbearia', cidades: ['Franca'], rng: rngSemente(2) });
  assert.deepEqual([r.escolhidas[0].auditados, r.escolhidas[0].oportunidades], [2, 0]);
});

// O teste que importa: o bandit APRENDE. 50 cidades com taxa escondida; 120 lotes de 10 empresas.
test('território: Thompson acha bem mais oportunidade que escolher cidade ao acaso', () => {
  const rng = rngSemente(42);
  const cidades = Array.from({ length: 50 }, (_, i) => `C${i}`);
  const taxa = Object.fromEntries(cidades.map((c, i) => [c, i < 5 ? 0.6 : 0.08])); // 5 cidades boas escondidas
  const jogar = (estrategia) => {
    const db = abrirBanco(':memory:');
    let achou = 0, n = 0;
    for (let lote = 0; lote < 120; lote++) {
      const c = estrategia === 'acaso' ? cidades[Math.floor(rng() * cidades.length)]
        : escolherCidades(db, { uf: 'SP', nicho: 'barbearia', cidades, rng }).escolhidas[0].cidade;
      for (let k = 0; k < 10; k++) { const ok = rng() < taxa[c]; achou += ok; lead(db, `x${n++}`, c, ok ? 'sem_site' : 'site_proprio'); }
    }
    return achou;
  };
  const ts = jogar('thompson'), acaso = jogar('acaso');
  assert.ok(ts > acaso * 2, `thompson ${ts} vs acaso ${acaso}`);
});

// Volume pela população (escala linear, arXiv 1807.02292): com a MESMA taxa, a cidade que tem empresas para encher o lote ganha.
test('território: densidade só dos dados e cidade minúscula perde para a grande', async () => {
  const { densidadeDoRamo, populacaoDe } = await import('../src/territorio.mjs');
  const db = abrirBanco(':memory:');
  assert.equal(densidadeDoRamo(db, 'barbearia'), null); // sem nenhuma busca: não inventa densidade
  const pop = populacaoDe('Franca', 'SP');
  assert.ok(pop > 300000);
  db.prepare("INSERT INTO varreduras (id, cidade, uf, nicho, fonte, limite, criado_em, pais) VALUES (1, 'Franca', 'SP', 'barbearia', 'maps', 50, ?, 'BR')").run(agora());
  db.prepare("INSERT INTO lotes (varredura_id, numero, meta, pedido, coletados, novos, status, iniciado_em, fim) VALUES (1, 1, 50, 50, 50, 50, 'coletado', ?, 0)").run(agora());
  const d = densidadeDoRamo(db, 'barbearia');
  assert.ok(Math.abs(d.densidade - 50 / pop) < 1e-12);
  assert.match(d.origem, /limite inferior/);
  const r = escolherCidades(db, { uf: 'SP', nicho: 'barbearia', k: 2, cidades: ['Aspásia', 'Guarulhos'], rng: rngSemente(3) });
  assert.equal(r.escolhidas[0].cidade, 'Guarulhos');
  const asp = r.escolhidas.find((b) => b.cidade === 'Aspásia');
  assert.ok(asp.peso < 0.05, String(asp.peso)); // ~1,9 mil habitantes não enchem um lote de 50
});
