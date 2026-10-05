import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.mjs';
import { carregaObservacao, contradicoes, mensagemFallback, observacao, promptMaia, receberMensagem, salvarLead, validarMensagem } from '../src/agentes.mjs';
import { IDIOMAS, idiomaDoPais } from '../src/idiomas.mjs';
import { resolverLocal, mensagemCidade } from '../src/localidades.mjs';
import { separarPais } from '../src/comando.mjs';
import { termosDoNicho } from '../src/nichos.mjs';
import { AJUSTES_PADRAO } from '../src/config.mjs';

const lead = (extra = {}) => ({ id: 'L1', nome: 'Clínica Sol', categoria: 'Dentista', cidade: 'Lisboa', nicho: 'odontologia', situacao_site: 'sem_site', ...extra });
const ajustes = { ...AJUSTES_PADRAO, remetente_nome: 'Victor', remetente_portfolio: '' };

test('Brasil: a mensagem pronta é a de sempre (não mudou nada para quem não diz país)', () => {
  const t = mensagemFallback(lead({ pais: 'BR', cidade: 'Franca' }), ajustes, 'ser_encontrado');
  assert.match(t, /Aqui é o Victor|Meu nome é Victor|Sou o Victor/);
  assert.match(t, /Se não quiser receber mensagens, é só responder SAIR\./);
  assert.match(t, /no Google não encontra um site da Clínica Sol/);
  assert.equal(mensagemFallback(lead({ cidade: 'Franca' }), ajustes, 'ser_encontrado'), t); // sem `pais` = Brasil
});

test('Portugal: português de Portugal, "website", tratamento por "lhe" e saída com "basta responder SAIR"', () => {
  const t = mensagemFallback(lead({ pais: 'PT' }), ajustes, 'ser_encontrado');
  assert.match(t, /Chamo-me Victor|O meu nome é Victor|Sou o Victor/);
  assert.match(t, /website da Clínica Sol/);
  assert.match(t, /Se não pretender receber mensagens, basta responder SAIR\./);
  assert.doesNotMatch(t, /\bsite da\b/);
  assert.doesNotMatch(t, /Posso te mostrar|te mandar/); // "te" é do Brasil
});

test('Paraguai: espanhol com "usted", observação e linha de saída em espanhol', () => {
  const t = mensagemFallback(lead({ pais: 'PY', cidade: 'Asunción' }), ajustes, 'ser_encontrado');
  assert.match(t, /Soy Victor|Mi nombre es Victor/);
  assert.match(t, /en Asunción/);
  assert.match(t, /sitio web de Clínica Sol/);
  assert.match(t, /Si no desea recibir mensajes, solo responda SALIR\./);
  assert.match(t, /creo sitios web y landing pages modernas/);
  assert.doesNotMatch(t, /\bvocê\b|\bnão\b/);
});

test('cada ângulo tem observação nos três idiomas e o texto pronto passa na própria conferência', () => {
  for (const pais of ['BR', 'PT', 'PY']) {
    for (const ang of ['ser_encontrado', 'modernizar', 'independencia', 'reputacao', 'recuperar']) {
      const l = lead({ pais, rating: 4.6, avaliacoes: 80, auditoria: JSON.stringify({ sinais: ['sem_https'] }), situacao_site: 'so_rede_social' });
      assert.ok(observacao(l, ang).includes('Clínica Sol'), `${pais}/${ang}`);
      const t = mensagemFallback(l, ajustes, ang);
      assert.deepEqual(contradicoes(t, l, ajustes), [], `${pais}/${ang}: ${t}`);
      assert.ok(carregaObservacao(t, ang, idiomaDoPais(pais)), `${pais}/${ang} carrega a observação`);
    }
  }
});

test('o SAIR/SALIR é acrescentado na língua certa e o pedido de parar é entendido em cada idioma', () => {
  assert.match(validarMensagem('Olá', ajustes, IDIOMAS['pt-PT']).texto, /basta responder SAIR/);
  assert.match(validarMensagem('Hola', ajustes, IDIOMAS['es-PY']).texto, /responda SALIR/);
  assert.equal(validarMensagem('Hola\n\nSi no desea recibir mensajes, solo responda SALIR.', ajustes, IDIOMAS['es-PY']).texto.match(/SALIR/g).length, 1);
  assert.ok(IDIOMAS['es-PY'].sair.pedido.test('por favor no me escriban más'));
  assert.ok(IDIOMAS['es-PY'].sair.pedido.test('SALIR'));
  assert.ok(!IDIOMAS['es-PY'].sair.pedido.test('¿cuánto cuesta?'));
  assert.ok(IDIOMAS['pt-PT'].sair.pedido.test('não pretendo, obrigado'));
  assert.ok(IDIOMAS['pt-BR'].sair.pedido.test('SAIR'));
  assert.match(validarMensagem('Ya hice su sitio web', ajustes, IDIOMAS['es-PY']).problemas.join(), /promete algo/);
});

test('o prompt da Maia vem no idioma do país', () => {
  assert.match(promptMaia(lead({ pais: 'PY' }), ajustes, 'ser_encontrado').sistema, /español de Paraguay.*usted/s);
  assert.match(promptMaia(lead({ pais: 'PT' }), ajustes, 'ser_encontrado').sistema, /português de Portugal/);
  assert.match(promptMaia(lead(), ajustes, 'ser_encontrado').sistema, /português do Brasil/);
});

test('a oferta de cada idioma pode ser trocada em ajustes.ofertas', () => {
  const t = mensagemFallback(lead({ pais: 'PY' }), { ...ajustes, ofertas: { 'es-PY': 'hago páginas web para comercios' } }, 'ser_encontrado');
  assert.match(t, /hago páginas web para comercios/);
});

test('o telefone do lead é normalizado pelas regras do país da busca', () => {
  const db = abrirBanco(':memory:');
  db.prepare("INSERT INTO varreduras (cidade, uf, nicho, fonte, limite, criado_em, pais) VALUES ('Lisboa', 'LIS', 'odontologia', 'maps', 50, 't', 'PT'), ('Asunción', 'ASU', 'odontologia', 'maps', 50, 't', 'PY'), ('Franca', 'SP', 'odontologia', 'maps', 50, 't', 'BR')").run();
  const v = (id, pais, cidade, uf) => ({ id, pais, cidade, uf, nicho: 'odontologia', fonte: 'maps' });
  salvarLead(db, { nome: 'Clínica PT', telefone: '+351 912 345 678' }, v(1, 'PT', 'Lisboa', 'LIS'));
  salvarLead(db, { nome: 'Clínica PY', telefone: '0981 123 456' }, v(2, 'PY', 'Asunción', 'ASU'));
  salvarLead(db, { nome: 'Clínica BR', telefone: '(16) 99385-0531' }, v(3, 'BR', 'Franca', 'SP'));
  salvarLead(db, { nome: 'Clínica PT com número do Brasil', telefone: '(16) 99385-0531' }, v(1, 'PT', 'Lisboa', 'LIS'));
  const por = Object.fromEntries(db.prepare('SELECT nome, telefone, pais FROM leads').all().map((r) => [r.nome, r]));
  assert.deepEqual([por['Clínica PT'].telefone, por['Clínica PT'].pais], ['351912345678', 'PT']);
  assert.deepEqual([por['Clínica PY'].telefone, por['Clínica PY'].pais], ['595981123456', 'PY']);
  assert.deepEqual([por['Clínica BR'].telefone, por['Clínica BR'].pais], ['5516993850531', 'BR']);
  assert.equal(por['Clínica PT com número do Brasil'].telefone, null);
});

test('resposta de um lead no Paraguai que pede "no me escriban" vira não contatar', () => {
  const db = abrirBanco(':memory:');
  db.prepare("INSERT INTO leads (id, nome, fonte, etapa, telefone, pais, criado_em, atualizado_em) VALUES ('P1', 'Dentista PY', 'maps', 'enviado', '595981123456', 'PY', 't', 't')").run();
  receberMensagem(db, { telefone: '595981123456', texto: 'Por favor no me escriban más', deMim: false, waId: 'W1' });
  assert.equal(db.prepare("SELECT etapa FROM leads WHERE id = 'P1'").get().etapa, 'nao_contatar');
});

test('cidade sem país: acha o país sozinha e pede o país quando existe em dois', () => {
  const lisboa = resolverLocal('Lisboa');
  assert.deepEqual([lisboa.cidade, lisboa.uf, lisboa.pais], ['Lisboa', 'LIS', 'PT']);
  assert.equal(resolverLocal('Ciudad del Este').pais, 'PY');
  assert.equal(resolverLocal('Ribeirão Preot').pais, 'BR');
  const porto = resolverLocal('Porto');
  assert.equal(porto.ok, false);
  assert.equal(porto.motivo, 'pais_ambiguo');
  assert.match(mensagemCidade('Porto', null, porto), /mais de um país.*Portugal/);
  assert.equal(resolverLocal('Porto', { pais: 'PT' }).uf, 'POR');
  assert.equal(resolverLocal('Funchal', { uf: 'MAD' }).pais, 'PT');
});

test('comando: o país dito junto da cidade vira país', () => {
  assert.deepEqual(separarPais('Lisboa Portugal'), { cidade: 'Lisboa', pais: 'PT' });
  assert.deepEqual(separarPais('Ciudad Del Este No Paraguai'), { cidade: 'Ciudad Del Este', pais: 'PY' });
  assert.deepEqual(separarPais('Franca'), { cidade: 'Franca', pais: null });
});

test('termos de busca no idioma do país, com volta para os do Brasil quando não há tradução', () => {
  assert.deepEqual(termosDoNicho('academia', 'pt-BR').slice(0, 1), ['academia']);
  assert.equal(termosDoNicho('academia', 'pt-PT')[0], 'ginásio');
  assert.equal(termosDoNicho('academia', 'es-PY')[0], 'gimnasio');
  assert.equal(termosDoNicho('barbearia', 'pt-PT')[0], 'barbearia'); // sem tradução própria: usa o do Brasil
});
